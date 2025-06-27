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

describe('image.helper', () => {
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

  describe('image helper', () => {
    test('generates img tag with basic parameters', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        height: 200,
        alt: 'Custom Alt Text'
      });

      const result = await helper.image.call({}, options);

      expect(result).toBeInstanceOf(Handlebars.SafeString);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('<img');
      expect(htmlString).toContain('src="https://example.com/test.jpg"');
      expect(htmlString).toContain('width="300"');
      expect(htmlString).toContain('height="200"');
      expect(htmlString).toContain('alt="Custom Alt Text"');
      expect(htmlString).toContain('loading="lazy"');
      expect(htmlString).toContain('>');
    });

    test('uses imageRef alt when no custom alt provided', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('alt="Test Image"');
    });

    test('handles missing alt gracefully', async () => {
      const siteData = createMockSiteData();
      const imageRef = { ...createMockImageRef(), alt: undefined };
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('alt=""');
    });

    test('applies CSS class when provided', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        class: 'thumbnail responsive'
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('class="thumbnail responsive"');
    });

    test('disables lazy loading when lazy=false', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300,
        lazy: false
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).not.toContain('loading="lazy"');
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

      await helper.image.call({}, options);

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

      await helper.image.call({}, options);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        { width: 300 },
        true // isExport should be true
      );
    });

    test('handles invalid ImageRef gracefully', async () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: 'invalid-string',
        width: 300
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toBe('<!-- Invalid ImageRef provided to image helper -->');
      expect(mockImageService.getDisplayUrl).not.toHaveBeenCalled();
    });

    test('handles missing src parameter', async () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        width: 300
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toBe('<!-- Invalid ImageRef provided to image helper -->');
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

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toBe('<!-- Image render failed: Image processing failed -->');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ImageHelper] Failed to render image for src: assets/images/test.jpg',
        error
      );
      
      consoleSpy.mockRestore();
    });

    test('generates minimal img tag with only required attributes', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('<img');
      expect(htmlString).toContain('src="https://example.com/test.jpg"');
      expect(htmlString).toContain('alt="Test Image"');
      expect(htmlString).toContain('loading="lazy"');
      expect(htmlString).not.toContain('width=');
      expect(htmlString).not.toContain('height=');
      expect(htmlString).not.toContain('class=');
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

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('src="https://cloudinary.com/test.jpg"');
      expect(cloudinaryService.getDisplayUrl).toHaveBeenCalled();
    });

    test('handles complex transform combinations', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 400,
        height: 300,
        crop: 'fit',
        gravity: 'north',
        alt: 'Complex Transform',
        class: 'featured-image',
        lazy: false
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('src="https://example.com/test.jpg"');
      expect(htmlString).toContain('width="400"');
      expect(htmlString).toContain('height="300"');
      expect(htmlString).toContain('alt="Complex Transform"');
      expect(htmlString).toContain('class="featured-image"');
      expect(htmlString).not.toContain('loading="lazy"');
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        imageRef,
        {
          width: 400,
          height: 300, 
          crop: 'fit',
          gravity: 'north'
        },
        false
      );
    });

    test('maintains proper HTML structure and formatting', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 200,
        height: 150,
        alt: 'Test & Sample "Image"',
        class: 'test-class'
      });

      const result = await helper.image.call({}, options);
      const htmlString = result.toString();
      
      // Should be well-formed HTML
      expect(htmlString).toMatch(/^<img\s[^>]*>$/);
      expect(htmlString).toContain('alt="Test & Sample "Image""');
      
      // Verify no extra whitespace issues
      expect(htmlString).not.toContain('  '); // No double spaces
      expect(htmlString.trim()).toBe(htmlString); // No leading/trailing whitespace
    });

    test('handles concurrent image processing', async () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        src: imageRef,
        width: 300
      });

      // Process multiple images concurrently
      const promises = Array.from({ length: 5 }, () => 
        helper.image.call({}, options)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Handlebars.SafeString);
        expect(result.toString()).toContain('<img');
      });
      
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledTimes(5);
    });
  });

  describe('Helper Factory', () => {
    test('returns object with image helper function', () => {
      const siteData = createMockSiteData();
      const helpers = imageHelper(siteData);
      
      expect(helpers).toHaveProperty('image');
      expect(typeof helpers.image).toBe('function');
    });

    test('helper function is async', () => {
      const siteData = createMockSiteData();
      const helpers = imageHelper(siteData);
      const imageRef = createMockImageRef();
      
      const options = createMockHandlebarsOptions({
        src: imageRef
      });

      const result = helpers.image.call({}, options);
      expect(result).toBeInstanceOf(Promise);
    });

    test('different site data creates independent helpers', () => {
      const siteData1 = createMockSiteData();
      const siteData2 = { ...createMockSiteData(), siteId: 'different-site' };
      
      const helpers1 = imageHelper(siteData1);
      const helpers2 = imageHelper(siteData2);
      
      expect(helpers1).not.toBe(helpers2);
      expect(helpers1.image).not.toBe(helpers2.image);
    });
  });
});