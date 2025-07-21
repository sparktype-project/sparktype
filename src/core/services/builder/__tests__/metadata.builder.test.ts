// src/core/services/builder/__tests__/metadata.builder.test.ts

import { generateMetadataFiles } from '../metadata.builder';
import type { LocalSiteData, SiteBundle, StructureNode, CollectionItemRef } from '@/core/types';
import * as urlUtils from '../../urlUtils.service';

// Mock the urlUtils service
jest.mock('../../urlUtils.service', () => ({
  getUrlForNode: jest.fn()
}));

describe('metadata.builder', () => {
  // --- Refactored Test Data ---
  // The mock data is now more realistic. 'collectionItems' are explicitly part of the manifest,
  // and 'structure' only contains the regular pages, as per the new unified model.

  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      siteId: 'test-site',
      generatorVersion: '1.0.0',
      title: 'Test Site with & "Special Chars"',
      description: 'A test website with < and >',
      baseUrl: 'https://example.com',
      author: 'Test Author',
      theme: { name: 'default', config: {} },
      structure: [
        { type: 'page', title: 'Home Page', path: 'content/index.md', slug: 'home' },
        { type: 'page', title: 'About Us', path: 'content/about.md', slug: 'about' }
      ],
      collectionItems: [
        {
          collectionId: 'blog',
          title: 'Blog Post',
          path: 'content/blog/post.md',
          slug: 'blog-post',
          url: '/blog/blog-post'
        }
      ]
    },
    contentFiles: [
      {
        slug: 'home',
        path: 'content/index.md',
        frontmatter: { title: 'Home Page', layout: 'page', date: '2024-01-01T10:00:00Z', description: 'Home page description' },
        content: 'Welcome!'
      },
      {
        slug: 'about',
        path: 'content/about.md',
        frontmatter: { title: 'About Us', layout: 'page', date: '2024-01-02T15:30:00Z', description: 'About page description' },
        content: 'Learn more.'
      },
      {
        slug: 'blog-post',
        path: 'content/blog/post.md',
        frontmatter: { title: 'Blog Post', layout: 'blog', date: '2024-01-03T12:00:00Z' },
        content: 'Blog content.'
      }
    ]
  };

  let mockBundle: SiteBundle;

  beforeEach(() => {
    mockBundle = {};
    // Mock the unified getUrlForNode to return expected paths for both pages and items.
    (urlUtils.getUrlForNode as jest.Mock).mockImplementation((node: StructureNode | CollectionItemRef) => {
      if (node.slug === 'home') return '/';
      if (node.slug === 'about') return '/about/';
      if (node.slug === 'blog-post') return '/blog/blog-post/'; // Example static URL for a collection item
      return `/${node.slug}/`;
    });
  });

  describe('generateMetadataFiles', () => {
    test('generates sitemap.xml including both pages and collection items', () => {
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, mockSiteData);

      expect(mockBundle['sitemap.xml']).toBeDefined();
      const sitemap = mockBundle['sitemap.xml'] as string;

      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

      // Should include ALL content: 2 pages + 1 collection item
      expect(sitemap).toContain('<loc>https://example.com/</loc>');
      expect(sitemap).toContain('<loc>https://example.com/about/</loc>');
      expect(sitemap).toContain('<loc>https://example.com/blog/blog-post/</loc>');

      // Should include lastmod dates for all content
      expect(sitemap).toContain('<lastmod>2024-01-01</lastmod>');
      expect(sitemap).toContain('<lastmod>2024-01-02</lastmod>');
      expect(sitemap).toContain('<lastmod>2024-01-03</lastmod>');
    });

    test('generates RSS feed including all dated content', () => {
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, mockSiteData);

      expect(mockBundle['rss.xml']).toBeDefined();
      const rss = mockBundle['rss.xml'] as string;

      expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(rss).toContain('<rss version="2.0"');

      // Should correctly escape special characters from the manifest title and description.
      expect(rss).toContain('<title>Test Site with & "Special Chars"</title>');
      expect(rss).toContain('<description>A test website with < and ></description>');
      expect(rss).toContain('<link>https://example.com</link>');

      // Should include items for all pages with a `date` in frontmatter
      expect(rss.match(/<item>/g)?.length).toBe(3);
      expect(rss).toContain('<title>Home Page</title>');
      expect(rss).toContain('<title>About Us</title>');
      expect(rss).toContain('<title>Blog Post</title>');
      expect(rss).toContain('<description>Home page description</description>');
    });

    test('handles missing baseUrl gracefully', () => {
      const siteDataNoBaseUrl = {
        ...mockSiteData,
        manifest: { ...mockSiteData.manifest, baseUrl: undefined }
      };
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, siteDataNoBaseUrl);

      const sitemap = mockBundle['sitemap.xml'] as string;
      const rss = mockBundle['rss.xml'] as string;

      // Should default to a placeholder domain
      expect(sitemap).toContain('<loc>https://example.com/');
      expect(rss).toContain('<link>https://example.com</link>');
    });

    test('handles empty content lists gracefully', () => {
      const siteDataEmpty = {
        ...mockSiteData,
        manifest: { ...mockSiteData.manifest, structure: [], collectionItems: [] },
        contentFiles: []
      };
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, siteDataEmpty);

      const sitemap = mockBundle['sitemap.xml'] as string;
      const rss = mockBundle['rss.xml'] as string;

      // Should generate valid, empty files
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
      expect(rss).not.toContain('<item>');
    });

    test('preserves existing content in the bundle', () => {
      mockBundle['existing-file.txt'] = 'some content';
      // CORRECTED: Call with the new, 2-argument signature.
      generateMetadataFiles(mockBundle, mockSiteData);
      expect(mockBundle['existing-file.txt']).toBe('some content');
      expect(mockBundle['sitemap.xml']).toBeDefined();
    });
  });
});