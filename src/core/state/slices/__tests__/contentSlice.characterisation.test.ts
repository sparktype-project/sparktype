import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { toast } from 'sonner';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';
import { createTestAppStore } from '@/test/support/testAppStore';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import type * as LocalFileSystemModule from '@/core/services/localFileSystem.service';
import { createContentSlice } from '../contentSlice';

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
  findImagesInContentFile: vi.fn(() => []),
}));

// Wrap the two persistence primitives so individual tests can force failures while
// every other test keeps exercising the real storage implementation.
vi.mock('@/core/services/localFileSystem.service', async (importOriginal) => {
  const actual = await importOriginal<typeof LocalFileSystemModule>();
  return {
    ...actual,
    saveContentFile: vi.fn(actual.saveContentFile),
    moveContentFiles: vi.fn(actual.moveContentFiles),
  };
});

const mockSaveContentFile = vi.mocked(localSiteFs.saveContentFile);
const mockMoveContentFiles = vi.mocked(localSiteFs.moveContentFiles);

let realSaveContentFile: typeof localSiteFs.saveContentFile;
let realMoveContentFiles: typeof localSiteFs.moveContentFiles;

beforeAll(async () => {
  const actual = await vi.importActual<typeof LocalFileSystemModule>(
    '@/core/services/localFileSystem.service'
  );
  realSaveContentFile = actual.saveContentFile;
  realMoveContentFiles = actual.moveContentFiles;
});

beforeEach(async () => {
  await resetIndexedDbForTests();
  localStorage.clear();
  vi.clearAllMocks();
  mockSaveContentFile.mockImplementation(realSaveContentFile);
  mockMoveContentFiles.mockImplementation(realMoveContentFiles);
});

/**
 * Characterisation tests.
 *
 * These pin the observable behaviour of the content slice's store API — page creation,
 * deletion, nested moves and persistence — so the extraction into
 * `src/core/state/slices/content/*` can be proven behaviour-preserving.
 * Assertions describe what a caller observes (state, storage, toasts), never module shape.
 */
describe('contentSlice characterisation', () => {
  test('exposes exactly the documented action surface', () => {
    const slice = createContentSlice((() => undefined) as never, (() => undefined) as never, {} as never);

    // `changePageSlug` (legacy delete-then-recreate variant) was removed by the rename
    // fix commit; it had no callers and never participated in slug-change tracking.
    expect(Object.keys(slice).sort()).toEqual([
      'addOrUpdateContentFile',
      'changePageSlugWithContent',
      'createTag',
      'createTagGroup',
      'deleteContentFileAndState',
      'deleteTag',
      'deleteTagGroup',
      'getApplicableTagGroups',
      'getTagsForGroup',
      'repositionNode',
      'setAsHomepage',
      'updateContentFileOnly',
      'updateTag',
      'updateTagGroup',
    ]);
  });

  describe('page creation', () => {
    test('marks the first page as homepage and persists it into the manifest', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('basicSite', { siteId: 'char-first-page' });
      site.manifest.structure = [];
      site.contentFiles = [];
      await store.getState().addSite(site);

      const saved = await store.getState().addOrUpdateContentFile(
        site.siteId,
        'content/home.md',
        stringifyToMarkdown({ title: 'Home', layout: 'page' }, 'First page body')
      );

      expect(saved).toBe(true);

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.contentFiles?.[0]).toMatchObject({
        path: 'content/home.md',
        slug: 'home',
        frontmatter: { homepage: true },
      });
      expect(state.manifest.structure).toEqual([
        expect.objectContaining({ path: 'content/home.md', slug: 'home', navOrder: 0 }),
      ]);

      const persistedManifest = await localSiteFs.getManifestById(site.siteId);
      expect(persistedManifest?.structure).toEqual([
        expect.objectContaining({ path: 'content/home.md' }),
      ]);
      const persistedContent = await localSiteFs.getSiteContentFiles(site.siteId);
      expect(persistedContent.map((file) => file.path)).toEqual(['content/home.md']);
    });

    test('appends a new page to the navigation structure and stores the file', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('basicSite', { siteId: 'char-new-page' });
      await store.getState().addSite(site);

      await store.getState().addOrUpdateContentFile(
        site.siteId,
        'content/about.md',
        stringifyToMarkdown({ title: 'About', layout: 'page' }, 'About body')
      );

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.manifest.structure.map((node) => node.path)).toEqual([
        'content/home.md',
        'content/about.md',
      ]);
      expect(state.manifest.structure[1]).toMatchObject({ slug: 'about', navOrder: 1 });
      expect(state.contentFiles?.map((file) => file.path)).toEqual([
        'content/home.md',
        'content/about.md',
      ]);

      const persistedContent = await localSiteFs.getSiteContentFiles(site.siteId);
      expect(persistedContent.map((file) => file.path)).toEqual([
        'content/home.md',
        'content/about.md',
      ]);
    });

    test('updates the title of an existing page without adding a structure node when not silent', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('basicSite', { siteId: 'char-update-page' });
      await store.getState().addSite(site);

      // Non-silent saves are the explicit "write through to state" path; the default
      // for an existing file is silent, which only persists to storage.
      await store.getState().addOrUpdateContentFile(
        site.siteId,
        'content/home.md',
        stringifyToMarkdown({ title: 'Homepage', layout: 'page' }, 'Updated body'),
        false
      );

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.manifest.structure).toHaveLength(1);
      expect(state.manifest.structure[0]).toMatchObject({
        path: 'content/home.md',
        title: 'Homepage',
      });
      expect(state.contentFiles?.[0].frontmatter.title).toBe('Homepage');
    });

    test('keeps collection items out of the navigation structure', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('collectionSite', { siteId: 'char-collection-item' });
      await store.getState().addSite(site);

      await store.getState().addOrUpdateContentFile(
        site.siteId,
        'content/posts/second-post.md',
        stringifyToMarkdown({ title: 'Second Post', layout: 'post', date: '2025-01-12' }, 'Body')
      );

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.manifest.structure.map((node) => node.path)).toEqual([
        'content/home.md',
        'content/posts.md',
      ]);
      // Exactly the items inside `content/posts/`. The collection's own listing page
      // (`content/posts.md`) is a navigation page and must not be indexed as an item of
      // itself: that entry produced a bogus `posts/posts` page and sitemap URL at build time.
      expect(state.manifest.collectionItems).toEqual([
        {
          collectionId: 'posts',
          slug: 'launch-day',
          path: 'content/posts/launch-day.md',
          title: 'Launch Day',
          url: '',
        },
        {
          collectionId: 'posts',
          slug: 'second-post',
          path: 'content/posts/second-post.md',
          title: 'Second Post',
          url: '',
        },
      ]);
    });

    test('a page at a collection content path appears in navigation, not in the item index', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('collectionSite', { siteId: 'char-collection-path-page' });
      // A collection whose listing page does not exist yet.
      site.contentFiles = site.contentFiles!.filter((file) => file.path !== 'content/posts.md');
      site.manifest.structure = site.manifest.structure.filter((node) => node.path !== 'content/posts.md');
      await store.getState().addSite(site);

      // Saved without the `collection` frontmatter flag that marks a listing page.
      await store.getState().addOrUpdateContentFile(
        site.siteId,
        'content/posts.md',
        stringifyToMarkdown({ title: 'Posts', layout: 'page' }, 'Not flagged as a listing page')
      );

      // The two membership rules must agree: the page is a navigation page (it is not
      // inside `content/posts/`), and it is not an item. Disagreeing would leave it out
      // of the structure and out of the item index — visible in neither listing.
      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.manifest.structure.map((node) => node.path)).toContain('content/posts.md');
      expect(state.manifest.collectionItems).toEqual([
        {
          collectionId: 'posts',
          slug: 'launch-day',
          path: 'content/posts/launch-day.md',
          title: 'Launch Day',
          url: '',
        },
      ]);
    });
  });

  describe('deletion', () => {
    test('removes the file, its structure node and its collection item reference', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('collectionSite', { siteId: 'char-delete' });
      await store.getState().addSite(site);

      await store.getState().deleteContentFileAndState(site.siteId, 'content/posts/launch-day.md');

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.contentFiles?.map((file) => file.path)).toEqual([
        'content/home.md',
        'content/posts.md',
      ]);
      expect(state.manifest.collectionItems?.some((item) => item.path === 'content/posts/launch-day.md')).toBe(false);

      const persistedContent = await localSiteFs.getSiteContentFiles(site.siteId);
      expect(persistedContent.map((file) => file.path)).toEqual([
        'content/home.md',
        'content/posts.md',
      ]);
      const persistedManifest = await localSiteFs.getManifestById(site.siteId);
      expect(persistedManifest?.collectionItems?.some((item) => item.path === 'content/posts/launch-day.md')).toBe(false);
    });

    test('refuses to delete the homepage and leaves storage untouched', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('basicSite', { siteId: 'char-delete-homepage' });
      await store.getState().addSite(site);

      await store.getState().deleteContentFileAndState(site.siteId, 'content/home.md');

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.contentFiles?.map((file) => file.path)).toEqual(['content/home.md']);
      const persistedContent = await localSiteFs.getSiteContentFiles(site.siteId);
      expect(persistedContent.map((file) => file.path)).toEqual(['content/home.md']);
    });
  });

  describe('nested moves', () => {
    test('moves a page and its descendants under a new parent in state and storage', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('nestedPagesSite', { siteId: 'char-move' });
      await store.getState().addSite(site);

      await store.getState().repositionNode(site.siteId, 'content/about.md', 'content/home.md', 0);

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.manifest.structure).toHaveLength(1);
      expect(state.manifest.structure[0]).toMatchObject({
        path: 'content/home.md',
        children: [
          expect.objectContaining({
            path: 'content/home/about.md',
            slug: 'home/about',
            children: [
              expect.objectContaining({ path: 'content/home/about/team.md', slug: 'home/about/team' }),
            ],
          }),
        ],
      });
      expect(state.contentFiles?.map((file) => file.path).sort()).toEqual([
        'content/home.md',
        'content/home/about.md',
        'content/home/about/team.md',
      ]);

      const persistedContent = await localSiteFs.getSiteContentFiles(site.siteId);
      expect(persistedContent.map((file) => file.path).sort()).toEqual([
        'content/home.md',
        'content/home/about.md',
        'content/home/about/team.md',
      ]);
      const persistedManifest = await localSiteFs.getManifestById(site.siteId);
      expect(persistedManifest?.structure[0].children?.[0].path).toBe('content/home/about.md');
    });

    test('refuses to move the homepage', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('nestedPagesSite', { siteId: 'char-move-homepage' });
      await store.getState().addSite(site);

      await store.getState().repositionNode(site.siteId, 'content/home.md', null, 1);

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.manifest.structure[0].path).toBe('content/home.md');
      expect(state.manifest.structure[1].path).toBe('content/about.md');
    });

    test('leaves state and storage unchanged when the file move fails', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('nestedPagesSite', { siteId: 'char-move-failure' });
      await store.getState().addSite(site);

      mockMoveContentFiles.mockRejectedValueOnce(new Error('storage offline'));

      await store.getState().repositionNode(site.siteId, 'content/about.md', 'content/home.md', 0);

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.contentFiles?.map((file) => file.path)).toEqual([
        'content/home.md',
        'content/about.md',
        'content/about/team.md',
      ]);
      expect(state.manifest.structure.map((node) => node.path)).toEqual([
        'content/home.md',
        'content/about.md',
      ]);
      const persistedContent = await localSiteFs.getSiteContentFiles(site.siteId);
      expect(persistedContent.map((file) => file.path)).toEqual([
        'content/home.md',
        'content/about.md',
        'content/about/team.md',
      ]);
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'An error occurred while updating the site structure. Reverting changes.'
      );
    });
  });

  describe('persistence', () => {
    test('updateContentFileOnly writes the parsed file through to state and manifest', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('collectionSite', { siteId: 'char-update-only' });
      await store.getState().addSite(site);

      const listingFile = site.contentFiles!.find((file) => file.path === 'content/posts.md')!;
      await store.getState().updateContentFileOnly(site.siteId, {
        ...listingFile,
        frontmatter: { ...listingFile.frontmatter, title: 'All Posts' },
        content: 'Listing body',
      });

      const state = store.getState().getSiteById(site.siteId)!;
      const updated = state.contentFiles?.find((file) => file.path === 'content/posts.md')!;
      expect(updated.frontmatter.title).toBe('All Posts');
      expect(updated.content).toBe('Listing body');

      const persistedContent = await localSiteFs.getSiteContentFiles(site.siteId);
      const persistedListing = persistedContent.find((file) => file.path === 'content/posts.md')!;
      expect(persistedListing.frontmatter.title).toBe('All Posts');
      expect(persistedListing.content).toBe('Listing body');

      const persistedManifest = await localSiteFs.getManifestById(site.siteId);
      expect(persistedManifest?.collectionItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'content/posts/launch-day.md' }),
        ])
      );
    });

    test('setAsHomepage swaps the homepage flag, reorders the structure and persists both', async () => {
      const store = createTestAppStore();
      const site = createSiteFixture('nestedPagesSite', { siteId: 'char-homepage' });
      await store.getState().addSite(site);

      await store.getState().setAsHomepage(site.siteId, 'content/about.md');

      const state = store.getState().getSiteById(site.siteId)!;
      expect(state.manifest.structure.map((node) => node.path)).toEqual([
        'content/about.md',
        'content/home.md',
      ]);
      const newHome = state.contentFiles?.find((file) => file.path === 'content/about.md')!;
      const oldHome = state.contentFiles?.find((file) => file.path === 'content/home.md')!;
      expect(newHome.frontmatter.homepage).toBe(true);
      expect(oldHome.frontmatter.homepage).toBeUndefined();

      const persistedManifest = await localSiteFs.getManifestById(site.siteId);
      expect(persistedManifest?.structure.map((node) => node.path)).toEqual([
        'content/about.md',
        'content/home.md',
      ]);
      const persistedContent = await localSiteFs.getSiteContentFiles(site.siteId);
      expect(persistedContent.find((file) => file.path === 'content/about.md')?.frontmatter.homepage).toBe(true);
    });
  });
});
