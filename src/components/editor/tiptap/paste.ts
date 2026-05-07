import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeInlineWhitespace(value: string): string {
  return value
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderInline(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replace(/\s+/g, ' ');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const tag = node.tagName.toLowerCase();
  const content = Array.from(node.childNodes).map(renderInline).join('');

  switch (tag) {
    case 'strong':
    case 'b':
      return content.trim() ? `**${content.trim()}**` : '';
    case 'em':
    case 'i':
      return content.trim() ? `*${content.trim()}*` : '';
    case 's':
    case 'strike':
    case 'del':
      return content.trim() ? `~~${content.trim()}~~` : '';
    case 'code':
      return `\`${normalizeWhitespace(node.textContent ?? '')}\``;
    case 'a': {
      const href = node.getAttribute('href');
      const label = normalizeWhitespace(content || href || '');

      return href ? `[${label}](${href})` : label;
    }
    case 'br':
      return '\n';
    case 'img': {
      const src = node.getAttribute('src');
      const alt = node.getAttribute('alt') ?? '';

      return src ? `![${alt}](${src})` : '';
    }
    default:
      return content;
  }
}

function renderBlock(node: ChildNode, listDepth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeWhitespace(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const tag = node.tagName.toLowerCase();

  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(node.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === 'li')
      .map((child, index) => {
        const bullet = tag === 'ol' ? `${index + 1}. ` : '- ';
        const parts = Array.from(child.childNodes).map((grandchild) => {
          if (grandchild instanceof HTMLElement && ['ul', 'ol'].includes(grandchild.tagName.toLowerCase())) {
            const nested = renderBlock(grandchild, listDepth + 1).trimEnd();
            const indent = '  '.repeat(listDepth + 1);

            return `\n${nested
              .split('\n')
              .map((line) => (line ? `${indent}${line}` : line))
              .join('\n')}`;
          }

          return renderInline(grandchild);
        });

        const line = normalizeInlineWhitespace(parts.join(''));
        return `${'  '.repeat(listDepth)}${bullet}${line}`;
      })
      .join('\n');

    return `${items}\n\n`;
  }

  if (tag === 'pre') {
    const code = (node.textContent ?? '').replace(/\n+$/, '');
    return `\`\`\`\n${code}\n\`\`\`\n\n`;
  }

  if (tag === 'blockquote') {
    const content = Array.from(node.childNodes)
      .map((child) => renderBlock(child, listDepth))
      .join('')
      .trim();

    const quoted = content
      .split('\n')
      .filter(Boolean)
      .map((line) => `> ${line}`)
      .join('\n');

    return `${quoted}\n\n`;
  }

  if (tag === 'hr') {
    return '---\n\n';
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    const text = normalizeWhitespace(Array.from(node.childNodes).map(renderInline).join(''));
    return `${'#'.repeat(level)} ${text}\n\n`;
  }

  if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
    const text = Array.from(node.childNodes).map((child) => {
      if (child instanceof HTMLElement && ['ul', 'ol', 'pre', 'blockquote', 'hr'].includes(child.tagName.toLowerCase())) {
        return `\n${renderBlock(child, listDepth)}`;
      }

      return renderInline(child);
    }).join('');

    const normalized = normalizeInlineWhitespace(text);

    return normalized ? `${normalized}\n\n` : '';
  }

  const content = Array.from(node.childNodes).map((child) => renderBlock(child, listDepth)).join('');
  return content;
}

export function convertPastedHtmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const markdown = Array.from(doc.body.childNodes)
    .map((node) => renderBlock(node))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return markdown;
}

export function looksLikeMarkdown(text: string): boolean {
  return (
    /^#{1,6}\s/m.test(text) ||
    /^>\s/m.test(text) ||
    /^[-*+]\s/m.test(text) ||
    /^\d+\.\s/m.test(text) ||
    /^```/m.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /_[^_]+_/.test(text) ||
    /~~[^~]+~~/.test(text) ||
    /`[^`]+`/.test(text) ||
    /!\[[^\]]*]\([^)]+\)/.test(text) ||
    /\[[^\]]+]\([^)]+\)/.test(text)
  );
}

export const PasteMarkdown = Extension.create({
  name: 'pasteMarkdown',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const clipboardData = event.clipboardData;

            if (!clipboardData) {
              return false;
            }

            if (clipboardData.files.length > 0) {
              return false;
            }

            const rawText = clipboardData.getData('text/plain');
            const text = rawText.trim();
            const html = clipboardData.getData('text/html').trim();

            let markdown = '';

            if (text && looksLikeMarkdown(text)) {
              markdown = rawText;
            } else if (html) {
              markdown = convertPastedHtmlToMarkdown(html);
            }

            if (!markdown || !editor.markdown) {
              return false;
            }

            const json = editor.markdown.parse(markdown);
            editor.chain().focus().insertContent(json).run();
            return true;
          },
        },
      }),
    ];
  },
});
