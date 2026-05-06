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
    cleanupOrphanedImagesMock.mockResolvedValue({
      originalImagesRemoved: 1,
      derivativesRemoved: 2,
      bytesFreed: 1024,
      cleanupLog: [],
    });
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

    expect(cleanupOrphanedImagesMock).toHaveBeenCalledWith(site);
    expect(bundle['_site/assets/originals/logo.png']).toBeInstanceOf(Blob);
    expect(bundle['_site/themes/starter/theme.json']).toContain('"layouts"');
    expect(bundle['_site/themes/starter/base.hbs']).toBe('<html>{{{body}}}</html>');
    expect(bundle['_site/themes/starter/layouts/page/index.hbs']).toBe('<main>{{{content}}}</main>');
    expect(bundle['_site/data/media.json']).toContain('assets/originals/logo.png');
  });

  test('continues when cleanup or image bundling fails, but still generates media.json', async () => {
    const site = createSiteFixture('imageHeavySite');
    const bundle: Record<string, Blob | string> = {};

    cleanupOrphanedImagesMock.mockRejectedValueOnce(new Error('cleanup timeout'));
    getActiveImageServiceMock.mockReturnValueOnce({
      getExportableAssets: vi.fn().mockRejectedValue(new Error('asset failure')),
    });

    await expect(bundleAllAssets(bundle, site)).resolves.toBeUndefined();
    expect(bundle['_site/data/media.json']).toContain('"imageService"');
  });
});
