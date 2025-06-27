/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { resolvePageContent } from '../pageResolver.service';
import type { 
  LocalSiteData, 
  ParsedMarkdownFile, 
  MarkdownFrontmatter, 
  StructureNode, 
  Manifest,
  CollectionConfig,
} from '@/core/types';
import { PageType } from '@/core/types';

// Mock the fileTree service functions
jest.mock('../fileTree.service', () => ({
  findNodeByPath: jest.fn(),
  findChildNodes: jest.fn()
}));

// Mock the urlUtils service
jest.mock('../urlUtils.service', () => ({
  getUrlForNode: jest.fn()
}));

import { findNodeByPath, findChildNodes } from '../fileTree.service';
import { getUrlForNode } from '../urlUtils.service';

const mockFindNodeByPath = findNodeByPath as jest.MockedFunction<typeof findNodeByPath>;
const mockFindChildNodes = findChildNodes as jest.MockedFunction<typeof findChildNodes>;
const mockGetUrlForNode = getUrlForNode as jest.MockedFunction<typeof getUrlForNode>;

describe('pageResolver.service', () => {
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

  const createNode = (path: string, title?: string): StructureNode => ({
    type: 'page',
    title: title || path.replace('content/', '').replace('.md', ''),
    path,
    slug: path.replace('content/', '').replace('.md', '')
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

  describe('resolvePageContent', () => {
    describe('Homepage Resolution', () => {
      test('resolves homepage when slug array is empty', () => {
        const homepageFile = createContentFile('content/home.md', { 
          title: 'Welcome Home',
          homepage: true 
        });
        const homeNode = createNode('content/home.md', 'Welcome Home');
        
        const siteData = createSiteData([homeNode], [homepageFile]);
        
        mockFindNodeByPath.mockReturnValue(homeNode);
        
        const result = resolvePageContent(siteData, [], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.pageTitle).toBe('Welcome Home');
          expect(result.contentFile).toBe(homepageFile);
          expect(result.layoutPath).toBe('page');
        }
        
        expect(mockFindNodeByPath).toHaveBeenCalledWith(siteData.manifest.structure, 'content/home.md');
      });

      test('resolves homepage when slug array has empty string', () => {
        const homepageFile = createContentFile('content/index.md', { 
          title: 'Home Page',
          homepage: true 
        });
        const homeNode = createNode('content/index.md', 'Home Page');
        
        const siteData = createSiteData([homeNode], [homepageFile]);
        
        mockFindNodeByPath.mockReturnValue(homeNode);
        
        const result = resolvePageContent(siteData, [''], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.pageTitle).toBe('Home Page');
          expect(result.contentFile).toBe(homepageFile);
        }
      });

      test('returns not found when no homepage is designated', () => {
        const normalFile = createContentFile('content/page.md', { 
          title: 'Normal Page',
          homepage: false 
        });
        const normalNode = createNode('content/page.md', 'Normal Page');
        
        const siteData = createSiteData([normalNode], [normalFile]);
        
        const result = resolvePageContent(siteData, [], 1);
        
        expect(result.type).toBe(PageType.NotFound);
        if (result.type === PageType.NotFound) {
          expect(result.errorMessage).toBe('No homepage has been designated for this site.');
        }
      });

      test('handles multiple files where only one is homepage', () => {
        const homepageFile = createContentFile('content/home.md', { 
          title: 'Homepage',
          homepage: true 
        });
        const aboutFile = createContentFile('content/about.md', { 
          title: 'About',
          homepage: false 
        });
        const blogFile = createContentFile('content/blog.md', { 
          title: 'Blog' 
          // No homepage property
        });
        
        const homeNode = createNode('content/home.md', 'Homepage');
        const siteData = createSiteData([homeNode], [homepageFile, aboutFile, blogFile]);
        
        mockFindNodeByPath.mockReturnValue(homeNode);
        
        const result = resolvePageContent(siteData, [], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.contentFile).toBe(homepageFile);
        }
      });
    });

    describe('Regular Page Resolution', () => {
      test('resolves regular page by slug', () => {
        const aboutFile = createContentFile('content/about.md', { 
          title: 'About Us',
          layout: 'page' 
        });
        const aboutNode = createNode('content/about.md', 'About Us');
        
        const siteData = createSiteData([aboutNode], [aboutFile]);
        
        mockFindNodeByPath.mockReturnValue(aboutNode);
        
        const result = resolvePageContent(siteData, ['about'], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.pageTitle).toBe('About Us');
          expect(result.contentFile).toBe(aboutFile);
          expect(result.layoutPath).toBe('page');
        }
        
        expect(mockFindNodeByPath).toHaveBeenCalledWith(siteData.manifest.structure, 'content/about.md');
      });

      test('resolves nested page by slug array', () => {
        const postFile = createContentFile('content/blog/post1.md', { 
          title: 'First Post',
          layout: 'post' 
        });
        const postNode = createNode('content/blog/post1.md', 'First Post');
        
        const siteData = createSiteData([postNode], [postFile]);
        
        mockFindNodeByPath.mockReturnValue(postNode);
        
        const result = resolvePageContent(siteData, ['blog', 'post1'], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.pageTitle).toBe('First Post');
          expect(result.contentFile).toBe(postFile);
          expect(result.layoutPath).toBe('post');
        }
        
        expect(mockFindNodeByPath).toHaveBeenCalledWith(siteData.manifest.structure, 'content/blog/post1.md');
      });

      test('uses default layout when not specified', () => {
        const pageFile = createContentFile('content/page.md', { 
          title: 'Test Page'
          // No layout specified
        });
        const pageNode = createNode('content/page.md', 'Test Page');
        
        const siteData = createSiteData([pageNode], [pageFile]);
        
        mockFindNodeByPath.mockReturnValue(pageNode);
        
        const result = resolvePageContent(siteData, ['page'], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.layoutPath).toBe('page'); // DEFAULT_PAGE_LAYOUT_PATH
        }
      });

      test('returns not found when node not in structure', () => {
        const siteData = createSiteData([], []);
        
        mockFindNodeByPath.mockReturnValue(undefined);
        
        const result = resolvePageContent(siteData, ['nonexistent'], 1);
        
        expect(result.type).toBe(PageType.NotFound);
        if (result.type === PageType.NotFound) {
          expect(result.errorMessage).toBe('No page found in site structure for path: content/nonexistent.md');
        }
      });

      test('returns not found when content file is missing', () => {
        const pageNode = createNode('content/missing.md', 'Missing Page');
        const siteData = createSiteData([pageNode], []); // No content files
        
        mockFindNodeByPath.mockReturnValue(pageNode);
        
        const result = resolvePageContent(siteData, ['missing'], 1);
        
        expect(result.type).toBe(PageType.NotFound);
        if (result.type === PageType.NotFound) {
          expect(result.errorMessage).toBe('Manifest references "content/missing.md" but its content file is missing.');
        }
      });
    });

    describe('Collection Page Resolution', () => {
      test('resolves collection page without pagination', () => {
        const collectionConfig: CollectionConfig = {
          sort_by: 'title',
          sort_order: 'asc'
        };
        
        const blogFile = createContentFile('content/blog.md', { 
          title: 'Blog',
          layout: 'collection',
          collection: collectionConfig
        });
        const blogNode = createNode('content/blog.md', 'Blog');
        
        const post1 = createContentFile('content/blog/post1.md', { title: 'Alpha Post' });
        const post2 = createContentFile('content/blog/post2.md', { title: 'Beta Post' });
        const post3 = createContentFile('content/blog/post3.md', { title: 'Gamma Post' });
        
        const childNodes = [
          createNode('content/blog/post1.md'),
          createNode('content/blog/post2.md'),
          createNode('content/blog/post3.md')
        ];
        
        const siteData = createSiteData([blogNode], [blogFile, post1, post2, post3]);
        
        mockFindNodeByPath.mockReturnValue(blogNode);
        mockFindChildNodes.mockReturnValue(childNodes);
        
        const result = resolvePageContent(siteData, ['blog'], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.pageTitle).toBe('Blog');
          expect(result.contentFile).toBe(blogFile);
          expect(result.collectionItems).toHaveLength(3);
          expect(result.collectionItems![0].frontmatter.title).toBe('Alpha Post');
          expect(result.collectionItems![1].frontmatter.title).toBe('Beta Post');
          expect(result.collectionItems![2].frontmatter.title).toBe('Gamma Post');
          expect(result.pagination).toBeUndefined();
        }
        
        expect(mockFindChildNodes).toHaveBeenCalledWith(siteData.manifest.structure, 'content/blog.md');
      });

      test('resolves collection page with pagination', () => {
        const collectionConfig: CollectionConfig = {
          sort_by: 'date',
          sort_order: 'desc',
          items_per_page: 2
        };
        
        const blogFile = createContentFile('content/blog.md', { 
          title: 'Blog',
          layout: 'collection',
          collection: collectionConfig
        });
        const blogNode = createNode('content/blog.md', 'Blog');
        
        const post1 = createContentFile('content/blog/post1.md', { 
          title: 'Post 1', 
          date: '2024-01-03' 
        });
        const post2 = createContentFile('content/blog/post2.md', { 
          title: 'Post 2', 
          date: '2024-01-02' 
        });
        const post3 = createContentFile('content/blog/post3.md', { 
          title: 'Post 3', 
          date: '2024-01-01' 
        });
        
        const childNodes = [
          createNode('content/blog/post1.md'),
          createNode('content/blog/post2.md'),
          createNode('content/blog/post3.md')
        ];
        
        const siteData = createSiteData([blogNode], [blogFile, post1, post2, post3]);
        
        mockFindNodeByPath.mockReturnValue(blogNode);
        mockFindChildNodes.mockReturnValue(childNodes);
        mockGetUrlForNode.mockReturnValue('blog');
        
        const result = resolvePageContent(siteData, ['blog'], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.collectionItems).toHaveLength(2); // items_per_page = 2
          expect(result.collectionItems![0].frontmatter.title).toBe('Post 1'); // Most recent
          expect(result.collectionItems![1].frontmatter.title).toBe('Post 2');
          
          expect(result.pagination).toBeDefined();
          expect(result.pagination!.currentPage).toBe(1);
          expect(result.pagination!.totalPages).toBe(2);
          expect(result.pagination!.totalItems).toBe(3);
          expect(result.pagination!.hasPrevPage).toBe(false);
          expect(result.pagination!.hasNextPage).toBe(true);
          expect(result.pagination!.nextPageUrl).toBe('/blog/page/2');
        }
      });

      test('resolves collection page second page', () => {
        const collectionConfig: CollectionConfig = {
          sort_by: 'title',
          sort_order: 'asc',
          items_per_page: 2
        };
        
        const blogFile = createContentFile('content/blog.md', { 
          title: 'Blog',
          collection: collectionConfig
        });
        const blogNode = createNode('content/blog.md', 'Blog');
        
        const post1 = createContentFile('content/blog/post1.md', { title: 'Alpha' });
        const post2 = createContentFile('content/blog/post2.md', { title: 'Beta' });
        const post3 = createContentFile('content/blog/post3.md', { title: 'Gamma' });
        
        const childNodes = [
          createNode('content/blog/post1.md'),
          createNode('content/blog/post2.md'),
          createNode('content/blog/post3.md')
        ];
        
        const siteData = createSiteData([blogNode], [blogFile, post1, post2, post3]);
        
        mockFindNodeByPath.mockReturnValue(blogNode);
        mockFindChildNodes.mockReturnValue(childNodes);
        mockGetUrlForNode.mockReturnValue('blog');
        
        const result = resolvePageContent(siteData, ['blog'], 2);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.collectionItems).toHaveLength(1); // Only 1 item on page 2
          expect(result.collectionItems![0].frontmatter.title).toBe('Gamma');
          
          expect(result.pagination!.currentPage).toBe(2);
          expect(result.pagination!.hasPrevPage).toBe(true);
          expect(result.pagination!.hasNextPage).toBe(false);
          expect(result.pagination!.prevPageUrl).toBe('/blog');
        }
      });

      test('handles collection with no child nodes', () => {
        const collectionConfig: CollectionConfig = {
          sort_by: 'date',
          sort_order: 'desc'
        };
        
        const blogFile = createContentFile('content/blog.md', { 
          title: 'Empty Blog',
          collection: collectionConfig
        });
        const blogNode = createNode('content/blog.md', 'Empty Blog');
        
        const siteData = createSiteData([blogNode], [blogFile]);
        
        mockFindNodeByPath.mockReturnValue(blogNode);
        mockFindChildNodes.mockReturnValue([]); // No children
        
        const result = resolvePageContent(siteData, ['blog'], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.collectionItems).toEqual([]);
          expect(result.pagination).toBeUndefined();
        }
      });

      test('handles collection sorting by different fields', () => {
        const collectionConfig: CollectionConfig = {
          sort_by: 'priority',
          sort_order: 'desc'
        };
        
        const blogFile = createContentFile('content/blog.md', { 
          title: 'Blog',
          collection: collectionConfig
        });
        const blogNode = createNode('content/blog.md', 'Blog');
        
        const post1 = createContentFile('content/blog/post1.md', { title: 'Post 1', priority: 1 });
        const post2 = createContentFile('content/blog/post2.md', { title: 'Post 2', priority: 3 });
        const post3 = createContentFile('content/blog/post3.md', { title: 'Post 3', priority: 2 });
        
        const childNodes = [
          createNode('content/blog/post1.md'),
          createNode('content/blog/post2.md'),
          createNode('content/blog/post3.md')
        ];
        
        const siteData = createSiteData([blogNode], [blogFile, post1, post2, post3]);
        
        mockFindNodeByPath.mockReturnValue(blogNode);
        mockFindChildNodes.mockReturnValue(childNodes);
        
        const result = resolvePageContent(siteData, ['blog'], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.collectionItems![0].frontmatter.priority).toBe(3);
          expect(result.collectionItems![1].frontmatter.priority).toBe(2);
          expect(result.collectionItems![2].frontmatter.priority).toBe(1);
        }
      });

      test('handles collection pagination edge cases', () => {
        const collectionConfig: CollectionConfig = {
          items_per_page: 5
        };
        
        const blogFile = createContentFile('content/blog.md', { 
          title: 'Blog',
          collection: collectionConfig
        });
        const blogNode = createNode('content/blog.md', 'Blog');
        
        const siteData = createSiteData([blogNode], [blogFile]);
        
        mockFindNodeByPath.mockReturnValue(blogNode);
        mockFindChildNodes.mockReturnValue([]);
        mockGetUrlForNode.mockReturnValue('blog');
        
        // Test page number beyond available pages
        const result = resolvePageContent(siteData, ['blog'], 10);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.pagination!.currentPage).toBe(1); // Should clamp to valid range
          expect(result.pagination!.totalPages).toBe(0); // No items, so 0 pages
        }
      });
    });

    describe('Error Handling and Edge Cases', () => {
      test('handles site data without content files', () => {
        const siteData = createSiteData([], undefined as any);
        
        const result = resolvePageContent(siteData, ['test'], 1);
        
        expect(result.type).toBe(PageType.NotFound);
      });

      test('handles invalid page numbers', () => {
        const pageFile = createContentFile('content/page.md', { title: 'Test Page' });
        const pageNode = createNode('content/page.md', 'Test Page');
        const siteData = createSiteData([pageNode], [pageFile]);
        
        mockFindNodeByPath.mockReturnValue(pageNode);
        
        // Test negative page number
        const result1 = resolvePageContent(siteData, ['page'], -1);
        expect(result1.type).toBe(PageType.SinglePage);
        
        // Test zero page number
        const result2 = resolvePageContent(siteData, ['page'], 0);
        expect(result2.type).toBe(PageType.SinglePage);
      });

      test('handles collection with invalid sort data', () => {
        const collectionConfig: CollectionConfig = {
          sort_by: 'date',
          sort_order: 'desc'
        };
        
        const blogFile = createContentFile('content/blog.md', { 
          title: 'Blog',
          collection: collectionConfig
        });
        const blogNode = createNode('content/blog.md', 'Blog');
        
        const post1 = createContentFile('content/blog/post1.md', { 
          title: 'Post 1', 
          date: 'invalid-date' 
        });
        const post2 = createContentFile('content/blog/post2.md', { 
          title: 'Post 2'
          // No date property
        });
        
        const childNodes = [
          createNode('content/blog/post1.md'),
          createNode('content/blog/post2.md')
        ];
        
        const siteData = createSiteData([blogNode], [blogFile, post1, post2]);
        
        mockFindNodeByPath.mockReturnValue(blogNode);
        mockFindChildNodes.mockReturnValue(childNodes);
        
        const result = resolvePageContent(siteData, ['blog'], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.collectionItems).toHaveLength(2);
          // Should handle gracefully without crashing
        }
      });

      test('handles very deep slug arrays', () => {
        const deepSlug = ['level1', 'level2', 'level3', 'level4', 'level5', 'page'];
        const deepFile = createContentFile('content/level1/level2/level3/level4/level5/page.md', { 
          title: 'Deep Page' 
        });
        const deepNode = createNode('content/level1/level2/level3/level4/level5/page.md', 'Deep Page');
        
        const siteData = createSiteData([deepNode], [deepFile]);
        
        mockFindNodeByPath.mockReturnValue(deepNode);
        
        const result = resolvePageContent(siteData, deepSlug, 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.pageTitle).toBe('Deep Page');
        }
        
        expect(mockFindNodeByPath).toHaveBeenCalledWith(
          siteData.manifest.structure, 
          'content/level1/level2/level3/level4/level5/page.md'
        );
      });

      test('preserves all frontmatter properties in result', () => {
        const richFrontmatter = {
          title: 'Rich Page',
          layout: 'special',
          author: 'John Doe',
          tags: ['tag1', 'tag2'],
          customProperty: 'custom value',
          published: true
        };
        
        const pageFile = createContentFile('content/rich.md', richFrontmatter);
        const pageNode = createNode('content/rich.md', 'Rich Page');
        const siteData = createSiteData([pageNode], [pageFile]);
        
        mockFindNodeByPath.mockReturnValue(pageNode);
        
        const result = resolvePageContent(siteData, ['rich'], 1);
        
        expect(result.type).toBe(PageType.SinglePage);
        if (result.type === PageType.SinglePage) {
          expect(result.contentFile.frontmatter.author).toBe('John Doe');
          expect(result.contentFile.frontmatter.tags).toEqual(['tag1', 'tag2']);
          expect(result.contentFile.frontmatter.customProperty).toBe('custom value');
          expect(result.contentFile.frontmatter.published).toBe(true);
        }
      });
    });
  });
});