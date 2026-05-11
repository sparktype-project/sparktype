import { getRelativePath } from '../relativePaths.service';

describe('relativePaths.service', () => {
  test('returns absolute external targets unchanged', () => {
    expect(
      getRelativePath(
        'blog/post/index.html',
        'https://res.cloudinary.com/dhcgic4ld/image/upload/c_fill,h_600,w_1200/f_auto/q_auto/Untitled_Artwork_3'
      )
    ).toBe(
      'https://res.cloudinary.com/dhcgic4ld/image/upload/c_fill,h_600,w_1200/f_auto/q_auto/Untitled_Artwork_3'
    );
  });

  test('returns protocol-relative and data URL targets unchanged', () => {
    expect(getRelativePath('blog/post/index.html', '//res.cloudinary.com/demo/image/upload/mk')).toBe(
      '//res.cloudinary.com/demo/image/upload/mk'
    );
    expect(getRelativePath('blog/post/index.html', 'data:image/png;base64,abc123')).toBe(
      'data:image/png;base64,abc123'
    );
  });

  test('still calculates relative paths for local targets', () => {
    expect(getRelativePath('blog/post/index.html', '_site/assets/derivatives/hero.jpg')).toBe(
      '../../_site/assets/derivatives/hero.jpg'
    );
  });
});
