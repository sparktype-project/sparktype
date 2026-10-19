import { makeRootAbsolute } from '../rootAbsoluteUrls';

function render(body: string, pagePath = '/404/'): Document {
  const out = makeRootAbsolute(`<!DOCTYPE html><html><head>${body}</head><body></body></html>`, pagePath);
  return new DOMParser().parseFromString(out, 'text/html');
}

describe('makeRootAbsolute', () => {
  test('resolves relative URLs against the page location at the site root', () => {
    const doc = render(
      '<link rel="stylesheet" href="../_site/themes/x/styles.css"><script src="../_site/app.js"></script>' +
        '<a href="../about/index.html">About</a><a href="../">Home</a>',
    );
    expect(doc.querySelector('link')?.getAttribute('href')).toBe('/_site/themes/x/styles.css');
    expect(doc.querySelector('script')?.getAttribute('src')).toBe('/_site/app.js');
    expect(Array.from(doc.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual(['/about/index.html', '/']);
  });

  test('keeps the hosting subpath', () => {
    const doc = render('<link rel="stylesheet" href="../_site/s.css"><a href="../">Home</a>', '/repo/404/');
    expect(doc.querySelector('link')?.getAttribute('href')).toBe('/repo/_site/s.css');
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('/repo/');
  });

  test('leaves absolute, root-absolute, protocol-relative, fragment and special-scheme URLs alone', () => {
    const urls = [
      'https://example.org/x',
      '/already/absolute',
      '//cdn.example/x.js',
      '#top',
      'mailto:a@b.co',
      'tel:123',
      'data:text/plain,hi',
    ];
    const doc = render(urls.map((u) => `<a href="${u}">x</a>`).join(''));
    expect(Array.from(doc.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual(urls);
  });

  test('rewrites image sources and srcset candidates, keeping descriptors, queries and fragments', () => {
    const doc = render(
      '<img src="../_site/a.jpg" srcset="../_site/a-1x.jpg 1x, ../_site/a-2x.jpg 2x"><a href="../p/?q=1#h">p</a>',
      '/repo/404/',
    );
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('/repo/_site/a.jpg');
    expect(doc.querySelector('img')?.getAttribute('srcset')).toBe('/repo/_site/a-1x.jpg 1x, /repo/_site/a-2x.jpg 2x');
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('/repo/p/?q=1#h');
  });

  test('keeps the doctype and does not touch URLs inside inline scripts', () => {
    const out = makeRootAbsolute(
      '<!DOCTYPE html><html><head><script>const s = \'<a href="../x">\';</script></head><body></body></html>',
      '/404/',
    );
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(out).toContain('<a href="../x">');
  });
});
