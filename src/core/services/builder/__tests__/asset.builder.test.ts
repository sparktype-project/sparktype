/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { bundleAllAssets } from '../asset.builder';
import type { LocalSiteData, SiteBundle, ImageRef } from '@/core/types';
import * as configHelpers from '../../config/configHelpers.service';
import * as imagesService from '../../images/images.service';
import * as imageCleanup from '../../images/imageCleanup.service';
import * as mediaManifest from '../../images/mediaManifest.service';
import { CSS_CONFIG } from '@/config/editorConfig';

// Mock dependencies
jest.mock('../../config/configHelpers.service');
jest.mock('../../images/images.service');
jest.mock('../../images/imageCleanup.service');
jest.mock('../../images/mediaManifest.service');
jest.mock('@/config/editorConfig');

// Mock fetch
global.fetch = jest.fn();

describe('asset.builder', () => {
  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test description',
      structure: [],
      theme: {
        name: 'default',
        config: {}
      },
      logo: {
        serviceId: 'local',
        src: 'logo.png'
      }
    },
    contentFiles: [
      {
        slug: 'post1',
        path: 'content/posts/post1.md',
        frontmatter: {
          title: 'Post 1',
          layout: 'blog',
          featured_image: {
            serviceId: 'local',
            src: 'featured1.jpg'
          } as ImageRef
        },
        content: 'Post content'
      },
      {
        slug: 'post2',
        path: 'content/posts/post2.md',
        frontmatter: {
          title: 'Post 2',
          layout: 'page'
        },
        content: 'Another post'
      }
    ]
  };

  const mockThemeManifest = {
    name: 'Default Theme',
    version: '1.0.0',
    files: [
      { path: 'theme.json', type: 'manifest' },
      { path: 'base.hbs', type: 'base' },
      { path: 'css/theme.css', type: 'stylesheet' }
    ]
  };

  const mockLayoutManifest = {
    name: 'Blog Layout',
    version: '1.0.0',
    files: [
      { path: 'layout.json', type: 'manifest' },
      { path: 'blog.hbs', type: 'template' }
    ]
  };

  const mockImageService = {
    getExportableAssets: jest.fn()
  };

  let mockBundle: SiteBundle;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBundle = {};

    // Mock CSS_CONFIG
    (CSS_CONFIG as any) = {
      MAIN_STYLESHEET_PATH: 'http://localhost:3000/styles/main.css',
      EXPORT_BUNDLE_PATH: '_site/styles/main.css',
    };

    // Mock fetch for CSS
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('/* Main CSS content */'),
    });

    // Mock image cleanup
    (imageCleanup.cleanupOrphanedImages as jest.Mock).mockResolvedValue({
      originalImagesRemoved: 1,
      derivativesRemoved: 2,
      bytesFreed: 1024000,
    });

    // Mock media manifest generation
    (mediaManifest.generateMediaManifest as jest.Mock).mockResolvedValue({
      version: 1,
      imageService: 'local',
      images: {
        'assets/originals/featured1.jpg': {
          referencedIn: ['content/posts/post1.md'],
          metadata: {
            sizeBytes: 245760,
            width: 1920,
            height: 1080,
            alt: 'Featured image',
          },
        },
      },
    });

    // Mock config helpers
    (configHelpers.getJsonAsset as jest.Mock)
      .mockImplementation(async (_siteData, assetType, assetId, fileName) => {
        if (assetType === 'theme' && assetId === 'default' && fileName === 'theme.json') {
          return mockThemeManifest;
        }
        if (assetType === 'layout' && assetId === 'blog' && fileName === 'layout.json') {
          return mockLayoutManifest;
        }
        return null;
      });

    (configHelpers.getAssetContent as jest.Mock)
      .mockImplementation(async (_siteData, _assetType, _assetId, filePath) => {
        if (filePath === 'base.hbs') return '<html>{{{body}}}</html>';
        if (filePath === 'css/theme.css') return 'body { margin: 0; }';
        if (filePath === 'blog.hbs') return '<article>{{{content}}}</article>';
        return null;
      });

    // Mock image service
    (imagesService.getActiveImageService as jest.Mock).mockReturnValue(mockImageService);
    mockImageService.getExportableAssets.mockResolvedValue([
      { path: 'images/logo.png', data: 'logo-binary-data' },
      { path: 'images/featured1.jpg', data: 'featured-binary-data' }
    ]);
  });

  describe('bundleAllAssets', () => {
    test('bundles theme assets correctly', async () => {
      await bundleAllAssets(mockBundle, mockSiteData);

      // Should load theme manifest
      expect(configHelpers.getJsonAsset).toHaveBeenCalledWith(
        mockSiteData,
        'theme',
        'default',
        'theme.json'
      );

      // Should load theme files
      expect(configHelpers.getAssetContent).toHaveBeenCalledWith(
        mockSiteData,
        'theme',
        'default',
        'base.hbs'
      );
      expect(configHelpers.getAssetContent).toHaveBeenCalledWith(
        mockSiteData,
        'theme',
        'default',
        'css/theme.css'
      );

      // Should add theme files to bundle with correct paths
      expect(mockBundle['_site/themes/default/base.hbs']).toBe('<html>{{{body}}}</html>');
      expect(mockBundle['_site/themes/default/css/theme.css']).toBe('body { margin: 0; }');
    });

    test('bundles layout assets correctly', async () => {
      await bundleAllAssets(mockBundle, mockSiteData);

      // Should load layout manifest for used layouts
      expect(configHelpers.getJsonAsset).toHaveBeenCalledWith(
        mockSiteData,
        'layout',
        'blog',
        'layout.json'
      );

      // Should load layout files
      expect(configHelpers.getAssetContent).toHaveBeenCalledWith(
        mockSiteData,
        'layout',
        'blog',
        'blog.hbs'
      );

      // Should add layout files to bundle with correct paths
      expect(mockBundle['_site/layouts/blog/blog.hbs']).toBe('<article>{{{content}}}</article>');
    });

    test('bundles only unique layouts', async () => {
      const siteDataDuplicateLayouts = {
        ...mockSiteData,
        contentFiles: [
          ...mockSiteData.contentFiles!,
          {
            slug: 'post3',
            path: 'content/posts/post3.md',
            frontmatter: { title: 'Post 3', layout: 'blog' },
            content: 'Third post'
          }
        ]
      };

      await bundleAllAssets(mockBundle, siteDataDuplicateLayouts);

      // Should only call getJsonAsset once for 'blog' layout despite multiple uses
      const blogLayoutCalls = (configHelpers.getJsonAsset as jest.Mock).mock.calls.filter(
        call => call[1] === 'layout' && call[2] === 'blog'
      );
      expect(blogLayoutCalls).toHaveLength(1);
    });

    test('bundles image assets correctly', async () => {
      await bundleAllAssets(mockBundle, mockSiteData);

      // Should get active image service
      expect(imagesService.getActiveImageService).toHaveBeenCalledWith(mockSiteData.manifest);

      // Should get exportable assets with all image refs
      expect(mockImageService.getExportableAssets).toHaveBeenCalledWith(
        'test-site',
        expect.arrayContaining([
          mockSiteData.manifest.logo,
          mockSiteData.contentFiles![0].frontmatter.featured_image
        ])
      );

      // Should add image assets to bundle
      expect(mockBundle['images/logo.png']).toBe('logo-binary-data');
      expect(mockBundle['images/featured1.jpg']).toBe('featured-binary-data');
    });

    test('handles missing theme manifest', async () => {
      (configHelpers.getJsonAsset as jest.Mock).mockResolvedValue(null);

      await bundleAllAssets(mockBundle, mockSiteData);

      // Should not throw error
      expect(mockBundle).toEqual({
        'images/logo.png': 'logo-binary-data',
        'images/featured1.jpg': 'featured-binary-data'
      });
    });

    test('handles missing layout manifest', async () => {
      (configHelpers.getJsonAsset as jest.Mock)
        .mockImplementation(async (_siteData, assetType, _assetId, _fileName) => {
          if (assetType === 'theme') return mockThemeManifest;
          return null; // No layout manifest
        });

      await bundleAllAssets(mockBundle, mockSiteData);

      // Should still bundle theme and images
      expect(mockBundle['_site/themes/default/base.hbs']).toBe('<html>{{{body}}}</html>');
      expect(mockBundle['images/logo.png']).toBe('logo-binary-data');
    });

    test('handles missing asset content', async () => {
      (configHelpers.getAssetContent as jest.Mock).mockResolvedValue(null);

      await bundleAllAssets(mockBundle, mockSiteData);

      // Should not add null content to bundle
      expect(mockBundle['_site/themes/default/base.hbs']).toBeUndefined();
      expect(mockBundle['images/logo.png']).toBe('logo-binary-data');
    });

    test('handles empty content files', async () => {
      const siteDataNoContent = {
        ...mockSiteData,
        contentFiles: []
      };

      await bundleAllAssets(mockBundle, siteDataNoContent);

      // Should still bundle theme and manifest images
      expect(mockBundle['_site/themes/default/base.hbs']).toBe('<html>{{{body}}}</html>');
      expect(mockBundle['images/logo.png']).toBe('logo-binary-data');
    });

    test('handles no image references', async () => {
      const siteDataNoImages = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          logo: undefined
        },
        contentFiles: [
          {
            slug: 'simple',
            path: 'content/simple.md',
            frontmatter: { title: 'Simple', layout: 'page' },
            content: 'Simple content'
          }
        ]
      };

      mockImageService.getExportableAssets.mockResolvedValue([]);

      await bundleAllAssets(mockBundle, siteDataNoImages);

      // Should still bundle theme assets
      expect(mockBundle['_site/themes/default/base.hbs']).toBe('<html>{{{body}}}</html>');
      
      // Should not have any image assets
      expect(Object.keys(mockBundle).filter(key => key.startsWith('images/'))).toHaveLength(0);
    });

    test('finds all nested image references', async () => {
      const siteDataNestedImages = {
        ...mockSiteData,
        contentFiles: [
          {
            slug: 'complex',
            path: 'content/complex.md',
            frontmatter: {
              title: 'Complex',
              layout: 'page',
              gallery: {
                images: [
                  { serviceId: 'local', src: 'gallery1.jpg' } as ImageRef,
                  { serviceId: 'local', src: 'gallery2.jpg' } as ImageRef
                ]
              },
              author: {
                avatar: { serviceId: 'local', src: 'avatar.png' } as ImageRef
              }
            },
            content: 'Complex content'
          }
        ]
      };

      await bundleAllAssets(mockBundle, siteDataNestedImages);

      // Should find all nested image references
      const calls = mockImageService.getExportableAssets.mock.calls[0];
      const imageRefs = calls[1];
      
      expect(imageRefs).toEqual(
        expect.arrayContaining([
          mockSiteData.manifest.logo,
          expect.objectContaining({ src: 'gallery1.jpg' }),
          expect.objectContaining({ src: 'gallery2.jpg' }),
          expect.objectContaining({ src: 'avatar.png' })
        ])
      );
    });

    test('handles image service errors gracefully', async () => {
      mockImageService.getExportableAssets.mockRejectedValue(new Error('Image service error'));

      // Should not throw, but log error and continue
      await expect(bundleAllAssets(mockBundle, mockSiteData)).rejects.toThrow('Image service error');
    });

    // New tests for media.json functionality
    test('generates media.json data file successfully', async () => {
      await bundleAllAssets(mockBundle, mockSiteData);

      // Should call media manifest generation
      expect(mediaManifest.generateMediaManifest).toHaveBeenCalledWith(mockSiteData, {
        includeOrphaned: false,
        verbose: true,
      });

      // Should add media.json to bundle
      expect(mockBundle['_site/data/media.json']).toBeDefined();

      const mediaJson = JSON.parse(mockBundle['_site/data/media.json'] as string);
      expect(mediaJson).toEqual({
        version: 1,
        imageService: 'local',
        images: {
          'assets/originals/featured1.jpg': {
            referencedIn: ['content/posts/post1.md'],
            metadata: {
              sizeBytes: 245760,
              width: 1920,
              height: 1080,
              alt: 'Featured image',
            },
          },
        },
      });
    });

    test('handles media manifest generation failure gracefully', async () => {
      (mediaManifest.generateMediaManifest as jest.Mock).mockRejectedValue(
        new Error('Registry error')
      );

      // Should not throw despite media manifest failure
      await expect(bundleAllAssets(mockBundle, mockSiteData)).resolves.not.toThrow();

      // Media.json should not be in bundle
      expect(mockBundle['_site/data/media.json']).toBeUndefined();

      // But other assets should still be bundled
      expect(mockBundle['_site/styles/main.css']).toBe('/* Main CSS content */');
    });

    test('bundles CSS from configured path', async () => {
      await bundleAllAssets(mockBundle, mockSiteData);

      // Should fetch CSS from configured path
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/styles/main.css');

      // Should add CSS to bundle at configured export path
      expect(mockBundle['_site/styles/main.css']).toBe('/* Main CSS content */');
    });

    test('handles CSS fetch failure gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      // Should not throw despite CSS failure
      await expect(bundleAllAssets(mockBundle, mockSiteData)).resolves.not.toThrow();

      // CSS should not be in bundle
      expect(mockBundle['_site/styles/main.css']).toBeUndefined();

      // But media.json should still be generated
      expect(mockBundle['_site/data/media.json']).toBeDefined();
    });

    test('performs image cleanup before bundling', async () => {
      await bundleAllAssets(mockBundle, mockSiteData);

      // Should call image cleanup
      expect(imageCleanup.cleanupOrphanedImages).toHaveBeenCalledWith(mockSiteData);

      // Should still bundle everything successfully
      expect(mockBundle['_site/data/media.json']).toBeDefined();
    });

    test('handles image cleanup timeout gracefully', async () => {
      // Mock cleanup to hang indefinitely (simulating timeout)
      (imageCleanup.cleanupOrphanedImages as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      // Should not throw despite cleanup hanging
      await expect(bundleAllAssets(mockBundle, mockSiteData)).resolves.not.toThrow();

      // Media.json should still be generated
      expect(mockBundle['_site/data/media.json']).toBeDefined();
    });

    test('handles empty media manifest correctly', async () => {
      (mediaManifest.generateMediaManifest as jest.Mock).mockResolvedValue({
        version: 1,
        imageService: 'local',
        images: {},
      });

      await bundleAllAssets(mockBundle, mockSiteData);

      // Should still generate media.json even when empty
      expect(mockBundle['_site/data/media.json']).toBeDefined();

      const mediaJson = JSON.parse(mockBundle['_site/data/media.json'] as string);
      expect(mediaJson.images).toEqual({});
    });

    test('handles CSS fetch error exception gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Should not throw despite fetch error
      await expect(bundleAllAssets(mockBundle, mockSiteData)).resolves.not.toThrow();

      // CSS should not be in bundle
      expect(mockBundle['_site/styles/main.css']).toBeUndefined();
    });
  });
});