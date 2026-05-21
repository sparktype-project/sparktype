import type { LayoutConfig, LocalSiteData, PageResolutionResult } from '@/core/types';
import { PageType } from '@/core/types';
import Handlebars from 'handlebars';
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

function enableCollectionPagination(site: LocalSiteData, itemsPerPage = 2) {
  const listingFile = site.contentFiles?.[1];
  const layoutConfig = listingFile?.frontmatter.layoutConfig as LayoutConfig;

  if (!listingFile) {
    throw new Error('Expected collection listing fixture at contentFiles[1].');
  }

  site.contentFiles![1] = {
    ...listingFile,
    frontmatter: {
      ...listingFile.frontmatter,
      layoutConfig: {
        ...layoutConfig,
        pagination: {
          enabled: true,
          itemsPerPage,
        },
      },
    },
  };
}

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

  test('resolves paginated collection display routes when pagination is enabled', async () => {
    const site = createSiteFixture('collectionSite');

    enableCollectionPagination(site);

    site.contentFiles!.push(
      {
        path: 'content/posts/second-post.md',
        slug: 'posts/second-post',
        frontmatter: {
          title: 'Second Post',
          layout: 'post',
          date: '2025-01-09',
        },
        content: 'Second post body',
      },
      {
        path: 'content/posts/third-post.md',
        slug: 'posts/third-post',
        frontmatter: {
          title: 'Third Post',
          layout: 'post',
          date: '2025-01-08',
        },
        content: 'Third post body',
      },
    );

    site.manifest.collectionItems = [
      ...(site.manifest.collectionItems || []),
      {
        collectionId: 'posts',
        slug: 'second-post',
        path: 'content/posts/second-post.md',
        title: 'Second Post',
        url: '',
      },
      {
        collectionId: 'posts',
        slug: 'third-post',
        path: 'content/posts/third-post.md',
        title: 'Third Post',
        url: '',
      },
    ];

    await expect(resolvePageContent(site, ['posts', 'page', '2'])).resolves.toMatchObject({
      type: PageType.SinglePage,
      contentFile: expect.objectContaining({ path: 'content/posts.md' }),
      pageNumber: 2,
    });
    await expect(resolvePageContent(site, ['posts', 'page', '3'])).resolves.toMatchObject({
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

  test('renders collection_view directives inside page content', async () => {
    const site = createSiteFixture('collectionSite');
    site.contentFiles![0] = {
      ...site.contentFiles![0],
      content: '::collection_view{collection="posts" layout="list-view" maxItems="1"}',
    };

    Handlebars.registerPartial('post/partials/card', '<article data-collection-item>{{frontmatter.title}}</article>');

    getLayoutManifestMock.mockImplementation(async (_siteData: LocalSiteData, layoutId: string) => {
      if (layoutId === 'post') {
        return {
          id: 'post',
          name: 'Post',
          layoutType: 'item',
          partials: [
            {
              path: 'card.hbs',
              name: 'Card',
              isDefault: true,
            },
          ],
        };
      }

      return {
        id: 'page',
        name: 'Page',
        layoutType: 'page',
        parentLayout: 'base',
      };
    });

    const resolution = await resolvePageContent(site, []);
    expect(resolution.type).toBe(PageType.SinglePage);

    const html = await render(site, resolution, {
      siteRootPath: '/',
      isExport: false,
    });

    const normalized = compactHtml(html);
    expect(normalized).toContain('data-collection-item');
    expect(normalized).toContain('Launch Day');

    delete Handlebars.partials['post/partials/card'];
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

  test('renders provider-backed markdown images through the active image service', async () => {
    const site = createSiteFixture('customThemeSite');
    site.manifest.settings = {
      ...site.manifest.settings,
      imageProvider: { id: 'cloudinary' },
    };
    site.contentFiles![0] = {
      ...site.contentFiles![0],
      content: '![Uploaded image](bcc-wf)',
    };

    const getDisplayUrl = vi.fn().mockResolvedValue('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/bcc-wf');
    getActiveImageServiceMock.mockReturnValue({
      id: 'cloudinary',
      getDisplayUrl,
    });

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
    expect(getDisplayUrl).toHaveBeenCalledWith(
      site.manifest,
      expect.objectContaining({
        serviceId: 'cloudinary',
        src: 'bcc-wf',
        alt: 'Uploaded image',
      }),
      {},
      false,
      undefined,
    );
    expect(normalized).toContain('src="https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/bcc-wf"');
    expect(normalized).not.toContain('src="bcc-wf"');
  });

  test('preserves preprocessed absolute markdown image URLs during export', async () => {
    const site = createSiteFixture('customThemeSite');
    site.contentFiles![0] = {
      ...site.contentFiles![0],
      content: '![Uploaded image](assets/originals/mk)',
    };
    getProcessedMarkdownImageUrlMock.mockReturnValue(
      'https://res.cloudinary.com/dhcgic4ld/image/upload/c_fill,g_xy_center,h_256,w_256/f_auto/q_auto/mk'
    );

    const resolution: PageResolutionResult = {
      type: PageType.SinglePage,
      pageTitle: 'Home',
      contentFile: site.contentFiles![0],
      layoutPath: 'page',
    };

    const html = await render(site, resolution, {
      siteRootPath: '/',
      isExport: true,
    });

    const normalized = compactHtml(html);
    expect(normalized).toContain(
      'src="https://res.cloudinary.com/dhcgic4ld/image/upload/c_fill,g_xy_center,h_256,w_256/f_auto/q_auto/mk"'
    );
    expect(normalized).not.toContain('/https://res.cloudinary.com/');
  });

  test('renders uploaded cloudinary videos with the hosted iframe player', async () => {
    const site = createSiteFixture('customThemeSite');
    site.manifest.settings = {
      ...site.manifest.settings,
      cloudinary: {
        cloudName: 'demo-cloud',
      },
    };
    site.contentFiles![0] = {
      ...site.contentFiles![0],
      content:
        '<video src="https://res.cloudinary.com/demo-cloud/video/upload/v3/videos/demo.mp4" controls preload="metadata" data-sparktype-upload="true" data-sparktype-service-id="cloudinary" data-sparktype-video-src="videos/demo" data-sparktype-width="1920" data-sparktype-height="1080"></video>',
    };

    getActiveImageServiceMock.mockReturnValue({
      id: 'cloudinary',
      getDisplayUrl: vi.fn(),
    });

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
    expect(normalized).toContain('data-sparktype-cloudinary-player="true"');
    expect(normalized).toContain('src="https://player.cloudinary.com/embed/?cloud_name=demo-cloud&amp;public_id=videos%2Fdemo&amp;source%5Bsource_types%5D%5B0%5D=mp4"');
    expect(normalized).toContain('padding-top:56.25%');
    expect(normalized).not.toContain('<video');
  });

  test('renders paginated collection pages with pagination context for list layouts', async () => {
    const site = createSiteFixture('collectionSite');

    enableCollectionPagination(site);

    site.contentFiles!.push(
      {
        path: 'content/posts/second-post.md',
        slug: 'posts/second-post',
        frontmatter: {
          title: 'Second Post',
          layout: 'post',
          date: '2025-01-09',
        },
        content: 'Second post body',
      },
      {
        path: 'content/posts/third-post.md',
        slug: 'posts/third-post',
        frontmatter: {
          title: 'Third Post',
          layout: 'post',
          date: '2025-01-08',
        },
        content: 'Third post body',
      },
    );

    site.manifest.collectionItems = [
      ...(site.manifest.collectionItems || []),
      {
        collectionId: 'posts',
        slug: 'second-post',
        path: 'content/posts/second-post.md',
        title: 'Second Post',
        url: '',
      },
      {
        collectionId: 'posts',
        slug: 'third-post',
        path: 'content/posts/third-post.md',
        title: 'Third Post',
        url: '',
      },
    ];

    getLayoutManifestMock.mockImplementation(async (_siteData: LocalSiteData, layoutId: string) => {
      if (layoutId === 'listing') {
        return {
          id: 'listing',
          name: 'Listing',
          layoutType: 'list',
        };
      }

      return {
        id: 'post',
        name: 'Post',
        layoutType: 'item',
        partials: [],
      };
    });
    getThemeAssetContentMock.mockImplementation(async (_siteData: unknown, _themeName: string, assetPath: string) => {
      if (assetPath === 'layouts/listing/index.hbs') {
        return `<main>{{#each collectionItems}}<article>{{frontmatter.title}}</article>{{/each}}{{#if pagination}}<nav data-pagination="{{pagination.currentPage}}/{{pagination.totalPages}}" data-prev="{{pagination.prevPageUrl}}" data-next="{{pagination.nextPageUrl}}"></nav>{{/if}}</main>`;
      }
      if (assetPath === 'listing.hbs') {
        return `{{{body}}}`;
      }
      if (assetPath === 'base.hbs') {
        return `<html><body>{{{body}}}</body></html>`;
      }
      return null;
    });
    assemblePageContextMock.mockImplementation(async (_siteData: LocalSiteData, resolution: PageResolutionResult) => ({
      ...resolution,
      pageTitle: resolution.type === PageType.SinglePage ? resolution.contentFile.frontmatter.title : 'Not Found',
      contentFile: resolution.type === PageType.SinglePage ? resolution.contentFile : undefined,
    }));
    assembleBaseContextMock.mockResolvedValue({});

    const resolution = await resolvePageContent(site, ['posts', 'page', '2']);
    expect(resolution.type).toBe(PageType.SinglePage);

    const html = await render(site, resolution, {
      siteRootPath: '/',
      isExport: false,
    });

    const normalized = compactHtml(html);
    expect(normalized).toContain('<article>Third Post</article>');
    expect(normalized).not.toContain('<article>Launch Day</article>');
    expect(normalized).toContain('data-pagination="2/2"');
    expect(normalized).toContain('data-prev="#/sites/collection-site/view/posts"');
  });

  test('renders iframe-safe pager links for paginated collection previews', async () => {
    const site = createSiteFixture('collectionSite');

    enableCollectionPagination(site);

    site.contentFiles!.push(
      {
        path: 'content/posts/second-post.md',
        slug: 'posts/second-post',
        frontmatter: {
          title: 'Second Post',
          layout: 'post',
          date: '2025-01-09',
        },
        content: 'Second post body',
      },
      {
        path: 'content/posts/third-post.md',
        slug: 'posts/third-post',
        frontmatter: {
          title: 'Third Post',
          layout: 'post',
          date: '2025-01-08',
        },
        content: 'Third post body',
      },
    );

    site.manifest.collectionItems = [
      ...(site.manifest.collectionItems || []),
      {
        collectionId: 'posts',
        slug: 'second-post',
        path: 'content/posts/second-post.md',
        title: 'Second Post',
        url: '',
      },
      {
        collectionId: 'posts',
        slug: 'third-post',
        path: 'content/posts/third-post.md',
        title: 'Third Post',
        url: '',
      },
    ];

    getLayoutManifestMock.mockImplementation(async (_siteData: LocalSiteData, layoutId: string) => {
      if (layoutId === 'listing') {
        return {
          id: 'listing',
          name: 'Listing',
          layoutType: 'list',
        };
      }

      return {
        id: 'post',
        name: 'Post',
        layoutType: 'item',
        partials: [],
      };
    });
    getThemeAssetContentMock.mockImplementation(async (_siteData: unknown, _themeName: string, assetPath: string) => {
      if (assetPath === 'layouts/listing/index.hbs') {
        return `<main>{{#if pagination}}<nav data-prev="{{pagination.prevPageUrl}}" data-next="{{pagination.nextPageUrl}}"></nav>{{/if}}</main>`;
      }
      if (assetPath === 'listing.hbs') {
        return `{{{body}}}`;
      }
      if (assetPath === 'base.hbs') {
        return `<html><body>{{{body}}}</body></html>`;
      }
      return null;
    });
    assemblePageContextMock.mockImplementation(async (_siteData: LocalSiteData, resolution: PageResolutionResult) => ({
      ...resolution,
      pageTitle: resolution.type === PageType.SinglePage ? resolution.contentFile.frontmatter.title : 'Not Found',
      contentFile: resolution.type === PageType.SinglePage ? resolution.contentFile : undefined,
    }));
    assembleBaseContextMock.mockResolvedValue({});

    const resolution = await resolvePageContent(site, ['posts', 'page', '2']);
    expect(resolution.type).toBe(PageType.SinglePage);

    const html = await render(site, resolution, {
      siteRootPath: '/',
      isExport: false,
      forIframe: true,
    });

    const normalized = compactHtml(html);
    expect(normalized).toContain('data-prev="posts"');
    expect(normalized).not.toContain('#/sites/collection-site/view/posts');
  });

  test('renders export-safe pager links for downloaded paginated collection pages', async () => {
    const site = createSiteFixture('collectionSite');

    enableCollectionPagination(site);

    site.contentFiles!.push(
      {
        path: 'content/posts/second-post.md',
        slug: 'posts/second-post',
        frontmatter: {
          title: 'Second Post',
          layout: 'post',
          date: '2025-01-09',
        },
        content: 'Second post body',
      },
      {
        path: 'content/posts/third-post.md',
        slug: 'posts/third-post',
        frontmatter: {
          title: 'Third Post',
          layout: 'post',
          date: '2025-01-08',
        },
        content: 'Third post body',
      },
    );

    site.manifest.collectionItems = [
      ...(site.manifest.collectionItems || []),
      {
        collectionId: 'posts',
        slug: 'second-post',
        path: 'content/posts/second-post.md',
        title: 'Second Post',
        url: '',
      },
      {
        collectionId: 'posts',
        slug: 'third-post',
        path: 'content/posts/third-post.md',
        title: 'Third Post',
        url: '',
      },
    ];

    getLayoutManifestMock.mockImplementation(async (_siteData: LocalSiteData, layoutId: string) => {
      if (layoutId === 'listing') {
        return {
          id: 'listing',
          name: 'Listing',
          layoutType: 'list',
        };
      }

      return {
        id: 'post',
        name: 'Post',
        layoutType: 'item',
        partials: [],
      };
    });
    getThemeAssetContentMock.mockImplementation(async (_siteData: unknown, _themeName: string, assetPath: string) => {
      if (assetPath === 'layouts/listing/index.hbs') {
        return `<main>{{#if pagination}}<nav data-prev="{{pagination.prevPageUrl}}" data-next="{{pagination.nextPageUrl}}"></nav>{{/if}}</main>`;
      }
      if (assetPath === 'listing.hbs') {
        return `{{{body}}}`;
      }
      if (assetPath === 'base.hbs') {
        return `<html><body>{{{body}}}</body></html>`;
      }
      return null;
    });
    assemblePageContextMock.mockImplementation(async (_siteData: LocalSiteData, resolution: PageResolutionResult) => ({
      ...resolution,
      pageTitle: resolution.type === PageType.SinglePage ? resolution.contentFile.frontmatter.title : 'Not Found',
      contentFile: resolution.type === PageType.SinglePage ? resolution.contentFile : undefined,
    }));
    assembleBaseContextMock.mockResolvedValue({});

    const resolution = await resolvePageContent(site, ['posts', 'page', '2']);
    expect(resolution.type).toBe(PageType.SinglePage);

    const html = await render(site, resolution, {
      siteRootPath: '/',
      isExport: true,
      relativeAssetPath: '../../../',
    });

    const normalized = compactHtml(html);
    expect(normalized).toContain('data-prev="../../index.html"');
    expect(normalized).toContain('data-next=""');
  });
});
