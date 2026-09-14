// Runs in the default jsdom environment: pins the normal-path behaviour that
// the fail-closed test's node environment cannot exercise.
import { describe, expect, test } from 'vitest';

import { sanitizeHtml, sanitizeMarkdownHtml } from '../sanitize';

describe('sanitiser normal path with a DOM', () => {
  test('sanitizeHtml preserves safe markup and strips inline scripts', () => {
    expect(sanitizeHtml('<p>hello</p>')).toContain('hello');
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).not.toContain('alert');
  });

  test('sanitizeMarkdownHtml preserves safe markup and strips scripts', () => {
    expect(sanitizeMarkdownHtml('<p>hello</p>')).toContain('hello');
    expect(sanitizeMarkdownHtml('<p>hi</p><script>alert(1)</script>')).not.toContain('alert');
  });
});
