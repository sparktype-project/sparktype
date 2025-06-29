/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { bundleSourceFiles } from '../source.builder';
import type { LocalSiteData, SiteBundle } from '@/core/types';
import * as markdownParser from '../../../libraries/markdownParser';
import * as localSiteFs from '../../localFileSystem.service';

// Mock dependencies
jest.mock('../../../libraries/markdownParser');
jest.mock('../../localFileSystem.service');

describe('source.builder', () => {
  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
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
      },
      {
        slug: 'about',
        path: 'content/about.md',
        frontmatter: {
          title: 'About Us',
          layout: 'page',
          author: 'John Doe'
        },
        content: 'Learn more about us.'
      }
    ]
  };

  const mockDataFiles = {
    'data/categories.json': '["tech", "lifestyle", "travel"]',
    'data/config.yaml': 'site_config: true',
    'data/authors.json': '[{"name": "John", "bio": "Writer"}]'
  };

  let mockBundle: SiteBundle;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBundle = {};

    // Mock markdownParser
    (markdownParser.stringifyToMarkdown as jest.Mock)
      .mockImplementation((frontmatter, content) => {
        const frontmatterYaml = Object.entries(frontmatter)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join('\n');
        return `---\n${frontmatterYaml}\n---\n${content}`;
      });

    // Mock localFileSystem
    (localSiteFs.getAllDataFiles as jest.Mock).mockResolvedValue(mockDataFiles);
  });

  describe('bundleSourceFiles', () => {
    test('adds synchronized manifest to bundle', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      expect(mockBundle['_site/manifest.json']).toBeDefined();
      
      const manifestContent = JSON.parse(mockBundle['_site/manifest.json'] as string);
      expect(manifestContent).toEqual(mockSiteData.manifest);
      expect(manifestContent.title).toBe('Test Site');
      expect(manifestContent.theme.name).toBe('default');
    });

    test('adds all content files to bundle with correct paths', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      expect(mockBundle['_site/content/index.md']).toBeDefined();
      expect(mockBundle['_site/content/about.md']).toBeDefined();

      // Verify content format
      const homeContent = mockBundle['_site/content/index.md'] as string;
      expect(homeContent).toContain('---');
      expect(homeContent).toContain('title: "Home Page"');
      expect(homeContent).toContain('layout: "page"');
      expect(homeContent).toContain('Welcome to our site!');

      const aboutContent = mockBundle['_site/content/about.md'] as string;
      expect(aboutContent).toContain('title: "About Us"');
      expect(aboutContent).toContain('author: "John Doe"');
      expect(aboutContent).toContain('Learn more about us.');
    });

    test('calls stringifyToMarkdown for each content file', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      expect(markdownParser.stringifyToMarkdown).toHaveBeenCalledTimes(2);
      
      expect(markdownParser.stringifyToMarkdown).toHaveBeenCalledWith(
        {
          title: 'Home Page',
          layout: 'page'
        },
        'Welcome to our site!'
      );

      expect(markdownParser.stringifyToMarkdown).toHaveBeenCalledWith(
        {
          title: 'About Us',
          layout: 'page',
          author: 'John Doe'
        },
        'Learn more about us.'
      );
    });

    test('adds all data files to bundle', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      expect(localSiteFs.getAllDataFiles).toHaveBeenCalledWith('test-site');

      expect(mockBundle['_site/data/categories.json']).toBe('["tech", "lifestyle", "travel"]');
      expect(mockBundle['_site/data/config.yaml']).toBe('site_config: true');
      expect(mockBundle['_site/data/authors.json']).toBe('[{"name": "John", "bio": "Writer"}]');
    });

    test('handles empty content files', async () => {
      const siteDataEmpty = {
        ...mockSiteData,
        contentFiles: []
      };

      await bundleSourceFiles(mockBundle, siteDataEmpty);

      // Should still add manifest and data files
      expect(mockBundle['_site/manifest.json']).toBeDefined();
      expect(mockBundle['_site/data/categories.json']).toBe('["tech", "lifestyle", "travel"]');
      
      // Should not have any content files
      expect(Object.keys(mockBundle).filter(key => key.startsWith('_site/content/'))).toHaveLength(0);
    });

    test('handles undefined content files', async () => {
      const siteDataUndefined = {
        ...mockSiteData,
        contentFiles: undefined
      };

      await bundleSourceFiles(mockBundle, siteDataUndefined);

      // Should still add manifest and data files
      expect(mockBundle['_site/manifest.json']).toBeDefined();
      expect(mockBundle['_site/data/categories.json']).toBe('["tech", "lifestyle", "travel"]');
      
      // Should not call stringifyToMarkdown
      expect(markdownParser.stringifyToMarkdown).not.toHaveBeenCalled();
    });

    test('handles empty data files', async () => {
      (localSiteFs.getAllDataFiles as jest.Mock).mockResolvedValue({});

      await bundleSourceFiles(mockBundle, mockSiteData);

      // Should still add manifest and content files
      expect(mockBundle['_site/manifest.json']).toBeDefined();
      expect(mockBundle['_site/content/index.md']).toBeDefined();
      
      // Should not have any data files
      expect(Object.keys(mockBundle).filter(key => key.startsWith('_site/data/'))).toHaveLength(0);
    });

    test('handles non-string data files', async () => {
      const mixedDataFiles = {
        'data/valid.json': '{"valid": true}',
        'data/invalid.bin': null as any,
        'data/another.txt': 'text content'
      };

      (localSiteFs.getAllDataFiles as jest.Mock).mockResolvedValue(mixedDataFiles);

      await bundleSourceFiles(mockBundle, mockSiteData);

      // Should only add string data files
      expect(mockBundle['_site/data/valid.json']).toBe('{"valid": true}');
      expect(mockBundle['_site/data/another.txt']).toBe('text content');
      expect(mockBundle['_site/data/invalid.bin']).toBeUndefined();
    });

    test('preserves manifest structure exactly', async () => {
      const complexManifest = {
        ...mockSiteData.manifest,
        author: 'Site Author',
        baseUrl: 'https://example.com',
        customField: 'custom value',
        settings: {
          imageService: 'cloudinary' as const,
          customSetting: true
        }
      };

      const siteDataComplex = {
        ...mockSiteData,
        manifest: complexManifest
      };

      await bundleSourceFiles(mockBundle, siteDataComplex);

      const manifestContent = JSON.parse(mockBundle['_site/manifest.json'] as string);
      expect(manifestContent).toEqual(complexManifest);
      expect(manifestContent.author).toBe('Site Author');
      expect(manifestContent.settings.imageService).toBe('cloudinary');
      expect(manifestContent.settings.customSetting).toBe(true);
    });

    test('formats manifest JSON with proper indentation', async () => {
      await bundleSourceFiles(mockBundle, mockSiteData);

      const manifestJson = mockBundle['_site/manifest.json'] as string;
      
      // Should be formatted with 2-space indentation
      expect(manifestJson).toContain('{\n  "title":');
      expect(manifestJson).toContain('\n  "description":');
      expect(manifestJson).toContain('\n}');
    });

    test('handles data file loading errors', async () => {
      (localSiteFs.getAllDataFiles as jest.Mock).mockRejectedValue(new Error('File system error'));

      await expect(bundleSourceFiles(mockBundle, mockSiteData))
        .rejects
        .toThrow('File system error');
    });

    test('handles complex frontmatter correctly', async () => {
      const siteDataComplex = {
        ...mockSiteData,
        contentFiles: [
          {
            slug: 'complex',
            path: 'content/complex.md',
            frontmatter: {
              title: 'Complex Post',
              layout: 'blog',
              tags: ['tech', 'tutorial'],
              metadata: {
                seo: {
                  title: 'SEO Title',
                  description: 'SEO Description'
                }
              },
              published: true,
              publishDate: '2024-01-01'
            },
            content: 'Complex content here'
          }
        ]
      };

      await bundleSourceFiles(mockBundle, siteDataComplex);

      expect(markdownParser.stringifyToMarkdown).toHaveBeenCalledWith(
        {
          title: 'Complex Post',
          layout: 'blog',
          tags: ['tech', 'tutorial'],
          metadata: {
            seo: {
              title: 'SEO Title',
              description: 'SEO Description'
            }
          },
          published: true,
          publishDate: '2024-01-01'
        },
        'Complex content here'
      );
    });
  });
});