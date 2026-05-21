import type { LayoutConfig, PageResolutionResult } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';

const { renderMock } = vi.hoisted(() => ({
  renderMock: vi.fn(async (_siteData: unknown, resolution: PageResolutionResult) => {
    if (!('contentFile' in resolution)) {
      return '<h1>404</h1>';
    }

    return `<html><body>${resolution.contentFile.path}</body></html>`;
  }),
}));

vi.mock('@/core/services/renderer/render.service', () => ({
  render: renderMock,
}));

import { generateHtmlPages } from '../page.builder';

function enableCollectionPagination() {
  const site = createSiteFixture('collectionSite');
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
          itemsPerPage: 2,
        },
      },
    },
  };

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

  return site;
}

describe('page.builder fixture coverage', () => {
  beforeEach(() => {
    renderMock.mockClear();
  });

  test('builds a basic site homepage at index.html', async () => {
    const site = createSiteFixture('basicSite');

    const pages = await generateHtmlPages(site);

    expect(Object.keys(pages)).toEqual(['index.html']);
    expect(pages['index.html']).toContain('content/home.md');
  });

  test('builds nested pages with stable export paths', async () => {
    const site = createSiteFixture('nestedPagesSite');

    const pages = await generateHtmlPages(site);

    expect(Object.keys(pages).sort()).toEqual([
      'about/index.html',
      'about/team/index.html',
      'index.html',
    ]);
    expect(renderMock).toHaveBeenCalledTimes(3);
  });

  test('builds collection listing pages and collection item pages', async () => {
    const site = createSiteFixture('collectionSite');

    const pages = await generateHtmlPages(site);

    expect(Object.keys(pages).sort()).toEqual([
      'index.html',
      'posts/index.html',
      'posts/launch-day/index.html',
    ]);
    expect(pages['posts/launch-day/index.html']).toContain('content/posts/launch-day.md');
  });

  test('builds paginated collection listing pages when pagination is enabled', async () => {
    const site = enableCollectionPagination();

    const pages = await generateHtmlPages(site);

    expect(Object.keys(pages).sort()).toEqual([
      'index.html',
      'posts/index.html',
      'posts/launch-day/index.html',
      'posts/page/2/index.html',
      'posts/second-post/index.html',
      'posts/third-post/index.html',
    ]);
    expect(renderMock).toHaveBeenCalledWith(
      site,
      expect.objectContaining({
        contentFile: expect.objectContaining({ path: 'content/posts.md' }),
        pageNumber: 2,
      }),
      expect.anything(),
    );
  });
});
