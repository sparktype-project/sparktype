/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { 
  cleanupOrphanedImages, 
  previewCleanup, 
  getImageUsageStats
} from '../imageCleanup.service';
// CleanupResult type is imported when needed via function return types
import type { LocalSiteData, ImageRef, Manifest, ParsedMarkdownFile } from '@/core/types';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import * as derivativeCache from '../derivativeCache.service';

// Mock dependencies
jest.mock('@/core/services/localFileSystem.service');
jest.mock('../derivativeCache.service');

const mockLocalSiteFs = localSiteFs as jest.Mocked<typeof localSiteFs>;
const mockDerivativeCache = derivativeCache as jest.Mocked<typeof derivativeCache>;

describe('imageCleanup.service', () => {
  // Helper functions for creating test data
  const createMockBlob = (content: string, type = 'image/jpeg'): Blob => {
    return new Blob([content], { type });
  };

  const createMockSiteData = (): LocalSiteData => ({
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test Site Description',
      theme: { name: 'default', config: {} },
      structure: [],
      settings: { imageService: 'local' }
    } as Manifest,
    contentFiles: []
  });

  const createMockImageRef = (src: string, alt = 'Test Image'): ImageRef => ({
    serviceId: 'local',
    src,
    alt,
    width: 800,
    height: 600
  });

  const createMockContentFile = (
    path: string, 
    content: string, 
    frontmatter: any = {}
  ): ParsedMarkdownFile => ({
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    path,
    frontmatter,
    content,
    blocks: [],
    hasBlocks: false
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllReferencedImages (internal logic)', () => {
    test('should find ImageRefs in manifest', async () => {
      const siteData = createMockSiteData();
      const logoImageRef = createMockImageRef('assets/images/logo.jpg');
      siteData.manifest.logo = logoImageRef;

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({
        'assets/images/logo.jpg': createMockBlob('logo-data'),
        'assets/images/unused.jpg': createMockBlob('unused-data')
      });

      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([]);

      const { orphanedOriginals } = await findOrphanedImages(siteData);
      
      expect(orphanedOriginals).toContain('assets/images/unused.jpg');
      expect(orphanedOriginals).not.toContain('assets/images/logo.jpg');
    });

    test('should find ImageRefs in content file frontmatter', async () => {
      const siteData = createMockSiteData();
      const heroImageRef = createMockImageRef('assets/images/hero.jpg');
      
      siteData.contentFiles = [
        createMockContentFile('content/about.md', 'About page content', {
          heroImage: heroImageRef
        })
      ];

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({
        'assets/images/hero.jpg': createMockBlob('hero-data'),
        'assets/images/orphaned.jpg': createMockBlob('orphaned-data')
      });

      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([]);

      const { orphanedOriginals } = await findOrphanedImages(siteData);
      
      expect(orphanedOriginals).toContain('assets/images/orphaned.jpg');
      expect(orphanedOriginals).not.toContain('assets/images/hero.jpg');
    });

    test('should find inline markdown image references', async () => {
      const siteData = createMockSiteData();
      
      siteData.contentFiles = [
        createMockContentFile(
          'content/blog/post.md', 
          'Here is an image: ![Description](assets/images/inline.png)\n\nAnd another: ![Alt text](assets/images/another.jpg)'
        )
      ];

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({
        'assets/images/inline.png': createMockBlob('inline-data'),
        'assets/images/another.jpg': createMockBlob('another-data'),
        'assets/images/unused.gif': createMockBlob('unused-data')
      });

      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([]);

      const { orphanedOriginals } = await findOrphanedImages(siteData);
      
      expect(orphanedOriginals).toContain('assets/images/unused.gif');
      expect(orphanedOriginals).not.toContain('assets/images/inline.png');
      expect(orphanedOriginals).not.toContain('assets/images/another.jpg');
    });

    test('should handle circular references without infinite loops', async () => {
      const siteData = createMockSiteData();
      
      // Create circular reference
      const circularObj: any = { name: 'circular' };
      circularObj.self = circularObj;
      circularObj.imageRef = createMockImageRef('assets/images/circular.jpg');
      
      (siteData.manifest as any).circularData = circularObj;

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({
        'assets/images/circular.jpg': createMockBlob('circular-data'),
      });

      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([]);

      // Should not throw or hang
      const { orphanedOriginals } = await findOrphanedImages(siteData);
      
      expect(orphanedOriginals).not.toContain('assets/images/circular.jpg');
    });
  });

  describe('extractSourcePathFromDerivative (internal logic)', () => {
    // Since the function is not exported, we test it indirectly through orphaned derivatives detection
    test('should correctly extract source paths from current derivative format', async () => {
      const siteData = createMockSiteData();

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({});

      // Mock derivative cache with current format
      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/photo_w300_hauto_c-scale_g-center.jpg',
        'test-site/assets/images/image_wauto_h200_c-fill_g-north.png',
        'test-site/nested/path/pic_w150_h150_c-fit_g-south.webp'
      ]);

      mockDerivativeCache.getCachedDerivative.mockResolvedValue(createMockBlob('derivative-data'));

      const { orphanedDerivatives } = await findOrphanedImages(siteData);
      
      // All derivatives should be considered orphaned since no source images exist
      expect(orphanedDerivatives).toContain('assets/images/photo_w300_hauto_c-scale_g-center.jpg');
      expect(orphanedDerivatives).toContain('assets/images/image_wauto_h200_c-fill_g-north.png');
      expect(orphanedDerivatives).toContain('nested/path/pic_w150_h150_c-fit_g-south.webp');
    });

    test('should handle legacy derivative formats gracefully', async () => {
      const siteData = createMockSiteData();

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({});

      // Mock legacy format derivatives (from old tests)
      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/photo_w300.jpg', // Legacy simple format
        'test-site/assets/images/current_w300_hauto_c-scale_g-center.jpg' // Current format
      ]);

      mockDerivativeCache.getCachedDerivative.mockResolvedValue(createMockBlob('derivative-data'));

      // Should not throw errors when encountering legacy formats
      const { orphanedDerivatives } = await findOrphanedImages(siteData);
      
      expect(orphanedDerivatives).toContain('assets/images/photo_w300.jpg'); // Should be treated as orphaned
      expect(orphanedDerivatives).toContain('assets/images/current_w300_hauto_c-scale_g-center.jpg');
    });
  });

  describe('cleanupOrphanedImages', () => {
    test('should remove orphaned original images', async () => {
      const siteData = createMockSiteData();
      
      const referencedBlob = createMockBlob('referenced-data', 'image/jpeg');
      const orphanedBlob = createMockBlob('orphaned-data', 'image/png');

      // Add referenced image to manifest
      siteData.manifest.logo = createMockImageRef('assets/images/logo.jpg');

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({
        'assets/images/logo.jpg': referencedBlob,
        'assets/images/orphaned.png': orphanedBlob
      });

      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([]);

      const result = await cleanupOrphanedImages(siteData);

      expect(result.originalImagesRemoved).toBe(1);
      expect(result.derivativesRemoved).toBe(0);
      expect(result.bytesFreed).toBe(orphanedBlob.size);
      
      expect(mockLocalSiteFs.saveAllImageAssetsForSite).toHaveBeenCalledWith(
        'test-site',
        { 'assets/images/logo.jpg': referencedBlob }
      );

      expect(result.cleanupLog).toContain('[ImageCleanup] Starting cleanup for site: test-site');
      expect(result.cleanupLog).toContain('[ImageCleanup] Found 1 orphaned originals, 0 orphaned derivatives');
      expect(result.cleanupLog).toContain('[ImageCleanup] Removing orphaned original: assets/images/orphaned.png');
    });

    test('should remove orphaned derivative images', async () => {
      const siteData = createMockSiteData();
      
      const derivativeBlob = createMockBlob('derivative-data', 'image/jpeg');

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({});

      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/orphaned_w300_hauto_c-scale_g-center.jpg'
      ]);

      mockDerivativeCache.getCachedDerivative.mockResolvedValue(derivativeBlob);

      const result = await cleanupOrphanedImages(siteData);

      expect(result.originalImagesRemoved).toBe(0);
      expect(result.derivativesRemoved).toBe(1);
      expect(result.bytesFreed).toBe(derivativeBlob.size);

      expect(mockDerivativeCache.removeCachedDerivative).toHaveBeenCalledWith(
        'test-site/assets/images/orphaned_w300_hauto_c-scale_g-center.jpg'
      );

      expect(result.cleanupLog).toContain('[ImageCleanup] Removed orphaned derivative: assets/images/orphaned_w300_hauto_c-scale_g-center.jpg');
    });

    test('should continue cleanup after individual storage errors', async () => {
      const siteData = createMockSiteData();

      mockLocalSiteFs.getAllImageAssetsForSite.mockRejectedValue(new Error('IndexedDB error'));
      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/derivative_w300_hauto_c-scale_g-center.jpg'
      ]);
      mockDerivativeCache.getCachedDerivative.mockResolvedValue(createMockBlob('derivative'));

      // Should not throw despite storage error
      const result = await cleanupOrphanedImages(siteData);

      expect(result.originalImagesRemoved).toBe(0);
      expect(result.derivativesRemoved).toBe(1); // Derivative cleanup should still work
      expect(result.cleanupLog).toContain('[ImageCleanup] Error finding orphaned images: Error: IndexedDB error');
    });

    test('should handle invalid blob data gracefully', async () => {
      const siteData = createMockSiteData();

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({
        'assets/images/invalid.jpg': null as any, // Invalid blob data
        'assets/images/valid.jpg': createMockBlob('valid-data')
      });

      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([]);

      const result = await cleanupOrphanedImages(siteData);

      expect(result.originalImagesRemoved).toBe(2); // Both should be counted as removed
      expect(result.cleanupLog).toContain('[ImageCleanup] Warning: Invalid blob data for assets/images/invalid.jpg');
    });
  });

  describe('previewCleanup', () => {
    test('should calculate estimated bytes without modifying storage', async () => {
      const siteData = createMockSiteData();
      
      const orphanedOriginalBlob = createMockBlob('orphaned-original', 'image/jpeg');
      const orphanedDerivativeBlob = createMockBlob('orphaned-derivative', 'image/jpeg');
      const referencedBlob = createMockBlob('referenced', 'image/jpeg');

      siteData.manifest.logo = createMockImageRef('assets/images/logo.jpg');

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({
        'assets/images/logo.jpg': referencedBlob,
        'assets/images/orphaned.jpg': orphanedOriginalBlob
      });

      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/orphaned-derivative_w300_hauto_c-scale_g-center.jpg'
      ]);

      mockDerivativeCache.getCachedDerivative.mockResolvedValue(orphanedDerivativeBlob);

      const result = await previewCleanup(siteData);

      expect(result.orphanedOriginals).toEqual(['assets/images/orphaned.jpg']);
      expect(result.orphanedDerivatives).toEqual(['assets/images/orphaned-derivative_w300_hauto_c-scale_g-center.jpg']);
      expect(result.estimatedBytesFreed).toBe(orphanedOriginalBlob.size + orphanedDerivativeBlob.size);

      // Verify no storage modifications were made
      expect(mockLocalSiteFs.saveAllImageAssetsForSite).not.toHaveBeenCalled();
      expect(mockDerivativeCache.removeCachedDerivative).not.toHaveBeenCalled();
    });

    test('should handle storage errors gracefully and return partial results', async () => {
      const siteData = createMockSiteData();

      mockLocalSiteFs.getAllImageAssetsForSite.mockRejectedValue(new Error('Storage error'));
      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([]);

      const result = await previewCleanup(siteData);

      expect(result.orphanedOriginals).toEqual([]);
      expect(result.orphanedDerivatives).toEqual([]);
      expect(result.estimatedBytesFreed).toBe(0);
    });
  });

  describe('getImageUsageStats', () => {
    test('should return comprehensive image usage statistics', async () => {
      const siteData = createMockSiteData();
      
      const referencedBlob = createMockBlob('referenced', 'image/jpeg');
      const orphanedBlob = createMockBlob('orphaned', 'image/png');
      const derivativeBlob = createMockBlob('derivative', 'image/jpeg');

      // Add one referenced image
      siteData.manifest.logo = createMockImageRef('assets/images/logo.jpg');

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({
        'assets/images/logo.jpg': referencedBlob,
        'assets/images/orphaned.png': orphanedBlob
      });

      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/logo_w300_hauto_c-scale_g-center.jpg',
        'test-site/assets/images/orphaned_w200_hauto_c-fit_g-center.png'
      ]);

      mockDerivativeCache.getCachedDerivative.mockResolvedValue(derivativeBlob);

      const stats = await getImageUsageStats(siteData);

      expect(stats.totalOriginalImages).toBe(2);
      expect(stats.totalDerivatives).toBe(2);
      expect(stats.referencedImages).toBe(1);
      expect(stats.orphanedOriginals).toBe(1);
      expect(stats.orphanedDerivatives).toBe(1);
      expect(stats.totalStorageBytes).toBe(
        referencedBlob.size + orphanedBlob.size + (derivativeBlob.size * 2)
      );
    });

    test('should handle empty storage', async () => {
      const siteData = createMockSiteData();

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({});
      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([]);

      const stats = await getImageUsageStats(siteData);

      expect(stats.totalOriginalImages).toBe(0);
      expect(stats.totalDerivatives).toBe(0);
      expect(stats.referencedImages).toBe(0);
      expect(stats.orphanedOriginals).toBe(0);
      expect(stats.orphanedDerivatives).toBe(0);
      expect(stats.totalStorageBytes).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should handle concurrent cleanup operations', async () => {
      const siteData = createMockSiteData();

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({
        'assets/images/test.jpg': createMockBlob('test-data')
      });
      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([]);

      // Run multiple cleanup operations simultaneously
      const cleanupPromises = Array(3).fill(null).map(() => cleanupOrphanedImages(siteData));
      const results = await Promise.all(cleanupPromises);

      // All should complete successfully
      results.forEach(result => {
        expect(result.originalImagesRemoved).toBe(1);
        expect(result.cleanupLog.length).toBeGreaterThan(0);
      });
    });

    test('should provide detailed error information in logs', async () => {
      const siteData = createMockSiteData();

      mockLocalSiteFs.getAllImageAssetsForSite.mockResolvedValue({});
      mockDerivativeCache.getAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/test_w300_hauto_c-scale_g-center.jpg'
      ]);

      // Simulate derivative removal error
      mockDerivativeCache.removeCachedDerivative.mockRejectedValue(new Error('Permission denied'));

      const result = await cleanupOrphanedImages(siteData);

      expect(result.cleanupLog).toContain('[ImageCleanup] Error removing derivative assets/images/test_w300_hauto_c-scale_g-center.jpg: Error: Permission denied');
    });
  });
});

// Helper function to access internal function for testing
// This would normally be in a separate test file or the function would be exported
async function findOrphanedImages(siteData: LocalSiteData) {
  // This is a workaround to test the internal function
  // In a real scenario, you might export this function or test it through public APIs
  const previewResult = await previewCleanup(siteData);
  return {
    orphanedOriginals: previewResult.orphanedOriginals,
    orphanedDerivatives: previewResult.orphanedDerivatives
  };
}