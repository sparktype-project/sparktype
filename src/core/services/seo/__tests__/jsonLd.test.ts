import Handlebars from 'handlebars';
import type { ParsedMarkdownFile } from '@/core/types';
import { BUNDLED_THEMES, renderThemeHead } from '@/test/support/themeHead';
import { buildJsonLd, serializeJsonLd } from '../jsonLd';

const post = (frontmatter: Record<string, unknown> = {}): ParsedMarkdownFile => ({
  path: 'content/posts/hello.md',
  slug: 'posts/hello',
  frontmatter: { title: 'Hello', layout: 'post', date: '2025-04-04', ...frontmatter },
  content: '',
});

const home = (): ParsedMarkdownFile => ({
  path: 'content/home.md',
  slug: 'home',
  frontmatter: { title: 'Home', layout: 'page', homepage: true },
  content: '',
});

const manifest = {
  title: 'My Site',
  description: 'About the site',
  collectionItems: [{ collectionId: 'posts', slug: 'hello', path: 'content/posts/hello.md', title: 'Hello', url: '' }],
};

const parse = (json: string | undefined) => JSON.parse(json ?? 'null') as Record<string, unknown>;

describe('buildJsonLd', () => {
  test('describes the homepage as a WebSite', () => {
    const data = parse(buildJsonLd({ file: home(), manifest, origin: 'https://user.github.io/repo', pageUrl: undefined, imageUrl: undefined }));
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'My Site',
      url: 'https://user.github.io/repo/',
      description: 'About the site',
    });
  });

  test('omits the homepage entry without a site address, and on paginated homepage pages', () => {
    expect(buildJsonLd({ file: home(), manifest, origin: null, pageUrl: undefined, imageUrl: undefined })).toBeUndefined();
    expect(buildJsonLd({ file: home(), manifest, origin: 'https://example.org', pageUrl: undefined, imageUrl: undefined, pageNumber: 2 })).toBeUndefined();
  });

  test('describes a dated collection item as a BlogPosting', () => {
    const data = parse(
      buildJsonLd({
        file: post(),
        manifest,
        origin: 'https://example.org',
        pageUrl: 'https://example.org/posts/hello',
        imageUrl: 'https://example.org/_site/a.jpg',
      }),
    );
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Hello',
      datePublished: '2025-04-04',
      image: 'https://example.org/_site/a.jpg',
      url: 'https://example.org/posts/hello',
    });
    expect(data).not.toHaveProperty('author');
  });

  test('adds an author only when the page or the site names one, preferring the page', () => {
    const args = { origin: null, pageUrl: undefined, imageUrl: undefined };
    expect(parse(buildJsonLd({ file: post(), manifest: { ...manifest, author: 'Site Owner' }, ...args })).author).toEqual({
      '@type': 'Person',
      name: 'Site Owner',
    });
    expect(parse(buildJsonLd({ file: post({ author: 'Guest' }), manifest: { ...manifest, author: 'Site Owner' }, ...args })).author).toEqual({
      '@type': 'Person',
      name: 'Guest',
    });
    expect(parse(buildJsonLd({ file: post({ author: '  ' }), manifest, ...args }))).not.toHaveProperty('author');
  });

  test('leaves out url and image it cannot give absolutely', () => {
    const data = parse(buildJsonLd({ file: post(), manifest, origin: null, pageUrl: undefined, imageUrl: undefined }));
    expect(data).not.toHaveProperty('url');
    expect(data).not.toHaveProperty('image');
    expect(data.headline).toBe('Hello');
  });

  test.each([
    ['an undated item', { date: undefined }],
    ['an unparseable date', { date: 'someday' }],
  ])('emits nothing for %s', (_label, frontmatter) => {
    expect(buildJsonLd({ file: post(frontmatter), manifest, origin: 'https://example.org', pageUrl: undefined, imageUrl: undefined })).toBeUndefined();
  });

  test('emits nothing for a plain page or a page that is not a collection item', () => {
    const page: ParsedMarkdownFile = { path: 'content/about.md', slug: 'about', frontmatter: { title: 'About', layout: 'page', date: '2025-01-01' }, content: '' };
    expect(buildJsonLd({ file: page, manifest, origin: 'https://example.org', pageUrl: undefined, imageUrl: undefined })).toBeUndefined();
  });
});

describe('serializeJsonLd injection safety', () => {
  const hostile = '</script><script>alert(1)</script><!-- \u2028 \u2029 "quotes" & ]]>';

  test('escapes < and the line separators yet round-trips through JSON.parse', () => {
    const json = serializeJsonLd({ headline: hostile });
    expect(json).not.toContain('<');
    expect(json).not.toContain('\u2028');
    expect(json).not.toContain('\u2029');
    expect(parse(json).headline).toBe(hostile);
  });

  test('a hostile title cannot break out of the script tag in either theme', () => {
    const jsonLd = buildJsonLd({
      file: post({ title: hostile, author: hostile }),
      manifest: { ...manifest, title: hostile, author: hostile },
      origin: 'https://example.org',
      pageUrl: 'https://example.org/posts/hello',
      imageUrl: undefined,
    });
    expect(parse(jsonLd).headline).toBe(hostile);

    for (const theme of BUNDLED_THEMES) {
      const html = renderThemeHead(theme, { jsonLd: new Handlebars.SafeString(jsonLd ?? '') });
      const scripts = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) ?? [];
      expect(scripts).toHaveLength(1);
      expect(html.match(/<script/g) ?? []).toHaveLength(1);
      const [script = ''] = scripts;
      const body = script.replace(/^<script type="application\/ld\+json">/, '').replace(/<\/script>$/, '');
      expect(parse(body).headline).toBe(hostile);
    }
  });
});

describe.each(BUNDLED_THEMES)('%s head: structured data', (theme) => {
  test('prints no script tag when there is no structured data', () => {
    expect(renderThemeHead(theme, { jsonLd: '' })).not.toContain('ld+json');
  });
});
