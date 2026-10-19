import {
  getRedirectFromValues,
  isReservedOutput,
  normalizeRedirectPath,
  planRedirects,
  redirectOutputPath,
  type RedirectPage,
} from '../redirects';

describe('normalizeRedirectPath', () => {
  test.each([
    ['/old-post', '/old-post'],
    ['old-post', '/old-post'],
    ['/old/nested/post/', '/old/nested/post'],
    ['/old//post//', '/old/post'],
    ['/old/post/index.html', '/old/post'],
    ['/old.html', '/old.html'],
    ['/old?utm=1#top', '/old'],
    ['/café menu', '/caf%C3%A9%20menu'],
    ['/caf%C3%A9%20menu', '/caf%C3%A9%20menu'],
    ['  /spaced  ', '/spaced'],
  ])('%j -> %j', (raw, expected) => expect(normalizeRedirectPath(raw)).toBe(expected));

  test.each(['', '   ', '/', '/index.html', 'https://example.org/x', '//cdn.example/x', '/a/../b', '/a/./b', '/wild/*', 'javascript:x', '/%E0%A4%A'])(
    'rejects %j',
    (raw) => expect(normalizeRedirectPath(raw)).toBeNull(),
  );
});

describe('redirectOutputPath', () => {
  test('writes directory indexes for pretty paths and the named file for file-like paths', () => {
    expect(redirectOutputPath('/old')).toBe('old/index.html');
    expect(redirectOutputPath('/blog/2020/old-post')).toBe('blog/2020/old-post/index.html');
    expect(redirectOutputPath('/old.html')).toBe('old.html');
    expect(redirectOutputPath('/feeds/atom.xml')).toBe('feeds/atom.xml');
  });
});

describe('getRedirectFromValues', () => {
  test('accepts a list or a single string and drops blanks and non-text', () => {
    expect(getRedirectFromValues({ redirect_from: ['/a', ' ', 3, '/b'] })).toEqual(['/a', '/b']);
    expect(getRedirectFromValues({ redirect_from: '/a' })).toEqual(['/a']);
    expect(getRedirectFromValues({})).toEqual([]);
    expect(getRedirectFromValues({ redirect_from: { a: 1 } })).toEqual([]);
  });
});

describe('isReservedOutput', () => {
  test('covers generated files and the _site tree', () => {
    for (const path of ['404.html', 'robots.txt', 'sitemap.xml', 'rss.xml', '_redirects', '_site/data/media.json']) {
      expect(isReservedOutput(path)).toBe(true);
    }
    expect(isReservedOutput('about/index.html')).toBe(false);
  });
});

describe('planRedirects', () => {
  const page = (path: string, url: string, redirect_from?: unknown): RedirectPage => ({
    path,
    url,
    outputPath: url === '' ? 'index.html' : `${url}/index.html`,
    frontmatter: { title: path, ...(redirect_from === undefined ? {} : { redirect_from }) },
  });

  test('plans nested old paths to the page they are declared on', () => {
    const plan = planRedirects([page('content/new.md', 'blog/new-post', ['/old/deeply/nested', '/legacy.html'])]);
    expect(plan.skipped).toEqual([]);
    expect(plan.redirects).toEqual([
      { from: '/old/deeply/nested', to: 'blog/new-post', sourcePath: 'content/new.md', outputPath: 'old/deeply/nested/index.html' },
      { from: '/legacy.html', to: 'blog/new-post', sourcePath: 'content/new.md', outputPath: 'legacy.html' },
    ]);
  });

  test('a real page always beats a redirect that shadows it, wherever it appears', () => {
    const plan = planRedirects([
      page('content/a.md', 'a', ['/b', '/b/index.html']),
      page('content/b.md', 'b'),
    ]);
    expect(plan.redirects).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(['shadows-output', 'shadows-output']);
  });

  test('refuses to shadow generated files', () => {
    const plan = planRedirects([page('content/a.md', 'a', ['/robots.txt', '/404.html', '/_site/x.css'])]);
    expect(plan.redirects).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(['shadows-output', 'shadows-output', 'shadows-output']);
  });

  test('a redirect to its own page is a loop and is skipped', () => {
    const plan = planRedirects([page('content/a.md', 'about', ['/about', '/about/', '/about/index.html'])]);
    expect(plan.redirects).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(['self', 'self', 'self']);
  });

  test('two redirects cannot form a chain: every target is a real page, so a hop through one shadows it', () => {
    const plan = planRedirects([page('content/a.md', 'a', ['/b']), page('content/b.md', 'b', ['/a'])]);
    expect(plan.redirects).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(['shadows-output', 'shadows-output']);
  });

  test('the first page keeps a path two pages claim', () => {
    const plan = planRedirects([page('content/a.md', 'a', ['/old']), page('content/b.md', 'b', ['/old/'])]);
    expect(plan.redirects.map((r) => [r.from, r.to])).toEqual([['/old', 'a']]);
    expect(plan.skipped).toEqual([{ sourcePath: 'content/b.md', value: '/old/', reason: 'duplicate' }]);
  });

  test('reports invalid values', () => {
    const plan = planRedirects([page('content/a.md', 'a', ['https://x.example/y', '/ok'])]);
    expect(plan.redirects.map((r) => r.from)).toEqual(['/ok']);
    expect(plan.skipped).toEqual([{ sourcePath: 'content/a.md', value: 'https://x.example/y', reason: 'invalid' }]);
  });
});
