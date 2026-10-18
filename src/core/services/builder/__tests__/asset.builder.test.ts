import { createSiteFixture } from '@/test/support/siteFixtures';

const {
  getJsonAssetMock,
  getThemeAssetContentMock,
  getActiveImageServiceMock,
  cleanupOrphanedImagesMock,
  generateMediaManifestMock,
} = vi.hoisted(() => ({
  getJsonAssetMock: vi.fn(),
  getThemeAssetContentMock: vi.fn(),
  getActiveImageServiceMock: vi.fn(),
  cleanupOrphanedImagesMock: vi.fn(),
  generateMediaManifestMock: vi.fn(),
}));

vi.mock('@/core/services/config/configHelpers.service', () => ({
  getJsonAsset: getJsonAssetMock,
  getThemeAssetContent: getThemeAssetContentMock,
  getAssetContent: vi.fn(),
}));

vi.mock('@/core/services/images/images.service', () => ({
  getActiveImageService: getActiveImageServiceMock,
}));

vi.mock('@/core/services/images/imageCleanup.service', () => ({
  cleanupOrphanedImages: cleanupOrphanedImagesMock,
}));

vi.mock('../../images/mediaManifest.service', () => ({
  generateMediaManifest: generateMediaManifestMock,
}));

import { bundleAllAssets } from '../asset.builder';

describe('asset.builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getJsonAssetMock.mockResolvedValue({
      files: [{ path: 'base.hbs' }, { path: 'styles.css' }],
      layouts: ['page'],
    });
    getThemeAssetContentMock.mockImplementation(async (_siteData, _themeName, assetPath) => {
      if (assetPath === 'base.hbs') return '<html>{{{body}}}</html>';
      if (assetPath === 'styles.css') return 'body { color: red; }';
      if (assetPath === 'layouts/page/layout.json') return JSON.stringify({ files: [{ path: 'index.hbs' }] });
      if (assetPath === 'layouts/page/index.hbs') return '<main>{{{content}}}</main>';
      return null;
    });
    getActiveImageServiceMock.mockReturnValue({
      getExportableAssets: vi.fn().mockResolvedValue([
        { path: '_site/assets/originals/logo.png', data: new Blob(['logo']) },
      ]),
    });
    generateMediaManifestMock.mockResolvedValue({
      version: 1,
      imageService: 'local',
      images: {
        'assets/originals/logo.png': {
          path: 'assets/originals/logo.png',
          referencedIn: ['content/home.md'],
          metadata: { sizeBytes: 4 },
        },
      },
    });
  });

  test('bundles referenced images, theme assets, layout assets, and media.json', async () => {
    const site = createSiteFixture('imageHeavySite');
    const bundle: Record<string, Blob | string> = {};

    await bundleAllAssets(bundle, site);

    expect(bundle['_site/assets/originals/logo.png']).toBeInstanceOf(Blob);
    expect(bundle['_site/themes/starter/theme.json']).toContain('"layouts"');
    expect(bundle['_site/themes/starter/base.hbs']).toBe('<html>{{{body}}}</html>');
    expect(bundle['_site/themes/starter/layouts/page/index.hbs']).toBe('<main>{{{content}}}</main>');
    expect(bundle['_site/data/media.json']).toContain('assets/originals/logo.png');
  });

  test('bundles local images that are referenced only from the markdown body', async () => {
    // Images inserted in the editor are stored as plain markdown links in the body, not as
    // ImageRef frontmatter fields. They must still reach the bundle or published pages 404.
    const base = createSiteFixture('imageHeavySite');
    const site = {
      ...base,
      manifest: { ...base.manifest, logo: undefined, favicon: undefined },
      contentFiles: [
        {
          ...base.contentFiles![0],
          frontmatter: { title: 'Body only', layout: 'page', published: true },
          content: 'Intro\n\n![tiny](assets/originals/body-image.png)\n\n<img src="assets/originals/inline.png" alt="x">\n\n![remote](https://example.com/a.png)',
        },
      ],
    };
    const getExportableAssets = vi.fn().mockResolvedValue([]);
    getActiveImageServiceMock.mockReturnValue({ getExportableAssets });

    await bundleAllAssets({}, site);

    const refs = getExportableAssets.mock.calls[0][1] as Array<{ serviceId: string; src: string }>;
    expect(refs.map((ref) => ref.src).sort()).toEqual(['assets/originals/body-image.png', 'assets/originals/inline.png']);
    expect(refs.every((ref) => ref.serviceId === 'local')).toBe(true);
  });

  test('does not run orphan cleanup: cleanup writes to the site’s stored data, which a build must not touch', async () => {
    const site = createSiteFixture('imageHeavySite');
    const bundle: Record<string, Blob | string> = {};

    await bundleAllAssets(bundle, site);

    expect(cleanupOrphanedImagesMock).not.toHaveBeenCalled();
  });

  test('continues when image bundling fails, but still generates media.json', async () => {
    const site = createSiteFixture('imageHeavySite');
    const bundle: Record<string, Blob | string> = {};

    getActiveImageServiceMock.mockReturnValueOnce({
      getExportableAssets: vi.fn().mockRejectedValue(new Error('asset failure')),
    });

    await expect(bundleAllAssets(bundle, site)).resolves.toBeUndefined();
    expect(bundle['_site/data/media.json']).toContain('"imageService"');
  });
});
