import type { LocalSiteData, Manifest, ParsedMarkdownFile } from '@/core/types';
import { BUNDLED_THEMES, renderThemeHead } from '@/test/support/themeHead';

const { getProcessedImageUrl } = vi.hoisted(() => ({ getProcessedImageUrl: vi.fn() }));
vi.mock('@/core/services/images/imagePreprocessor.service', () => ({
  imagePreprocessor: { getProcessedImageUrl },
}));

import { resolveCanonicalUrl, resolveNoindex, resolveSocialImage } from '../headMeta';

const site = { siteId: 's1' } as LocalSiteData;
const file = {
  path: 'content/post.md',
  slug: 'post',
  frontmatter: { title: 'Post', featured_image: { serviceId: 'local', src: 'assets/images/a.jpg' } },
  content: '',
} as unknown as ParsedMarkdownFile;

describe('resolveSocialImage', () => {
  beforeEach(() => getProcessedImageUrl.mockReset());

  test('is absolute against the site origin, keeping a subpath', () => {
    getProcessedImageUrl.mockReturnValue('_site/assets/a_w1200.jpg');
    expect(resolveSocialImage(site, file, 'https://user.github.io/repo', true)).toEqual({
      url: 'https://user.github.io/repo/_site/assets/a_w1200.jpg',
    });
  });

  test('passes an already-absolute remote image through', () => {
    getProcessedImageUrl.mockReturnValue('https://res.cloudinary.com/x/a.jpg');
    expect(resolveSocialImage(site, file, 'https://example.org', true)?.url).toBe('https://res.cloudinary.com/x/a.jpg');
  });

  test('is omitted without a site origin', () => {
    getProcessedImageUrl.mockReturnValue('_site/assets/a.jpg');
    expect(resolveSocialImage(site, file, null, true)).toBeUndefined();
  });
});

describe.each(BUNDLED_THEMES)('%s head: site address', (theme) => {
  test('emits canonical, og:url and absolute og:image when the site has an origin', () => {
    const html = renderThemeHead(theme, {
      canonicalUrl: 'https://user.github.io/repo/about',
      socialImage: { url: 'https://user.github.io/repo/_site/a.jpg' },
      hasFeed: true,
    });
    expect(html).toContain('<link rel="canonical" href="https://user.github.io/repo/about">');
    expect(html).toContain('<meta property="og:url" content="https://user.github.io/repo/about">');
    expect(html).toContain('<meta property="og:image" content="https://user.github.io/repo/_site/a.jpg">');
    expect(html).toContain('rss.xml');
  });

  test('omits canonical, og:url, og:image and the feed link without one', () => {
    const html = renderThemeHead(theme, { hasFeed: false });
    expect(html).not.toContain('canonical');
    expect(html).not.toContain('og:url');
    expect(html).not.toContain('og:image');
    expect(html).not.toContain('example.com');
    expect(html).not.toContain('rss.xml');
  });
});

describe('resolveCanonicalUrl', () => {
  const page = (frontmatter: Record<string, unknown>) =>
    ({ path: 'content/a.md', slug: 'a', frontmatter: { title: 'A', ...frontmatter }, content: '' }) as unknown as ParsedMarkdownFile;

  test('builds the address under the origin, keeping a subpath', () => {
    expect(resolveCanonicalUrl(page({}), 'https://user.github.io/repo', 'about')).toBe('https://user.github.io/repo/about');
  });

  test('is undefined with no origin and no override', () => {
    expect(resolveCanonicalUrl(page({}), null, 'about')).toBeUndefined();
  });

  test('a valid override wins, with or without an origin', () => {
    const file = page({ canonical: 'https://other.example/original' });
    expect(resolveCanonicalUrl(file, 'https://example.org', 'about')).toBe('https://other.example/original');
    expect(resolveCanonicalUrl(file, null, 'about')).toBe('https://other.example/original');
  });

  test('an invalid override is ignored', () => {
    expect(resolveCanonicalUrl(page({ canonical: 'javascript:alert(1)' }), 'https://example.org', 'about')).toBe(
      'https://example.org/about',
    );
  });

  test('a paginated page keeps its own address instead of the override', () => {
    const file = page({ canonical: 'https://other.example/original' });
    expect(resolveCanonicalUrl(file, 'https://example.org', 'posts/page/2', 2)).toBe('https://example.org/posts/page/2');
  });
});

describe.each(BUNDLED_THEMES)('%s head: page SEO', (theme) => {
  test('noindex adds a robots meta tag; otherwise none', () => {
    expect(renderThemeHead(theme, { noindex: true })).toContain('<meta name="robots" content="noindex">');
    expect(renderThemeHead(theme, { noindex: false })).not.toContain('robots');
  });

  test('a canonical override is emitted as the canonical link and og:url', () => {
    const html = renderThemeHead(theme, { canonicalUrl: 'https://other.example/original' });
    expect(html).toContain('<link rel="canonical" href="https://other.example/original">');
    expect(html).toContain('<meta property="og:url" content="https://other.example/original">');
  });
});

describe('resolveNoindex', () => {
  const page = (frontmatter: Record<string, unknown>) =>
    ({ path: 'content/a.md', slug: 'a', frontmatter: { title: 'A', ...frontmatter }, content: '' }) as unknown as ParsedMarkdownFile;

  test('is true for a noindex page or any page of a discouraging site', () => {
    expect(resolveNoindex(page({ noindex: true }), {} as Manifest)).toBe(true);
    expect(resolveNoindex(page({}), { discourageSearchEngines: true } as Manifest)).toBe(true);
    expect(resolveNoindex(page({}), {} as Manifest)).toBe(false);
  });
});
