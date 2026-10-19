import type { LocalSiteData, ParsedMarkdownFile, StructureNode } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { createPublicSiteSnapshot } from '../publication';
import { generateMetadataFiles } from '../metadata.builder';

/**
 * Parses a generated XML file the way a feed reader or crawler would. A malformed
 * document surfaces as a `parsererror` element rather than a thrown exception.
 */
function parseXml(xml: string): XMLDocument {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function expectWellFormed(xml: string): XMLDocument {
  const doc = parseXml(xml);
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  expect(doc.documentElement.nodeName).not.toBe('parsererror');
  return doc;
}

function firstTagText(doc: XMLDocument, tagName: string): string | null {
  return doc.getElementsByTagName(tagName)[0]?.textContent ?? null;
}

function createDraftItem(path: string): ParsedMarkdownFile {
  return {
    path,
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    frontmatter: {
      title: 'Unpublished Draft',
      layout: 'post',
      published: false,
      date: '2025-06-06',
      description: 'Draft description',
    },
    content: 'Draft body text that must never be published.',
  };
}

function createSpecialCharacterSite(): LocalSiteData {
  const structure: StructureNode[] = [
    {
      type: 'page',
      title: 'Home & Away <Studio>',
      slug: 'home',
      path: 'content/home.md',
      children: [],
    },
    {
      type: 'page',
      title: 'About "us" & co',
      slug: 'about&co',
      path: 'content/about.md',
      children: [
        { type: 'page', title: 'Crème & Café', slug: 'crème & café', path: 'content/about/cafe.md' },
      ],
    },
  ];

  return {
    siteId: 'special-chars-site',
    manifest: {
      siteId: 'special-chars-site',
      generatorVersion: '1.0.0',
      title: 'Rock & Roll <3 "quoted" \'apostrophe\'',
      description: 'Description with & and <angle> brackets',
      baseUrl: 'https://example.com/',
      theme: { name: 'starter', config: {} },
      structure,
      collections: [
        { id: 'posts', name: 'Posts', contentPath: 'content/posts', defaultItemLayout: 'post' },
      ],
      collectionItems: [
        {
          collectionId: 'posts',
          slug: 'link',
          path: 'content/posts/link.md',
          title: 'Link & Load',
          url: '',
        },
      ],
    },
    contentFiles: [
      { path: 'content/home.md', slug: 'home', frontmatter: { title: 'Home & Away <Studio>', layout: 'page', homepage: true }, content: 'Home' },
      { path: 'content/about.md', slug: 'about&co', frontmatter: { title: 'About "us" & co', layout: 'page' }, content: 'About' },
      { path: 'content/about/cafe.md', slug: 'crème & café', frontmatter: { title: 'Crème & Café', layout: 'page' }, content: 'Café' },
      {
        path: 'content/posts/link.md',
        slug: 'posts/link',
        frontmatter: {
          title: 'Link & Load',
          layout: 'post',
          date: '2025-04-04',
          description: 'Body & <tags> "quoted" \'single\'',
        },
        content: 'First paragraph with unicode: 日本語 😀\n\nNested CDATA terminator: ]]> and more text & entities.',
      },
    ],
  };
}

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
    site.manifest.baseUrl = 'https://example.com';
    const bundle: Record<string, string> = {};

    generateMetadataFiles(bundle, site);

    expect(bundle['rss.xml']).toBeUndefined();
    expect(bundle['sitemap.xml']).toContain('https://example.com');
  });

  test.each([undefined, '', 'not a url'])('writes neither sitemap nor rss, nor a placeholder host, for baseUrl %j', (baseUrl) => {
    const site = createSiteFixture('collectionSite');
    site.manifest.baseUrl = baseUrl;

    const bundle: Record<string, string> = {};
    generateMetadataFiles(bundle, site);

    expect(bundle['sitemap.xml']).toBeUndefined();
    expect(bundle['rss.xml']).toBeUndefined();
    expect(JSON.stringify(bundle)).not.toContain('example.com');
  });

  test('keeps the subpath of a project-site base url in every absolute url', () => {
    const site = createSiteFixture('collectionSite');
    site.manifest.baseUrl = 'https://user.github.io/repo/';

    const bundle: Record<string, string> = {};
    generateMetadataFiles(bundle, site);

    const locations = Array.from(expectWellFormed(bundle['sitemap.xml']).getElementsByTagName('loc')).map((n) => n.textContent);
    expect(locations).toEqual(
      expect.arrayContaining([
        'https://user.github.io/repo/',
        'https://user.github.io/repo/posts',
        'https://user.github.io/repo/posts/launch-day',
      ]),
    );
    expect(locations.every((loc) => loc?.startsWith('https://user.github.io/repo/'))).toBe(true);

    const rss = expectWellFormed(bundle['rss.xml']);
    expect(firstTagText(rss, 'link')).toBe('https://user.github.io/repo');
    expect(firstTagText(rss, 'guid')).toBe('https://user.github.io/repo/posts/launch-day');
    expect(rss.getElementsByTagName('atom:link')[0].getAttribute('href')).toBe('https://user.github.io/repo/rss.xml');
  });

  test('produces well-formed rss with escaped entities, unicode and a split CDATA terminator', () => {
    const site = createSpecialCharacterSite();

    const bundle: Record<string, string> = {};
    generateMetadataFiles(bundle, site);

    const doc = expectWellFormed(bundle['rss.xml']);

    // Escaped text must round-trip through a real parser unchanged.
    expect(firstTagText(doc, 'title')).toBe('Rock & Roll <3 "quoted" \'apostrophe\'');
    expect(firstTagText(doc, 'description')).toBe('Description with & and <angle> brackets');

    const items = doc.getElementsByTagName('item');
    expect(items).toHaveLength(1);
    const itemTitle = items[0].getElementsByTagName('title')[0];
    expect(itemTitle.textContent).toBe('Link & Load');

    const encoded = doc.getElementsByTagName('content:encoded')[0]?.textContent ?? '';
    expect(encoded).toContain('日本語 😀');
    expect(encoded).toContain(']]>');
    expect(encoded).toContain('more text & entities.');
    expect(encoded).toContain('Nested CDATA terminator:');
  });

  test('produces a well-formed sitemap when slugs and base urls contain XML characters', () => {
    const site = createSpecialCharacterSite();

    const bundle: Record<string, string> = {};
    generateMetadataFiles(bundle, site);

    const doc = expectWellFormed(bundle['sitemap.xml']);
    const locations = Array.from(doc.getElementsByTagName('loc')).map((node) => node.textContent ?? '');

    expect(locations).toContain('https://example.com/about&co');
    expect(locations).toContain('https://example.com/cr%C3%A8me%20&%20caf%C3%A9');
    expect(locations).toContain('https://example.com/posts/link');
  });

  test.each([
    ['a leading', ']]>leading terminator'],
    ['a trailing', 'trailing terminator]]>'],
    ['several', 'one]]>two]]>three'],
    ['a standalone', ']]>'],
    ['an adjacent pair', ']]>]]>'],
  ])('round-trips %s CDATA terminator in item content', (_case, content) => {
    const site = createSpecialCharacterSite();
    site.contentFiles![3] = { ...site.contentFiles![3], content };

    const bundle: Record<string, string> = {};
    generateMetadataFiles(bundle, site);

    const doc = expectWellFormed(bundle['rss.xml']);
    const encoded = doc.getElementsByTagName('content:encoded')[0]?.textContent ?? '';
    expect(encoded).toBe(content);
  });

  test('omits unpublished pages and items from rss and sitemap', () => {
    const site = createSiteFixture('collectionSite');
    site.manifest.baseUrl = 'https://example.com';
    site.contentFiles!.push(createDraftItem('content/posts/draft-post.md'));
    site.manifest.collectionItems!.push({
      collectionId: 'posts',
      slug: 'draft-post',
      path: 'content/posts/draft-post.md',
      title: 'Unpublished Draft',
      url: '',
    });
    site.manifest.structure.push({
      type: 'page',
      path: 'content/secret.md',
      slug: 'secret',
      title: 'Unpublished Draft',
    });
    site.contentFiles!.push(createDraftItem('content/secret.md'));

    const bundle: Record<string, string> = {};
    generateMetadataFiles(bundle, createPublicSiteSnapshot(site));

    expect(bundle['sitemap.xml']).not.toContain('draft-post');
    expect(bundle['sitemap.xml']).not.toContain('secret');
    expect(bundle['rss.xml']).not.toContain('Unpublished Draft');
    expect(bundle['rss.xml']).not.toContain('Draft body text');
    expect(bundle['rss.xml']).toContain('Launch Day');
  });
});

describe('metadata.builder SEO files', () => {
  function build(site: LocalSiteData): Record<string, string> {
    const bundle: Record<string, string> = {};
    generateMetadataFiles(bundle, createPublicSiteSnapshot(site));
    return bundle;
  }

  function locations(bundle: Record<string, string>): string[] {
    return Array.from(expectWellFormed(bundle['sitemap.xml']).getElementsByTagName('loc')).map((n) => n.textContent ?? '');
  }

  test('excludes noindex pages and noindex collection items from the sitemap', () => {
    const site = createSiteFixture('collectionSite');
    site.manifest.baseUrl = 'https://example.org';
    site.contentFiles!.find((f) => f.path === 'content/posts/launch-day.md')!.frontmatter.noindex = true;

    const urls = locations(build(site));

    expect(urls).toContain('https://example.org/');
    expect(urls).not.toContain('https://example.org/posts/launch-day');
  });

  test('takes lastmod from updated, then date, and omits it when neither exists', () => {
    const site = createSiteFixture('collectionSite');
    site.manifest.baseUrl = 'https://example.org';
    const post = site.contentFiles!.find((f) => f.path === 'content/posts/launch-day.md')!;
    post.frontmatter.date = '2025-01-01';
    post.frontmatter.updated = '2025-03-03';

    const doc = expectWellFormed(build(site)['sitemap.xml']);
    const entry = (loc: string) =>
      Array.from(doc.getElementsByTagName('url')).find((u) => u.getElementsByTagName('loc')[0].textContent === loc)!;

    expect(entry('https://example.org/posts/launch-day').getElementsByTagName('lastmod')[0].textContent).toBe('2025-03-03');
    // The homepage fixture has no date: no lastmod, and certainly not today.
    expect(entry('https://example.org/').getElementsByTagName('lastmod')).toHaveLength(0);
    expect(build(site)['sitemap.xml']).not.toContain(new Date().toISOString().slice(0, 10));
  });

  test('keeps the sitemap well-formed for urls containing &, <, unicode and ]]>', () => {
    const site = createSpecialCharacterSite();
    site.contentFiles!.push({
      path: 'content/odd.md',
      slug: 'a&b<c>]]>日本語',
      frontmatter: { title: 'Odd', layout: 'page' },
      content: '',
    });
    site.manifest.structure.push({ type: 'page', title: 'Odd', slug: 'a&b<c>]]>日本語', path: 'content/odd.md' });

    const bundle = build(site);
    const urls = locations(bundle);

    const odd = urls.find((u) => u.includes('a&b'));
    expect(odd).toBeDefined();
    expect(new URL(odd!).pathname).toContain('%E6%97%A5%E6%9C%AC%E8%AA%9E');
    expect(bundle['sitemap.xml']).not.toContain(']]>');
  });

  test('writes robots.txt with a Sitemap line that keeps the base url subpath', () => {
    const site = createSiteFixture('basicSite');
    site.manifest.baseUrl = 'https://user.github.io/repo/';

    expect(build(site)['robots.txt']).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://user.github.io/repo/sitemap.xml\n',
    );
  });

  test('writes a plain robots.txt without a Sitemap line when there is no baseUrl', () => {
    const site = createSiteFixture('basicSite');
    site.manifest.baseUrl = undefined;

    const bundle = build(site);

    expect(bundle['robots.txt']).toBe('User-agent: *\nAllow: /\n');
    expect(bundle['sitemap.xml']).toBeUndefined();
  });

  test('a discouraging site disallows everything and publishes no sitemap or Sitemap line', () => {
    const site = createSiteFixture('collectionSite');
    site.manifest.baseUrl = 'https://example.org';
    site.manifest.discourageSearchEngines = true;

    const bundle = build(site);

    expect(bundle['robots.txt']).toBe('User-agent: *\nDisallow: /\n');
    expect(bundle['sitemap.xml']).toBeUndefined();
  });
});
