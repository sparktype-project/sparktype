import type { LocalSiteData, PageResolutionResult } from '@/core/types';
import { PageType } from '@/core/types';
import { compactHtml } from '@/test/support/html';
import { createSiteFixture } from '@/test/support/siteFixtures';

const {
  prepareRenderEnvironmentMock,
  getMergedThemeDataForFormMock,
  getLayoutManifestMock,
  getThemeAssetContentMock,
  getAssetContentMock,
  clearAssetContentCacheMock,
  assemblePageContextMock,
  assembleBaseContextMock,
  getActiveImageServiceMock,
  preprocessImagesMock,
  getProcessedImageUrlMock,
  getProcessedMarkdownImageUrlMock,
  getProcessedImagesMock,
} = vi.hoisted(() => ({
  prepareRenderEnvironmentMock: vi.fn(),
  getMergedThemeDataForFormMock: vi.fn(),
  getLayoutManifestMock: vi.fn(),
  getThemeAssetContentMock: vi.fn(),
  getAssetContentMock: vi.fn(),
  clearAssetContentCacheMock: vi.fn(),
  assemblePageContextMock: vi.fn(),
  assembleBaseContextMock: vi.fn(),
  getActiveImageServiceMock: vi.fn(),
  preprocessImagesMock: vi.fn(),
  getProcessedImageUrlMock: vi.fn(),
  getProcessedMarkdownImageUrlMock: vi.fn(),
  getProcessedImagesMock: vi.fn(() => new Map()),
}));

vi.mock('@/config/editorConfig', async () => {
  const actual = await vi.importActual<typeof import('@/config/editorConfig')>('@/config/editorConfig');
  return {
    ...actual,
    SECURITY_CONFIG: {
      TRUSTED_SCRIPT_DOMAINS: ['trusted.example'],
    },
  };
});

vi.mock('@/core/services/config/theme.service', () => ({
  getMergedThemeDataForForm: getMergedThemeDataForFormMock,
}));

vi.mock('@/core/services/config/configHelpers.service', () => ({
  getLayoutManifest: getLayoutManifestMock,
  getThemeAssetContent: getThemeAssetContentMock,
  getAssetContent: getAssetContentMock,
  clearAssetContentCache: clearAssetContentCacheMock,
}));

vi.mock('@/core/services/renderer/asset.service', () => ({
  prepareRenderEnvironment: prepareRenderEnvironmentMock,
}));

vi.mock('@/core/services/renderer/context.service', () => ({
  assemblePageContext: assemblePageContextMock,
  assembleBaseContext: assembleBaseContextMock,
}));

vi.mock('@/core/services/images/images.service', () => ({
  getActiveImageService: getActiveImageServiceMock,
}));

vi.mock('@/core/services/images/imagePreprocessor.service', () => ({
  imagePreprocessor: {
    preprocessImages: preprocessImagesMock,
    getProcessedImageUrl: getProcessedImageUrlMock,
    getProcessedMarkdownImageUrl: getProcessedMarkdownImageUrlMock,
    getProcessedImages: getProcessedImagesMock,
  },
}));

import { resolvePageContent } from '../pageResolver.service';
import { render } from '../renderer/render.service';

describe('page resolver and render integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMergedThemeDataForFormMock.mockImplementation(async (_themeName: string, config: Record<string, unknown>) => ({
      schema: null,
      initialConfig: config,
    }));
    getLayoutManifestMock.mockResolvedValue({
      id: 'page',
      name: 'Page',
      layoutType: 'single',
      parentLayout: 'base',
    });
    getAssetContentMock.mockResolvedValue(JSON.stringify({ layouts: ['page'] }));
    getThemeAssetContentMock.mockImplementation(async (_siteData: unknown, _themeName: string, assetPath: string) => {
      if (assetPath === 'layouts/page/index.hbs') {
        return `<main data-layout="page">{{{content}}}</main>`;
      }
      if (assetPath === 'base.hbs') {
        return `<html><body data-accent="{{theme.config.accent}}">{{{body}}}<footer>{{theme.config.brandMessage}}</footer></body></html>`;
      }
      return null;
    });
    assemblePageContextMock.mockImplementation(async (siteData: LocalSiteData, resolution: PageResolutionResult, options: unknown) => ({
      pageTitle: resolution.type === PageType.SinglePage ? resolution.contentFile.frontmatter.title : 'Not Found',
      theme: siteData.manifest.theme,
      options,
      contentFile: resolution.type === PageType.SinglePage ? resolution.contentFile : undefined,
    }));
    assembleBaseContextMock.mockImplementation(async (siteData: LocalSiteData, resolution: PageResolutionResult, options: unknown) => ({
      theme: siteData.manifest.theme,
      options,
      contentFile: resolution.type === PageType.SinglePage ? resolution.contentFile : undefined,
    }));
    getActiveImageServiceMock.mockReturnValue({
      getDisplayUrl: vi.fn(),
    });
    preprocessImagesMock.mockResolvedValue(undefined);
    getProcessedImageUrlMock.mockReturnValue(null);
    getProcessedMarkdownImageUrlMock.mockReturnValue(null);
  });

  test('resolves homepage, nested pages, collection items, and not-found cases', async () => {
    const nestedSite = createSiteFixture('nestedPagesSite');
    const collectionSite = createSiteFixture('collectionSite');

    await expect(resolvePageContent(nestedSite, [])).resolves.toMatchObject({
      type: PageType.SinglePage,
      contentFile: expect.objectContaining({ path: 'content/home.md' }),
    });
    await expect(resolvePageContent(nestedSite, ['about', 'team'])).resolves.toMatchObject({
      type: PageType.SinglePage,
      contentFile: expect.objectContaining({ path: 'content/about/team.md' }),
    });
    await expect(resolvePageContent(collectionSite, ['posts', 'launch-day'])).resolves.toMatchObject({
      type: PageType.SinglePage,
      contentFile: expect.objectContaining({ path: 'content/posts/launch-day.md' }),
    });
    await expect(resolvePageContent(collectionSite, ['missing'])).resolves.toMatchObject({
      type: PageType.NotFound,
    });
  });

  test('renders custom theme pages with merged theme config and parent layout inheritance', async () => {
    const site = createSiteFixture('customThemeSite');
    const resolution: PageResolutionResult = {
      type: PageType.SinglePage,
      pageTitle: 'Home',
      contentFile: site.contentFiles![0],
      layoutPath: 'page',
    };

    const html = await render(site, resolution, {
      siteRootPath: '/',
      isExport: false,
    });

    const normalized = compactHtml(html);
    expect(clearAssetContentCacheMock).toHaveBeenCalledTimes(1);
    expect(normalized).toContain('data-accent="#0f766e"');
    expect(normalized).toContain('<footer>Custom brand</footer>');
    expect(normalized).toContain('<main data-layout="page">');
  });

  test('sanitizes unsafe html by stripping executable and embedded content', async () => {
    const site = createSiteFixture('unsafeHtmlSite');
    const resolution: PageResolutionResult = {
      type: PageType.SinglePage,
      pageTitle: 'Home',
      contentFile: site.contentFiles![0],
      layoutPath: 'page',
    };

    const html = await render(site, resolution, {
      siteRootPath: '/',
      isExport: false,
    });

    const normalized = compactHtml(html);
    expect(normalized).not.toContain('onclick=');
    expect(normalized).not.toContain('<script');
    expect(normalized).not.toContain('http://insecure.example/embed');
    expect(normalized).not.toContain('https://trusted.example/embed');
    expect(normalized).not.toContain('https://trusted.example/app.js');
  });
});
