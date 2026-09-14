// @vitest-environment node
// Fail-closed sanitiser test: without a DOM there is no DOMPurify, so both
// entry points must throw instead of returning the input unsanitised.
import { describe, expect, test } from 'vitest';

import { sanitizeHtml, sanitizeMarkdownHtml } from '../sanitize';

describe('sanitiser fail-closed without a DOM', () => {
  test('sanitizeHtml throws instead of returning unsanitised HTML', () => {
    expect(() => sanitizeHtml('<p>hello</p><script>alert(1)</script>')).toThrow(
      /requires a DOM environment/,
    );
  });

  test('sanitizeMarkdownHtml throws instead of returning unsanitised HTML', () => {
    expect(() => sanitizeMarkdownHtml('<p>hello</p><script>alert(1)</script>')).toThrow(
      /requires a DOM environment/,
    );
  });
});
