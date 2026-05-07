import { describe, expect, test } from 'vitest';
import { convertPastedHtmlToMarkdown, looksLikeMarkdown } from '../paste';

describe('TipTap paste markdown helpers', () => {
  test('detects common markdown patterns', () => {
    expect(looksLikeMarkdown('# Heading')).toBe(true);
    expect(looksLikeMarkdown('- item')).toBe(true);
    expect(looksLikeMarkdown('~~Removed~~')).toBe(true);
    expect(looksLikeMarkdown('Normal sentence')).toBe(false);
  });

  test('converts basic html formatting into markdown', () => {
    const html = '<h2>Title</h2><p>Hello <strong>world</strong> and <em>friends</em> with <a href="https://example.com">link</a>.</p>';

    expect(convertPastedHtmlToMarkdown(html)).toBe(
      '## Title\n\nHello **world** and *friends* with [link](https://example.com).',
    );
  });

  test('converts lists, blockquotes, inline code, and images', () => {
    const html = `
      <blockquote><p>Quoted line</p></blockquote>
      <ul><li>One</li><li>Two</li></ul>
      <p>Use <code>npm test</code></p>
      <p><img src="assets/images/hero.jpg" alt="Hero"></p>
    `;

    expect(convertPastedHtmlToMarkdown(html)).toBe(
      '> Quoted line\n\n- One\n- Two\n\nUse `npm test`\n\n![Hero](assets/images/hero.jpg)',
    );
  });

  test('strips unsupported wrappers and keeps basic markdown marks', () => {
    const html = `
      <div>
        <span>Hello <strong>world</strong></span>
        <span>and <del>goodbye</del></span>
      </div>
    `;

    expect(convertPastedHtmlToMarkdown(html)).toBe('Hello **world** and ~~goodbye~~');
  });
});
