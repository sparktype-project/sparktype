/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { buildSiteBundle } from '../../siteBuilder.service';
import type { LocalSiteData } from '@/core/types';
import * as themeService from '../../config/theme.service';
import * as assetBuilder from '../asset.builder';
import * as sourceBuilder from '../source.builder';
import * as metadataBuilder from '../metadata.builder';
import * as pageBuilder from '../page.builder';

// Mock all the builder modules
jest.mock('../../config/theme.service');
jest.mock('../asset.builder');
jest.mock('../source.builder');
jest.mock('../metadata.builder');
jest.mock('../page.builder');
jest.mock('../../fileTree.service');

describe('siteBuilder.service', () => {
  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      title: 'Test Site',
      description: 'Test description',
      structure: [
        {
          type: 'page',
          title: 'Home',
          path: 'index.html',
          slug: 'home'
        }
      ],
      theme: {
        name: 'default',
        config: {
          color_primary: '#0066cc'
        }
      }
    },
    contentFiles: [
      {
        slug: 'home',
        path: 'content/index.md',
        frontmatter: {
          title: 'Home Page',
          layout: 'page'
        },
        content: 'Welcome to our site!'
      }
    ]
  };

  const mockMergedConfig = {
    color_primary: '#0066cc',
    color_background: '#ffffff'
  };

  const mockHtmlPages = {
    'index.html': '<html><body>Home Page Content</body></html>',
    'about.html': '<html><body>About Page Content</body></html>'
  };

  const mockAllStaticNodes = [
    {
      type: 'page' as const,
      title: 'Home',
      path: 'index.html',
      slug: 'home'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock theme service
    (themeService.getMergedThemeDataForForm as jest.Mock).mockResolvedValue({
      schema: null,
      initialConfig: mockMergedConfig
    });

    // Mock builders
    (pageBuilder.generateHtmlPages as jest.Mock).mockResolvedValue(mockHtmlPages);
    (sourceBuilder.bundleSourceFiles as jest.Mock).mockResolvedValue(undefined);
    (assetBuilder.bundleAllAssets as jest.Mock).mockResolvedValue(undefined);
    (metadataBuilder.generateMetadataFiles as jest.Mock).mockReturnValue(undefined);

    // Mock flattenTree
    const fileTreeService = require('../../fileTree.service');
    fileTreeService.flattenTree = jest.fn().mockReturnValue(mockAllStaticNodes);
  });

  describe('buildSiteBundle', () => {
    test('builds complete site bundle successfully', async () => {
      const result = await buildSiteBundle(mockSiteData);

      // Should return the generated HTML pages
      expect(result).toEqual(mockHtmlPages);

      // Should merge theme config
      expect(themeService.getMergedThemeDataForForm).toHaveBeenCalledWith(
        'default',
        { color_primary: '#0066cc' }
      );

      // Should call all builders in correct order
      expect(pageBuilder.generateHtmlPages).toHaveBeenCalledWith(
        expect.objectContaining({
          manifest: expect.objectContaining({
            theme: expect.objectContaining({
              config: mockMergedConfig
            })
          })
        }),
        mockAllStaticNodes
      );

      expect(sourceBuilder.bundleSourceFiles).toHaveBeenCalledWith(
        mockHtmlPages,
        expect.any(Object)
      );

      expect(assetBuilder.bundleAllAssets).toHaveBeenCalledWith(
        mockHtmlPages,
        expect.any(Object)
      );

      expect(metadataBuilder.generateMetadataFiles).toHaveBeenCalledWith(
        mockHtmlPages,
        expect.any(Object),
        mockAllStaticNodes
      );
    });

    test('throws error when content files are not loaded', async () => {
      const siteDataWithoutContent = {
        ...mockSiteData,
        contentFiles: undefined
      };

      await expect(buildSiteBundle(siteDataWithoutContent))
        .rejects
        .toThrow('Cannot build site: content files are not loaded.');
    });

    test('handles theme config merging failure gracefully', async () => {
      (themeService.getMergedThemeDataForForm as jest.Mock).mockRejectedValue(
        new Error('Theme config error')
      );

      await expect(buildSiteBundle(mockSiteData))
        .rejects
        .toThrow('Theme config error');
    });

    test('synchronizes site data with merged theme config', async () => {
      await buildSiteBundle(mockSiteData);

      // Verify the synchronized site data has merged config
      const [[synchronizedSiteData]] = (pageBuilder.generateHtmlPages as jest.Mock).mock.calls;
      
      expect(synchronizedSiteData.manifest.theme.config).toEqual(mockMergedConfig);
      expect(synchronizedSiteData.siteId).toBe('test-site');
      expect(synchronizedSiteData.contentFiles).toEqual(mockSiteData.contentFiles);
    });

    test('passes flattened nodes to all relevant builders', async () => {
      await buildSiteBundle(mockSiteData);

      // Verify flattenTree was called with correct parameters
      const fileTreeService = require('../../fileTree.service');
      expect(fileTreeService.flattenTree).toHaveBeenCalledWith(
        mockSiteData.manifest.structure,
        mockSiteData.contentFiles
      );

      // Verify builders received the flattened nodes
      expect(pageBuilder.generateHtmlPages).toHaveBeenCalledWith(
        expect.any(Object),
        mockAllStaticNodes
      );

      expect(metadataBuilder.generateMetadataFiles).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        mockAllStaticNodes
      );
    });

    test('handles empty content files array', async () => {
      const siteDataEmptyContent = {
        ...mockSiteData,
        contentFiles: []
      };

      const result = await buildSiteBundle(siteDataEmptyContent);

      expect(result).toEqual(mockHtmlPages);
      expect(pageBuilder.generateHtmlPages).toHaveBeenCalledWith(
        expect.objectContaining({
          contentFiles: []
        }),
        mockAllStaticNodes
      );
    });

    test('preserves all site data properties during synchronization', async () => {
      const siteDataWithExtras = {
        ...mockSiteData,
        layoutFiles: [{ path: 'layout.json', content: '{}' }],
        themeFiles: [{ path: 'theme.css', content: 'body {}' }],
        dataFiles: { 'categories.json': '[]' },
        secrets: { apiKey: 'secret' }
      };

      await buildSiteBundle(siteDataWithExtras);

      const [[synchronizedSiteData]] = (pageBuilder.generateHtmlPages as jest.Mock).mock.calls;
      
      expect(synchronizedSiteData.layoutFiles).toEqual(siteDataWithExtras.layoutFiles);
      expect(synchronizedSiteData.themeFiles).toEqual(siteDataWithExtras.themeFiles);
      expect(synchronizedSiteData.dataFiles).toEqual(siteDataWithExtras.dataFiles);
      expect(synchronizedSiteData.secrets).toEqual(siteDataWithExtras.secrets);
    });

    test('handles builder failures', async () => {
      (pageBuilder.generateHtmlPages as jest.Mock).mockRejectedValue(
        new Error('Page generation failed')
      );

      await expect(buildSiteBundle(mockSiteData))
        .rejects
        .toThrow('Page generation failed');
    });

    test('accumulates bundle content from all builders', async () => {
      // Mock builders to add content to bundle
      (sourceBuilder.bundleSourceFiles as jest.Mock).mockImplementation((bundle) => {
        bundle['_signum/manifest.json'] = '{"title":"Test"}';
        bundle['_signum/content/index.md'] = '# Home';
      });

      (assetBuilder.bundleAllAssets as jest.Mock).mockImplementation((bundle) => {
        bundle['themes/default/theme.css'] = 'body { margin: 0; }';
        bundle['images/logo.png'] = 'binary-data';
      });

      (metadataBuilder.generateMetadataFiles as jest.Mock).mockImplementation((bundle) => {
        bundle['sitemap.xml'] = '<sitemap></sitemap>';
        bundle['rss.xml'] = '<rss></rss>';
      });

      const result = await buildSiteBundle(mockSiteData);

      // Should include HTML pages and all builder additions
      expect(result).toEqual({
        'index.html': '<html><body>Home Page Content</body></html>',
        'about.html': '<html><body>About Page Content</body></html>',
        '_signum/manifest.json': '{"title":"Test"}',
        '_signum/content/index.md': '# Home',
        'themes/default/theme.css': 'body { margin: 0; }',
        'images/logo.png': 'binary-data',
        'sitemap.xml': '<sitemap></sitemap>',
        'rss.xml': '<rss></rss>'
      });
    });
  });
});