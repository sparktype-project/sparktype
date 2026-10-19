import { absoluteSiteUrl, getSiteOrigin } from '../siteOrigin.service';

describe('getSiteOrigin', () => {
  test.each([
    [undefined, null],
    ['', null],
    ['   ', null],
    ['not a url', null],
    ['ftp://example.org', null],
    ['javascript:alert(1)', null],
    ['https://example.org', 'https://example.org'],
    ['https://example.org/', 'https://example.org'],
    ['  https://example.org/  ', 'https://example.org'],
    ['https://user.github.io/repo/', 'https://user.github.io/repo'],
    ['https://user.github.io/repo?x=1#top', 'https://user.github.io/repo'],
    ['http://localhost:8080', 'http://localhost:8080'],
  ])('%j -> %j', (baseUrl, expected) => {
    expect(getSiteOrigin({ baseUrl })).toBe(expected);
  });
});

describe('absoluteSiteUrl', () => {
  test('joins root-level paths', () => {
    expect(absoluteSiteUrl('https://example.org', 'about')).toBe('https://example.org/about');
    expect(absoluteSiteUrl('https://example.org', '')).toBe('https://example.org/');
  });

  test('keeps the subpath of a project-site host', () => {
    expect(absoluteSiteUrl('https://user.github.io/repo', 'about')).toBe('https://user.github.io/repo/about');
    expect(absoluteSiteUrl('https://user.github.io/repo', '/posts/a')).toBe('https://user.github.io/repo/posts/a');
    expect(absoluteSiteUrl('https://user.github.io/repo', '')).toBe('https://user.github.io/repo/');
  });
});
