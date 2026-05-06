import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';
import { createTestAppStore } from '@/test/support/testAppStore';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/core/services/siteSecrets.service', () => ({
  loadSiteSecretsFromDb: vi.fn(async () => ({})),
  deleteSiteSecretsFromDb: vi.fn(async () => undefined),
}));

vi.mock('@/core/services/images/imageRegistry.service', () => ({
  updateImageReferences: vi.fn(async () => undefined),
  deleteImageRegistry: vi.fn(async () => undefined),
}));

vi.mock('@/core/services/images/imageReferenceFinder.service', () => ({
  findImagesInContentFile: vi.fn(() => ['assets/originals/hero.jpg']),
}));

vi.mock('@/core/services/assetStorage.service', () => ({
  deleteCustomAssetsForSite: vi.fn(async () => undefined),
}));

vi.mock('@/core/services/publishing/gitSync.service', () => ({
  gitSyncService: {
    clearSyncState: vi.fn(async () => undefined),
  },
}));

vi.mock('@/core/services/images/derivativeCache.service', () => ({
  clearSiteDerivativeCache: vi.fn(async () => undefined),
}));

describe('site/content slice integration', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
    localStorage.clear();
  });

  test('initializeSites hydrates manifests and loadSite merges full content data', async () => {
    const store = createTestAppStore();
    const site = createSiteFixture('basicSite', { siteId: 'hydrate-site' });

    await store.getState().addSite(site);
    await store.getState().initializeSites();

    expect(store.getState().sites).toHaveLength(1);
    expect(store.getState().sites[0]).toMatchObject({
      siteId: 'hydrate-site',
      manifest: expect.objectContaining({ title: 'Basic Site' }),
    });
    expect(store.getState().sites[0].contentFiles).toBeUndefined();

    await store.getState().loadSite(site.siteId);

    expect(store.getState().getSiteById(site.siteId)).toMatchObject({
      siteId: 'hydrate-site',
      contentFiles: site.contentFiles,
      themeFiles: site.themeFiles,
    });
  });

  test('first page creation marks homepage and adds navigation structure', async () => {
    const store = createTestAppStore();
    const emptySite = createSiteFixture('basicSite', { siteId: 'first-page-site' });
    emptySite.manifest.structure = [];
    emptySite.contentFiles = [];
    await store.getState().addSite(emptySite);

    const rawMarkdown = stringifyToMarkdown(
      { title: 'Home', layout: 'page' },
      'First page body'
    );

    const saved = await store.getState().addOrUpdateContentFile(emptySite.siteId, 'content/home.md', rawMarkdown);
    expect(saved).toBe(true);

    const site = store.getState().getSiteById(emptySite.siteId)!;
    expect(site.contentFiles?.[0].frontmatter.homepage).toBe(true);
    expect(site.manifest.structure).toEqual([
      expect.objectContaining({ path: 'content/home.md', slug: 'home' }),
    ]);
  });

  test('collection item creation updates content without polluting navigation', async () => {
    const store = createTestAppStore();
    const site = createSiteFixture('collectionSite', { siteId: 'collection-nav-site' });
    await store.getState().addSite(site);

    const rawMarkdown = stringifyToMarkdown(
      { title: 'Second Post', layout: 'post', date: '2025-01-12' },
      'Second post body'
    );

    await store.getState().addOrUpdateContentFile(site.siteId, 'content/posts/second-post.md', rawMarkdown);

    const updated = store.getState().getSiteById(site.siteId)!;
    expect(updated.manifest.structure.map((node) => node.path)).toEqual([
      'content/home.md',
      'content/posts.md',
    ]);
    expect(updated.manifest.collectionItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionId: 'posts',
          path: 'content/posts/second-post.md',
          slug: 'second-post',
        }),
      ])
    );
  });

  test('changePageSlugWithContent moves descendants and updates state', async () => {
    const store = createTestAppStore();
    const site = createSiteFixture('nestedPagesSite', { siteId: 'slug-site' });
    await store.getState().addSite(site);

    const aboutFile = site.contentFiles!.find((file) => file.path === 'content/about.md')!;
    const result = await store.getState().changePageSlugWithContent(
      site.siteId,
      'content/about.md',
      'company',
      aboutFile.frontmatter,
      aboutFile.content
    );

    expect(result).toEqual({
      success: true,
      newFilePath: 'content/company.md',
    });

    const updatedSite = store.getState().getSiteById(site.siteId)!;
    expect(updatedSite.contentFiles?.map((file) => file.path).sort()).toEqual([
      'content/company.md',
      'content/company/team.md',
      'content/home.md',
    ]);
    expect(updatedSite.manifest.structure[1]).toMatchObject({
      path: 'content/company.md',
      slug: 'company',
      children: [expect.objectContaining({ path: 'content/company/team.md', slug: 'company/team' })],
    });
  });
});
