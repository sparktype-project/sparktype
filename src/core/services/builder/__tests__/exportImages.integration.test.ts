/**
 * Export image pipeline integration test.
 *
 * Runs a real `buildSiteBundle` over a site with a raster image whose derivative does not exist
 * yet, so the export's image preprocessor must generate one. It asserts the three properties the
 * export image path has to hold together:
 *
 * 1. the image registry is not written — it is site metadata, not a build artifact;
 * 2. the derivative ends up in the bundle, so the paths the published HTML references resolve;
 * 3. the user's original image bytes are untouched.
 *
 * The derivative cache *is* written: it is derived, additive and idempotent, and the bundle
 * sources its derivative files from that same cache, so the write is what makes property 2 true.
 *
 * Only the canvas boundary is faked. jsdom decodes no images and has no 2D canvas, so
 * `imageManipulation.service` — the module that turns a blob into pixels and pixels back into a
 * blob — is replaced with one that returns a fixed blob. Everything that decides *when* a
 * derivative is generated, cached, registered and bundled is the real code: the real
 * `imagePreprocessor`, the real `localImageService`, the real derivative cache, the real registry
 * and the real builder.
 */
import type { LayoutManifest, LocalSiteData, ParsedMarkdownFile, ThemeManifest } from '@/core/types';
import type * as StorageModule from '@/core/services/storage/siteStorage.service';
import { addImageToRegistry, getImageRegistry } from '@/core/services/images/imageRegistry.service';
import { readMetadata } from '@/core/services/storage/siteStorage.service';
import { getAllImageAssetsForSite, saveImageAsset } from '@/core/services/localFileSystem.service';
import { resetInMemoryBlobStore } from '@/test/support/blobStorageStub';
import { resetIndexedDbForTests } from '@/test/support/storage';

// Dynamic import required: `vi.mock` factories run before this file's imports are initialised.
vi.mock('@/core/services/storage/siteStorage.service', async (importOriginal) => {
  const { stubBlobBackend } = await import('@/test/support/blobStorageStub');
  return stubBlobBackend(() => importOriginal<typeof StorageModule>());
});

vi.mock('@/core/services/images/imageManipulation.service', () => ({
  getImageDimensions: async () => ({ width: 200, height: 150 }),
  cropAndResizeImage: async (_blob: Blob, options: { width?: number; height?: number }) =>
    new Blob([`resized:${options.width ?? 'auto'}x${options.height ?? 'auto'}`], { type: 'image/jpeg' }),
}));

/** A minimal but real PNG header, so the fixture is a raster image rather than an SVG. */
const HERO_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x7f, 0x01]);
const HERO_IMAGE = 'assets/originals/hero.png';

const THEME_MANIFEST: ThemeManifest = {
  name: 'starter',
  version: '1.0.0',
  files: [{ path: 'base.hbs', type: 'base' }],
  layouts: ['page'],
  stylesheets: [],
};

const LAYOUT_MANIFESTS: Record<string, LayoutManifest> = {
  page: { id: 'page', name: 'Page', version: '1.0.0', layoutType: 'page', parentLayout: 'base', files: [] },
};

const THEME_FILES: Record<string, string> = {
  'base.hbs': '<html><head><title>{{pageTitle}}</title></head><body>{{{body}}}</body></html>',
  'layouts/page/index.hbs': '<main data-layout="page">{{{content}}}</main>',
};

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

import { buildSiteBundle } from '../../siteBuilder.service';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';

const SECTION_IMAGE = 'assets/originals/section.png';
const SECTION_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x11, 0x22]);

/**
 * The published homepage references two raster images: one inline in its markdown and one in a
 * frontmatter field, so both the markdown and the frontmatter preset paths generate derivatives.
 */
function createRasterSite(): LocalSiteData {
  const home: ParsedMarkdownFile = {
    path: 'content/home.md',
    slug: 'home',
    frontmatter: {
      title: 'Home',
      layout: 'page',
      homepage: true,
      featured_image: { serviceId: 'local', src: SECTION_IMAGE, alt: 'Section', width: 0, height: 0 },
    },
    content: `![Hero](${HERO_IMAGE})`,
  };

  return {
    siteId: 'raster-site',
    manifest: {
      siteId: 'raster-site',
      generatorVersion: '1.0.0',
      title: 'Raster Site',
      description: 'Raster site',
      baseUrl: 'https://example.com',
      theme: { name: 'starter', config: {} },
      structure: [{ type: 'page', title: 'Home', slug: 'home', path: home.path, navOrder: 1 }],
    },
    contentFiles: [home],
    themeFiles: [{ path: 'themes/starter/theme.json', content: JSON.stringify(THEME_MANIFEST) }],
    layoutFiles: [{ path: 'layouts/page/layout.json', content: JSON.stringify(LAYOUT_MANIFESTS.page) }],
  };
}

function derivativePathsIn(bundle: Record<string, string | Blob>, image: string): string[] {
  const baseName = image.split('/').pop()!.replace(/\.[^.]+$/, '');
  return Object.keys(bundle).filter(
    (path) => path.startsWith('_site/assets/derivatives/') && path.includes(baseName),
  );
}

describe('export image pipeline', () => {
  beforeEach(async () => {
    resetInMemoryBlobStore();
    await resetIndexedDbForTests();
    // The preprocessor is a module singleton whose in-memory result cache outlives the storage
    // reset above; it would otherwise skip regenerating derivatives this test cleared.
    imagePreprocessor.getProcessedImages().clear();
  });

  test('generates derivatives into the bundle without writing the image registry or the originals', async () => {
    const site = createRasterSite();
    await saveImageAsset(site.siteId, HERO_IMAGE, new Blob([HERO_BYTES], { type: 'image/png' }));
    await saveImageAsset(site.siteId, SECTION_IMAGE, new Blob([SECTION_BYTES], { type: 'image/png' }));
    const originalsBefore = await getAllImageAssetsForSite(site.siteId);

    const bundle = await buildSiteBundle(site);

    // (a) No registry write. No registry existed before, and the export must not create one —
    // neither while generating media.json nor while generating derivatives.
    expect(await readMetadata('imageRegistries', site.siteId)).toBeNull();

    // (b) The derivative the published page references is in the bundle, so the image resolves.
    const heroDerivatives = derivativePathsIn(bundle, HERO_IMAGE);
    expect(heroDerivatives.length).toBeGreaterThan(0);
    expect(bundle[heroDerivatives[0]]).toBeInstanceOf(Blob);
    expect(derivativePathsIn(bundle, SECTION_IMAGE).length).toBeGreaterThan(0);

    // The page's own image reference points at one of those files.
    const imgSrc = bundle['index.html'].toString().match(/<img[^>]*src="([^"]+)"/)?.[1] ?? '';
    expect(imgSrc).toContain('assets/derivatives/');
    expect(bundle[imgSrc.replace(/^\.\//, '')]).toBeInstanceOf(Blob);

    // The original that the site data references directly is bundled beside its derivatives.
    expect(bundle[`_site/${SECTION_IMAGE}`]).toBeInstanceOf(Blob);

    // (c) The user's stored originals are byte-identical.
    const originalsAfter = await getAllImageAssetsForSite(site.siteId);
    expect(Object.keys(originalsAfter).sort()).toEqual(Object.keys(originalsBefore).sort());
    expect(new Uint8Array(await originalsAfter[HERO_IMAGE].arrayBuffer())).toEqual(HERO_BYTES);
    expect(new Uint8Array(await originalsAfter[SECTION_IMAGE].arrayBuffer())).toEqual(SECTION_BYTES);
  });

  test('leaves an existing registry untouched during export', async () => {
    const site = createRasterSite();
    await saveImageAsset(site.siteId, HERO_IMAGE, new Blob([HERO_BYTES], { type: 'image/png' }));
    await saveImageAsset(site.siteId, SECTION_IMAGE, new Blob([SECTION_BYTES], { type: 'image/png' }));
    // A registry as the editor leaves it: the uploaded originals, no derivatives yet.
    await addImageToRegistry(site.siteId, HERO_IMAGE, HERO_BYTES.length);
    await addImageToRegistry(site.siteId, SECTION_IMAGE, SECTION_BYTES.length);
    const registryBefore = await getImageRegistry(site.siteId);

    const bundle = await buildSiteBundle(site);

    const registryAfter = await getImageRegistry(site.siteId);
    expect(registryAfter).toEqual(registryBefore);
    expect(Object.values(registryAfter.images).every((entry) => entry.derivativePaths.length === 0)).toBe(true);
    expect(derivativePathsIn(bundle, HERO_IMAGE).length).toBeGreaterThan(0);
  });
});
