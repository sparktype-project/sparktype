import type { LocalSiteData, ParsedMarkdownFile, StructureNode } from '@/core/types';
import { generateNavLinks } from '../navigationStructure.service';
import { generateExportUrl, generatePreviewUrl } from '../urlUtils.service';
import { getRelativePath } from '../relativePaths.service';

vi.mock('../urlUtils.service', () => ({
  generateExportUrl: vi.fn(),
  generatePreviewUrl: vi.fn(),
}));

vi.mock('../relativePaths.service', () => ({
  getRelativePath: vi.fn(),
}));

const mockGenerateExportUrl = vi.mocked(generateExportUrl);
const mockGeneratePreviewUrl = vi.mocked(generatePreviewUrl);
const mockGetRelativePath = vi.mocked(getRelativePath);

function createContentFile(path: string, overrides: Partial<ParsedMarkdownFile['frontmatter']> = {}): ParsedMarkdownFile {
  return {
    path,
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    content: '',
    frontmatter: {
      title: path.split('/').pop()?.replace('.md', '') ?? 'page',
      layout: 'page',
      ...overrides,
    },
  };
}

function createNode(path: string, overrides: Partial<StructureNode> = {}): StructureNode {
  return {
    type: 'page',
    title: path.split('/').pop()?.replace('.md', '') ?? 'page',
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    path,
    navOrder: 1,
    children: [],
    ...overrides,
  };
}

function createSiteData(structure: StructureNode[], contentFiles: ParsedMarkdownFile[] = []): LocalSiteData {
  return {
    siteId: 'site-123',
    manifest: {
      siteId: 'site-123',
      title: 'Test Site',
      generatorVersion: '1.0.0',
      theme: { name: 'default', config: {} },
      structure,
    },
    contentFiles,
  };
}

describe('navigationStructure.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates preview links in nav order and uses menuTitle when present', () => {
    const siteData = createSiteData([
      createNode('content/contact.md', { title: 'Contact', navOrder: 3 }),
      createNode('content/home.md', { title: 'Home', navOrder: 1 }),
      createNode('content/about.md', { title: 'About page', menuTitle: 'About', navOrder: 2 }),
      createNode('content/draft.md', { title: 'Draft', navOrder: undefined }),
    ]);

    mockGeneratePreviewUrl
      .mockReturnValueOnce('/preview/home')
      .mockReturnValueOnce('/preview/about')
      .mockReturnValueOnce('/preview/contact');

    const result = generateNavLinks(siteData, 'content/current.md', {
      isExport: false,
      siteRootPath: '/ignored',
      forIframe: false,
    });

    expect(result).toEqual([
      { href: '/preview/home', label: 'Home', children: [] },
      { href: '/preview/about', label: 'About', children: [] },
      { href: '/preview/contact', label: 'Contact', children: [] },
    ]);
    expect(mockGeneratePreviewUrl).toHaveBeenCalledTimes(3);
    expect(mockGenerateExportUrl).not.toHaveBeenCalled();
  });

  it('builds nested preview navigation and excludes children for collection pages', () => {
    const productsNode = createNode('content/products.md', {
      title: 'Products',
      navOrder: 2,
      children: [
        createNode('content/products/software.md', { title: 'Software', navOrder: 1 }),
      ],
    });
    const blogNode = createNode('content/blog.md', {
      title: 'Blog',
      navOrder: 3,
      children: [
        createNode('content/blog/post-1.md', { title: 'Post 1', navOrder: 1 }),
      ],
    });

    const siteData = createSiteData(
      [
        createNode('content/home.md', { title: 'Home', navOrder: 1 }),
        productsNode,
        blogNode,
      ],
      [
        createContentFile('content/home.md'),
        createContentFile('content/products.md'),
        createContentFile('content/products/software.md'),
        createContentFile('content/blog.md', { collection: 'posts' }),
        createContentFile('content/blog/post-1.md'),
      ]
    );

    mockGeneratePreviewUrl
      .mockReturnValueOnce('/preview/home')
      .mockReturnValueOnce('/preview/products')
      .mockReturnValueOnce('/preview/products/software')
      .mockReturnValueOnce('/preview/blog');

    const result = generateNavLinks(siteData, 'content/current.md', {
      isExport: false,
      siteRootPath: '/ignored',
      forIframe: false,
    });

    expect(result).toEqual([
      { href: '/preview/home', label: 'Home', children: [] },
      {
        href: '/preview/products',
        label: 'Products',
        children: [{ href: '/preview/products/software', label: 'Software', children: [] }],
      },
      { href: '/preview/blog', label: 'Blog', children: [] },
    ]);
  });

  it('generates relative export paths for homepage and child pages', () => {
    const siteData = createSiteData([
      createNode('content/home.md', { title: 'Home', navOrder: 1 }),
      createNode('content/about.md', { title: 'About', navOrder: 2 }),
    ]);

    mockGenerateExportUrl.mockReturnValueOnce('').mockReturnValueOnce('about');
    mockGetRelativePath.mockReturnValueOnce('../../index.html').mockReturnValueOnce('../../about/index.html');

    const result = generateNavLinks(siteData, 'nested/page/index.html', {
      isExport: true,
      siteRootPath: '/ignored',
      forIframe: false,
    });

    expect(result).toEqual([
      { href: '../../index.html', label: 'Home', children: [] },
      { href: '../../about/index.html', label: 'About', children: [] },
    ]);
    expect(mockGetRelativePath).toHaveBeenNthCalledWith(1, 'nested/page/index.html', 'index.html');
    expect(mockGetRelativePath).toHaveBeenNthCalledWith(2, 'nested/page/index.html', 'about/index.html');
    expect(mockGeneratePreviewUrl).not.toHaveBeenCalled();
  });

  it('uses direct export URLs when rendering for iframe mode', () => {
    const siteData = createSiteData([
      createNode('content/home.md', { title: 'Home', navOrder: 1 }),
      createNode('content/docs.md', { title: 'Docs', navOrder: 2 }),
    ]);

    mockGenerateExportUrl.mockReturnValueOnce('').mockReturnValueOnce('docs');

    const result = generateNavLinks(siteData, 'content/current.md', {
      isExport: false,
      siteRootPath: '/ignored',
      forIframe: true,
    });

    expect(result).toEqual([
      { href: '/', label: 'Home', children: [] },
      { href: 'docs', label: 'Docs', children: [] },
    ]);
    expect(mockGetRelativePath).not.toHaveBeenCalled();
  });
});
