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
    const bundle: Record<string, string> = {};

    generateMetadataFiles(bundle, site);

    expect(bundle['rss.xml']).toBeUndefined();
    expect(bundle['sitemap.xml']).toContain('https://example.com');
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
