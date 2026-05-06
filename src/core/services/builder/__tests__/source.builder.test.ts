import { createSiteFixture } from '@/test/support/siteFixtures';

const { getAllDataFilesMock, stringifyToMarkdownMock } = vi.hoisted(() => ({
  getAllDataFilesMock: vi.fn(),
  stringifyToMarkdownMock: vi.fn(),
}));

vi.mock('@/core/libraries/markdownParser', () => ({
  stringifyToMarkdown: stringifyToMarkdownMock,
}));

vi.mock('@/core/services/localFileSystem.service', () => ({
  getAllDataFiles: getAllDataFilesMock,
}));

import { bundleSourceFiles } from '../source.builder';

describe('source.builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stringifyToMarkdownMock.mockImplementation((frontmatter, content) => `---\n${frontmatter.title}\n---\n${content}`);
    getAllDataFilesMock.mockResolvedValue({
      'data/categories.json': '["news"]',
    });
  });

  test('adds a manifest that references media.json and bundles published source files', async () => {
    const site = createSiteFixture('collectionSite');
    site.contentFiles?.push({
      path: 'content/draft.md',
      slug: 'draft',
      frontmatter: { title: 'Draft', layout: 'page', published: false },
      content: 'Hidden',
    });

    const bundle: Record<string, string> = {};
    await bundleSourceFiles(bundle, site);

    expect(JSON.parse(bundle['_site/manifest.json'])).toMatchObject({
      dataFiles: ['data/media.json'],
    });
    expect(bundle['_site/content/home.md']).toContain('Home');
    expect(bundle['_site/content/draft.md']).toBeUndefined();
    expect(bundle['_site/data/categories.json']).toBe('["news"]');
  });
});
