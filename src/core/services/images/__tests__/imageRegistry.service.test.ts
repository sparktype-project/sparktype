// src/core/services/images/__tests__/imageRegistry.service.test.ts

import {
  addImageToRegistry,
  updateImageMetadata,
  addDerivativeToRegistry,
  updateImageReferences,
  removeImageFromRegistry,
  getOrphanedImages,
  getImageUsageStats,
  getImageRegistry,
  createEmptyRegistry,
  deleteImageRegistry,
  type AddImageMetadata,
} from '../imageRegistry.service';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  databases: new Map(),
};

// Mock IDBDatabase
const createMockDB = () => ({
  transaction: jest.fn((_storeName: string, _mode: string) => ({
    objectStore: jest.fn(() => ({
      get: jest.fn((key: string) => ({
        onsuccess: null,
        onerror: null,
        result: mockIndexedDB.databases.get(key),
      })),
      put: jest.fn((_value: any) => ({
        onsuccess: null,
        onerror: null,
      })),
      delete: jest.fn((_key: string) => ({
        onsuccess: null,
        onerror: null,
      })),
    })),
  })),
  objectStoreNames: { contains: jest.fn(() => false) },
  createObjectStore: jest.fn(),
});

// Mock global IndexedDB
Object.defineProperty(global, 'indexedDB', {
  value: {
    open: jest.fn(() => {
      const request = {
        onsuccess: null as any,
        onerror: null as any,
        onupgradeneeded: null as any,
        result: createMockDB(),
      };
      setTimeout(() => {
        if (request.onupgradeneeded) {
          request.onupgradeneeded({ target: request } as any);
        }
        if (request.onsuccess) {
          request.onsuccess({} as any);
        }
      }, 0);
      return request;
    }),
  },
  writable: true,
});

describe('ImageRegistry Service', () => {
  beforeEach(() => {
    mockIndexedDB.databases.clear();
    jest.clearAllMocks();
  });

  describe('Registry Creation and Management', () => {
    test('createEmptyRegistry creates valid registry structure', () => {
      const registry = createEmptyRegistry('test-site');

      expect(registry).toMatchObject({
        siteId: 'test-site',
        version: 1,
        lastUpdated: expect.any(Number),
        images: {},
      });
    });

    test('getImageRegistry returns empty registry for new site', async () => {
      const registry = await getImageRegistry('new-site');

      expect(registry.siteId).toBe('new-site');
      expect(registry.images).toEqual({});
    });
  });

  describe('Adding Images to Registry', () => {
    test('addImageToRegistry with complete metadata', async () => {
      const siteId = 'test-site';
      const imagePath = 'assets/originals/photo.jpg';
      const metadata: AddImageMetadata = {
        sizeBytes: 245760,
        width: 1920,
        height: 1080,
        alt: 'Beautiful sunset',
      };

      // Mock the registry storage
      mockIndexedDB.databases.set(siteId, createEmptyRegistry(siteId));

      await addImageToRegistry(siteId, imagePath, metadata);

      const registry = await getImageRegistry(siteId);
      const imageMetadata = registry.images[imagePath];

      expect(imageMetadata).toMatchObject({
        originalPath: imagePath,
        derivativePaths: [],
        referencedIn: [],
        sizeBytes: 245760,
        width: 1920,
        height: 1080,
        alt: 'Beautiful sunset',
        lastAccessed: expect.any(Number),
        createdAt: expect.any(Number),
      });
    });

    test('addImageToRegistry with legacy number format', async () => {
      const siteId = 'test-site';
      const imagePath = 'assets/originals/photo.jpg';
      const sizeBytes = 245760;

      mockIndexedDB.databases.set(siteId, createEmptyRegistry(siteId));

      await addImageToRegistry(siteId, imagePath, sizeBytes);

      const registry = await getImageRegistry(siteId);
      const imageMetadata = registry.images[imagePath];

      expect(imageMetadata).toMatchObject({
        originalPath: imagePath,
        sizeBytes: 245760,
        width: undefined,
        height: undefined,
        alt: undefined,
      });
    });

    test('addImageToRegistry with minimal metadata', async () => {
      const siteId = 'test-site';
      const imagePath = 'assets/originals/document.pdf';
      const metadata: AddImageMetadata = {
        sizeBytes: 1024000,
      };

      mockIndexedDB.databases.set(siteId, createEmptyRegistry(siteId));

      await addImageToRegistry(siteId, imagePath, metadata);

      const registry = await getImageRegistry(siteId);
      const imageMetadata = registry.images[imagePath];

      expect(imageMetadata.sizeBytes).toBe(1024000);
      expect(imageMetadata.width).toBeUndefined();
      expect(imageMetadata.height).toBeUndefined();
      expect(imageMetadata.alt).toBeUndefined();
    });
  });

  describe('Updating Image Metadata', () => {
    test('updateImageMetadata updates existing image', async () => {
      const siteId = 'test-site';
      const imagePath = 'assets/originals/photo.jpg';

      // Create registry with initial image
      const registry = createEmptyRegistry(siteId);
      registry.images[imagePath] = {
        originalPath: imagePath,
        derivativePaths: [],
        referencedIn: [],
        lastAccessed: Date.now(),
        sizeBytes: 245760,
        createdAt: Date.now(),
      };
      mockIndexedDB.databases.set(siteId, registry);

      await updateImageMetadata(siteId, imagePath, {
        alt: 'Updated alt text',
        width: 1920,
        height: 1080,
      });

      const updatedRegistry = await getImageRegistry(siteId);
      const imageMetadata = updatedRegistry.images[imagePath];

      expect(imageMetadata.alt).toBe('Updated alt text');
      expect(imageMetadata.width).toBe(1920);
      expect(imageMetadata.height).toBe(1080);
    });

    test('updateImageMetadata throws error for non-existent image', async () => {
      const siteId = 'test-site';
      const imagePath = 'assets/originals/nonexistent.jpg';

      mockIndexedDB.databases.set(siteId, createEmptyRegistry(siteId));

      await expect(
        updateImageMetadata(siteId, imagePath, { alt: 'Test' })
      ).rejects.toThrow('Image not found in registry');
    });
  });

  describe('Derivative Tracking', () => {
    test('addDerivativeToRegistry tracks derivative relationships', async () => {
      const siteId = 'test-site';
      const originalPath = 'assets/originals/photo.jpg';
      const derivativePath = 'assets/derivatives/photo_w300_hauto.jpg';

      // Create registry with original image
      const registry = createEmptyRegistry(siteId);
      registry.images[originalPath] = {
        originalPath,
        derivativePaths: [],
        referencedIn: [],
        lastAccessed: Date.now(),
        sizeBytes: 245760,
        createdAt: Date.now(),
      };
      mockIndexedDB.databases.set(siteId, registry);

      await addDerivativeToRegistry(siteId, originalPath, derivativePath);

      const updatedRegistry = await getImageRegistry(siteId);
      const imageMetadata = updatedRegistry.images[originalPath];

      expect(imageMetadata.derivativePaths).toContain(derivativePath);
    });

    test('addDerivativeToRegistry prevents duplicate derivatives', async () => {
      const siteId = 'test-site';
      const originalPath = 'assets/originals/photo.jpg';
      const derivativePath = 'assets/derivatives/photo_w300_hauto.jpg';

      // Create registry with original image and existing derivative
      const registry = createEmptyRegistry(siteId);
      registry.images[originalPath] = {
        originalPath,
        derivativePaths: [derivativePath],
        referencedIn: [],
        lastAccessed: Date.now(),
        sizeBytes: 245760,
        createdAt: Date.now(),
      };
      mockIndexedDB.databases.set(siteId, registry);

      await addDerivativeToRegistry(siteId, originalPath, derivativePath);

      const updatedRegistry = await getImageRegistry(siteId);
      const imageMetadata = updatedRegistry.images[originalPath];

      expect(imageMetadata.derivativePaths).toEqual([derivativePath]);
      expect(imageMetadata.derivativePaths.length).toBe(1);
    });
  });

  describe('Reference Tracking', () => {
    test('updateImageReferences tracks content references', async () => {
      const siteId = 'test-site';
      const contentFilePath = 'content/blog/post.md';
      const imagePaths = [
        'assets/originals/photo1.jpg',
        'assets/originals/photo2.jpg',
      ];

      // Create registry with images
      const registry = createEmptyRegistry(siteId);
      imagePaths.forEach(path => {
        registry.images[path] = {
          originalPath: path,
          derivativePaths: [],
          referencedIn: [],
          lastAccessed: Date.now(),
          sizeBytes: 100000,
          createdAt: Date.now(),
        };
      });
      mockIndexedDB.databases.set(siteId, registry);

      await updateImageReferences(siteId, contentFilePath, imagePaths);

      const updatedRegistry = await getImageRegistry(siteId);

      imagePaths.forEach(path => {
        expect(updatedRegistry.images[path].referencedIn).toContain(contentFilePath);
      });
    });

    test('updateImageReferences clears old references', async () => {
      const siteId = 'test-site';
      const contentFilePath = 'content/blog/post.md';
      const oldImagePath = 'assets/originals/old-photo.jpg';
      const newImagePath = 'assets/originals/new-photo.jpg';

      // Create registry with image that has old reference
      const registry = createEmptyRegistry(siteId);
      registry.images[oldImagePath] = {
        originalPath: oldImagePath,
        derivativePaths: [],
        referencedIn: [contentFilePath],
        lastAccessed: Date.now(),
        sizeBytes: 100000,
        createdAt: Date.now(),
      };
      registry.images[newImagePath] = {
        originalPath: newImagePath,
        derivativePaths: [],
        referencedIn: [],
        lastAccessed: Date.now(),
        sizeBytes: 100000,
        createdAt: Date.now(),
      };
      mockIndexedDB.databases.set(siteId, registry);

      // Update to reference only new image
      await updateImageReferences(siteId, contentFilePath, [newImagePath]);

      const updatedRegistry = await getImageRegistry(siteId);

      expect(updatedRegistry.images[oldImagePath].referencedIn).not.toContain(contentFilePath);
      expect(updatedRegistry.images[newImagePath].referencedIn).toContain(contentFilePath);
    });
  });

  describe('Orphaned Image Detection', () => {
    test('getOrphanedImages identifies unreferenced images', async () => {
      const siteId = 'test-site';
      const referencedPath = 'assets/originals/used.jpg';
      const orphanedPath = 'assets/originals/unused.jpg';

      // Create registry with both referenced and orphaned images
      const registry = createEmptyRegistry(siteId);
      registry.images[referencedPath] = {
        originalPath: referencedPath,
        derivativePaths: ['assets/derivatives/used_w300.jpg'],
        referencedIn: ['content/blog/post.md'],
        lastAccessed: Date.now(),
        sizeBytes: 100000,
        createdAt: Date.now(),
      };
      registry.images[orphanedPath] = {
        originalPath: orphanedPath,
        derivativePaths: ['assets/derivatives/unused_w300.jpg'],
        referencedIn: [],
        lastAccessed: Date.now(),
        sizeBytes: 200000,
        createdAt: Date.now(),
      };
      mockIndexedDB.databases.set(siteId, registry);

      const { orphanedOriginals, orphanedDerivatives } = await getOrphanedImages(siteId);

      expect(orphanedOriginals).toContain(orphanedPath);
      expect(orphanedOriginals).not.toContain(referencedPath);
      expect(orphanedDerivatives).toContain('assets/derivatives/unused_w300.jpg');
      expect(orphanedDerivatives).not.toContain('assets/derivatives/used_w300.jpg');
    });
  });

  describe('Usage Statistics', () => {
    test('getImageUsageStats provides accurate counts', async () => {
      const siteId = 'test-site';

      // Create registry with mixed usage
      const registry = createEmptyRegistry(siteId);
      registry.images['assets/originals/used1.jpg'] = {
        originalPath: 'assets/originals/used1.jpg',
        derivativePaths: ['assets/derivatives/used1_w300.jpg'],
        referencedIn: ['content/post1.md'],
        lastAccessed: Date.now(),
        sizeBytes: 100000,
        createdAt: Date.now(),
      };
      registry.images['assets/originals/used2.jpg'] = {
        originalPath: 'assets/originals/used2.jpg',
        derivativePaths: [],
        referencedIn: ['content/post2.md'],
        lastAccessed: Date.now(),
        sizeBytes: 150000,
        createdAt: Date.now(),
      };
      registry.images['assets/originals/unused.jpg'] = {
        originalPath: 'assets/originals/unused.jpg',
        derivativePaths: ['assets/derivatives/unused_w300.jpg'],
        referencedIn: [],
        lastAccessed: Date.now(),
        sizeBytes: 200000,
        createdAt: Date.now(),
      };
      mockIndexedDB.databases.set(siteId, registry);

      const stats = await getImageUsageStats(siteId);

      expect(stats.totalOriginalImages).toBe(3);
      expect(stats.totalDerivatives).toBe(2);
      expect(stats.referencedImages).toBe(2);
      expect(stats.orphanedOriginals).toBe(1);
      expect(stats.orphanedDerivatives).toBe(1);
      expect(stats.totalRegistryBytes).toBe(450000);
    });
  });

  describe('Registry Cleanup', () => {
    test('removeImageFromRegistry removes image completely', async () => {
      const siteId = 'test-site';
      const imagePath = 'assets/originals/to-remove.jpg';

      // Create registry with image
      const registry = createEmptyRegistry(siteId);
      registry.images[imagePath] = {
        originalPath: imagePath,
        derivativePaths: [],
        referencedIn: [],
        lastAccessed: Date.now(),
        sizeBytes: 100000,
        createdAt: Date.now(),
      };
      mockIndexedDB.databases.set(siteId, registry);

      await removeImageFromRegistry(siteId, imagePath);

      const updatedRegistry = await getImageRegistry(siteId);
      expect(updatedRegistry.images[imagePath]).toBeUndefined();
    });

    test('deleteImageRegistry removes entire registry', async () => {
      const siteId = 'test-site';

      // Create registry
      const registry = createEmptyRegistry(siteId);
      registry.images['test.jpg'] = {
        originalPath: 'test.jpg',
        derivativePaths: [],
        referencedIn: [],
        lastAccessed: Date.now(),
        sizeBytes: 100000,
        createdAt: Date.now(),
      };
      mockIndexedDB.databases.set(siteId, registry);

      await deleteImageRegistry(siteId);

      // Should return empty registry after deletion
      const newRegistry = await getImageRegistry(siteId);
      expect(Object.keys(newRegistry.images)).toHaveLength(0);
    });
  });
});