/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { imageHelper } from '../image.helper';
import { getActiveImageService } from '@/core/services/images/images.service';
import type { LocalSiteData, ImageRef, Manifest } from '@/core/types';
import Handlebars from 'handlebars';

// Mock the image service
jest.mock('@/core/services/images/images.service', () => ({
  getActiveImageService: jest.fn()
}));

const mockGetActiveImageService = getActiveImageService as jest.MockedFunction<typeof getActiveImageService>;

describe('imageUrl.helper', () => {
  // Helper functions
  const createMockSiteData = (): LocalSiteData => ({
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test Site',
      theme: { name: 'default', config: {} },
      structure: [],
      settings: { imageService: 'local' }
    } as Manifest,
    contentFiles: []
  });

  const createMockImageRef = (): ImageRef => ({
    serviceId: 'local',
    src: 'assets/images/test.jpg',
    alt: 'Test Image',
    width: 800,
    height: 600
  });

  const createMockHandlebarsOptions = (hash: Record<string, unknown> = {}): Handlebars.HelperOptions => ({
    hash,
    data: {
      root: {
        options: {
          isExport: false
        }
      }
    },
    fn: jest.fn(),
    inverse: jest.fn()
  });

  const mockImageService = {
    id: 'local',
    name: 'Local Service',
    upload: jest.fn(),
    getDisplayUrl: jest.fn(),
    getExportableAssets: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveImageService.mockReturnValue(mockImageService);
    mockImageService.getDisplayUrl.mockResolvedValue('https://example.com/test.jpg');
  });

  describe('image_url helper', () => {
    test('returns URL as SafeString with basic parameters', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        height: 200
      });

      const result = await helper.image_url.call({}, options);

      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('https://example.com/test.jpg');
    });

    test('passes transform options to image service', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        height: 200,
        crop: 'fill',
        gravity: 'center'
      });

      await helper.image_url.call({}, options);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 300,
          height: 200,
          crop: 'fill',
          gravity: 'center'
        },
        false
      );
    });

    test('respects export mode from root context', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });
      
      // Set export mode
      options.data.root.options.isExport = true;

      await helper.image_url.call({}, options);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        { width: 300 },
        true // isExport should be true
      );
    });

    test('handles missing export context gracefully', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });
      
      // Remove export context
      delete options.data.root.options;

      await helper.image_url.call({}, options);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        { width: 300 },
        false // should default to false
      );
    });

    test('handles invalid ImageRef with string src', async () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: 'invalid-string',
        width: 300
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[image_url] Invalid or missing ImageRef object provided.');
      expect(mockImageService.getDisplayUrl).not.toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    test('handles missing src parameter', async () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        width: 300
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[image_url] Invalid or missing ImageRef object provided.');
      
      consoleWarnSpy.mockRestore();
    });

    test('handles null src parameter', async () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: null,
        width: 300
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    test('handles object without serviceId', async () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: { url: 'some-url' }, // Missing serviceId
        width: 300
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    test('handles image service errors gracefully', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const error = new Error('Image processing failed');
      mockImageService.getDisplayUrl.mockRejectedValue(error);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe('');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[image_url] Failed to generate URL for src: assets/images/test.jpg',
        error
      );
      
      consoleErrorSpy.mockRestore();
    });

    test('returns URL without transform options when none provided', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef
      });

      const result = await helper.image_url.call({}, options);
      
      expect(result.toString()).toBe('https://example.com/test.jpg');
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {}, // Empty transform options
        false
      );
    });

    test('handles partial transform options', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 400,
        crop: 'fit'
        // height and gravity intentionally omitted
      });

      await helper.image_url.call({}, options);
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 400,
          crop: 'fit'
          // height and gravity should be undefined
        },
        false
      );
    });

    test('handles different image service types', async () => {
      const siteData = createMockSiteData();
      siteData.manifest.settings = { imageService: 'cloudinary' };
      
      const cloudinaryService = {
        id: 'cloudinary',
        name: 'Cloudinary Service',
        upload: jest.fn(),
        getDisplayUrl: jest.fn().mockResolvedValue('https://cloudinary.com/test.jpg'),
        getExportableAssets: jest.fn()
      };
      
      mockGetActiveImageService.mockReturnValue(cloudinaryService);
      
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const result = await helper.image_url.call({}, options);
      
      expect(result.toString()).toBe('https://cloudinary.com/test.jpg');
      expect(cloudinaryService.getDisplayUrl).toHaveBeenCalled();
    });

    test('handles complex URLs with special characters', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const complexUrl = 'https://example.com/images/test%20image.jpg?v=123&format=webp';
      mockImageService.getDisplayUrl.mockResolvedValue(complexUrl);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const result = await helper.image_url.call({}, options);
      
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result.toString()).toBe(complexUrl);
    });

    test('handles concurrent URL generation', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      // Process multiple URLs concurrently
      const promises = Array.from({ length: 5 }, () => 
        helper.image_url.call({}, options)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach((result: any) => {
        expect(result).toBeInstanceOf(Handlebars.SafeString);
        expect(result.toString()).toBe('https://example.com/test.jpg');
      });
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledTimes(5);
    });

    test('handles all supported transform options', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 800,
        height: 600,
        crop: 'scale',
        gravity: 'south'
      });

      await helper.image_url.call({}, options);
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 800,
          height: 600,
          crop: 'scale',
          gravity: 'south'
        },
        false
      );
    });

    test('ignores non-transform hash parameters', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        alt: 'Should be ignored',
        class: 'Should also be ignored',
        lazy: true,
        unknownParam: 'Also ignored'
      });

      await helper.image_url.call({}, options);
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 300
          // Only width should be passed, other params ignored
        },
        false
      );
    });

    test('returns empty string for various error conditions', async () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const testCases = [
        { src: undefined },
        { src: null },
        { src: '' },
        { src: 123 },
        { src: [] },
        { src: {} },
        { src: { notServiceId: 'test' } }
      ];

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      for (const testCase of testCases) {
        const options = createMockHandlebarsOptions(testCase);
        const result = await helper.image_url.call({}, options);
        
        expect(result).toBeInstanceOf(Handlebars.SafeString);
        expect(result.toString()).toBe('');
      }
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Helper Factory', () => {
    test('returns object with image_url helper function', () => {
      const siteData = createMockSiteData();
      const helpers = imageHelper(siteData);
      
      expect(helpers).toHaveProperty('image_url');
      expect(typeof helpers.image_url).toBe('function');
    });

    test('helper function is async', () => {
      const siteData = createMockSiteData();
      const helpers = imageHelper(siteData);
      const imageRef = createMockImageRef();
      
      const options = createMockHandlebarsOptions({
        src: imageRef
      });

      const result = helpers.image_url.call({}, options);
      expect(result).toBeInstanceOf(Promise);
    });

    test('different site data creates independent helpers', () => {
      const siteData1 = createMockSiteData();
      const siteData2 = { ...createMockSiteData(), siteId: 'different-site' };
      
      const helpers1 = imageHelper(siteData1);
      const helpers2 = imageHelper(siteData2);
      
      expect(helpers1).not.toBe(helpers2);
      expect(helpers1.image_url).not.toBe(helpers2.image_url);
    });

    test('maintains site data context correctly', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      await helper.image_url.call({}, options);
      
      expect(mockGetActiveImageService).toHaveBeenCalledWith(siteData.manifest);
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        { width: 300 },
        false
      );
    });
  });
});