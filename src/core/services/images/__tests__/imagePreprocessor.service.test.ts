/* eslint-disable @typescript-eslint/no-explicit-any */
import { ImagePreprocessorService } from '../imagePreprocessor.service';
import { getActiveImageService } from '../images.service';
import type { LocalSiteData, ImageRef, Manifest } from '@/core/types';

// Mock the image service
jest.mock('../images.service', () => ({
  getActiveImageService: jest.fn()
}));

const mockGetActiveImageService = getActiveImageService as jest.MockedFunction<typeof getActiveImageService>;

describe('ImagePreprocessorService (Declarative System)', () => {
  let service: ImagePreprocessorService;
  let mockImageService: any;

  const createMockSiteData = (contentFiles: any[] = [], layoutFiles: any[] = []): LocalSiteData => ({
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
    contentFiles,
    layoutFiles
  });

  const createMockImageRef = (): ImageRef => ({
    serviceId: 'local',
    src: 'assets/images/test.jpg',
    alt: 'Test Image',
    width: 800,
    height: 600
  });

  beforeEach(() => {
    service = new ImagePreprocessorService();
    mockImageService = {
      id: 'local',
      name: 'Local Service',
      getDisplayUrl: jest.fn().mockResolvedValue('https://example.com/processed.jpg')
    };
    mockGetActiveImageService.mockReturnValue(mockImageService);
    jest.clearAllMocks();
  });

  describe('Declarative Preset Resolution', () => {
    test('uses simple string preset from layout manifest', async () => {
      const layoutManifest = {
        name: 'Blog Post Layout',
        layoutType: 'single',
        image_presets: {
          banner_image: 'hero'
        }
      };

      const siteData = createMockSiteData([
        {
          path: 'content/blog/post.md',
          frontmatter: {
            layout: 'blog-post',
            banner_image: createMockImageRef()
          }
        }
      ], [
        {
          path: 'layouts/blog-post/layout.json',
          content: JSON.stringify(layoutManifest)
        }
      ]);

      await service.preprocessImages(siteData, false);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        expect.any(Object),
        expect.objectContaining({
          width: 1200,
          height: 600,
          crop: 'fill'
        }),
        false
      );
    });

    test('uses context-specific presets from layout manifest', async () => {
      const contentLayoutManifest = {
        name: 'Blog Post Layout',
        layoutType: 'single',
        image_presets: {
          featured_image: {
            contexts: {
              card: 'thumbnail',
              list: 'banner_small',
              full: 'page_display'
            },
            default: 'page_display'
          }
        }
      };

      const siteData = createMockSiteData([
        // Collection item (blog post)
        {
          path: 'content/blog/post1.md',
          frontmatter: {
            layout: 'blog-post',
            featured_image: createMockImageRef()
          }
        },
        // Collection page that can render this item
        {
          path: 'content/blog/index.md',
          frontmatter: {
            layout: 'blog-listing',
            layoutConfig: {
              collectionId: 'blog'
            }
          }
        }
      ], [
        {
          path: 'layouts/blog-post/layout.json',
          content: JSON.stringify(contentLayoutManifest)
        },
        {
          path: 'layouts/blog-listing/layout.json',
          content: JSON.stringify({
            displayTypes: {
              'post-card': {
                partial: 'post-card',
                imageContext: 'card'
              },
              'post-full': {
                partial: 'post-full',
                imageContext: 'full'
              }
            }
          })
        }
      ]);

      await service.preprocessImages(siteData, false);

      // Should be called 3 times: card context (thumbnail), full context (page_display), and another full for single page view
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledTimes(3);
      
      const calls = mockImageService.getDisplayUrl.mock.calls;
      
      // Check card context (thumbnail: 300x200)
      const cardCall = calls.find((call: any) => call[2].width === 300 && call[2].height === 200);
      expect(cardCall).toBeDefined();
      
      // Check full context (page_display: 600x400)
      const fullCalls = calls.filter((call: any) => call[2].width === 600 && call[2].height === 400);
      expect(fullCalls).toHaveLength(2); // One for each full context
    });

    test('falls back to default preset when context not found', async () => {
      const layoutManifest = {
        name: 'Blog Post Layout',
        layoutType: 'single',
        image_presets: {
          featured_image: {
            contexts: {
              card: 'thumbnail'
            },
            default: 'page_display'
          }
        }
      };

      const siteData = createMockSiteData([
        {
          path: 'content/blog/post.md',
          frontmatter: {
            layout: 'blog-post',
            featured_image: createMockImageRef()
          }
        },
        {
          path: 'content/blog/index.md',
          frontmatter: {
            layout: 'blog-listing',
            layoutConfig: {
              collectionId: 'blog'
            }
          }
        }
      ], [
        {
          path: 'layouts/blog-post/layout.json',
          content: JSON.stringify(layoutManifest)
        },
        {
          path: 'layouts/blog-listing/layout.json',
          content: JSON.stringify({
            displayTypes: {
              'post-list': {
                partial: 'post-list',
                imageContext: 'list' // This context doesn't exist in the featured_image config
              }
            }
          })
        }
      ]);

      await service.preprocessImages(siteData, false);

      const calls = mockImageService.getDisplayUrl.mock.calls;
      
      // Should use default (page_display: 600x400) when 'list' context not found
      const defaultCall = calls.find((call: any) => call[2].width === 600 && call[2].height === 400);
      expect(defaultCall).toBeDefined();
    });

    test('uses system fallback when no layout configuration found', async () => {
      const siteData = createMockSiteData([
        {
          path: 'content/page.md',
          frontmatter: {
            layout: 'page',
            featured_image: createMockImageRef()
          }
        }
      ]);

      await service.preprocessImages(siteData, false);

      // Should use system fallback: 'page_display' for full context
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        expect.any(Object),
        expect.objectContaining({
          width: 600,
          height: 400,
          crop: 'fill'
        }),
        false
      );
    });
  });

  describe('Collection Item Context Detection', () => {
    test('processes multiple contexts for collection items', async () => {
      const siteData = createMockSiteData([
        // Collection item
        {
          path: 'content/blog/post1.md',
          frontmatter: {
            layout: 'blog-post',
            featured_image: createMockImageRef()
          }
        },
        // Collection page that references the items
        {
          path: 'content/blog/index.md',
          frontmatter: {
            layout: 'blog-listing',
            layoutConfig: {
              collectionId: 'blog'
            }
          }
        }
      ], [
        {
          path: 'layouts/blog-listing/layout.json',
          content: JSON.stringify({
            displayTypes: {
              'post-card': {
                partial: 'post-card',
                imageContext: 'card'
              }
            }
          })
        }
      ]);

      await service.preprocessImages(siteData, false);

      // Should be called twice - once for collection context (card), once for full context
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledTimes(2);
      
      const calls = mockImageService.getDisplayUrl.mock.calls;
      
      // Check that both thumbnail (card context) and page_display (full context) were processed
      const thumbnailCall = calls.find((call: any) => call[2].width === 300 && call[2].height === 200);
      const pageDisplayCall = calls.find((call: any) => call[2].width === 600 && call[2].height === 400);
      
      expect(thumbnailCall).toBeDefined();
      expect(pageDisplayCall).toBeDefined();
    });

    test('processes only full context for regular pages', async () => {
      const siteData = createMockSiteData([
        {
          path: 'content/about.md',
          frontmatter: {
            layout: 'page',
            featured_image: createMockImageRef()
          }
        }
      ]);

      await service.preprocessImages(siteData, false);

      // Should be called once - only for full context
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledTimes(1);
      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        expect.any(Object),
        expect.objectContaining({
          width: 600,
          height: 400,
          crop: 'fill'
        }),
        false
      );
    });
  });

  describe('Context-aware URL retrieval', () => {
    test('returns correct URL for specific contexts', async () => {
      const siteData = createMockSiteData([
        {
          path: 'content/blog/post1.md',
          frontmatter: {
            layout: 'blog-post',
            featured_image: createMockImageRef()
          }
        },
        {
          path: 'content/blog/index.md',
          frontmatter: {
            layout: 'blog-listing',
            layoutConfig: {
              collectionId: 'blog'
            }
          }
        }
      ], [
        {
          path: 'layouts/blog-listing/layout.json',
          content: JSON.stringify({
            displayTypes: {
              'post-card': {
                partial: 'post-card',
                imageContext: 'card'
              }
            }
          })
        }
      ]);

      mockImageService.getDisplayUrl
        .mockResolvedValueOnce('https://example.com/card.jpg')
        .mockResolvedValueOnce('https://example.com/full.jpg');

      await service.preprocessImages(siteData, false);

      const cardUrl = service.getProcessedImageUrl(
        'content/blog/post1.md',
        'featured_image',
        'thumbnail'
      );

      const fullUrl = service.getProcessedImageUrl(
        'content/blog/post1.md',
        'featured_image',
        'full'
      );

      expect(cardUrl).toBe('https://example.com/card.jpg');
      expect(fullUrl).toBe('https://example.com/full.jpg');
    });

    test('returns null when preset not found', async () => {
      const siteData = createMockSiteData([
        {
          path: 'content/page.md',
          frontmatter: {
            layout: 'page',
            featured_image: createMockImageRef()
          }
        }
      ]);

      await service.preprocessImages(siteData, false);

      const url = service.getProcessedImageUrl(
        'content/page.md',
        'featured_image',
        'nonexistent_preset'
      );

      expect(url).toBeNull();
    });

    test('returns null for non-existent images', () => {
      const url = service.getProcessedImageUrl(
        'content/nonexistent.md',
        'featured_image',
        'full'
      );

      expect(url).toBeNull();
    });
  });

  describe('Error handling', () => {
    test('handles invalid layout manifest gracefully', async () => {
      const siteData = createMockSiteData([
        {
          path: 'content/page.md',
          frontmatter: {
            layout: 'broken',
            featured_image: createMockImageRef()
          }
        }
      ], [
        {
          path: 'layouts/broken/layout.json',
          content: 'invalid json{'
        }
      ]);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.preprocessImages(siteData, false);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse layout manifest for broken'),
        expect.any(Error)
      );

      // Should still process with system fallbacks
      expect(mockImageService.getDisplayUrl).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('handles image processing errors gracefully', async () => {
      const siteData = createMockSiteData([
        {
          path: 'content/page.md',
          frontmatter: {
            layout: 'page',
            featured_image: createMockImageRef()
          }
        }
      ]);

      mockImageService.getDisplayUrl.mockRejectedValue(new Error('Processing failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.preprocessImages(siteData, false);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process image'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    test('handles missing content files gracefully', async () => {
      const siteData = createMockSiteData([]);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.preprocessImages(siteData, false);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ImagePreprocessor] No content files found in siteData'
      );
      expect(mockImageService.getDisplayUrl).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Preset resolution with inheritance', () => {
    test('resolves base presets correctly', async () => {
      const siteData = createMockSiteData([
        {
          path: 'content/page.md',
          frontmatter: {
            layout: 'page',
            featured_image: createMockImageRef()
          }
        }
      ]);

      await service.preprocessImages(siteData, false);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        expect.any(Object),
        expect.objectContaining({
          width: 600,
          height: 400,
          crop: 'fill',
          gravity: 'center'
        }),
        false
      );
    });

    test('handles original preset without dimensions', async () => {
      const layoutManifest = {
        name: 'Custom Layout',
        layoutType: 'single',
        image_presets: {
          featured_image: 'original'
        }
      };

      const siteData = createMockSiteData([
        {
          path: 'content/page.md',
          frontmatter: {
            layout: 'custom',
            featured_image: createMockImageRef()
          }
        }
      ], [
        {
          path: 'layouts/custom/layout.json',
          content: JSON.stringify(layoutManifest)
        }
      ]);

      await service.preprocessImages(siteData, false);

      expect(mockImageService.getDisplayUrl).toHaveBeenCalledWith(
        siteData.manifest,
        expect.any(Object),
        expect.objectContaining({
          crop: 'scale',
          gravity: 'center'
        }),
        false
      );

      // Should not have width or height for original preset
      const call = mockImageService.getDisplayUrl.mock.calls[0];
      expect(call[2]).not.toHaveProperty('width');
      expect(call[2]).not.toHaveProperty('height');
    });
  });
});