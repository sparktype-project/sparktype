import { createSiteFixture } from '@/test/support/siteFixtures';
import { createPublicSiteSnapshot } from '../publication';

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

  test('adds a manifest that references media.json and bundles every content file it is given', async () => {
    const site = createSiteFixture('collectionSite');

    const bundle: Record<string, string> = {};
    await bundleSourceFiles(bundle, site);

    expect(JSON.parse(bundle['_site/manifest.json'])).toMatchObject({
      dataFiles: ['data/media.json'],
    });
    expect(bundle['_site/content/home.md']).toContain('Home');
    expect(bundle['_site/content/posts/launch-day.md']).toContain('Collection item body');
    expect(bundle['_site/data/categories.json']).toBe('["news"]');
  });

  test('never receives drafts: the public snapshot excludes them from both sources and manifest', async () => {
    const site = createSiteFixture('collectionSite');
    site.contentFiles?.push({
      path: 'content/draft.md',
      slug: 'draft',
      frontmatter: { title: 'Draft', layout: 'page', published: false },
      content: 'Hidden',
    });
    site.manifest.structure.push({
      type: 'page',
      path: 'content/draft.md',
      slug: 'draft',
      title: 'Draft',
    });

    const bundle: Record<string, string> = {};
    await bundleSourceFiles(bundle, createPublicSiteSnapshot(site));

    expect(bundle['_site/content/draft.md']).toBeUndefined();
    expect(bundle['_site/manifest.json']).not.toContain('content/draft.md');
    expect(bundle['_site/content/home.md']).toContain('Home');
  });
});
