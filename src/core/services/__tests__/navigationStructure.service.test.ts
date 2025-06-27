/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { generateNavLinks } from '../navigationStructure.service';
import type { LocalSiteData, StructureNode, Manifest, ParsedMarkdownFile, MarkdownFrontmatter } from '@/core/types';

// Mock the dependencies
jest.mock('../urlUtils.service', () => ({
  getUrlForNode: jest.fn()
}));

jest.mock('../relativePaths.service', () => ({
  getRelativePath: jest.fn()
}));

import { getUrlForNode } from '../urlUtils.service';
import { getRelativePath } from '../relativePaths.service';

const mockGetUrlForNode = getUrlForNode as jest.MockedFunction<typeof getUrlForNode>;
const mockGetRelativePath = getRelativePath as jest.MockedFunction<typeof getRelativePath>;

describe('navigationStructure.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper functions to create test data
  const createFrontmatter = (overrides: Partial<MarkdownFrontmatter> = {}): MarkdownFrontmatter => ({
    title: 'Default Title',
    layout: 'page',
    ...overrides
  });

  const createContentFile = (
    path: string, 
    frontmatter: Partial<MarkdownFrontmatter> = {}
  ): ParsedMarkdownFile => ({
    slug: path.replace('content/', '').replace('.md', ''),
    path,
    frontmatter: createFrontmatter(frontmatter),
    content: `# ${frontmatter.title || 'Default Title'}\n\nSample content.`
  });

  const createNode = (
    path: string, 
    title: string,
    navOrder?: number,
    menuTitle?: string,
    children?: StructureNode[]
  ): StructureNode => ({
    type: 'page',
    title,
    path,
    slug: path.replace('content/', '').replace('.md', ''),
    navOrder,
    menuTitle,
    children
  });

  const createManifest = (structure: StructureNode[]): Manifest => ({
    siteId: 'test-site',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'A test site',
    theme: { name: 'default', config: {} },
    structure
  });

  const createSiteData = (
    structure: StructureNode[],
    contentFiles: ParsedMarkdownFile[]
  ): LocalSiteData => ({
    siteId: 'test-site',
    manifest: createManifest(structure),
    contentFiles
  });

  describe('generateNavLinks', () => {
    describe('Basic Navigation Generation', () => {
      test('generates navigation links for simple structure', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/about.md', 'About', 2),
          createNode('content/contact.md', 'Contact', 3)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' }),
          createContentFile('content/contact.md', { title: 'Contact' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('') // Home
          .mockReturnValueOnce('about') // About
          .mockReturnValueOnce('contact'); // Contact

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({
          href: '/site',
          label: 'Home',
          children: []
        });
        expect(result[1]).toEqual({
          href: '/site/about',
          label: 'About',
          children: []
        });
        expect(result[2]).toEqual({
          href: '/site/contact',
          label: 'Contact',
          children: []
        });
      });

      test('filters out nodes without navOrder', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/about.md', 'About'), // No navOrder
          createNode('content/contact.md', 'Contact', 3)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' }),
          createContentFile('content/contact.md', { title: 'Contact' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('') // Home
          .mockReturnValueOnce('contact'); // Contact

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('Home');
        expect(result[1].label).toBe('Contact');
      });

      test('sorts nodes by navOrder', () => {
        const structure = [
          createNode('content/contact.md', 'Contact', 30),
          createNode('content/home.md', 'Home', 10),
          createNode('content/about.md', 'About', 20)
        ];

        const contentFiles = [
          createContentFile('content/contact.md', { title: 'Contact' }),
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('') // Home
          .mockReturnValueOnce('about') // About
          .mockReturnValueOnce('contact'); // Contact

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(3);
        expect(result[0].label).toBe('Home'); // navOrder 10
        expect(result[1].label).toBe('About'); // navOrder 20
        expect(result[2].label).toBe('Contact'); // navOrder 30
      });

      test('uses menuTitle when available', () => {
        const structure = [
          createNode('content/about.md', 'About Us Page', 1, 'About'),
          createNode('content/contact.md', 'Contact Information', 2, 'Get in Touch')
        ];

        const contentFiles = [
          createContentFile('content/about.md', { title: 'About Us Page' }),
          createContentFile('content/contact.md', { title: 'Contact Information' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('about')
          .mockReturnValueOnce('contact');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].label).toBe('About'); // menuTitle, not title
        expect(result[1].label).toBe('Get in Touch'); // menuTitle, not title
      });

      test('falls back to title when menuTitle not available', () => {
        const structure = [
          createNode('content/home.md', 'Home Page', 1), // No menuTitle
          createNode('content/about.md', 'About', 2, 'About Us') // Has menuTitle
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home Page' }),
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('')
          .mockReturnValueOnce('about');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].label).toBe('Home Page'); // Uses title
        expect(result[1].label).toBe('About Us'); // Uses menuTitle
      });
    });

    describe('Nested Navigation', () => {
      test('generates nested navigation structure', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/products.md', 'Products', 2, undefined, [
            createNode('content/products/software.md', 'Software', 1),
            createNode('content/products/hardware.md', 'Hardware', 2)
          ])
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/products.md', { title: 'Products' }),
          createContentFile('content/products/software.md', { title: 'Software' }),
          createContentFile('content/products/hardware.md', { title: 'Hardware' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('')
          .mockReturnValueOnce('products')
          .mockReturnValueOnce('products/software')
          .mockReturnValueOnce('products/hardware');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('Home');
        expect(result[0].children).toEqual([]);

        expect(result[1].label).toBe('Products');
        expect(result[1].children).toHaveLength(2);
        expect(result[1].children[0]).toEqual({
          href: '/site/products/software',
          label: 'Software',
          children: []
        });
        expect(result[1].children[1]).toEqual({
          href: '/site/products/hardware',
          label: 'Hardware',
          children: []
        });
      });

      test('filters children without navOrder', () => {
        const structure = [
          createNode('content/products.md', 'Products', 1, undefined, [
            createNode('content/products/software.md', 'Software', 1),
            createNode('content/products/services.md', 'Services'), // No navOrder
            createNode('content/products/hardware.md', 'Hardware', 2)
          ])
        ];

        const contentFiles = [
          createContentFile('content/products.md', { title: 'Products' }),
          createContentFile('content/products/software.md', { title: 'Software' }),
          createContentFile('content/products/services.md', { title: 'Services' }),
          createContentFile('content/products/hardware.md', { title: 'Hardware' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('products')
          .mockReturnValueOnce('products/software')
          .mockReturnValueOnce('products/hardware');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].children).toHaveLength(2); // services filtered out
        expect(result[0].children[0].label).toBe('Software');
        expect(result[0].children[1].label).toBe('Hardware');
      });

      test('handles deeply nested structures', () => {
        const structure = [
          createNode('content/docs.md', 'Documentation', 1, undefined, [
            createNode('content/docs/api.md', 'API', 1, undefined, [
              createNode('content/docs/api/auth.md', 'Authentication', 1),
              createNode('content/docs/api/endpoints.md', 'Endpoints', 2)
            ])
          ])
        ];

        const contentFiles = [
          createContentFile('content/docs.md', { title: 'Documentation' }),
          createContentFile('content/docs/api.md', { title: 'API' }),
          createContentFile('content/docs/api/auth.md', { title: 'Authentication' }),
          createContentFile('content/docs/api/endpoints.md', { title: 'Endpoints' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('docs')
          .mockReturnValueOnce('docs/api')
          .mockReturnValueOnce('docs/api/auth')
          .mockReturnValueOnce('docs/api/endpoints');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Documentation');
        expect(result[0].children).toHaveLength(1);
        expect(result[0].children[0].label).toBe('API');
        expect(result[0].children[0].children).toHaveLength(2);
        expect(result[0].children[0].children[0].label).toBe('Authentication');
        expect(result[0].children[0].children[1].label).toBe('Endpoints');
      });
    });

    describe('Collection Page Handling', () => {
      test('excludes children of collection pages from navigation', () => {
        const structure = [
          createNode('content/blog.md', 'Blog', 1, undefined, [
            createNode('content/blog/post1.md', 'Post 1', 1),
            createNode('content/blog/post2.md', 'Post 2', 2)
          ])
        ];

        const contentFiles = [
          createContentFile('content/blog.md', { 
            title: 'Blog',
            collection: { sort_by: 'date', sort_order: 'desc' }
          }),
          createContentFile('content/blog/post1.md', { title: 'Post 1' }),
          createContentFile('content/blog/post2.md', { title: 'Post 2' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode.mockReturnValueOnce('blog');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Blog');
        expect(result[0].children).toEqual([]); // Children excluded because it's a collection
      });

      test('includes children of non-collection pages', () => {
        const structure = [
          createNode('content/services.md', 'Services', 1, undefined, [
            createNode('content/services/web.md', 'Web Development', 1),
            createNode('content/services/mobile.md', 'Mobile Apps', 2)
          ])
        ];

        const contentFiles = [
          createContentFile('content/services.md', { 
            title: 'Services'
            // No collection property
          }),
          createContentFile('content/services/web.md', { title: 'Web Development' }),
          createContentFile('content/services/mobile.md', { title: 'Mobile Apps' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('services')
          .mockReturnValueOnce('services/web')
          .mockReturnValueOnce('services/mobile');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].children).toHaveLength(2); // Children included
        expect(result[0].children[0].label).toBe('Web Development');
        expect(result[0].children[1].label).toBe('Mobile Apps');
      });
    });

    describe('URL Generation Modes', () => {
      test('generates preview mode URLs correctly', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/about.md', 'About', 2)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/mysite' };

        mockGetUrlForNode
          .mockReturnValueOnce('') // Home returns empty string
          .mockReturnValueOnce('about');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].href).toBe('/mysite'); // Empty URL becomes root
        expect(result[1].href).toBe('/mysite/about');
      });

      test('generates export mode URLs correctly', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/about.md', 'About', 2)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' }),
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: true, siteRootPath: '/export' };

        mockGetUrlForNode
          .mockReturnValueOnce('index.html')
          .mockReturnValueOnce('about/index.html');

        mockGetRelativePath
          .mockReturnValueOnce('./index.html')
          .mockReturnValueOnce('./about/index.html');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].href).toBe('./index.html');
        expect(result[1].href).toBe('./about/index.html');

        expect(mockGetRelativePath).toHaveBeenCalledWith('content/current.md', 'index.html');
        expect(mockGetRelativePath).toHaveBeenCalledWith('content/current.md', 'about/index.html');
      });

      test('handles root path variations in preview mode', () => {
        const structure = [
          createNode('content/about.md', 'About', 1)
        ];

        const contentFiles = [
          createContentFile('content/about.md', { title: 'About' })
        ];

        const siteData = createSiteData(structure, contentFiles);

        // Test empty root path
        mockGetUrlForNode.mockReturnValue('about');
        let options = { isExport: false, siteRootPath: '' };
        let result = generateNavLinks(siteData, 'content/current.md', options);
        expect(result[0].href).toBe('/about');

        // Test root path with slash  
        mockGetUrlForNode.mockReturnValue('about');
        options = { isExport: false, siteRootPath: '/' };
        result = generateNavLinks(siteData, 'content/current.md', options);
        expect(result[0].href).toBe('//about'); // "/" + "/about" = "//about"

        // Test root path with directory
        mockGetUrlForNode.mockReturnValue('about');
        options = { isExport: false, siteRootPath: '/site' };
        result = generateNavLinks(siteData, 'content/current.md', options);
        expect(result[0].href).toBe('/site/about');
      });

      test('handles homepage URLs in preview mode', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode.mockReturnValue(''); // Homepage returns empty string

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0].href).toBe('/site'); // Empty string becomes site root
      });
    });

    describe('Edge Cases and Error Handling', () => {
      test('handles empty structure', () => {
        const siteData = createSiteData([], []);
        const options = { isExport: false, siteRootPath: '/site' };

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toEqual([]);
      });

      test('handles structure with no navigation items', () => {
        const structure = [
          createNode('content/page1.md', 'Page 1'), // No navOrder
          createNode('content/page2.md', 'Page 2') // No navOrder
        ];

        const contentFiles = [
          createContentFile('content/page1.md', { title: 'Page 1' }),
          createContentFile('content/page2.md', { title: 'Page 2' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toEqual([]);
      });

      test('handles missing content files gracefully', () => {
        const structure = [
          createNode('content/home.md', 'Home', 1),
          createNode('content/missing.md', 'Missing', 2)
        ];

        const contentFiles = [
          createContentFile('content/home.md', { title: 'Home' })
          // Missing content file for missing.md
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('')
          .mockReturnValueOnce('missing');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('Home');
        expect(result[1].label).toBe('Missing'); // Still includes the node
        expect(result[1].children).toEqual([]); // No children since no collection
      });

      test('handles nodes with zero navOrder', () => {
        const structure = [
          createNode('content/first.md', 'First', 0),
          createNode('content/second.md', 'Second', 1)
        ];

        const contentFiles = [
          createContentFile('content/first.md', { title: 'First' }),
          createContentFile('content/second.md', { title: 'Second' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('first')
          .mockReturnValueOnce('second');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe('First'); // navOrder 0 comes first
        expect(result[1].label).toBe('Second');
      });

      test('handles duplicate navOrder values', () => {
        const structure = [
          createNode('content/alpha.md', 'Alpha', 1),
          createNode('content/beta.md', 'Beta', 1), // Same navOrder
          createNode('content/gamma.md', 'Gamma', 1) // Same navOrder
        ];

        const contentFiles = [
          createContentFile('content/alpha.md', { title: 'Alpha' }),
          createContentFile('content/beta.md', { title: 'Beta' }),
          createContentFile('content/gamma.md', { title: 'Gamma' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode
          .mockReturnValueOnce('alpha')
          .mockReturnValueOnce('beta')
          .mockReturnValueOnce('gamma');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result).toHaveLength(3);
        // Order should be stable (original array order)
        expect(result[0].label).toBe('Alpha');
        expect(result[1].label).toBe('Beta');
        expect(result[2].label).toBe('Gamma');
      });

      test('preserves all required properties in NavLinkItem', () => {
        const structure = [
          createNode('content/test.md', 'Test Page', 1, 'Test Menu')
        ];

        const contentFiles = [
          createContentFile('content/test.md', { title: 'Test Page' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode.mockReturnValue('test');

        const result = generateNavLinks(siteData, 'content/current.md', options);

        expect(result[0]).toHaveProperty('href');
        expect(result[0]).toHaveProperty('label');
        expect(result[0]).toHaveProperty('children');
        expect(typeof result[0].href).toBe('string');
        expect(typeof result[0].label).toBe('string');
        expect(Array.isArray(result[0].children)).toBe(true);
      });
    });

    describe('Performance and Consistency', () => {
      test('performs well with large navigation structures', () => {
        const largeStructure = Array.from({ length: 100 }, (_, i) =>
          createNode(`content/page${i}.md`, `Page ${i}`, i + 1)
        );

        const largeContentFiles = largeStructure.map(node =>
          createContentFile(node.path, { title: node.title })
        );

        const siteData = createSiteData(largeStructure, largeContentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        // Mock all URL calls
        mockGetUrlForNode.mockImplementation((node) => node.slug);

        const start = performance.now();
        const result = generateNavLinks(siteData, 'content/current.md', options);
        const end = performance.now();

        expect(result).toHaveLength(100);
        expect(end - start).toBeLessThan(50); // Should be fast
      });

      test('maintains referential transparency', () => {
        const structure = [
          createNode('content/test.md', 'Test', 1)
        ];

        const contentFiles = [
          createContentFile('content/test.md', { title: 'Test' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        mockGetUrlForNode.mockReturnValue('test');

        // Multiple calls should return consistent results
        const result1 = generateNavLinks(siteData, 'content/current.md', options);
        const result2 = generateNavLinks(siteData, 'content/current.md', options);
        const result3 = generateNavLinks(siteData, 'content/current.md', options);

        expect(result1).toEqual(result2);
        expect(result2).toEqual(result3);
      });

      test('does not mutate input data', () => {
        const structure = [
          createNode('content/test.md', 'Test', 1)
        ];

        const contentFiles = [
          createContentFile('content/test.md', { title: 'Test' })
        ];

        const siteData = createSiteData(structure, contentFiles);
        const options = { isExport: false, siteRootPath: '/site' };

        const originalStructure = JSON.parse(JSON.stringify(structure));
        const originalContentFiles = JSON.parse(JSON.stringify(contentFiles));

        mockGetUrlForNode.mockReturnValue('test');

        generateNavLinks(siteData, 'content/current.md', options);

        expect(siteData.manifest.structure).toEqual(originalStructure);
        expect(siteData.contentFiles).toEqual(originalContentFiles);
      });
    });
  });
});