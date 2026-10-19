import { getCanonicalOverride, getLastModified, isIndexable, isNoindex, shouldNoindex, toSitemapDate, validateCanonicalUrl } from '../pageSeo';

describe('validateCanonicalUrl', () => {
  test.each([undefined, null, '', '   ', 'https://example.org/a', 'http://example.org', ' https://example.org/a?b=1#c '])(
    'accepts %j',
    (value) => expect(validateCanonicalUrl(value)).toBeNull(),
  );

  test.each(['/relative', 'example.org/page', 'javascript:alert(1)', 'ftp://example.org', 'mailto:a@b.co', 'https://', 42])(
    'rejects %j',
    (value) => expect(validateCanonicalUrl(value)).toEqual(expect.any(String)),
  );
});

describe('getCanonicalOverride', () => {
  test('returns the normalised absolute URL', () => {
    expect(getCanonicalOverride({ canonical: ' https://example.org/a b ' })).toBe('https://example.org/a%20b');
  });

  test('ignores blank and invalid values', () => {
    expect(getCanonicalOverride({})).toBeUndefined();
    expect(getCanonicalOverride({ canonical: '' })).toBeUndefined();
    expect(getCanonicalOverride({ canonical: 'javascript:alert(1)' })).toBeUndefined();
  });
});

describe('isNoindex', () => {
  test('is true only for the boolean true', () => {
    expect(isNoindex({ noindex: true })).toBe(true);
    expect(isNoindex({ noindex: false })).toBe(false);
    expect(isNoindex({ noindex: 'true' })).toBe(false);
    expect(isNoindex({})).toBe(false);
  });
});

describe('sitemap dates', () => {
  test.each([
    ['2025-04-04', '2025-04-04'],
    ['2025-04-04T23:59:00Z', '2025-04-04'],
    [new Date('2025-04-04T00:00:00Z'), '2025-04-04'],
    ['April 4, 2025 12:00 UTC', '2025-04-04'],
    ['', undefined],
    ['soon', undefined],
    [new Date('nope'), undefined],
    [20250404, undefined],
    [undefined, undefined],
  ])('toSitemapDate(%j) -> %j', (value, expected) => {
    expect(toSitemapDate(value)).toBe(expected);
  });

  test('getLastModified prefers updated, falls back to date, and never invents one', () => {
    expect(getLastModified({ date: '2025-01-01', updated: '2025-02-02' })).toBe('2025-02-02');
    expect(getLastModified({ date: '2025-01-01' })).toBe('2025-01-01');
    expect(getLastModified({ date: '2025-01-01', updated: 'garbage' })).toBe('2025-01-01');
    expect(getLastModified({ title: 'No dates' })).toBeUndefined();
  });
});

describe('indexability', () => {
  const page = (frontmatter: Record<string, unknown> = {}, slug = 'about') => ({ slug, frontmatter });

  test('noindex, a discouraging site or the 404 page makes a page non-indexable', () => {
    expect(isIndexable(page(), {})).toBe(true);
    expect(isIndexable(page({ noindex: true }), {})).toBe(false);
    expect(isIndexable(page(), { discourageSearchEngines: true })).toBe(false);
    expect(isIndexable(page({}, '404'), {})).toBe(false);
    expect(shouldNoindex(page(), { discourageSearchEngines: true })).toBe(true);
    expect(shouldNoindex(page(), { discourageSearchEngines: false })).toBe(false);
  });
});
