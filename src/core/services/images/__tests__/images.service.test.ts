/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { getActiveImageService } from '../images.service';
import { localImageService } from '../localImage.service';
import { cloudinaryImageService } from '../cloudinaryImage.service';
import type { Manifest } from '@/core/types';

// Mock the image services
jest.mock('../localImage.service', () => ({
  localImageService: {
    id: 'local',
    name: 'Store in Site Bundle',
    upload: jest.fn(),
    getDisplayUrl: jest.fn(),
    getExportableAssets: jest.fn()
  }
}));

jest.mock('../cloudinaryImage.service', () => ({
  cloudinaryImageService: {
    id: 'cloudinary',
    name: 'Cloudinary CDN',
    upload: jest.fn(),
    getDisplayUrl: jest.fn(),
    getExportableAssets: jest.fn()
  }
}));

describe('images.service', () => {
  // Helper function to create test manifests
  const createManifest = (imageService?: 'local' | 'cloudinary'): Manifest => ({
    siteId: 'test-site',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'Test Site Description',
    theme: { name: 'default', config: {} },
    structure: [],
    settings: imageService ? { imageService } : undefined
  });

  describe('getActiveImageService', () => {
    test('returns local service when no image service is configured', () => {
      const manifest = createManifest();
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('returns local service when explicitly configured', () => {
      const manifest = createManifest('local');
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('returns cloudinary service when configured', () => {
      const manifest = createManifest('cloudinary');
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(cloudinaryImageService);
      expect(result.id).toBe('cloudinary');
    });

    test('falls back to local service for invalid service ID', () => {
      const manifest: Manifest = {
        siteId: 'test-site',
        generatorVersion: '1.0.0',
        title: 'Test Site',
        description: 'Test Site Description',
        theme: { name: 'default', config: {} },
        structure: [],
        settings: {
          imageService: 'invalid-service' as any
        }
      };
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('handles manifest without settings object', () => {
      const manifest: Manifest = {
        siteId: 'test-site',
        generatorVersion: '1.0.0',
        title: 'Test Site',
        description: 'Test Site Description',
        theme: { name: 'default', config: {} },
        structure: []
        // No settings property
      };
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('handles empty settings object', () => {
      const manifest: Manifest = {
        siteId: 'test-site',
        generatorVersion: '1.0.0',
        title: 'Test Site',
        description: 'Test Site Description',
        theme: { name: 'default', config: {} },
        structure: [],
        settings: {}
      };
      
      const result = getActiveImageService(manifest);
      
      expect(result).toBe(localImageService);
      expect(result.id).toBe('local');
    });

    test('preserves service properties and methods', () => {
      const localResult = getActiveImageService(createManifest('local'));
      const cloudinaryResult = getActiveImageService(createManifest('cloudinary'));
      
      // Verify local service properties
      expect(localResult.id).toBe('local');
      expect(localResult.name).toBe('Store in Site Bundle');
      expect(typeof localResult.upload).toBe('function');
      expect(typeof localResult.getDisplayUrl).toBe('function');
      expect(typeof localResult.getExportableAssets).toBe('function');
      
      // Verify cloudinary service properties
      expect(cloudinaryResult.id).toBe('cloudinary');
      expect(cloudinaryResult.name).toBe('Cloudinary CDN');
      expect(typeof cloudinaryResult.upload).toBe('function');
      expect(typeof cloudinaryResult.getDisplayUrl).toBe('function');
      expect(typeof cloudinaryResult.getExportableAssets).toBe('function');
    });

    test('returns consistent references for same service type', () => {
      const manifest1 = createManifest('local');
      const manifest2 = createManifest('local');
      
      const service1 = getActiveImageService(manifest1);
      const service2 = getActiveImageService(manifest2);
      
      expect(service1).toBe(service2);
      expect(service1 === service2).toBe(true);
    });

    test('handles different manifest structures', () => {
      const testCases = [
        // Minimal manifest
        {
          siteId: 'minimal',
          generatorVersion: '1.0.0',
          title: 'Minimal',
          description: 'Minimal',
          theme: { name: 'default', config: {} },
          structure: []
        },
        // Rich manifest with other settings
        {
          siteId: 'rich',
          generatorVersion: '1.0.0',
          title: 'Rich',
          description: 'Rich',
          author: 'Test Author',
          baseUrl: 'https://test.com',
          theme: { name: 'custom', config: { color: 'blue' } },
          structure: [],
          settings: {
            imageService: 'cloudinary' as const,
            cloudinary: { cloudName: 'test-cloud' },
            otherSetting: 'value'
          }
        }
      ];

      for (const manifest of testCases) {
        const result = getActiveImageService(manifest as Manifest);
        expect(result).toBeDefined();
        expect(typeof result.id).toBe('string');
        expect(['local', 'cloudinary']).toContain(result.id);
      }
    });

    test('maintains service registry integrity', () => {
      // Test that services are properly registered and accessible
      const localManifest = createManifest('local');
      const cloudinaryManifest = createManifest('cloudinary');
      
      const localService = getActiveImageService(localManifest);
      const cloudinaryService = getActiveImageService(cloudinaryManifest);
      
      expect(localService).not.toBe(cloudinaryService);
      expect(localService.id).not.toBe(cloudinaryService.id);
    });
  });

  describe('Service Integration', () => {
    test('returned services maintain their interface contracts', () => {
      const manifest = createManifest('local');
      const service = getActiveImageService(manifest);
      
      // Verify the service implements the ImageService interface
      expect(service).toHaveProperty('id');
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('upload');
      expect(service).toHaveProperty('getDisplayUrl');
      expect(service).toHaveProperty('getExportableAssets');
      
      expect(typeof service.id).toBe('string');
      expect(typeof service.name).toBe('string');
      expect(typeof service.upload).toBe('function');
      expect(typeof service.getDisplayUrl).toBe('function');
      expect(typeof service.getExportableAssets).toBe('function');
    });

    test('service switching works correctly', () => {
      const localManifest = createManifest('local');
      const cloudinaryManifest = createManifest('cloudinary');
      
      let activeService = getActiveImageService(localManifest);
      expect(activeService.id).toBe('local');
      
      activeService = getActiveImageService(cloudinaryManifest);
      expect(activeService.id).toBe('cloudinary');
      
      // Switch back
      activeService = getActiveImageService(localManifest);
      expect(activeService.id).toBe('local');
    });

    test('handles rapid service switching', () => {
      const manifests = [
        createManifest('local'),
        createManifest('cloudinary'),
        createManifest('local'),
        createManifest('cloudinary'),
        createManifest()
      ];
      
      const expectedServices = ['local', 'cloudinary', 'local', 'cloudinary', 'local'];
      
      for (let i = 0; i < manifests.length; i++) {
        const service = getActiveImageService(manifests[i]);
        expect(service.id).toBe(expectedServices[i]);
      }
    });
  });

  describe('Edge Cases', () => {
    test('handles null/undefined service configuration gracefully', () => {
      const manifest: Manifest = {
        siteId: 'test',
        generatorVersion: '1.0.0',
        title: 'Test',
        description: 'Test',
        theme: { name: 'default', config: {} },
        structure: [],
        settings: {
          imageService: null as any
        }
      };
      
      const result = getActiveImageService(manifest);
      expect(result).toBe(localImageService);
    });

    test('handles manifest with complex settings structure', () => {
      const manifest: Manifest = {
        siteId: 'complex',
        generatorVersion: '1.0.0',
        title: 'Complex',
        description: 'Complex',
        theme: { name: 'default', config: {} },
        structure: [],
        settings: {
          imageService: 'cloudinary',
          cloudinary: {
            cloudName: 'test-cloud'
          },
          nestedSettings: {
            imageService: 'local' // This should be ignored
          }
        }
      };
      
      const result = getActiveImageService(manifest);
      expect(result.id).toBe('cloudinary');
    });

    test('maintains performance with repeated calls', () => {
      const manifest = createManifest('local');
      
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        getActiveImageService(manifest);
      }
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // Should be very fast
    });
  });
});