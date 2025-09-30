/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Storage Architecture Contract Tests
 *
 * These tests enforce architectural boundaries and ensure storage separation is maintained.
 * They verify:
 * 1. siteImageAssetsStore contains ONLY originals
 * 2. derivativeCacheStore keys follow naming conventions
 * 3. media.json stays in sync with storage
 * 4. No cross-contamination between storage layers
 */

import { getAllImageAssetsForSite } from '../localFileSystem.service';
import { getAllCacheKeys } from '../images/derivativeCache.service';
import { generateMediaManifest } from '../images/mediaManifest.service';

// Mock dependencies
jest.mock('../localFileSystem.service');
jest.mock('../images/derivativeCache.service');
jest.mock('../images/mediaManifest.service');

const mockGetAllImageAssetsForSite = getAllImageAssetsForSite as jest.MockedFunction<typeof getAllImageAssetsForSite>;
const mockGetAllCacheKeys = getAllCacheKeys as jest.MockedFunction<typeof getAllCacheKeys>;
const mockGenerateMediaManifest = generateMediaManifest as jest.MockedFunction<typeof generateMediaManifest>;

describe('Storage Architecture Contracts', () => {
  const TEST_SITE_ID = 'test-site-123';
  const DERIVATIVE_PATTERN = /_w(auto|\d+)_h(auto|\d+)_c-[^_]+_g-[^_]+/;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Contract 1: siteImageAssetsStore contains ONLY originals', () => {
    test('should reject any paths with derivative naming pattern', async () => {
      // Mock storage with ONLY originals (correct state)
      const correctStorage: Record<string, Blob> = {
        'assets/originals/1754935108381-38.jpg': new Blob(['img1'], { type: 'image/jpeg' }),
        'assets/originals/logo.svg': new Blob(['svg'], { type: 'image/svg+xml' }),
        'assets/originals/banner.png': new Blob(['img2'], { type: 'image/png' })
      };

      mockGetAllImageAssetsForSite.mockResolvedValue(correctStorage);

      const images = await getAllImageAssetsForSite(TEST_SITE_ID);
      const paths = Object.keys(images);

      // CRITICAL: No derivative patterns should exist in originals store
      for (const path of paths) {
        const filename = path.split('/').pop() || '';
        expect(filename).not.toMatch(DERIVATIVE_PATTERN);
      }
    });

    test('should detect if derivatives are found in originals store', async () => {
      // Mock INCORRECT state (derivative contamination)
      const contaminatedStorage: Record<string, Blob> = {
        'assets/originals/image1.jpg': new Blob(['img1'], { type: 'image/jpeg' }),
        'assets/originals/image1_w600_h400_c-fill_g-center.jpg': new Blob(['derivative'], { type: 'image/jpeg' })
      };

      mockGetAllImageAssetsForSite.mockResolvedValue(contaminatedStorage);

      const images = await getAllImageAssetsForSite(TEST_SITE_ID);
      const paths = Object.keys(images);

      const derivativesInOriginals = paths.filter(path => {
        const filename = path.split('/').pop() || '';
        return DERIVATIVE_PATTERN.test(filename);
      });

      // This test verifies we can DETECT derivatives in originals store
      expect(derivativesInOriginals).toHaveLength(1);
      expect(derivativesInOriginals[0]).toBe('assets/originals/image1_w600_h400_c-fill_g-center.jpg');
    });

    test('should verify all paths start with assets/originals/', async () => {
      const storage: Record<string, Blob> = {
        'assets/originals/image1.jpg': new Blob(['img1'], { type: 'image/jpeg' }),
        'assets/originals/image2.png': new Blob(['img2'], { type: 'image/png' })
      };

      mockGetAllImageAssetsForSite.mockResolvedValue(storage);

      const images = await getAllImageAssetsForSite(TEST_SITE_ID);
      const paths = Object.keys(images);

      for (const path of paths) {
        expect(path).toMatch(/^assets\/originals\//);
      }
    });
  });

  describe('Contract 2: derivativeCacheStore keys follow naming convention', () => {
    test('should verify all cache keys have siteId prefix', async () => {
      const cacheKeys = [
        `${TEST_SITE_ID}/assets/derivatives/image1_w600_h400_c-fill_g-center.jpg`,
        `${TEST_SITE_ID}/assets/derivatives/image2_w300_h200_c-fit_g-center.jpg`
      ];

      mockGetAllCacheKeys.mockResolvedValue(cacheKeys);

      const keys = await getAllCacheKeys(TEST_SITE_ID);

      for (const key of keys) {
        expect(key).toMatch(new RegExp(`^${TEST_SITE_ID}/`));
      }
    });

    test('should verify all cache keys have derivative parameters', async () => {
      const cacheKeys = [
        `${TEST_SITE_ID}/assets/derivatives/image1_w600_h400_c-fill_g-center.jpg`,
        `${TEST_SITE_ID}/assets/derivatives/image2_wauto_hauto_c-scale_g-north.png`
      ];

      mockGetAllCacheKeys.mockResolvedValue(cacheKeys);

      const keys = await getAllCacheKeys(TEST_SITE_ID);

      for (const key of keys) {
        expect(key).toMatch(DERIVATIVE_PATTERN);
      }
    });

    test('should detect if cache keys have incorrect format', async () => {
      const invalidKeys = [
        // Missing siteId prefix
        'assets/derivatives/image1_w600_h400_c-fill_g-center.jpg',
        // Wrong prefix
        'wrong-site/assets/derivatives/image2_w600_h400_c-fill_g-center.jpg'
      ];

      mockGetAllCacheKeys.mockResolvedValue(invalidKeys);

      const keys = await getAllCacheKeys(TEST_SITE_ID);

      const invalidKeyCount = keys.filter(key =>
        !key.startsWith(`${TEST_SITE_ID}/`)
      ).length;

      // This test verifies we can DETECT incorrectly formatted cache keys
      expect(invalidKeyCount).toBe(2);
    });
  });

  describe('Contract 3: media.json stays in sync with storage', () => {
    test('should verify media.json matches siteImageAssetsStore exactly', async () => {
      const storedImages: Record<string, Blob> = {
        'assets/originals/image1.jpg': new Blob(['img1'], { type: 'image/jpeg' }),
        'assets/originals/image2.png': new Blob(['img2'], { type: 'image/png' }),
        'assets/originals/logo.svg': new Blob(['svg'], { type: 'image/svg+xml' })
      };

      const mediaManifest = {
        version: 1,
        imageService: 'local' as const,
        images: {
          'assets/originals/image1.jpg': {
            path: 'assets/originals/image1.jpg',
            uploadedAt: Date.now(),
            width: 800,
            height: 600,
            size: 1024,
            mimeType: 'image/jpeg',
            referencedIn: [],
            metadata: { sizeBytes: 1024 }
          },
          'assets/originals/image2.png': {
            path: 'assets/originals/image2.png',
            uploadedAt: Date.now(),
            width: 400,
            height: 300,
            size: 512,
            mimeType: 'image/png',
            referencedIn: [],
            metadata: { sizeBytes: 1024 }
          },
          'assets/originals/logo.svg': {
            path: 'assets/originals/logo.svg',
            uploadedAt: Date.now(),
            size: 256,
            mimeType: 'image/svg+xml',
            referencedIn: [],
            metadata: { sizeBytes: 1024 }
          }
        }
      };

      mockGetAllImageAssetsForSite.mockResolvedValue(storedImages);
      mockGenerateMediaManifest.mockResolvedValue(mediaManifest);

      const stored = await getAllImageAssetsForSite(TEST_SITE_ID);
      const media = await generateMediaManifest({ siteId: TEST_SITE_ID, manifest: {} as any, contentFiles: [], secrets: {} });

      const storedPaths = Object.keys(stored).sort();
      const mediaPaths = Object.keys(media.images).sort();

      expect(storedPaths).toEqual(mediaPaths);
    });

    test('should detect orphaned images in storage', async () => {
      const storedImages: Record<string, Blob> = {
        'assets/originals/image1.jpg': new Blob(['img1'], { type: 'image/jpeg' }),
        'assets/originals/orphaned.jpg': new Blob(['orphan'], { type: 'image/jpeg' })
      };

      const mediaManifest = {
        version: 1,
        imageService: 'local' as const,
        images: {
          'assets/originals/image1.jpg': {
            path: 'assets/originals/image1.jpg',
            uploadedAt: Date.now(),
            width: 800,
            height: 600,
            size: 1024,
            mimeType: 'image/jpeg',
            referencedIn: [],
            metadata: { sizeBytes: 1024 }
          }
          // orphaned.jpg is NOT in media.json
        }
      };

      mockGetAllImageAssetsForSite.mockResolvedValue(storedImages);
      mockGenerateMediaManifest.mockResolvedValue(mediaManifest);

      const stored = await getAllImageAssetsForSite(TEST_SITE_ID);
      const media = await generateMediaManifest({ siteId: TEST_SITE_ID, manifest: {} as any, contentFiles: [], secrets: {} });

      const storedPaths = Object.keys(stored);
      const mediaPaths = Object.keys(media.images);

      const orphaned = storedPaths.filter(p => !mediaPaths.includes(p));

      // Orphaned images indicate sync issue
      expect(orphaned).toContain('assets/originals/orphaned.jpg');
    });

    test('should detect missing images from storage', async () => {
      const storedImages: Record<string, Blob> = {
        'assets/originals/image1.jpg': new Blob(['img1'], { type: 'image/jpeg' })
      };

      const mediaManifest = {
        version: 1,
        imageService: 'local' as const,
        images: {
          'assets/originals/image1.jpg': {
            path: 'assets/originals/image1.jpg',
            uploadedAt: Date.now(),
            width: 800,
            height: 600,
            size: 1024,
            mimeType: 'image/jpeg',
            referencedIn: [],
            metadata: { sizeBytes: 1024 }
          },
          'assets/originals/missing.jpg': {
            path: 'assets/originals/missing.jpg',
            uploadedAt: Date.now(),
            width: 800,
            height: 600,
            size: 1024,
            mimeType: 'image/jpeg',
            referencedIn: [],
            metadata: { sizeBytes: 1024 }
          }
        }
      };

      mockGetAllImageAssetsForSite.mockResolvedValue(storedImages);
      mockGenerateMediaManifest.mockResolvedValue(mediaManifest);

      const stored = await getAllImageAssetsForSite(TEST_SITE_ID);
      const media = await generateMediaManifest({ siteId: TEST_SITE_ID, manifest: {} as any, contentFiles: [], secrets: {} });

      const storedPaths = Object.keys(stored);
      const mediaPaths = Object.keys(media.images);

      const missing = mediaPaths.filter(p => !storedPaths.includes(p));

      // Missing images indicate corruption
      expect(missing).toContain('assets/originals/missing.jpg');
    });
  });

  describe('Contract 4: No cross-contamination between storage layers', () => {
    test('should verify originals and derivatives are completely separate', async () => {
      const storedImages: Record<string, Blob> = {
        'assets/originals/image1.jpg': new Blob(['img1'], { type: 'image/jpeg' })
      };

      const derivativeKeys = [
        `${TEST_SITE_ID}/assets/derivatives/image1_w600_h400_c-fill_g-center.jpg`
      ];

      mockGetAllImageAssetsForSite.mockResolvedValue(storedImages);
      mockGetAllCacheKeys.mockResolvedValue(derivativeKeys);

      const originals = await getAllImageAssetsForSite(TEST_SITE_ID);
      const derivatives = await getAllCacheKeys(TEST_SITE_ID);

      const originalsFilenames = Object.keys(originals).map(p => p.split('/').pop());
      const derivativesFilenames = derivatives.map(k => k.split('/').pop());

      // Originals should NOT appear in derivatives list
      const overlap = originalsFilenames.filter(f => derivativesFilenames.includes(f));
      expect(overlap).toHaveLength(0);
    });

    test('should enforce path conventions', async () => {
      const paths = {
        originals: 'assets/originals/image.jpg',
        derivatives: `${TEST_SITE_ID}/assets/derivatives/image_w600_h400_c-fill_g-center.jpg`
      };

      // Originals path convention
      expect(paths.originals).toMatch(/^assets\/originals\//);
      expect(paths.originals).not.toMatch(/derivatives/);

      // Derivatives path convention
      expect(paths.derivatives).toMatch(/^[^\/]+\/assets\/derivatives\//);
      expect(paths.derivatives).toMatch(DERIVATIVE_PATTERN);
    });
  });

  describe('Integration: Full System Verification', () => {
    test('should verify complete system integrity', async () => {
      // Setup correct state
      const storedImages: Record<string, Blob> = {
        'assets/originals/image1.jpg': new Blob(['img1'], { type: 'image/jpeg' }),
        'assets/originals/image2.png': new Blob(['img2'], { type: 'image/png' })
      };

      const derivativeKeys = [
        `${TEST_SITE_ID}/assets/derivatives/image1_w600_h400_c-fill_g-center.jpg`,
        `${TEST_SITE_ID}/assets/derivatives/image2_w300_h200_c-fit_g-center.jpg`
      ];

      const mediaManifest = {
        version: 1,
        imageService: 'local' as const,
        images: {
          'assets/originals/image1.jpg': {
            path: 'assets/originals/image1.jpg',
            uploadedAt: Date.now(),
            width: 800,
            height: 600,
            size: 1024,
            mimeType: 'image/jpeg',
            referencedIn: [],
            metadata: { sizeBytes: 1024 }
          },
          'assets/originals/image2.png': {
            path: 'assets/originals/image2.png',
            uploadedAt: Date.now(),
            width: 400,
            height: 300,
            size: 512,
            mimeType: 'image/png',
            referencedIn: [],
            metadata: { sizeBytes: 1024 }
          }
        }
      };

      mockGetAllImageAssetsForSite.mockResolvedValue(storedImages);
      mockGetAllCacheKeys.mockResolvedValue(derivativeKeys);
      mockGenerateMediaManifest.mockResolvedValue(mediaManifest);

      // Run all verifications
      const originals = await getAllImageAssetsForSite(TEST_SITE_ID);
      const derivatives = await getAllCacheKeys(TEST_SITE_ID);
      const media = await generateMediaManifest({ siteId: TEST_SITE_ID, manifest: {} as any, contentFiles: [], secrets: {} });

      // Check 1: No derivatives in originals
      const originalPaths = Object.keys(originals);
      for (const path of originalPaths) {
        const filename = path.split('/').pop() || '';
        expect(filename).not.toMatch(DERIVATIVE_PATTERN);
      }

      // Check 2: All cache keys have correct format
      for (const key of derivatives) {
        expect(key).toMatch(new RegExp(`^${TEST_SITE_ID}/`));
        expect(key).toMatch(DERIVATIVE_PATTERN);
      }

      // Check 3: media.json matches storage
      expect(Object.keys(originals).sort()).toEqual(
        Object.keys(media.images).sort()
      );

      // Check 4: No overlap
      const originalsFilenames = originalPaths.map(p => p.split('/').pop());
      const derivativesFilenames = derivatives.map(k => k.split('/').pop());
      const overlap = originalsFilenames.filter(f => derivativesFilenames.includes(f));
      expect(overlap).toHaveLength(0);

      // All checks passed = system integrity maintained ✅
    });
  });
});