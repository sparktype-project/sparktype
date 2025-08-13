/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { imageHelper } from '../image.helper';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';
import type { LocalSiteData, ImageRef, Manifest } from '@/core/types';
import Handlebars from 'handlebars';

// Mock the image preprocessor
jest.mock('@/core/services/images/imagePreprocessor.service', () => ({
  imagePreprocessor: {
    getProcessedImageUrlForField: jest.fn()
  }
}));

const mockImagePreprocessor = imagePreprocessor as jest.Mocked<typeof imagePreprocessor>;

describe('image.helper (New Preset System)', () => {
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

  const createMockHandlebarsOptions = (hash: Record<string, unknown> = {}, rootContext: any = {}): Handlebars.HelperOptions => ({
    hash,
    data: {
      root: {
        contentFile: {
          path: 'content/blog/test-post.md',
          frontmatter: {}
        },
        options: {
          isExport: false
        },
        ...rootContext
      }
    },
    fn: jest.fn(),
    inverse: jest.fn()
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockImagePreprocessor.getProcessedImageUrlForField.mockReturnValue('https://example.com/processed/test.jpg');
  });

  describe('Basic functionality', () => {
    test('generates img tag using preprocessed image with fieldname', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image',
        alt: 'Custom Alt Text'
      }, {
        contentFile: {
          path: 'content/blog/test-post.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helper.image.call({}, options);

      expect(result).toBeInstanceOf(Handlebars.SafeString);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('<img');
      expect(htmlString).toContain('src="https://example.com/processed/test.jpg"');
      expect(htmlString).toContain('alt="Custom Alt Text"');
      expect(htmlString).toContain('loading="lazy"');
      expect(mockImagePreprocessor.getProcessedImageUrlForField).toHaveBeenCalledWith(
        'content/blog/test-post.md',
        'featured_image',
        'full'
      );
    });

    test('uses imageRef alt when no custom alt provided', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        contentFile: {
          path: 'content/blog/test-post.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('alt="Test Image"');
    });

    test('handles missing alt gracefully', () => {
      const siteData = createMockSiteData();
      const imageRef = { ...createMockImageRef(), alt: undefined };
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        contentFile: {
          path: 'content/blog/test-post.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('alt=""');
    });

    test('returns error message when no fieldname provided', () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({});

      const result = helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('<!-- No fieldname provided: use {{{image fieldname="field_name"}}} -->');
    });
  });

  describe('Field name detection', () => {
    test('uses fieldname parameter when provided', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'banner_image'
      }, {
        contentFile: {
          path: 'content/page.md',
          frontmatter: {
            banner_image: imageRef
          }
        }
      });

      helper.image.call({}, options);
      
      expect(mockImagePreprocessor.getProcessedImageUrlForField).toHaveBeenCalledWith(
        'content/page.md',
        'banner_image',
        undefined
      );
    });

    test('detects field name from context', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const context = {
        frontmatter: {
          featured_image: imageRef
        },
        path: 'content/blog/post1.md'
      };
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      });

      helper.image.call(context, options);
      
      expect(mockImagePreprocessor.getProcessedImageUrlForField).toHaveBeenCalledWith(
        'content/blog/post1.md',
        'featured_image',
        undefined
      );
    });
  });

  describe('Context detection', () => {
    test('detects context from displayType using layout configuration', () => {
      const siteData = {
        ...createMockSiteData(),
        layoutFiles: [{
          path: 'layouts/blog-listing/layout.json',
          content: JSON.stringify({
            displayTypes: {
              'post-card': {
                partial: 'post-card',
                imageContext: 'card'
              }
            }
          })
        }]
      };
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const context = {
        path: 'content/blog/post1.md'
      };
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        layoutConfig: {
          displayType: 'post-card',
          layout: 'blog-listing'
        }
      });

      const result = helper.image.call(context, options);
      
      expect(mockImagePreprocessor.getProcessedImageUrlForField).toHaveBeenCalledWith(
        'content/blog/post1.md',
        'featured_image',
        'card'
      );
    });

    test('detects full context from displayType configuration', () => {
      const siteData = {
        ...createMockSiteData(),
        layoutFiles: [{
          path: 'layouts/blog-listing/layout.json',
          content: JSON.stringify({
            displayTypes: {
              'post-full': {
                partial: 'post-full',
                imageContext: 'full'
              }
            }
          })
        }]
      };
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const context = {
        path: 'content/blog/post1.md'
      };
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        layoutConfig: {
          displayType: 'post-full',
          layout: 'blog-listing'
        }
      });

      const result = helper.image.call(context, options);
      
      expect(mockImagePreprocessor.getProcessedImageUrlForField).toHaveBeenCalledWith(
        'content/blog/post1.md',
        'featured_image',
        'full'
      );
    });

    test('defaults to full context for regular pages', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        contentFile: {
          path: 'content/about.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helper.image.call({}, options);
      
      expect(mockImagePreprocessor.getProcessedImageUrlForField).toHaveBeenCalledWith(
        'content/about.md',
        'featured_image',
        'full'
      );
    });
  });

  describe('URL-only mode for meta tags', () => {
    test('returns only URL when url_only=true', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image',
        url_only: true
      }, {
        contentFile: {
          path: 'content/page.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helper.image.call({}, options);
      
      expect(result.toString()).toBe('https://example.com/processed/test.jpg');
    });

    test('returns only URL when inside meta tag context', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const context = {
        tagName: 'meta'
      };
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        contentFile: {
          path: 'content/page.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helper.image.call(context, options);
      
      expect(result.toString()).toBe('https://example.com/processed/test.jpg');
    });
  });

  describe('CSS and HTML attributes', () => {
    test('applies CSS class when provided', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image',
        class: 'thumbnail responsive'
      }, {
        contentFile: {
          path: 'content/page.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).toContain('class="thumbnail responsive"');
    });

    test('disables lazy loading when lazy=false', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image',
        lazy: false
      }, {
        contentFile: {
          path: 'content/page.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helper.image.call({}, options);
      const htmlString = result.toString();
      
      expect(htmlString).not.toContain('loading="lazy"');
    });
  });

  describe('Error handling', () => {
    test('handles invalid ImageRef gracefully', () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        contentFile: {
          path: 'content/page.md',
          frontmatter: {
            featured_image: null
          }
        }
      });

      const result = helper.image.call({}, options);
      
      expect(result.toString()).toBe('<!-- Invalid ImageRef -->');
    });

    test('handles missing fieldname', () => {
      const siteData = createMockSiteData();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({});

      const result = helper.image.call({}, options);
      
      expect(result.toString()).toBe('<!-- No fieldname provided: use {{{image fieldname="field_name"}}} -->');
    });

    test('handles missing content path', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        contentFile: undefined
      });

      const result = helper.image.call({}, options);
      
      expect(result.toString()).toContain('<!-- No content path -->');
    });

    test('handles missing preprocessed image', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      mockImagePreprocessor.getProcessedImageUrlForField.mockReturnValue(null);
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        contentFile: {
          path: 'content/page.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helper.image.call({}, options);
      
      expect(result.toString()).toContain('<!-- Image not preprocessed -->');
    });

    test('handles processing errors gracefully', () => {
      const siteData = createMockSiteData();
      const imageRef = createMockImageRef();
      const helper = imageHelper(siteData);
      
      mockImagePreprocessor.getProcessedImageUrlForField.mockImplementation(() => {
        throw new Error('Processing failed');
      });
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        contentFile: {
          path: 'content/page.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = helper.image.call({}, options);
      
      expect(result.toString()).toContain('<!-- Image processing error: Processing failed -->');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Helper Factory', () => {
    test('returns object with image helper function', () => {
      const siteData = createMockSiteData();
      const helpers = imageHelper(siteData);
      
      expect(helpers).toHaveProperty('image');
      expect(typeof helpers.image).toBe('function');
    });

    test('helper function is synchronous', () => {
      const siteData = createMockSiteData();
      const helpers = imageHelper(siteData);
      const imageRef = createMockImageRef();
      
      const options = createMockHandlebarsOptions({
        fieldname: 'featured_image'
      }, {
        contentFile: {
          path: 'content/page.md',
          frontmatter: {
            featured_image: imageRef
          }
        }
      });

      const result = helpers.image.call({}, options);
      expect(result).toBeInstanceOf(Handlebars.SafeString);
      expect(result).not.toBeInstanceOf(Promise);
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