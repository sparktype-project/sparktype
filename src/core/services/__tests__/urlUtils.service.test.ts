import type { CollectionItemRef, StructureNode } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { addPagination, generateExportUrl, generatePreviewUrl, getUrlForNode } from '../urlUtils.service';

describe('urlUtils.service', () => {
  test('treats the homepage as the root path when site content marks it explicitly', () => {
    const site = createSiteFixture('basicSite', { siteId: 'url-site' });
    const homeNode = site.manifest.structure[0];

    expect(generatePreviewUrl(homeNode, site.manifest, site.siteId, undefined, site)).toBe('#/sites/url-site/view');
    expect(generateExportUrl(homeNode, site.manifest, undefined, site)).toBe('');
    expect(generateExportUrl(homeNode, site.manifest, undefined, site, undefined, true)).toBe('index.html');
  });

  test('generates nested preview and export URLs for regular pages', () => {
    const site = createSiteFixture('nestedPagesSite', { siteId: 'nested-url-site' });
    const teamNode = site.manifest.structure[1].children?.[0] as StructureNode;

    expect(generatePreviewUrl(teamNode, site.manifest, site.siteId, undefined, site)).toBe('#/sites/nested-url-site/view/about/team');
    expect(generateExportUrl(teamNode, site.manifest, undefined, site)).toBe('about/team');
    expect(generateExportUrl(teamNode, site.manifest, undefined, site, undefined, true)).toBe('about/team/index.html');
  });

  test('uses collection ids and item slugs for collection item URLs', () => {
    const site = createSiteFixture('collectionSite');
    const item = site.manifest.collectionItems?.[0] as CollectionItemRef;

    expect(generatePreviewUrl(item, site.manifest, site.siteId, undefined, site)).toBe(`#/sites/${site.siteId}/view/posts/launch-day`);
    expect(generateExportUrl(item, site.manifest, undefined, site)).toBe('posts/launch-day');
    expect(getUrlForNode(item, site.manifest, false, undefined, site)).toBe('posts/launch-day');
  });

  test('adds pagination for homepage and regular pages', () => {
    expect(addPagination('', 2, false)).toBe('page/2');
    expect(addPagination('', 3, true)).toBe('page/3/index.html');
    expect(addPagination('blog', 2, false)).toBe('blog/page/2');
    expect(addPagination('blog', 4, true)).toBe('blog/page/4/index.html');
  });

  test('returns iframe-safe export paths without a leading slash', () => {
    const site = createSiteFixture('nestedPagesSite');
    const aboutNode = site.manifest.structure[1];

    expect(generateExportUrl(aboutNode, site.manifest, undefined, site, 'about/team', false, true)).toBe('about');
  });
});
