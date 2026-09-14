/**
 * Publication integration test.
 *
 * Runs the real export pipeline (`buildSiteBundle`) over a site that mixes published and
 * unpublished content and asserts, on the generated artifacts, that:
 *
 * - no draft appears in any public output (HTML pages, pagination, listings, navigation,
 *   `_site/manifest.json`, Markdown sources, RSS, sitemap),
 * - a draft-only image is neither bundled nor deleted from storage (removing the orphan
 *   cleanup call from `bundleAllAssets` is what makes this hold),
 * - the caller's `LocalSiteData` is left untouched.
 *
 * Only asset/image plumbing is mocked (theme files, image preprocessing, merged theme config);
 * the builders, renderer, collections, navigation and XML generation are the real ones.
 */
import type { LayoutManifest, LocalSiteData, ParsedMarkdownFile, ThemeManifest } from '@/core/types';
import type * as StorageModule from '@/core/services/storage/siteStorage.service';
import { addImageToRegistry, updateImageReferences } from '@/core/services/images/imageRegistry.service';
import {
  getAllImageAssetsForSite,
  saveImageAsset,
} from '@/core/services/localFileSystem.service';
import { readMetadata } from '@/core/services/storage/siteStorage.service';
import { resetInMemoryBlobStore } from '@/test/support/blobStorageStub';
import { resetIndexedDbForTests } from '@/test/support/storage';

// The dynamic import is required: `vi.mock` factories run before this file's own imports are
// initialised, so the blob stub cannot be imported statically here.
vi.mock('@/core/services/storage/siteStorage.service', async (importOriginal) => {
  const { stubBlobBackend } = await import('@/test/support/blobStorageStub');
  return stubBlobBackend(() => importOriginal<typeof StorageModule>());
});

const THEME_MANIFEST: ThemeManifest = {
  name: 'starter',
  version: '1.0.0',
  files: [{ path: 'base.hbs', type: 'base' }],
  layouts: ['page', 'listing', 'post'],
  stylesheets: [],
};

const LAYOUT_MANIFESTS: Record<string, LayoutManifest> = {
  page: { id: 'page', name: 'Page', version: '1.0.0', layoutType: 'page', parentLayout: 'base', files: [] },
  listing: { id: 'listing', name: 'Listing', version: '1.0.0', layoutType: 'list', parentLayout: 'base', files: [] },
  post: {
    id: 'post',
    name: 'Post',
    version: '1.0.0',
    layoutType: 'item',
    files: [{ path: 'partials/card.hbs', type: 'partial', name: 'Card' }],
    partials: [{ path: 'card.hbs', name: 'Card', isDefault: true }],
  },
};

const THEME_FILES: Record<string, string> = {
  'base.hbs':
    '<html><head><title>{{pageTitle}}</title></head><body><nav>{{#each navLinks}}<a href="{{href}}">{{label}}</a>{{/each}}</nav>{{{body}}}</body></html>',
  'layouts/page/index.hbs': '<main data-layout="page">{{{content}}}</main>',
  'layouts/listing/index.hbs':
    '<main data-layout="listing">{{{content}}}<ul>{{#each collectionItems}}<li data-collection-item>{{frontmatter.title}}</li>{{/each}}</ul></main>',
  'layouts/post/index.hbs': '<article data-layout="post">{{{content}}}</article>',
  'layouts/post/partials/card.hbs': '<article data-collection-item>{{frontmatter.title}}</article>',
};

// Function declaration (hoisted), so the hoisted `vi.mock` factory below can reference it.
function resolveThemeAsset(assetPath: string): string | null {
  if (assetPath === 'theme.json') return JSON.stringify(THEME_MANIFEST);
  return THEME_FILES[assetPath] ?? null;
}

vi.mock('@/core/services/config/theme.service', () => ({
  getMergedThemeDataForForm: async (_name: string, config: Record<string, unknown>) => ({
    schema: null,
    initialConfig: config,
  }),
}));

vi.mock('@/core/services/config/configHelpers.service', () => ({
  clearAssetContentCache: () => {},
  getAssetContent: async (_context: unknown, _assetType: string, _assetId: string, fileName: string) =>
    resolveThemeAsset(fileName),
  getThemeAssetContent: async (_context: unknown, _themeName: string, assetPath: string) =>
    resolveThemeAsset(assetPath),
  getJsonAsset: async (_context: unknown, assetType: string) => (assetType === 'theme' ? THEME_MANIFEST : null),
  getLayoutManifest: async (_context: unknown, layoutId: string) => LAYOUT_MANIFESTS[layoutId] ?? null,
  getAvailableLayouts: async () => Object.values(LAYOUT_MANIFESTS),
}));

vi.mock('@/core/services/images/imagePreprocessor.service', () => ({
  imagePreprocessor: {
    preprocessImages: async () => {},
    getProcessedImageUrl: () => null,
    getProcessedMarkdownImageUrl: () => null,
    getProcessedImages: () => new Map(),
  },
}));

import { buildSiteBundle } from '../../siteBuilder.service';
import { createPublicSiteSnapshot } from '../publication';
import { resolvePageContent } from '@/core/services/pageResolver.service';
import { render } from '@/core/services/renderer/render.service';

const PUBLISHED_IMAGE = 'assets/originals/published.svg';
const DRAFT_IMAGE = 'assets/originals/draft-only.svg';
const PUBLISHED_IMAGE_BYTES = '<svg id="published"></svg>';
const DRAFT_IMAGE_BYTES = '<svg id="draft-only"></svg>';

function createItem(
  path: string,
  title: string,
  date: string,
  published?: boolean,
): ParsedMarkdownFile {
  return {
    path,
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    frontmatter: {
      title,
      layout: 'post',
      date,
      ...(published === undefined ? {} : { published }),
    },
    content: `${title} body text`,
  };
}

/**
 * A site with three published posts, one unpublished post, one unpublished page, and an image
 * referenced only from that unpublished page. Pagination is enabled with a page size of three,
 * so the draft decides whether a second listing page exists.
 */
function createPublicationSite(): LocalSiteData {
  const home: ParsedMarkdownFile = {
    path: 'content/home.md',
    slug: 'home',
    frontmatter: {
      title: 'Home',
      layout: 'page',
      homepage: true,
      featured_image: { serviceId: 'local', src: PUBLISHED_IMAGE, alt: 'Published', width: 100, height: 100 },
    },
    content: 'Welcome to the site.\n\n::collection_view{collection="posts" layout="list-view" maxItems="10"}',
  };
  const listing: ParsedMarkdownFile = {
    path: 'content/posts.md',
    slug: 'posts',
    frontmatter: {
      title: 'Posts',
      layout: 'listing',
      collection: 'posts',
      layoutConfig: {
        collectionId: 'posts',
        layout: 'post',
        sortBy: 'date',
        sortOrder: 'desc',
        pagination: { enabled: true, itemsPerPage: 3 },
      },
    },
    content: 'All posts',
  };
  const first = createItem('content/posts/first.md', 'First Post', '2025-01-03');
  const second = createItem('content/posts/second.md', 'Second Post', '2025-01-02');
  const third = createItem('content/posts/third.md', 'Third Post', '2025-01-01');
  const draftPost = createItem('content/posts/hidden.md', 'Hidden Draft Post', '2025-06-06', false);
  const draftPage: ParsedMarkdownFile = {
    path: 'content/about.md',
    slug: 'about',
    frontmatter: {
      title: 'Secret About Page',
      layout: 'page',
      published: false,
      featured_image: { serviceId: 'local', src: DRAFT_IMAGE, alt: 'Draft', width: 10, height: 10 },
    },
    content: 'Secret about body',
  };

  return {
    siteId: 'publication-site',
    manifest: {
      siteId: 'publication-site',
      generatorVersion: '1.0.0',
      title: 'Publication Site',
      description: 'Publication site',
      baseUrl: 'https://example.com',
      theme: { name: 'starter', config: {} },
      structure: [
        { type: 'page', title: 'Home', slug: 'home', path: home.path, navOrder: 1 },
        { type: 'page', title: 'Posts', slug: 'posts', path: listing.path, navOrder: 2 },
        { type: 'page', title: 'Secret About Page', slug: 'about', path: draftPage.path, navOrder: 3 },
      ],
      collections: [
        { id: 'posts', name: 'Posts', contentPath: 'content/posts', defaultItemLayout: 'post' },
      ],
      collectionItems: [first, second, third, draftPost].map((file) => ({
        collectionId: 'posts',
        slug: file.slug.replace(/^posts\//, ''),
        path: file.path,
        title: file.frontmatter.title,
        url: '',
      })),
    },
    contentFiles: [home, listing, first, second, third, draftPost, draftPage],
  };
}

function parseXml(xml: string): XMLDocument {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  return doc;
}

async function seedStoredImages(siteId: string): Promise<void> {
  await saveImageAsset(siteId, PUBLISHED_IMAGE, new Blob([PUBLISHED_IMAGE_BYTES], { type: 'image/svg+xml' }));
  await saveImageAsset(siteId, DRAFT_IMAGE, new Blob([DRAFT_IMAGE_BYTES], { type: 'image/svg+xml' }));
  await addImageToRegistry(siteId, PUBLISHED_IMAGE, PUBLISHED_IMAGE_BYTES.length);
  await addImageToRegistry(siteId, DRAFT_IMAGE, DRAFT_IMAGE_BYTES.length);
  // The registry tracks references per content file. `published.svg` is referenced from the
  // published homepage; `draft-only.svg` only from the unpublished page. Cleanup (which the
  // build no longer runs) would delete the draft-only image because the build must not.
  await updateImageReferences(siteId, 'content/home.md', [PUBLISHED_IMAGE]);
  await updateImageReferences(siteId, 'content/about.md', [DRAFT_IMAGE]);
}

describe('buildSiteBundle publication filtering', () => {
  beforeEach(async () => {
    resetInMemoryBlobStore();
    await resetIndexedDbForTests();
  });

  test('omits drafts from every public output', async () => {
    const site = createPublicationSite();
    await seedStoredImages(site.siteId);

    const bundle = await buildSiteBundle(site);

    // HTML pages: no page for the draft page or the draft post.
    expect(Object.keys(bundle).sort()).toEqual(
      expect.arrayContaining([
        'index.html',
        'posts/index.html',
        'posts/first/index.html',
        'posts/second/index.html',
        'posts/third/index.html',
      ]),
    );
    expect(Object.keys(bundle)).not.toContain('about/index.html');
    expect(Object.keys(bundle)).not.toContain('posts/hidden/index.html');
    expect(Object.values(bundle).join('')).not.toContain('Secret About Page');
    expect(Object.values(bundle).join('')).not.toContain('Hidden Draft Post');

    // Pagination counts published items only: three posts fit on one page.
    expect(Object.keys(bundle)).not.toContain('posts/page/2/index.html');

    // Navigation comes from the same filtered structure.
    expect(bundle['index.html']).toContain('<a href="./posts/index.html">Posts</a>');
    expect(bundle['index.html']).not.toContain('about');

    // Markdown sources.
    expect(bundle['_site/content/about.md']).toBeUndefined();
    expect(bundle['_site/content/posts/hidden.md']).toBeUndefined();
    expect(bundle['_site/content/posts/first.md']).toContain('First Post body text');

    // Public manifest: no draft paths, slugs or titles.
    const publicManifest = JSON.stringify(JSON.parse(bundle['_site/manifest.json'] as string));
    expect(publicManifest).not.toContain('content/about.md');
    expect(publicManifest).not.toContain('content/posts/hidden.md');
    expect(publicManifest).not.toContain('Secret About Page');
    expect(publicManifest).not.toContain('Hidden Draft Post');
    expect(JSON.parse(bundle['_site/manifest.json'] as string).collectionItems).toHaveLength(3);

    // RSS and sitemap.
    const rss = bundle['rss.xml'] as string;
    expect(rss).toBeDefined();
    expect(rss).not.toContain('Hidden Draft Post');
    expect(rss).not.toContain('Hidden Draft Post body text');
    expect(rss).toContain('First Post');

    const sitemap = parseXml(bundle['sitemap.xml'] as string);
    const locations = Array.from(sitemap.getElementsByTagName('loc')).map((node) => node.textContent ?? '');
    expect(locations).toContain('https://example.com/posts/first');
    expect(locations.join(' ')).not.toContain('hidden');
    expect(locations.join(' ')).not.toContain('about');
  });

  test('bundles published assets and preserves stored originals, including draft-only images', async () => {
    const site = createPublicationSite();
    await seedStoredImages(site.siteId);
    const storedBefore = await getAllImageAssetsForSite(site.siteId);

    const bundle = await buildSiteBundle(site);

    expect(bundle[`_site/${PUBLISHED_IMAGE}`]).toBeInstanceOf(Blob);
    expect(bundle[`_site/${DRAFT_IMAGE}`]).toBeUndefined();

    const storedAfter = await getAllImageAssetsForSite(site.siteId);
    expect(Object.keys(storedAfter).sort()).toEqual(Object.keys(storedBefore).sort());
    expect(await storedAfter[DRAFT_IMAGE].text()).toBe(DRAFT_IMAGE_BYTES);
    expect(await storedAfter[PUBLISHED_IMAGE].text()).toBe(PUBLISHED_IMAGE_BYTES);
  });

  test('media.json describes only images the published content references', async () => {
    const site = createPublicationSite();
    await seedStoredImages(site.siteId);

    const bundle = await buildSiteBundle(site);

    const media = JSON.parse(bundle['_site/data/media.json'] as string);
    expect(Object.keys(media.images)).toEqual([PUBLISHED_IMAGE]);
    expect(JSON.stringify(media)).not.toContain('content/about.md');
  });

  test('preview renders the writer’s drafts while export does not', async () => {
    const site = createPublicationSite();

    const previewHome = await render(site, await resolvePageContent(site, []), {
      siteRootPath: '/',
      isExport: false,
      forIframe: true,
    });
    expect(previewHome).toContain('Hidden Draft Post');
    expect(previewHome).toContain('Secret About Page');

    const previewListing = await render(site, await resolvePageContent(site, ['posts']), {
      siteRootPath: '/',
      isExport: false,
      forIframe: true,
    });
    expect(previewListing).toContain('Hidden Draft Post');

    const exportListing = await render(
      createPublicSiteSnapshot(site),
      await resolvePageContent(site, ['posts']),
      { siteRootPath: '/', isExport: true },
    );
    expect(exportListing).not.toContain('Hidden Draft Post');
    expect(exportListing).toContain('First Post');
  });

  test('does not write to persistent storage while exporting', async () => {
    const site = createPublicationSite();
    // Blobs only: no image registry exists yet, which is the state that used to make the
    // export create one (recording draft references as orphans).
    await saveImageAsset(site.siteId, PUBLISHED_IMAGE, new Blob([PUBLISHED_IMAGE_BYTES], { type: 'image/svg+xml' }));

    await buildSiteBundle(site);

    expect(await readMetadata('imageRegistries', site.siteId)).toBeNull();
  });

  test('does not mutate the caller’s site data', async () => {
    const site = createPublicationSite();
    await seedStoredImages(site.siteId);
    const before = structuredClone(site);

    await buildSiteBundle(site);

    expect(site).toEqual(before);
  });
});
