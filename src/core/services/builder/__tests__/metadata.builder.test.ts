/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { generateMetadataFiles } from '../metadata.builder';
import type { LocalSiteData, SiteBundle } from '@/core/types';
import * as urlUtils from '../../urlUtils.service';

// Mock dependencies
jest.mock('../../urlUtils.service', () => ({
  getUrlForNode: jest.fn()
}));

describe('metadata.builder', () => {
  const mockSiteData: LocalSiteData = {
    siteId: 'test-site',
    manifest: {
      title: 'Test Site',
      description: 'A test website for unit testing',
      baseUrl: 'https://example.com',
      author: 'Test Author',
      structure: []
    },
    contentFiles: [
      {
        slug: 'home',
        path: 'content/index.md',
        frontmatter: {
          title: 'Home Page',
          layout: 'page',
          date: '2024-01-01T10:00:00Z',
          description: 'Home page description'
        },
        content: 'Welcome to our site!'
      },
      {
        slug: 'about',
        path: 'content/about.md',
        frontmatter: {
          title: 'About Us',
          layout: 'page',
          date: '2024-01-02T15:30:00Z',
          description: 'About page description'
        },
        content: 'Learn more about us.'
      },
      {
        slug: 'blog-post',
        path: 'content/blog/post.md',
        frontmatter: {
          title: 'Blog Post',
          layout: 'blog',
          date: '2024-01-03T12:00:00Z'
        },
        content: 'Blog content'
      }
    ]
  };

  const mockAllStaticNodes = [
    {
      type: 'page' as const,
      title: 'Home Page',
      path: 'content/index.md',
      slug: 'home'
    },
    {
      type: 'page' as const,
      title: 'About Us',
      path: 'content/about.md',
      slug: 'about'
    },
    {
      type: 'page' as const,
      title: 'Blog Post',
      path: 'content/blog/post.md',
      slug: 'blog-post'
    }
  ];

  let mockBundle: SiteBundle;

  beforeEach(() => {
    mockBundle = {};
    
    // Mock urlUtils.getUrlForNode to return expected paths
    (urlUtils.getUrlForNode as jest.Mock).mockImplementation((node) => {
      if (node.slug === 'home') return '/';
      if (node.slug === 'about') return '/about/';
      if (node.slug === 'blog-post') return '/blog-post/';
      return `/${node.slug}/`;
    });
  });

  describe('generateMetadataFiles', () => {
    test('generates sitemap.xml correctly', () => {
      generateMetadataFiles(mockBundle, mockSiteData, mockAllStaticNodes);

      expect(mockBundle['sitemap.xml']).toBeDefined();
      
      const sitemap = mockBundle['sitemap.xml'] as string;
      
      // Should be valid XML
      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemap).toContain('</urlset>');
      
      // Should include all pages
      expect(sitemap).toContain('<loc>https://example.com/');
      expect(sitemap).toContain('<loc>https://example.com/about/');
      expect(sitemap).toContain('<loc>https://example.com/blog-post/');
      
      // Should include lastmod dates
      expect(sitemap).toContain('<lastmod>2024-01-01</lastmod>');
      expect(sitemap).toContain('<lastmod>2024-01-02</lastmod>');
      expect(sitemap).toContain('<lastmod>2024-01-03</lastmod>');
    });

    test('generates RSS feed correctly', () => {
      generateMetadataFiles(mockBundle, mockSiteData, mockAllStaticNodes);

      expect(mockBundle['rss.xml']).toBeDefined();
      
      const rss = mockBundle['rss.xml'] as string;
      
      // Should be valid RSS XML
      expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(rss).toContain('<rss version="2.0"');
      expect(rss).toContain('</rss>');
      
      // Should include channel info
      expect(rss).toContain('<title>Test Site</title>');
      expect(rss).toContain('<description>A test website for unit testing</description>');
      expect(rss).toContain('<link>https://example.com</link>');
      
      // Should include items for pages
      expect(rss).toContain('<item>');
      expect(rss).toContain('</item>');
    });

    test('handles missing baseUrl gracefully', () => {
      const siteDataNoBaseUrl = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          baseUrl: undefined
        }
      };

      generateMetadataFiles(mockBundle, siteDataNoBaseUrl, mockAllStaticNodes);

      const sitemap = mockBundle['sitemap.xml'] as string;
      const rss = mockBundle['rss.xml'] as string;
      
      // Should use empty base or handle gracefully
      expect(sitemap).toBeDefined();
      expect(rss).toBeDefined();
    });

    test('handles empty pages list', () => {
      generateMetadataFiles(mockBundle, mockSiteData, []);

      const sitemap = mockBundle['sitemap.xml'] as string;
      const rss = mockBundle['rss.xml'] as string;
      
      // Should still generate valid files
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemap).toContain('</urlset>');
      expect(rss).toContain('<rss version="2.0"');
      expect(rss).toContain('</rss>');
    });

    test('handles special characters in URLs', () => {
      const siteDataWithSpecialChars = {
        ...mockSiteData,
        contentFiles: [
          {
            slug: 'cafe-resume',
            path: 'cafe-resume/index.html',
            frontmatter: {
              title: 'Café & Résumé',
              layout: 'page',
              date: '2024-01-01T10:00:00Z'
            },
            content: 'Content with special chars'
          },
          {
            slug: 'quotes',
            path: 'quotes/index.html',
            frontmatter: {
              title: 'Test with "Quotes"',
              layout: 'page',
              date: '2024-01-02T10:00:00Z'
            },
            content: 'Content with quotes'
          }
        ]
      };

      const nodesWithSpecialChars = [
        {
          type: 'page' as const,
          title: 'Café & Résumé',
          path: 'cafe-resume/index.html',
          slug: 'cafe-resume'
        },
        {
          type: 'page' as const,
          title: 'Test with "Quotes"',
          path: 'quotes/index.html',
          slug: 'quotes'
        }
      ];

      generateMetadataFiles(mockBundle, siteDataWithSpecialChars, nodesWithSpecialChars);

      const sitemap = mockBundle['sitemap.xml'] as string;
      const rss = mockBundle['rss.xml'] as string;
      
      // Should properly encode URLs and escape XML
      expect(sitemap).toContain('cafe-resume/');
      expect(rss).toContain('Café &amp; Résumé');
      expect(rss).toContain('Test with &quot;Quotes&quot;');
    });

    test('includes correct lastmod dates in sitemap', () => {
      generateMetadataFiles(mockBundle, mockSiteData, mockAllStaticNodes);

      const sitemap = mockBundle['sitemap.xml'] as string;
      
      // Should include lastmod with date format (YYYY-MM-DD)
      expect(sitemap).toContain('<lastmod>');
      expect(sitemap).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    });

    test('includes publication dates in RSS items', () => {
      generateMetadataFiles(mockBundle, mockSiteData, mockAllStaticNodes);

      const rss = mockBundle['rss.xml'] as string;
      
      // Should include pubDate for RSS items
      expect(rss).toContain('<pubDate>');
      expect(rss).toMatch(/<pubDate>[^<]+<\/pubDate>/);
    });

    test('generates valid XML without HTML entities issues', () => {
      const siteDataSpecialChars = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          title: 'Site with & Ampersand',
          description: 'Description with <tags> and "quotes"'
        }
      };

      generateMetadataFiles(mockBundle, siteDataSpecialChars, mockAllStaticNodes);

      const sitemap = mockBundle['sitemap.xml'] as string;
      const rss = mockBundle['rss.xml'] as string;
      
      // Should properly escape XML entities
      expect(rss).toContain('Site with &amp; Ampersand');
      expect(rss).toContain('Description with &lt;tags&gt; and &quot;quotes&quot;');
      
      // Should not contain unescaped entities
      expect(rss).not.toContain('Site with & Ampersand');
      expect(rss).not.toContain('<tags>');
    });

    test('uses correct MIME types and formatting', () => {
      generateMetadataFiles(mockBundle, mockSiteData, mockAllStaticNodes);

      const sitemap = mockBundle['sitemap.xml'] as string;
      const rss = mockBundle['rss.xml'] as string;
      
      // Sitemap should have proper namespace
      expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      
      // RSS should have proper version and structure
      expect(rss).toContain('version="2.0"');
      expect(rss).toContain('<channel>');
      expect(rss).toContain('</channel>');
    });

    test('handles long descriptions gracefully', () => {
      const siteDataLongDesc = {
        ...mockSiteData,
        manifest: {
          ...mockSiteData.manifest,
          description: 'A'.repeat(1000) // Very long description
        }
      };

      generateMetadataFiles(mockBundle, siteDataLongDesc, mockAllStaticNodes);

      const rss = mockBundle['rss.xml'] as string;
      
      // Should handle long descriptions without breaking XML
      expect(rss).toBeDefined();
      expect(rss).toContain('<description>');
      expect(rss).toContain('</description>');
    });

    test('preserves bundle existing content', () => {
      // Pre-populate bundle with existing content
      mockBundle['existing-file.txt'] = 'existing content';
      mockBundle['images/logo.png'] = 'binary data';

      generateMetadataFiles(mockBundle, mockSiteData, mockAllStaticNodes);

      // Should preserve existing content
      expect(mockBundle['existing-file.txt']).toBe('existing content');
      expect(mockBundle['images/logo.png']).toBe('binary data');
      
      // Should add new metadata files
      expect(mockBundle['sitemap.xml']).toBeDefined();
      expect(mockBundle['rss.xml']).toBeDefined();
    });
  });
});