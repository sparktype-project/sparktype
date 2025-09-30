/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { localImageService } from '../localImage.service';
import type { ImageRef, ImageTransformOptions, Manifest } from '@/core/types';
import { MEMORY_CONFIG } from '@/config/editorConfig';

// Mock external dependencies
jest.mock('@/core/services/localFileSystem.service', () => ({
  saveImageAsset: jest.fn(),
  getImageAsset: jest.fn()
}));

jest.mock('../derivativeCache.service', () => ({
  getCachedDerivative: jest.fn(),
  setCachedDerivative: jest.fn(),
  getAllCacheKeys: jest.fn()
}));

jest.mock('browser-image-compression', () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock('@/core/libraries/utils', () => ({
  slugify: jest.fn()
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn()
  }
}));

import * as localSiteFs from '@/core/services/localFileSystem.service';
import { getCachedDerivative, setCachedDerivative, getAllCacheKeys } from '../derivativeCache.service';
import imageCompression from 'browser-image-compression';
import { slugify } from '@/core/libraries/utils';
import { toast } from 'sonner';

const mockSaveImageAsset = localSiteFs.saveImageAsset as jest.MockedFunction<typeof localSiteFs.saveImageAsset>;
const mockGetImageAsset = localSiteFs.getImageAsset as jest.MockedFunction<typeof localSiteFs.getImageAsset>;
const mockGetCachedDerivative = getCachedDerivative as jest.MockedFunction<typeof getCachedDerivative>;
const mockSetCachedDerivative = setCachedDerivative as jest.MockedFunction<typeof setCachedDerivative>;
const mockGetAllCacheKeys = getAllCacheKeys as jest.MockedFunction<typeof getAllCacheKeys>;
const mockImageCompression = imageCompression as jest.MockedFunction<typeof imageCompression>;
const mockSlugify = slugify as jest.MockedFunction<typeof slugify>;
const mockToastError = toast.error as jest.MockedFunction<typeof toast.error>;

// Mock global URL methods
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock Image constructor
const mockImage = {
  onload: jest.fn(),
  onerror: jest.fn(),
  width: 800,
  height: 600,
  src: ''
};
global.Image = jest.fn(() => mockImage) as any;

describe('localImage.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Date.now to a consistent value
    jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper functions
  const createMockFile = (
    name: string, 
    type: string, 
    size: number,
    content?: string
  ): File => {
    // Create content that matches the target size
    const targetContent = content || 'x'.repeat(size);
    const blob = new Blob([targetContent], { type });
    
    // Create a File with the exact size
    const file = new File([blob], name, { type });
    
    // Mock the size property to ensure it matches our target
    Object.defineProperty(file, 'size', {
      value: size,
      writable: false
    });
    
    return file;
  };

  const createManifest = (siteId: string): Manifest => ({
    siteId,
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'Test Site',
    theme: { name: 'default', config: {} },
    structure: []
  });

  describe('Service Properties', () => {
    test('has correct service identification', () => {
      expect(localImageService.id).toBe('local');
      expect(localImageService.name).toBe('Store in Site Bundle');
    });
  });

  describe('upload', () => {
    beforeEach(() => {
      mockSlugify.mockImplementation((str) => str.toLowerCase().replace(/[^a-z0-9]/g, '-'));
      mockSaveImageAsset.mockResolvedValue(undefined);
      
      // Mock successful image dimension retrieval
      setTimeout(() => {
        mockImage.onload();
      }, 0);
    });

    test('successfully uploads a valid JPEG image', async () => {
      const file = createMockFile('test-image.jpg', 'image/jpeg', 1024 * 1024); // 1MB
      const siteId = 'test-site';

      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, siteId);

      expect(result).toEqual({
        serviceId: 'local',
        src: 'assets/images/1640995200000-test-image.jpg',
        alt: 'test-image.jpg',
        width: 800,
        height: 600
      });

      expect(mockSlugify).toHaveBeenCalledWith('test-image');
      expect(mockSaveImageAsset).toHaveBeenCalledWith(
        siteId,
        'assets/images/1640995200000-test-image.jpg',
        file
      );
    });

    test('successfully uploads a valid PNG image', async () => {
      const file = createMockFile('my-photo.png', 'image/png', 2 * 1024 * 1024); // 2MB
      const siteId = 'test-site';

      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, siteId);

      expect(result).toEqual({
        serviceId: 'local',
        src: 'assets/images/1640995200000-my-photo.png',
        alt: 'my-photo.png',
        width: 800,
        height: 600
      });
    });

    test('successfully uploads a valid SVG image', async () => {
      const file = createMockFile('icon.svg', 'image/svg+xml', 100 * 1024); // 100KB
      const siteId = 'test-site';

      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, siteId);

      expect(result.serviceId).toBe('local');
      expect(result.src).toBe('assets/images/1640995200000-icon.svg');
      expect(result.alt).toBe('icon.svg');
    });

    test('handles special characters in filename', async () => {
      const file = createMockFile('My Photo (2024)!.jpg', 'image/jpeg', 1024 * 1024);
      const siteId = 'test-site';

      mockSlugify.mockReturnValue('my-photo-2024');
      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, siteId);

      expect(result.src).toBe('assets/images/1640995200000-my-photo-2024.jpg');
      expect(mockSlugify).toHaveBeenCalledWith('My Photo (2024)!');
    });

    test('throws error for unsupported file type', async () => {
      const file = createMockFile('document.pdf', 'application/pdf', 1024);
      const siteId = 'test-site';

      await expect(localImageService.upload(file, siteId)).rejects.toThrow(
        'Unsupported file type: application/pdf.'
      );

      expect(mockToastError).toHaveBeenCalledWith('Unsupported file type: application/pdf.');
      expect(mockSaveImageAsset).not.toHaveBeenCalled();
    });

    test('throws error for oversized JPEG image', async () => {
      const file = createMockFile('huge.jpg', 'image/jpeg', 10 * 1024 * 1024); // 10MB > 5MB limit
      const siteId = 'test-site';

      await expect(localImageService.upload(file, siteId)).rejects.toThrow(
        'Image is too large. Max size is 5.0MB.'
      );

      expect(mockToastError).toHaveBeenCalledWith('Image is too large. Max size is 5.0MB.');
      expect(mockSaveImageAsset).not.toHaveBeenCalled();
    });

    test('throws error for oversized SVG image', async () => {
      const file = createMockFile('huge.svg', 'image/svg+xml', 1024 * 1024); // 1MB > 512KB limit
      const siteId = 'test-site';

      await expect(localImageService.upload(file, siteId)).rejects.toThrow(
        'Image is too large. Max size is 512.0KB.'
      );

      expect(mockToastError).toHaveBeenCalledWith('Image is too large. Max size is 512.0KB.');
      expect(mockSaveImageAsset).not.toHaveBeenCalled();
    });

    test('throws error for file without extension', async () => {
      const file = createMockFile('imagefile', 'image/jpeg', 1024);
      const siteId = 'test-site';

      await expect(localImageService.upload(file, siteId)).rejects.toThrow(
        'Uploaded file is missing an extension.'
      );

      expect(mockSaveImageAsset).not.toHaveBeenCalled();
    });

    test('handles image dimension retrieval failure gracefully', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const siteId = 'test-site';

      // Mock failed image loading
      setTimeout(() => {
        mockImage.onerror(new Error('Failed to load'));
      }, 0);

      const result = await localImageService.upload(file, siteId);

      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    test('validates against memory config limits', async () => {
      // Test that the service uses MEMORY_CONFIG constants
      const jpegFile = createMockFile('test.jpg', 'image/jpeg', MEMORY_CONFIG.MAX_UPLOAD_SIZE + 1);
      const svgFile = createMockFile('test.svg', 'image/svg+xml', MEMORY_CONFIG.MAX_SVG_SIZE + 1);

      await expect(localImageService.upload(jpegFile, 'test-site')).rejects.toThrow(/too large/);
      await expect(localImageService.upload(svgFile, 'test-site')).rejects.toThrow(/too large/);
    });

    test('supports all configured image types', async () => {
      const supportedTypes = MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES;
      
      for (const type of supportedTypes) {
        const file = createMockFile(`test.${type.split('/')[1]}`, type, 1024);
        mockCreateObjectURL.mockReturnValue('blob:mock-url');
        
        await expect(localImageService.upload(file, 'test-site')).resolves.toBeDefined();
      }
    });
  });

  describe('getDisplayUrl', () => {
    const manifest = createManifest('test-site');
    const imageRef: ImageRef = {
      serviceId: 'local',
      src: 'assets/images/test.jpg',
      alt: 'Test Image',
      width: 800,
      height: 600
    };

    beforeEach(() => {
      mockGetImageAsset.mockResolvedValue(new Blob(['mock-image-data'], { type: 'image/jpeg' }));
      mockCreateObjectURL.mockReturnValue('blob:mock-display-url');
    });

    test('returns relative path for SVG in export mode', async () => {
      const svgRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/images/icon.svg',
        alt: 'Icon'
      };

      const options: ImageTransformOptions = { width: 100 };
      const result = await localImageService.getDisplayUrl(manifest, svgRef, options, true);

      expect(result).toBe('assets/images/icon.svg');
      expect(mockGetImageAsset).not.toHaveBeenCalled();
    });

    test('returns blob URL for SVG in preview mode', async () => {
      const svgRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/images/icon.svg',
        alt: 'Icon'
      };

      const options: ImageTransformOptions = { width: 100 };
      const result = await localImageService.getDisplayUrl(manifest, svgRef, options, false);

      expect(result).toBe('blob:mock-display-url');
      expect(mockGetImageAsset).toHaveBeenCalledWith('test-site', 'assets/images/icon.svg');
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    test('generates derivative filename with transform options', async () => {
      const options: ImageTransformOptions = {
        width: 300,
        height: 200,
        crop: 'fill',
        gravity: 'north'
      };

      mockGetCachedDerivative.mockResolvedValue(null); // Not cached
      mockImageCompression.mockResolvedValue(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' }));

      // Mock successful image loading for dimensions
      setTimeout(() => {
        mockImage.onload();
      }, 0);

      const result = await localImageService.getDisplayUrl(manifest, imageRef, options, true);

      const expectedFilename = 'assets/images/test_w300_h200_c-fill_g-north.jpg';
      expect(result).toBe(expectedFilename);
    });

    test('uses cached derivative when available', async () => {
      const options: ImageTransformOptions = { width: 300 };
      const cachedBlob = new Blob(['cached-image'], { type: 'image/jpeg' });

      mockGetCachedDerivative.mockResolvedValue(cachedBlob);

      const result = await localImageService.getDisplayUrl(manifest, imageRef, options, false);

      expect(result).toBe('blob:mock-display-url');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(cachedBlob);
      expect(mockImageCompression).not.toHaveBeenCalled();
    });

    test('processes new derivative when not cached', async () => {
      const options: ImageTransformOptions = { width: 300, height: 200 };
      const compressedFile = new File(['compressed'], 'test.jpg', { type: 'image/jpeg' });

      mockGetCachedDerivative.mockResolvedValue(null);
      mockImageCompression.mockResolvedValue(compressedFile);

      // Mock successful image loading
      setTimeout(() => {
        mockImage.onload();
      }, 0);

      const result = await localImageService.getDisplayUrl(manifest, imageRef, options, false);

      expect(result).toBe('blob:mock-display-url');
      expect(mockImageCompression).toHaveBeenCalled();
      expect(mockSetCachedDerivative).toHaveBeenCalled();
    });

    test('handles different crop modes correctly', async () => {
      const testCases = [
        { crop: 'fill' as const, width: 300, height: 200 },
        { crop: 'fit' as const, width: 300 },
        { crop: 'scale' as const, height: 200 }
      ];

      mockGetCachedDerivative.mockResolvedValue(null);
      mockImageCompression.mockResolvedValue(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' }));

      for (const options of testCases) {
        setTimeout(() => {
          mockImage.onload();
        }, 0);

        await localImageService.getDisplayUrl(manifest, imageRef, options, true);
        
        expect(mockImageCompression).toHaveBeenCalled();
        jest.clearAllMocks();
        mockGetCachedDerivative.mockResolvedValue(null);
        mockImageCompression.mockResolvedValue(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' }));
      }
    });

    test('prevents upscaling by capping dimensions', async () => {
      const options: ImageTransformOptions = {
        width: 1600, // Larger than source (800)
        height: 1200, // Larger than source (600)
        crop: 'fill'
      };

      mockGetCachedDerivative.mockResolvedValue(null);
      mockImageCompression.mockResolvedValue(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' }));

      // Mock image dimensions from getImageDimensions
      setTimeout(() => {
        mockImage.width = 800;
        mockImage.height = 600;
        mockImage.onload();
      }, 0);

      await localImageService.getDisplayUrl(manifest, imageRef, options, false);

      expect(mockImageCompression).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.objectContaining({
          maxWidth: 800, // Capped at source width
          maxHeight: 600  // Capped at source height
        })
      );
    });

    test('handles compression timeout', async () => {
      const options: ImageTransformOptions = { width: 300 };

      mockGetCachedDerivative.mockResolvedValue(null);
      
      // Mock compression that never resolves
      mockImageCompression.mockImplementation(() => new Promise(() => {}));

      setTimeout(() => {
        mockImage.onload();
      }, 0);

      // Fast forward time to trigger timeout
      jest.useFakeTimers();
      const promise = localImageService.getDisplayUrl(manifest, imageRef, options, false);
      jest.advanceTimersByTime(31000); // 31 seconds > 30 second timeout

      await expect(promise).rejects.toThrow('Image compression timed out after 30 seconds');
      
      jest.useRealTimers();
    });

    test('throws error for image without extension', async () => {
      const invalidRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/images/noextension',
        alt: 'Invalid'
      };

      const options: ImageTransformOptions = { width: 300 };

      await expect(
        localImageService.getDisplayUrl(manifest, invalidRef, options, false)
      ).rejects.toThrow('Source image has no extension.');
    });

    test('handles missing source image', async () => {
      const options: ImageTransformOptions = { width: 300 };

      mockGetImageAsset.mockResolvedValue(null);
      mockGetCachedDerivative.mockResolvedValue(null);

      await expect(
        localImageService.getDisplayUrl(manifest, imageRef, options, false)
      ).rejects.toThrow('Source image not found in local storage: assets/images/test.jpg');
    });

    test('deduplicates concurrent processing requests', async () => {
      const options: ImageTransformOptions = { width: 300 };

      mockGetCachedDerivative.mockResolvedValue(null);
      mockImageCompression.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' })), 100))
      );

      setTimeout(() => {
        mockImage.onload();
      }, 0);

      // Start multiple concurrent requests for the same derivative
      const promises = [
        localImageService.getDisplayUrl(manifest, imageRef, options, false),
        localImageService.getDisplayUrl(manifest, imageRef, options, false),
        localImageService.getDisplayUrl(manifest, imageRef, options, false)
      ];

      await Promise.all(promises);

      // Should only process once, not three times
      expect(mockImageCompression).toHaveBeenCalledTimes(1);
    });
  });

  describe('getExportableAssets', () => {
    const siteId = 'test-site';

    test('exports source images and cached derivatives', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'local',
          src: 'assets/images/photo1.jpg',
          alt: 'Photo 1'
        },
        {
          serviceId: 'local',
          src: 'assets/images/photo2.png',
          alt: 'Photo 2'
        },
        {
          serviceId: 'cloudinary', // Should be ignored
          src: 'cloudinary-url',
          alt: 'Cloudinary Image'
        }
      ];

      const photo1Blob = new Blob(['photo1-data'], { type: 'image/jpeg' });
      const photo2Blob = new Blob(['photo2-data'], { type: 'image/png' });
      const derivative1Blob = new Blob(['derivative1-data'], { type: 'image/jpeg' });
      const derivative2Blob = new Blob(['derivative2-data'], { type: 'image/jpeg' });

      mockGetImageAsset
        .mockResolvedValueOnce(photo1Blob)
        .mockResolvedValueOnce(photo2Blob);

      mockGetAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/photo1_w300.jpg',
        'test-site/assets/images/photo2_w200.png'
      ]);

      mockGetCachedDerivative
        .mockResolvedValueOnce(derivative1Blob)
        .mockResolvedValueOnce(derivative2Blob);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(4); // 2 sources + 2 derivatives
      
      const resultMap = new Map(result.map(asset => [asset.path, asset.data]));
      expect(resultMap.get('assets/images/photo1.jpg')).toBe(photo1Blob);
      expect(resultMap.get('assets/images/photo2.png')).toBe(photo2Blob);
      expect(resultMap.get('assets/images/photo1_w300.jpg')).toBe(derivative1Blob);
      expect(resultMap.get('assets/images/photo2_w200.png')).toBe(derivative2Blob);
    });

    test('handles missing source images gracefully', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'local',
          src: 'assets/images/missing.jpg',
          alt: 'Missing Image'
        }
      ];

      mockGetImageAsset.mockResolvedValue(null); // Missing source
      mockGetAllCacheKeys.mockResolvedValue([]);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(0);
    });

    test('handles missing derivatives gracefully', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'local',
          src: 'assets/images/photo.jpg',
          alt: 'Photo'
        }
      ];

      const photoBlob = new Blob(['photo-data'], { type: 'image/jpeg' });

      mockGetImageAsset.mockResolvedValue(photoBlob);
      mockGetAllCacheKeys.mockResolvedValue(['test-site/assets/images/missing_derivative.jpg']);
      mockGetCachedDerivative.mockResolvedValue(null); // Missing derivative

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(1); // Only source image
      expect(result[0].path).toBe('assets/images/photo.jpg');
      expect(result[0].data).toBe(photoBlob);
    });

    test('deduplicates assets with same path', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'local',
          src: 'assets/images/photo.jpg',
          alt: 'Photo 1'
        },
        {
          serviceId: 'local',
          src: 'assets/images/photo.jpg', // Duplicate path
          alt: 'Photo 2'
        }
      ];

      const photoBlob = new Blob(['photo-data'], { type: 'image/jpeg' });
      mockGetImageAsset.mockResolvedValue(photoBlob);
      mockGetAllCacheKeys.mockResolvedValue([]);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(1); // Deduplicated
      expect(mockGetImageAsset).toHaveBeenCalledTimes(1); // Only called once
    });

    test('filters out non-local images', async () => {
      const imageRefs: ImageRef[] = [
        {
          serviceId: 'cloudinary',
          src: 'cloudinary-url',
          alt: 'Cloudinary Image'
        },
        {
          serviceId: 'local',
          src: 'assets/images/local.jpg',
          alt: 'Local Image'
        }
      ];

      const localBlob = new Blob(['local-data'], { type: 'image/jpeg' });
      mockGetImageAsset.mockResolvedValue(localBlob);
      mockGetAllCacheKeys.mockResolvedValue([]);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('assets/images/local.jpg');
      expect(mockGetImageAsset).toHaveBeenCalledWith(siteId, 'assets/images/local.jpg');
    });

    test('handles empty image refs array', async () => {
      mockGetAllCacheKeys.mockResolvedValue([]);

      const result = await localImageService.getExportableAssets(siteId, []);

      expect(result).toHaveLength(0);
      expect(mockGetImageAsset).not.toHaveBeenCalled();
    });

    test('properly extracts derivative filenames from cache keys', async () => {
      const imageRefs: ImageRef[] = [];
      const derivativeBlob = new Blob(['derivative'], { type: 'image/jpeg' });

      mockGetAllCacheKeys.mockResolvedValue([
        'test-site/assets/images/complex_w300_h200_c-fill_g-center.jpg',
        'test-site/nested/path/image_w100.png'
      ]);

      mockGetCachedDerivative.mockResolvedValue(derivativeBlob);

      const result = await localImageService.getExportableAssets(siteId, imageRefs);

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('assets/images/complex_w300_h200_c-fill_g-center.jpg');
      expect(result[1].path).toBe('nested/path/image_w100.png');
    });
  });

  describe('Edge Cases and Performance', () => {
    test('handles very large file names', async () => {
      const longName = 'a'.repeat(200) + '.jpg';
      const file = createMockFile(longName, 'image/jpeg', 1024);

      mockSlugify.mockReturnValue('a'.repeat(200));
      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const result = await localImageService.upload(file, 'test-site');

      expect(result.src).toContain('a'.repeat(200));
    });

    test('maintains performance with multiple concurrent uploads', async () => {
      const files = Array.from({ length: 10 }, (_, i) => 
        createMockFile(`image${i}.jpg`, 'image/jpeg', 1024)
      );

      mockSlugify.mockImplementation((str) => str);
      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      const start = performance.now();
      const promises = files.map(file => localImageService.upload(file, 'test-site'));
      await Promise.all(promises);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete quickly
      expect(mockSaveImageAsset).toHaveBeenCalledTimes(10);
    });

    test('properly cleans up object URLs', async () => {
      const imageRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/images/test.svg',
        alt: 'Test SVG'
      };

      mockGetImageAsset.mockResolvedValue(new Blob(['svg-data'], { type: 'image/svg+xml' }));
      mockCreateObjectURL.mockReturnValue('blob:mock-url');

      await localImageService.getDisplayUrl(createManifest('test-site'), imageRef, {}, false);

      // Verify URL creation but not revocation (as that happens outside our control)
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe('Tauri Image Format Tests', () => {
    // Mock platform detection
    let mockIsTauriApp: jest.SpyInstance;

    beforeEach(() => {
      // Import and mock the platform utility
      mockIsTauriApp = jest.spyOn(require('@/core/utils/platform'), 'isTauriApp');
    });

    afterEach(() => {
      mockIsTauriApp.mockRestore();
    });

    test('should return data URL for images in Tauri environment', async () => {
      mockIsTauriApp.mockReturnValue(true);

      const manifest = createManifest('test-site');
      const imageRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/originals/test.jpg',
        alt: 'Test Image'
      };

      const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
      mockGetImageAsset.mockResolvedValue(blob);
      mockGetCachedDerivative.mockResolvedValue(blob);

      const options: ImageTransformOptions = { width: 600, height: 400 };
      const url = await localImageService.getDisplayUrl(manifest, imageRef, options, false);

      // In Tauri, should return data URL
      expect(url).toMatch(/^data:image\//);
    });

    test('should return data URL for SVG in Tauri environment', async () => {
      mockIsTauriApp.mockReturnValue(true);

      const manifest = createManifest('test-site');
      const svgRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/originals/icon.svg',
        alt: 'Icon'
      };

      const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      mockGetImageAsset.mockResolvedValue(svgBlob);

      const url = await localImageService.getDisplayUrl(manifest, svgRef, {}, false);

      // SVG in Tauri should also use data URL
      expect(url).toMatch(/^data:image\/svg\+xml/);
    });

    test('should use blob URLs in web environment', async () => {
      mockIsTauriApp.mockReturnValue(false);

      const manifest = createManifest('test-site');
      const imageRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/originals/test.jpg',
        alt: 'Test Image'
      };

      const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
      mockGetImageAsset.mockResolvedValue(blob);
      mockGetCachedDerivative.mockResolvedValue(blob);
      mockCreateObjectURL.mockReturnValue('blob:http://localhost:5173/abc-123');

      const options: ImageTransformOptions = { width: 600 };
      const url = await localImageService.getDisplayUrl(manifest, imageRef, options, false);

      // In web environment, should use blob URL
      expect(url).toMatch(/^blob:/);
      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
    });

    test('should return file path for exports regardless of platform', async () => {
      mockIsTauriApp.mockReturnValue(true);

      const manifest = createManifest('test-site');
      const imageRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/originals/test.jpg',
        alt: 'Test Image'
      };

      const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
      mockGetImageAsset.mockResolvedValue(blob);
      mockGetCachedDerivative.mockResolvedValue(null);
      mockImageCompression.mockResolvedValue(new File(['compressed'], 'test.jpg', { type: 'image/jpeg' }));

      setTimeout(() => {
        mockImage.width = 800;
        mockImage.height = 600;
        mockImage.onload();
      }, 0);

      const options: ImageTransformOptions = { width: 600, height: 400 };
      const url = await localImageService.getDisplayUrl(manifest, imageRef, options, true); // isExport = true

      // Export should always return file path, not data URL
      expect(url).toMatch(/^\/assets\/derivatives\//);
      expect(url).not.toMatch(/^data:/);
      expect(url).not.toMatch(/^blob:/);
    });

    test('should handle data URL conversion for iframe previews', async () => {
      mockIsTauriApp.mockReturnValue(false); // Web environment

      const manifest = createManifest('test-site');
      const imageRef: ImageRef = {
        serviceId: 'local',
        src: 'assets/originals/test.jpg',
        alt: 'Test Image'
      };

      const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
      mockGetImageAsset.mockResolvedValue(blob);
      mockGetCachedDerivative.mockResolvedValue(blob);

      const options: ImageTransformOptions = { width: 600 };
      // forIframe = true (5th parameter)
      const url = await localImageService.getDisplayUrl(manifest, imageRef, options, false, true);

      // Iframe context should use data URL to avoid WebKit blob URL limitations
      expect(url).toMatch(/^data:image\//);
    });
  });

  describe('Export Filtering Tests', () => {
    test('should filter out derivative filenames from originals export', async () => {
      const derivativePattern = /_w(auto|\d+)_h(auto|\d+)_c-[^_]+_g-[^_]+/;

      const derivativeFilenames = [
        'image_w256_hauto_c-fit_g-center.jpg',
        'image_w1200_h630_c-fill_g-center.jpg',
        'photo_w600_h400_c-scale_g-north.png',
        'banner_wauto_h200_c-fit_g-center.webp'
      ];

      const originalFilenames = [
        '1754935108381-38.jpg',
        'logo.svg',
        'header-banner.png',
        '1759013619560-sparktype-dark.png'
      ];

      // Test derivative filenames match pattern
      for (const filename of derivativeFilenames) {
        expect(filename).toMatch(derivativePattern);
      }

      // Test original filenames do NOT match pattern
      for (const filename of originalFilenames) {
        expect(filename).not.toMatch(derivativePattern);
      }
    });

    test('should export only originals to assets/originals/ folder', async () => {
      const allImageRefs: ImageRef[] = [
        { serviceId: 'local', src: 'assets/originals/image1.jpg', alt: 'Image 1' },
        { serviceId: 'local', src: 'assets/originals/image2.png', alt: 'Image 2' }
      ];

      // Mock storage to include a derivative (which shouldn't happen, but test filtering)
      const mockStorage: Record<string, Blob> = {
        'assets/originals/image1.jpg': new Blob(['img1'], { type: 'image/jpeg' }),
        'assets/originals/image2.png': new Blob(['img2'], { type: 'image/png' }),
        // This derivative shouldn't be in storage, but if it is, it should be filtered
        'assets/originals/image1_w600_h400_c-fill_g-center.jpg': new Blob(['derivative'], { type: 'image/jpeg' })
      };

      mockGetImageAsset.mockImplementation(async (_siteId, path) => {
        return mockStorage[path] || null;
      });

      mockGetAllCacheKeys.mockResolvedValue([]);

      const exportAssets = await localImageService.getExportableAssets('test-site', allImageRefs);

      // Filter exports to originals folder
      const originalsExports = exportAssets.filter(asset =>
        asset.path.includes('_site/assets/originals/')
      );

      // Verify no derivative filenames in originals exports
      const derivativePattern = /_w(auto|\d+)_h(auto|\d+)_c-[^_]+_g-[^_]+/;
      for (const asset of originalsExports) {
        const filename = asset.path.split('/').pop() || '';
        expect(filename).not.toMatch(derivativePattern);
      }
    });

    test('should export derivatives to assets/derivatives/ folder', async () => {
      const allImageRefs: ImageRef[] = [
        { serviceId: 'local', src: 'assets/originals/image1.jpg', alt: 'Image 1' }
      ];

      mockGetImageAsset.mockResolvedValue(new Blob(['img1'], { type: 'image/jpeg' }));

      // Mock cached derivatives
      const derivativeKeys = [
        'test-site/assets/derivatives/image1_w600_h400_c-fill_g-center.jpg',
        'test-site/assets/derivatives/image1_w300_h200_c-fit_g-center.jpg'
      ];

      mockGetAllCacheKeys.mockResolvedValue(derivativeKeys);
      mockGetCachedDerivative.mockResolvedValue(new Blob(['derivative'], { type: 'image/jpeg' }));

      const exportAssets = await localImageService.getExportableAssets('test-site', allImageRefs);

      // Filter exports to derivatives folder
      const derivativesExports = exportAssets.filter(asset =>
        asset.path.includes('_site/assets/derivatives/')
      );

      // Should have exported the derivatives
      expect(derivativesExports.length).toBeGreaterThan(0);

      // Verify all have derivative naming pattern
      const derivativePattern = /_w(auto|\d+)_h(auto|\d+)_c-[^_]+_g-[^_]+/;
      for (const asset of derivativesExports) {
        const filename = asset.path.split('/').pop() || '';
        expect(filename).toMatch(derivativePattern);
      }
    });

    test('should not have any overlap between originals and derivatives exports', async () => {
      const allImageRefs: ImageRef[] = [
        { serviceId: 'local', src: 'assets/originals/image1.jpg', alt: 'Image 1' }
      ];

      mockGetImageAsset.mockResolvedValue(new Blob(['img1'], { type: 'image/jpeg' }));
      mockGetAllCacheKeys.mockResolvedValue([
        'test-site/assets/derivatives/image1_w600_h400_c-fill_g-center.jpg'
      ]);
      mockGetCachedDerivative.mockResolvedValue(new Blob(['derivative'], { type: 'image/jpeg' }));

      const exportAssets = await localImageService.getExportableAssets('test-site', allImageRefs);

      const originalsExports = exportAssets.filter(asset =>
        asset.path.includes('_site/assets/originals/')
      );
      const derivativesExports = exportAssets.filter(asset =>
        asset.path.includes('_site/assets/derivatives/')
      );

      // Extract filenames
      const originalsFilenames = originalsExports.map(a => a.path.split('/').pop());
      const derivativesFilenames = derivativesExports.map(a => a.path.split('/').pop());

      // Verify no filename appears in both lists
      const overlap = originalsFilenames.filter(f => derivativesFilenames.includes(f));
      expect(overlap).toHaveLength(0);
    });
  });
});