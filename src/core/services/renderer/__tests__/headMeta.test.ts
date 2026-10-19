import type { LocalSiteData, Manifest, ParsedMarkdownFile } from '@/core/types';
import { BUNDLED_THEMES, renderThemeHead } from '@/test/support/themeHead';

const { getProcessedImageUrl } = vi.hoisted(() => ({ getProcessedImageUrl: vi.fn() }));
vi.mock('@/core/services/images/imagePreprocessor.service', () => ({
  imagePreprocessor: { getProcessedImageUrl },
}));

import {
  resolveCanonicalUrl,
  resolveNoindex,
  resolveOgType,
  resolveSocialImage,
  resolveTwitterCard,
} from '../headMeta';

const logo = { serviceId: 'local', src: 'assets/images/logo.png', width: 256, height: 256 };
const site = { siteId: 's1', manifest: { logo } } as unknown as LocalSiteData;
const siteWithoutLogo = { siteId: 's1', manifest: {} } as unknown as LocalSiteData;
const file = (frontmatter: Record<string, unknown> = {}) =>
  ({
    path: 'content/post.md',
    slug: 'post',
    frontmatter: {
      title: 'Post',
      featured_image: { serviceId: 'local', src: 'assets/images/a.jpg', width: 1600, height: 900 },
      ...frontmatter,
    },
    content: '',
  }) as unknown as ParsedMarkdownFile;

/** Processed URLs by `contentPath:field`, as the preprocessor would hold them. */
function processed(urls: Record<string, string>) {
  getProcessedImageUrl.mockImplementation(
    (_site: string, path: string, field: string) => urls[`${path}:${field}`] ?? null,
  );
}

describe('resolveSocialImage', () => {
  beforeEach(() => getProcessedImageUrl.mockReset());

  test('is absolute against the site origin, keeping a subpath, with the real dimensions', () => {
    processed({ 'content/post.md:featured_image': '_site/assets/a.jpg' });
    expect(resolveSocialImage(site, file(), 'https://user.github.io/repo', true)).toEqual({
      url: 'https://user.github.io/repo/_site/assets/a.jpg',
      width: 1600,
      height: 900,
      isFallback: false,
    });
  });

  test('omits dimensions it does not know instead of inventing 1200x630', () => {
    processed({ 'content/post.md:featured_image': '_site/assets/a.jpg' });
    const noSize = file({ featured_image: { serviceId: 'local', src: 'assets/images/a.jpg' } });
    const result = resolveSocialImage(site, noSize, 'https://example.org', true);
    expect(result).toEqual({ url: 'https://example.org/_site/assets/a.jpg', isFallback: false });
  });

  test('passes an already-absolute remote image through', () => {
    processed({ 'content/post.md:featured_image': 'https://res.cloudinary.com/x/a.jpg' });
    expect(resolveSocialImage(site, file(), 'https://example.org', true)?.url).toBe('https://res.cloudinary.com/x/a.jpg');
  });

  test('is emitted in preview too, using whatever URL the editor can load', () => {
    processed({ 'content/post.md:featured_image': 'blob:http://localhost/abc' });
    expect(resolveSocialImage(site, file(), null, false)).toMatchObject({ url: 'blob:http://localhost/abc', isFallback: false });
  });

  test('falls back to the site logo when the page has no featured image', () => {
    processed({ '_manifest:logo': '_site/assets/logo.png' });
    const noImage = file({ featured_image: undefined });
    expect(resolveSocialImage(site, noImage, 'https://example.org', true)).toEqual({
      url: 'https://example.org/_site/assets/logo.png',
      width: 256,
      height: 256,
      isFallback: true,
    });
  });

  test('is undefined when there is neither a featured image nor a logo', () => {
    processed({});
    expect(resolveSocialImage(siteWithoutLogo, file({ featured_image: undefined }), 'https://example.org', true)).toBeUndefined();
  });

  test('is omitted in an export without a site origin', () => {
    processed({ 'content/post.md:featured_image': '_site/assets/a.jpg', '_manifest:logo': '_site/assets/logo.png' });
    expect(resolveSocialImage(site, file(), null, true)).toBeUndefined();
  });
});

describe('resolveOgType', () => {
  const manifest = { collectionItems: [{ path: 'content/post.md' }] } as unknown as Manifest;

  test('is article only for a dated collection item', () => {
    expect(resolveOgType(file({ date: '2025-01-01' }), manifest)).toBe('article');
    expect(resolveOgType(file(), manifest)).toBe('website');
    expect(resolveOgType(file({ date: '2025-01-01' }), {} as Manifest)).toBe('website');
  });
});

describe('resolveTwitterCard', () => {
  test('is large only for a real featured image', () => {
    expect(resolveTwitterCard({ url: 'u', isFallback: false })).toBe('summary_large_image');
    expect(resolveTwitterCard({ url: 'u', isFallback: true })).toBe('summary');
    expect(resolveTwitterCard(undefined)).toBe('summary');
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

describe.each(BUNDLED_THEMES)('%s head: social tags', (theme) => {
  test('prints the resolved image with its real dimensions and a large card', () => {
    const html = renderThemeHead(theme, {
      ogType: 'article',
      twitterCard: 'summary_large_image',
      socialImage: { url: 'https://example.org/a.jpg', width: 1600, height: 900, isFallback: false },
    });
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta property="og:image" content="https://example.org/a.jpg">');
    expect(html).toContain('<meta property="og:image:width" content="1600">');
    expect(html).toContain('<meta property="og:image:height" content="900">');
    expect(html).toContain('<meta name="twitter:image" content="https://example.org/a.jpg">');
    expect(html).not.toContain('1200');
    expect(html).not.toContain('630');
  });

  test('omits dimension tags when the size is unknown', () => {
    const html = renderThemeHead(theme, {
      ogType: 'website',
      twitterCard: 'summary',
      socialImage: { url: 'https://example.org/logo.png', isFallback: true },
    });
    expect(html).toContain('og:image"');
    expect(html).not.toContain('og:image:width');
  });

  test('emits the image in preview as well as export', () => {
    const html = renderThemeHead(
      theme,
      { ogType: 'website', twitterCard: 'summary', socialImage: { url: 'blob:http://localhost/x', isFallback: false } },
      { isExport: false },
    );
    expect(html).toContain('<meta property="og:image" content="blob:http://localhost/x">');
  });

  test('a page with no image gets a summary card and no image tags', () => {
    const html = renderThemeHead(theme, { ogType: 'website', twitterCard: 'summary' });
    expect(html).toContain('<meta name="twitter:card" content="summary">');
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).not.toContain('og:image');
    expect(html).not.toContain('twitter:image');
  });
});
