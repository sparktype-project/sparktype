import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { toast } from 'sonner';
import type { LocalSiteData } from '@/core/types';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';
import { createTestAppStore } from '@/test/support/testAppStore';
import * as localSiteFs from '@/core/services/localFileSystem.service';
import type * as LocalFileSystemModule from '@/core/services/localFileSystem.service';
import { addImageToRegistry, getImageRegistry, getOrphanedImages } from '@/core/services/images/imageRegistry.service';

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

// Only the two content writes are wrapped, so individual tests can force a persistence
// failure while every other test exercises the real storage implementation.
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

const HERO_IMAGE = 'assets/originals/hero.jpg';
const TEAM_IMAGE = 'assets/originals/team.jpg';

const NESTED_SITE_ID = 'rename-nested-site';
const COLLECTION_SITE_ID = 'rename-collection-site';

beforeEach(async () => {
  await resetIndexedDbForTests();
  localStorage.clear();
  vi.clearAllMocks();
  mockSaveContentFile.mockImplementation(realSaveContentFile);
  mockMoveContentFiles.mockImplementation(realMoveContentFiles);
});

async function createNestedSite() {
  const store = createTestAppStore();
  const site = createSiteFixture('nestedPagesSite', { siteId: NESTED_SITE_ID });
  await store.getState().addSite(site);
  return store;
}

async function createCollectionSite() {
  const store = createTestAppStore();
  const site = createSiteFixture('collectionSite', { siteId: COLLECTION_SITE_ID });
  await store.getState().addSite(site);
  return store;
}

const aboutFile = (site: LocalSiteData) => site.contentFiles!.find((file) => file.path === 'content/about.md')!;

describe('changePageSlugWithContent > navigation pages', () => {
  test('renames an ordinary page and its descendants, and the rename survives a reload', async () => {
    const store = await createNestedSite();
    const site = store.getState().getSiteById(NESTED_SITE_ID)!;
    const about = aboutFile(site);

    const result = await store.getState().changePageSlugWithContent(
      NESTED_SITE_ID,
      'content/about.md',
      'company',
      about.frontmatter,
      about.content
    );

    expect(result).toEqual({ success: true, newFilePath: 'content/company.md' });

    // Reopen the site from storage, the way the app does on reload.
    const reopened = createTestAppStore();
    await reopened.getState().initializeSites();
    await reopened.getState().loadSite(NESTED_SITE_ID);
    const reloaded = reopened.getState().getSiteById(NESTED_SITE_ID)!;

    expect(reloaded.contentFiles?.map((file) => file.path).sort()).toEqual([
      'content/company.md',
      'content/company/team.md',
      'content/home.md',
    ]);
    expect(reloaded.manifest.structure[1]).toMatchObject({
      path: 'content/company.md',
      slug: 'company',
      children: [expect.objectContaining({ path: 'content/company/team.md', slug: 'company/team' })],
    });
  });

  test('rejects a collision with an existing slug', async () => {
    const store = await createNestedSite();
    const site = store.getState().getSiteById(NESTED_SITE_ID)!;
    const about = aboutFile(site);

    const result = await store.getState().changePageSlugWithContent(
      NESTED_SITE_ID,
      'content/about.md',
      'home',
      about.frontmatter,
      about.content
    );

    expect(result).toEqual({ success: false, error: 'A page with the slug "home" already exists' });
    expect(store.getState().getSiteById(NESTED_SITE_ID)!.contentFiles?.map((file) => file.path)).toEqual([
      'content/home.md',
      'content/about.md',
      'content/about/team.md',
    ]);
  });

  test('rejects a collision with an existing descendant path', async () => {
    const store = await createNestedSite();
    await store.getState().addOrUpdateContentFile(
      NESTED_SITE_ID,
      'content/company/team.md',
      stringifyToMarkdown({ title: 'Company Team', layout: 'page' }, 'Existing page')
    );
    const site = store.getState().getSiteById(NESTED_SITE_ID)!;
    const about = aboutFile(site);

    const result = await store.getState().changePageSlugWithContent(
      NESTED_SITE_ID,
      'content/about.md',
      'company',
      about.frontmatter,
      about.content
    );

    expect(result).toEqual({
      success: false,
      error: 'Cannot move page - path "content/company/team.md" already exists',
    });
    expect(store.getState().getSiteById(NESTED_SITE_ID)!.contentFiles?.map((file) => file.path)).toContain('content/about.md');
  });

  test('refuses to rename the homepage', async () => {
    const store = await createNestedSite();
    const site = store.getState().getSiteById(NESTED_SITE_ID)!;
    const home = site.contentFiles!.find((file) => file.path === 'content/home.md')!;

    const result = await store.getState().changePageSlugWithContent(
      NESTED_SITE_ID,
      'content/home.md',
      'landing',
      home.frontmatter,
      home.content
    );

    expect(result).toEqual({ success: false, error: 'Cannot change the slug of the homepage' });
    expect(store.getState().getSiteById(NESTED_SITE_ID)!.contentFiles?.map((file) => file.path)).toContain('content/home.md');
  });
});

describe('changePageSlugWithContent > collection items', () => {
  test('renames a collection item, retains membership, and survives a reload', async () => {
    const store = await createCollectionSite();
    const site = store.getState().getSiteById(COLLECTION_SITE_ID)!;
    const item = site.contentFiles!.find((file) => file.path === 'content/posts/launch-day.md')!;

    const result = await store.getState().changePageSlugWithContent(
      COLLECTION_SITE_ID,
      'content/posts/launch-day.md',
      'posts/launch-party',
      item.frontmatter,
      item.content
    );

    expect(result).toEqual({ success: true, newFilePath: 'content/posts/launch-party.md' });

    const state = store.getState().getSiteById(COLLECTION_SITE_ID)!;
    expect(state.contentFiles?.map((file) => file.path)).toEqual([
      'content/home.md',
      'content/posts.md',
      'content/posts/launch-party.md',
    ]);
    // The item stays a collection item and stays out of the navigation structure.
    expect(state.manifest.structure.map((node) => node.path)).toEqual(['content/home.md', 'content/posts.md']);
    expect(state.manifest.collectionItems).toEqual([
      {
        collectionId: 'posts',
        slug: 'launch-party',
        path: 'content/posts/launch-party.md',
        title: 'Launch Day',
        url: '',
      },
    ]);

    const reopened = createTestAppStore();
    await reopened.getState().initializeSites();
    await reopened.getState().loadSite(COLLECTION_SITE_ID);
    const reloaded = reopened.getState().getSiteById(COLLECTION_SITE_ID)!;

    expect(reloaded.contentFiles?.map((file) => file.path)).toContain('content/posts/launch-party.md');
    expect(reloaded.manifest.collectionItems).toEqual(state.manifest.collectionItems);
  });

  test('rejects a rename that would leave the item outside its collection', async () => {
    const store = await createCollectionSite();
    const site = store.getState().getSiteById(COLLECTION_SITE_ID)!;
    const item = site.contentFiles!.find((file) => file.path === 'content/posts/launch-day.md')!;

    const result = await store.getState().changePageSlugWithContent(
      COLLECTION_SITE_ID,
      'content/posts/launch-day.md',
      'launch-day',
      item.frontmatter,
      item.content
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('posts');

    const state = store.getState().getSiteById(COLLECTION_SITE_ID)!;
    expect(state.contentFiles?.map((file) => file.path)).toContain('content/posts/launch-day.md');
    expect(state.manifest.collectionItems).toEqual([
      expect.objectContaining({ collectionId: 'posts', path: 'content/posts/launch-day.md' }),
    ]);
    expect(store.getState().isSlugChangeInProgress(COLLECTION_SITE_ID)).toBe(false);
  });

  test('still rejects a path that is neither a page nor a known collection item', async () => {
    const store = await createCollectionSite();
    const site = store.getState().getSiteById(COLLECTION_SITE_ID)!;
    const listing = site.contentFiles!.find((file) => file.path === 'content/posts.md')!;

    // A file that exists but belongs to no collection and no structure entry.
    await store.setState((state) => ({
      sites: state.sites.map((entry) =>
        entry.siteId === COLLECTION_SITE_ID
          ? {
              ...entry,
              contentFiles: [
                ...(entry.contentFiles ?? []),
                { ...listing, path: 'content/stray.md', slug: 'stray' },
              ],
            }
          : entry
      ),
    }));

    const result = await store.getState().changePageSlugWithContent(
      COLLECTION_SITE_ID,
      'content/stray.md',
      'renamed',
      listing.frontmatter,
      listing.content
    );

    expect(result).toEqual({ success: false, error: 'Page not found in site structure' });
  });

  test('renames a file that is both a structure node and inside a collection path as a page', async () => {
    const store = await createCollectionSite();
    const itemPath = 'content/posts/launch-day.md';

    // A legacy shape: the item is also declared in the navigation structure.
    await store.setState((state) => ({
      sites: state.sites.map((entry) =>
        entry.siteId === COLLECTION_SITE_ID
          ? {
              ...entry,
              manifest: {
                ...entry.manifest,
                structure: [
                  ...entry.manifest.structure,
                  { type: 'page', path: itemPath, slug: 'posts/launch-day', title: 'Launch Day' },
                ],
              },
            }
          : entry
      ),
    }));

    const item = store.getState().getSiteById(COLLECTION_SITE_ID)!.contentFiles!.find((file) => file.path === itemPath)!;
    const result = await store.getState().changePageSlugWithContent(
      COLLECTION_SITE_ID,
      itemPath,
      'launch-party',
      item.frontmatter,
      item.content
    );

    // Structure membership wins: only the page branch moves the subtree, so treating the
    // file as an item would leave any descendant paths behind. The item index is rebuilt
    // from the resulting paths, so the file is no longer a collection item.
    expect(result).toEqual({ success: true, newFilePath: 'content/launch-party.md' });

    const state = store.getState().getSiteById(COLLECTION_SITE_ID)!;
    expect(state.manifest.structure.map((node) => node.path)).toContain('content/launch-party.md');
    // The file moved out of `content/posts/`, so the rebuilt index no longer lists it —
    // and the listing page is never an item, so nothing remains.
    expect(state.manifest.collectionItems).toEqual([]);
  });
});

describe('changePageSlugWithContent > slug-change tracking', () => {
  const failingCalls: Array<[string, string, string]> = [
    ['empty slug', 'content/about.md', '   '],
    ['missing file', 'content/missing.md', 'renamed'],
    ['homepage', 'content/home.md', 'renamed'],
    ['slug collision', 'content/about.md', 'home'],
    ['unchanged slug', 'content/about.md', 'about'],
  ];

  test.each(failingCalls)('clears slug-change tracking after a %s attempt', async (_label, filePath, newSlug) => {
    const store = await createNestedSite();
    const site = store.getState().getSiteById(NESTED_SITE_ID)!;
    const file = site.contentFiles!.find((entry) => entry.path === filePath) ?? site.contentFiles![1];

    await store.getState().changePageSlugWithContent(NESTED_SITE_ID, filePath, newSlug, file.frontmatter, file.content);

    expect(store.getState().isSlugChangeInProgress(NESTED_SITE_ID)).toBe(false);
  });

  test('clears slug-change tracking when persistence fails and keeps the original content', async () => {
    const store = await createNestedSite();
    const site = store.getState().getSiteById(NESTED_SITE_ID)!;
    const about = aboutFile(site);

    mockSaveContentFile.mockRejectedValueOnce(new Error('storage offline'));

    const result = await store.getState().changePageSlugWithContent(
      NESTED_SITE_ID,
      'content/about.md',
      'company',
      about.frontmatter,
      'Edited body that must not be lost'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('storage offline');
    expect(store.getState().isSlugChangeInProgress(NESTED_SITE_ID)).toBe(false);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Failed to change slug: storage offline');

    const state = store.getState().getSiteById(NESTED_SITE_ID)!;
    expect(state.contentFiles?.map((file) => file.path).sort()).toEqual([
      'content/about.md',
      'content/about/team.md',
      'content/home.md',
    ]);
    const stored = await localSiteFs.getSiteContentFiles(NESTED_SITE_ID);
    expect(stored.find((file) => file.path === 'content/about.md')?.content).toBe('About page');
  });

  test('leaves state and stored paths alone when the rename cannot move files', async () => {
    const store = await createNestedSite();
    const site = store.getState().getSiteById(NESTED_SITE_ID)!;
    const about = aboutFile(site);

    mockMoveContentFiles.mockRejectedValueOnce(new Error('content-move failed'));

    const result = await store.getState().changePageSlugWithContent(
      NESTED_SITE_ID,
      'content/about.md',
      'company',
      about.frontmatter,
      about.content
    );

    expect(result).toEqual({ success: false, error: 'Failed to change slug: content-move failed' });
    expect(store.getState().isSlugChangeInProgress(NESTED_SITE_ID)).toBe(false);

    const state = store.getState().getSiteById(NESTED_SITE_ID)!;
    expect(state.contentFiles?.map((file) => file.path).sort()).toEqual([
      'content/about.md',
      'content/about/team.md',
      'content/home.md',
    ]);
    expect(state.manifest.structure.map((node) => node.path)).toEqual(['content/home.md', 'content/about.md']);

    const stored = await localSiteFs.getSiteContentFiles(NESTED_SITE_ID);
    expect(stored.map((file) => file.path).sort()).toEqual([
      'content/about.md',
      'content/about/team.md',
      'content/home.md',
    ]);
  });
});

describe('changePageSlugWithContent > image references', () => {
  async function createImageSite() {
    const store = await createNestedSite();
    const site = store.getState().getSiteById(NESTED_SITE_ID)!;
    const about = aboutFile(site);
    const team = site.contentFiles!.find((file) => file.path === 'content/about/team.md')!;

    await addImageToRegistry(NESTED_SITE_ID, HERO_IMAGE, 1000);
    await addImageToRegistry(NESTED_SITE_ID, TEAM_IMAGE, 2000);

    // Saving through the store is what registers the references in the first place.
    await store.getState().updateContentFileOnly(NESTED_SITE_ID, {
      ...about,
      content: `About page\n\n![Hero](${HERO_IMAGE})`,
    });
    await store.getState().updateContentFileOnly(NESTED_SITE_ID, {
      ...team,
      content: `Meet the team\n\n![Team](${TEAM_IMAGE})`,
    });

    return store;
  }

  test('re-keys image references to the renamed file paths', async () => {
    const store = await createImageSite();
    const about = aboutFile(store.getState().getSiteById(NESTED_SITE_ID)!);

    await store.getState().changePageSlugWithContent(
      NESTED_SITE_ID,
      'content/about.md',
      'company',
      about.frontmatter,
      about.content
    );

    const registry = await getImageRegistry(NESTED_SITE_ID);
    expect(registry.images[HERO_IMAGE].referencedIn).toEqual(['content/company.md']);
    expect(registry.images[TEAM_IMAGE].referencedIn).toEqual(['content/company/team.md']);
  });

  test('does not report an image referenced only by a renamed file as orphaned', async () => {
    const store = await createImageSite();
    const about = aboutFile(store.getState().getSiteById(NESTED_SITE_ID)!);

    await store.getState().changePageSlugWithContent(
      NESTED_SITE_ID,
      'content/about.md',
      'company',
      about.frontmatter,
      about.content
    );

    // A later write to the vacated path clears any reference still recorded against it.
    await store.getState().addOrUpdateContentFile(
      NESTED_SITE_ID,
      'content/about.md',
      stringifyToMarkdown({ title: 'About', layout: 'page' }, 'No images here')
    );

    const orphans = await getOrphanedImages(NESTED_SITE_ID);
    expect(orphans.orphanedOriginals).not.toContain(HERO_IMAGE);
    expect(orphans.orphanedOriginals).not.toContain(TEAM_IMAGE);
  });
});

describe('repositionNode > image references', () => {
  async function createImageSite() {
    const store = await createNestedSite();
    const site = store.getState().getSiteById(NESTED_SITE_ID)!;
    const about = aboutFile(site);
    const team = site.contentFiles!.find((file) => file.path === 'content/about/team.md')!;

    await addImageToRegistry(NESTED_SITE_ID, HERO_IMAGE, 1000);
    await addImageToRegistry(NESTED_SITE_ID, TEAM_IMAGE, 2000);

    await store.getState().updateContentFileOnly(NESTED_SITE_ID, {
      ...about,
      content: `About page\n\n![Hero](${HERO_IMAGE})`,
    });
    await store.getState().updateContentFileOnly(NESTED_SITE_ID, {
      ...team,
      content: `Meet the team\n\n![Team](${TEAM_IMAGE})`,
    });

    return store;
  }

  test('re-keys image references when a page is drag-moved', async () => {
    const store = await createImageSite();

    await store.getState().repositionNode(NESTED_SITE_ID, 'content/about.md', 'content/home.md', 0);

    const registry = await getImageRegistry(NESTED_SITE_ID);
    expect(registry.images[HERO_IMAGE].referencedIn).toEqual(['content/home/about.md']);
    expect(registry.images[TEAM_IMAGE].referencedIn).toEqual(['content/home/about/team.md']);
  });

  test('does not report an image referenced only by a moved page as orphaned', async () => {
    const store = await createImageSite();

    await store.getState().repositionNode(NESTED_SITE_ID, 'content/about.md', 'content/home.md', 0);

    // Saving a fresh page at a vacated path clears any reference still recorded against it.
    await store.getState().addOrUpdateContentFile(
      NESTED_SITE_ID,
      'content/about.md',
      stringifyToMarkdown({ title: 'About', layout: 'page' }, 'No images here')
    );
    await store.getState().addOrUpdateContentFile(
      NESTED_SITE_ID,
      'content/about/team.md',
      stringifyToMarkdown({ title: 'Team', layout: 'page' }, 'No images here either')
    );

    const orphans = await getOrphanedImages(NESTED_SITE_ID);
    expect(orphans.orphanedOriginals).not.toContain(HERO_IMAGE);
    expect(orphans.orphanedOriginals).not.toContain(TEAM_IMAGE);
  });
});
