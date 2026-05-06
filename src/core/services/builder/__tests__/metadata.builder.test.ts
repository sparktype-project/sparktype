import { createSiteFixture } from '@/test/support/siteFixtures';
import { generateMetadataFiles } from '../metadata.builder';

describe('metadata.builder', () => {
  test('generates a sitemap for pages and collection items plus rss for dated collection items', () => {
    const site = createSiteFixture('collectionSite');
    site.manifest.baseUrl = 'https://example.com';

    const bundle: Record<string, string> = {};
    generateMetadataFiles(bundle, site);

    expect(bundle['sitemap.xml']).toContain('https://example.com/');
    expect(bundle['sitemap.xml']).toContain('https://example.com/posts');
    expect(bundle['sitemap.xml']).toContain('https://example.com/posts/launch-day');
    expect(bundle['rss.xml']).toContain('<title>Launch Day</title>');
    expect(bundle['rss.xml']).toContain('Collection item body');
    expect(bundle['rss.xml']).not.toContain('<title>Home</title>');
  });

  test('skips rss generation when there are no dated collection items', () => {
    const site = createSiteFixture('basicSite');
    const bundle: Record<string, string> = {};

    generateMetadataFiles(bundle, site);

    expect(bundle['rss.xml']).toBeUndefined();
    expect(bundle['sitemap.xml']).toContain('https://example.com');
  });
});
