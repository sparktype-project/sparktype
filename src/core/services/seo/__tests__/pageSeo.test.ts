import { getCanonicalOverride, isNoindex, validateCanonicalUrl } from '../pageSeo';

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
