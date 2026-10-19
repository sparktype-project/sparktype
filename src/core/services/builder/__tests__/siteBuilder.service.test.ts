import type { LocalSiteData } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';

const {
  getMergedThemeDataForFormMock,
  clearAssetContentCacheMock,
  generateHtmlPagesMock,
  bundleSourceFilesMock,
  bundleAllAssetsMock,
  generateMetadataFilesMock,
  addNotFoundPageMock,
} = vi.hoisted(() => ({
  getMergedThemeDataForFormMock: vi.fn(),
  clearAssetContentCacheMock: vi.fn(),
  generateHtmlPagesMock: vi.fn(),
  bundleSourceFilesMock: vi.fn(),
  bundleAllAssetsMock: vi.fn(),
  generateMetadataFilesMock: vi.fn(),
  addNotFoundPageMock: vi.fn(),
}));

vi.mock('@/core/services/config/theme.service', () => ({
  getMergedThemeDataForForm: getMergedThemeDataForFormMock,
}));

vi.mock('@/core/services/config/configHelpers.service', () => ({
  clearAssetContentCache: clearAssetContentCacheMock,
}));

vi.mock('../page.builder', () => ({
  generateHtmlPages: generateHtmlPagesMock,
}));

vi.mock('../source.builder', () => ({
  bundleSourceFiles: bundleSourceFilesMock,
}));

vi.mock('../asset.builder', () => ({
  bundleAllAssets: bundleAllAssetsMock,
}));

vi.mock('../notFound.builder', () => ({
  addNotFoundPage: addNotFoundPageMock,
}));

vi.mock('../metadata.builder', () => ({
  generateMetadataFiles: generateMetadataFilesMock,
}));

import { buildSiteBundle } from '../../siteBuilder.service';

describe('siteBuilder.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMergedThemeDataForFormMock.mockResolvedValue({
      schema: null,
      initialConfig: { accent: '#0f766e' },
    });
    generateHtmlPagesMock.mockResolvedValue({
      'index.html': '<html>Home</html>',
    });
    bundleSourceFilesMock.mockImplementation(async (bundle: Record<string, string>) => {
      bundle['_site/manifest.json'] = '{"title":"Fixture"}';
    });
    bundleAllAssetsMock.mockImplementation(async (bundle: Record<string, string>) => {
      bundle['_site/data/media.json'] = '{"images":{}}';
    });
    addNotFoundPageMock.mockImplementation(async (bundle: Record<string, string>) => {
      bundle['404.html'] = '<html>Not found</html>';
    });
    generateMetadataFilesMock.mockImplementation((bundle: Record<string, string>) => {
      bundle['sitemap.xml'] = '<urlset />';
    });
  });

  test('merges theme config and returns the complete bundle', async () => {
    const site = createSiteFixture('basicSite');

    const bundle = await buildSiteBundle(site);

    expect(clearAssetContentCacheMock).toHaveBeenCalledTimes(1);
    expect(getMergedThemeDataForFormMock).toHaveBeenCalledWith(
      'starter',
      { accent: 'teal' },
      undefined,
      site.siteId
    );
    expect(generateHtmlPagesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        manifest: expect.objectContaining({
          theme: expect.objectContaining({
            config: { accent: '#0f766e' },
          }),
        }),
      })
    );
    expect(bundle).toEqual({
      'index.html': '<html>Home</html>',
      '404.html': '<html>Not found</html>',
      '_site/manifest.json': '{"title":"Fixture"}',
      '_site/data/media.json': '{"images":{}}',
      'sitemap.xml': '<urlset />',
    });
  });

  test('hands the publication-filtered snapshot to every build stage', async () => {
    const site = createSiteFixture('basicSite');
    site.contentFiles!.push({
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
      navOrder: 2,
    });

    await buildSiteBundle(site);

    for (const builder of [
      generateHtmlPagesMock,
      bundleSourceFilesMock,
      bundleAllAssetsMock,
      generateMetadataFilesMock,
    ]) {
      const passedSiteData = builder.mock.calls[0].at(-1) as LocalSiteData;
      expect(passedSiteData.contentFiles?.map((file) => file.path)).toEqual(['content/home.md']);
      expect(passedSiteData.manifest.structure.map((node) => node.path)).toEqual(['content/home.md']);
    }
    expect(generateHtmlPagesMock.mock.calls[0][0]).not.toBe(site);
  });

  test('fails the build when the homepage is unpublished', async () => {
    const site = createSiteFixture('basicSite');
    site.contentFiles![0].frontmatter.published = false;

    await expect(buildSiteBundle(site)).rejects.toThrow(/homepage/);
    expect(generateHtmlPagesMock).not.toHaveBeenCalled();
  });

  test('wraps asset and metadata errors with build-stage context', async () => {
    const site = createSiteFixture('basicSite');
    bundleAllAssetsMock.mockRejectedValueOnce(new Error('asset boom'));

    await expect(buildSiteBundle(site)).rejects.toThrow('Asset bundling failed: Error: asset boom');

    bundleAllAssetsMock.mockResolvedValue(undefined);
    generateMetadataFilesMock.mockImplementationOnce(() => {
      throw new Error('metadata boom');
    });

    await expect(buildSiteBundle(site)).rejects.toThrow('Metadata generation failed: Error: metadata boom');
  });
});
