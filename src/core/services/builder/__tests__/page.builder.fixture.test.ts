import type { PageResolutionResult } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';

const { renderMock } = vi.hoisted(() => ({
  renderMock: vi.fn(async (_siteData: unknown, resolution: PageResolutionResult) => {
    if (resolution.type === 'not-found') {
      return '<h1>404</h1>';
    }

    return `<html><body>${resolution.contentFile.path}</body></html>`;
  }),
}));

vi.mock('@/core/services/renderer/render.service', () => ({
  render: renderMock,
}));

import { generateHtmlPages } from '../page.builder';

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
});
