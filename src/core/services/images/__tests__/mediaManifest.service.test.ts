// src/core/services/images/__tests__/mediaManifest.service.test.ts

import {
  generateMediaManifest,
  validateMediaManifest,
  importMediaManifest,
  estimateManifestStorageSize,
  type GenerateMediaManifestOptions,
  type ImportMediaManifestOptions,
} from '../mediaManifest.service';

import { createEmptyRegistry } from '../imageRegistry.service';
import type { LocalSiteData, MediaManifest } from '@/core/types';

// Mock dependencies
jest.mock('../imageRegistry.service');
jest.mock('../registryMigration.service');

const mockGetImageRegistry = jest.fn();
const mockSaveImageRegistry = jest.fn();
const mockEnsureImageRegistry = jest.fn();

require('../imageRegistry.service').getImageRegistry = mockGetImageRegistry;
require('../imageRegistry.service').saveImageRegistry = mockSaveImageRegistry;
require('../registryMigration.service').ensureImageRegistry = mockEnsureImageRegistry;

describe('Media Manifest Service', () => {
  // Test data helpers
  const createMockSiteData = (siteId: string): LocalSiteData => ({
    siteId,
    manifest: {
      siteId,
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test site description',
      theme: {
        name: 'default',
        config: {},
      },
      structure: [],
      settings: {
        imageService: 'local',
      },
    },
    contentFiles: [
      {
        path: 'content/blog/post1.md',
        slug: 'blog/post1',
        frontmatter: { title: 'Post 1', layout: 'post' },
        content: 'Content with ![image](assets/originals/photo1.jpg)',
      },
    ],
  });

  const createMockRegistry = (siteId: string) => {
    const registry = createEmptyRegistry(siteId);
    registry.images = {
      'assets/originals/photo1.jpg': {
        originalPath: 'assets/originals/photo1.jpg',
        derivativePaths: ['assets/derivatives/photo1_w300.jpg'],
        referencedIn: ['content/blog/post1.md'],
        lastAccessed: Date.now(),
        sizeBytes: 245760,
        width: 1920,
        height: 1080,
        alt: 'Beautiful photo',
        createdAt: Date.now(),
      },
      'assets/originals/photo2.jpg': {
        originalPath: 'assets/originals/photo2.jpg',
        derivativePaths: [],
        referencedIn: ['content/blog/post2.md'],
        lastAccessed: Date.now(),
        sizeBytes: 180000,
        width: 1600,
        height: 900,
        alt: 'Another photo',
        createdAt: Date.now(),
      },
      'assets/originals/unused.jpg': {
        originalPath: 'assets/originals/unused.jpg',
        derivativePaths: [],
        referencedIn: [], // Orphaned image
        lastAccessed: Date.now(),
        sizeBytes: 100000,
        createdAt: Date.now(),
      },
    };
    return registry;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureImageRegistry.mockResolvedValue(undefined);
    mockSaveImageRegistry.mockResolvedValue(undefined);
  });

  describe('generateMediaManifest', () => {
    test('generates manifest with only referenced images by default', async () => {
      const siteData = createMockSiteData('test-site');
      const registry = createMockRegistry('test-site');
      mockGetImageRegistry.mockResolvedValue(registry);

      const manifest = await generateMediaManifest(siteData);

      expect(manifest).toMatchObject({
        version: 1,
        imageService: 'local',
        images: expect.any(Object),
      });

      // Should include referenced images
      expect(manifest.images['assets/originals/photo1.jpg']).toBeDefined();
      expect(manifest.images['assets/originals/photo2.jpg']).toBeDefined();

      // Should exclude orphaned images
      expect(manifest.images['assets/originals/unused.jpg']).toBeUndefined();
    });

    test('includes orphaned images when requested', async () => {
      const siteData = createMockSiteData('test-site');
      const registry = createMockRegistry('test-site');
      mockGetImageRegistry.mockResolvedValue(registry);

      const options: GenerateMediaManifestOptions = {
        includeOrphaned: true,
      };

      const manifest = await generateMediaManifest(siteData, options);

      // Should include all images including orphaned ones
      expect(manifest.images['assets/originals/photo1.jpg']).toBeDefined();
      expect(manifest.images['assets/originals/photo2.jpg']).toBeDefined();
      expect(manifest.images['assets/originals/unused.jpg']).toBeDefined();

      expect(Object.keys(manifest.images)).toHaveLength(3);
    });

    test('properly formats image metadata for export', async () => {
      const siteData = createMockSiteData('test-site');
      const registry = createMockRegistry('test-site');
      mockGetImageRegistry.mockResolvedValue(registry);

      const manifest = await generateMediaManifest(siteData);

      const imageEntry = manifest.images['assets/originals/photo1.jpg'];
      expect(imageEntry).toEqual({
        referencedIn: ['content/blog/post1.md'],
        metadata: {
          sizeBytes: 245760,
          width: 1920,
          height: 1080,
          alt: 'Beautiful photo',
        },
      });
    });

    test('handles missing optional metadata gracefully', async () => {
      const siteData = createMockSiteData('test-site');
      const registry = createMockRegistry('test-site');

      // Remove optional metadata from one image
      delete registry.images['assets/originals/photo2.jpg'].width;
      delete registry.images['assets/originals/photo2.jpg'].height;
      delete registry.images['assets/originals/photo2.jpg'].alt;

      mockGetImageRegistry.mockResolvedValue(registry);

      const manifest = await generateMediaManifest(siteData);

      const imageEntry = manifest.images['assets/originals/photo2.jpg'];
      expect(imageEntry.metadata).toEqual({
        sizeBytes: 180000,
        // width, height, alt should be omitted
      });
    });

    test('throws error when registry access fails', async () => {
      const siteData = createMockSiteData('test-site');
      mockGetImageRegistry.mockRejectedValue(new Error('Registry error'));

      await expect(generateMediaManifest(siteData)).rejects.toThrow(
        'Failed to generate media manifest'
      );
    });
  });

  describe('validateMediaManifest', () => {
    const createValidManifest = (): MediaManifest => ({
      version: 1,
      imageService: 'local',
      images: {
        'assets/originals/photo.jpg': {
          referencedIn: ['content/post.md'],
          metadata: {
            sizeBytes: 100000,
            width: 1920,
            height: 1080,
            alt: 'Test photo',
          },
        },
      },
    });

    test('validates correct manifest format', () => {
      const manifest = createValidManifest();
      const validation = validateMediaManifest(manifest);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.stats.totalImages).toBe(1);
      expect(validation.stats.serviceType).toBe('local');
    });

    test('rejects invalid root structure', () => {
      const validation = validateMediaManifest('invalid');

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Media manifest must be a valid JSON object'
      );
    });

    test('rejects missing required fields', () => {
      const invalidManifest = {
        // missing version and imageService
        images: {},
      };

      const validation = validateMediaManifest(invalidManifest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Media manifest must have a numeric version field'
      );
      expect(validation.errors).toContain(
        'Media manifest must have a string imageService field'
      );
    });

    test('warns about unknown version', () => {
      const manifest = createValidManifest();
      manifest.version = 999;

      const validation = validateMediaManifest(manifest);

      expect(validation.warnings).toContain(
        'Unknown manifest version 999, expected 1'
      );
    });

    test('validates image entries', () => {
      const manifest = createValidManifest();
      // Add invalid image entry
      (manifest.images as any)['invalid/path/../hack'] = {
        referencedIn: 'not-an-array', // Should be array
        metadata: {
          sizeBytes: -100, // Should be positive
        },
      };

      const validation = validateMediaManifest(manifest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid image path format'))).toBe(true);
      expect(validation.errors.some(e => e.includes('must be array'))).toBe(true);
      expect(validation.errors.some(e => e.includes('must be positive number'))).toBe(true);
    });

    test('calculates accurate statistics', () => {
      const manifest = createValidManifest();
      manifest.images['assets/originals/photo2.jpg'] = {
        referencedIn: ['content/post1.md', 'content/post2.md'],
        metadata: {
          sizeBytes: 200000,
          width: 800,
          height: 600,
        },
      };

      const validation = validateMediaManifest(manifest);

      expect(validation.stats).toEqual({
        totalImages: 2,
        totalReferences: 3, // 1 + 2 references
        estimatedSize: 300000, // 100000 + 200000
        serviceType: 'local',
      });
    });
  });

  describe('importMediaManifest', () => {
    test('successfully imports valid manifest', async () => {
      const manifest: MediaManifest = {
        version: 1,
        imageService: 'local',
        images: {
          'assets/originals/photo.jpg': {
            referencedIn: ['content/post.md'],
            metadata: {
              sizeBytes: 100000,
              width: 1920,
              height: 1080,
              alt: 'Test photo',
            },
          },
        },
      };

      const registry = createEmptyRegistry('target-site');
      mockGetImageRegistry.mockResolvedValue(registry);

      const result = await importMediaManifest(manifest, 'target-site');

      expect(result.success).toBe(true);
      expect(result.imagesImported).toBe(1);
      expect(result.referencesProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);

      expect(mockSaveImageRegistry).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'target-site',
          images: expect.objectContaining({
            'assets/originals/photo.jpg': expect.objectContaining({
              originalPath: 'assets/originals/photo.jpg',
              referencedIn: ['content/post.md'],
              sizeBytes: 100000,
              width: 1920,
              height: 1080,
              alt: 'Test photo',
              derivativePaths: [], // Should be empty initially
            }),
          }),
        })
      );
    });

    test('handles service migration', async () => {
      const manifest: MediaManifest = {
        version: 1,
        imageService: 'cloudinary',
        images: {
          'assets/originals/photo.jpg': {
            referencedIn: ['content/post.md'],
            metadata: { sizeBytes: 100000 },
          },
        },
      };

      const registry = createEmptyRegistry('target-site');
      mockGetImageRegistry.mockResolvedValue(registry);

      const options: ImportMediaManifestOptions = {
        migrateToService: 'local',
      };

      const result = await importMediaManifest(manifest, 'target-site', options);

      expect(result.success).toBe(true);
      expect(result.finalImageService).toBe('local');
      expect(result.warnings.some(w => w.includes('Migrating from cloudinary to local'))).toBe(true);
    });

    test('rejects invalid manifest', async () => {
      const invalidManifest = {
        version: 'invalid',
        images: {},
      } as any;

      const result = await importMediaManifest(invalidManifest, 'target-site');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.imagesImported).toBe(0);
    });

    test('preserves existing registry when requested', async () => {
      const manifest: MediaManifest = {
        version: 1,
        imageService: 'local',
        images: {
          'assets/originals/new-photo.jpg': {
            referencedIn: ['content/new-post.md'],
            metadata: { sizeBytes: 50000 },
          },
        },
      };

      const existingRegistry = createMockRegistry('target-site');
      mockGetImageRegistry.mockResolvedValue(existingRegistry);

      const options: ImportMediaManifestOptions = {
        preserveExisting: true,
      };

      const result = await importMediaManifest(manifest, 'target-site', options);

      expect(result.success).toBe(true);
      expect(result.imagesImported).toBe(1);

      // Should have called save with both existing and new images
      expect(mockSaveImageRegistry).toHaveBeenCalledWith(
        expect.objectContaining({
          images: expect.objectContaining({
            // Existing images should still be there
            'assets/originals/photo1.jpg': expect.anything(),
            'assets/originals/photo2.jpg': expect.anything(),
            'assets/originals/unused.jpg': expect.anything(),
            // New image should be added
            'assets/originals/new-photo.jpg': expect.anything(),
          }),
        })
      );
    });
  });

  describe('estimateManifestStorageSize', () => {
    test('calculates storage statistics correctly', () => {
      const manifest: MediaManifest = {
        version: 1,
        imageService: 'local',
        images: {
          'assets/originals/small.jpg': {
            referencedIn: [],
            metadata: { sizeBytes: 50000 },
          },
          'assets/originals/medium.jpg': {
            referencedIn: [],
            metadata: { sizeBytes: 100000 },
          },
          'assets/originals/large.jpg': {
            referencedIn: [],
            metadata: { sizeBytes: 300000 },
          },
        },
      };

      const stats = estimateManifestStorageSize(manifest);

      expect(stats).toEqual({
        totalBytes: 450000, // 50000 + 100000 + 300000
        averageImageSize: 150000, // 450000 / 3
        largestImage: 300000,
        imageCount: 3,
      });
    });

    test('handles empty manifest', () => {
      const manifest: MediaManifest = {
        version: 1,
        imageService: 'local',
        images: {},
      };

      const stats = estimateManifestStorageSize(manifest);

      expect(stats).toEqual({
        totalBytes: 0,
        averageImageSize: 0,
        largestImage: 0,
        imageCount: 0,
      });
    });
  });
});