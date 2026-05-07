import { describe, expect, test } from 'vitest';
import { inferImageRefFromSource, isAbsoluteOrSpecialUrl, parseImageRef } from '../helpers';

describe('TipTap image helpers', () => {
  test('parses local asset paths as local image refs', () => {
    expect(parseImageRef('assets/images/hero.jpg', 'Hero')).toEqual({
      serviceId: 'local',
      src: 'assets/images/hero.jpg',
      alt: 'Hero',
    });
  });

  test('infers provider-backed refs for non-local markdown image sources', () => {
    expect(inferImageRefFromSource('bcc-wf', 'Uploaded image', 'cloudinary')).toEqual({
      serviceId: 'cloudinary',
      src: 'bcc-wf',
      alt: 'Uploaded image',
    });
  });

  test('does not infer provider refs for absolute urls', () => {
    expect(isAbsoluteOrSpecialUrl('https://example.com/image.jpg')).toBe(true);
    expect(inferImageRefFromSource('https://example.com/image.jpg', 'Remote', 'cloudinary')).toBeNull();
  });
});
