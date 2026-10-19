// src/core/services/builder/imageRefs.ts

import type { ImageRef, ParsedMarkdownFile } from '@/core/types';

// Local uploads are stored under `assets/originals/`. The editor writes body images as plain
// markdown links (or raw <img> tags), so they are invisible to the ImageRef walk over frontmatter.
const BODY_MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?(assets\/originals\/[^)\s>]+)/g;
const BODY_HTML_IMAGE = /<img\b[^>]*?\bsrc=["'](assets\/originals\/[^"']+)["']/gi;

/** Local images embedded in a markdown body. */
export function findBodyImageSources(content: string): string[] {
  const sources = new Set<string>();
  for (const pattern of [BODY_MARKDOWN_IMAGE, BODY_HTML_IMAGE]) {
    for (const match of content.matchAll(pattern)) {
      sources.add(match[1]);
    }
  }
  return [...sources];
}

/** Recursively collects every ImageRef-shaped object reachable from `root`. */
export function collectImageRefs(root: unknown, refs: Set<ImageRef> = new Set()): Set<ImageRef> {
  const visited = new Set<object>();
  function find(obj: unknown) {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);
    if ('serviceId' in obj && 'src' in obj && (obj as ImageRef).serviceId && (obj as ImageRef).src) {
      refs.add(obj as ImageRef);
    }
    Object.values(obj).forEach(find);
  }
  find(root);
  return refs;
}

/** Every image one content file references: frontmatter ImageRefs plus local body images. */
export function findContentFileImageRefs(file: Pick<ParsedMarkdownFile, 'frontmatter' | 'content'>): ImageRef[] {
  const refs = [...collectImageRefs(file.frontmatter)];
  const known = new Set(refs.map((ref) => ref.src));
  for (const src of findBodyImageSources(file.content)) {
    if (!known.has(src)) refs.push({ serviceId: 'local', src });
  }
  return refs;
}
