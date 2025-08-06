// src/components/browsing/MarkdownRenderer.tsx
'use client'; 

import { remark } from 'remark';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  markdown: string;
}

export default function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  // Parse the markdown string to HTML.
  // useMemo will re-calculate only if the 'markdown' prop changes.
  const html = useMemo(() => {
    try {
      // Use remark to parse with directive support
      const processor = remark()
        .use(remarkDirective)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeStringify, { allowDangerousHtml: true });
      
      const result = processor.processSync(markdown);
      const rawHtml = String(result);
      
      if (typeof window !== 'undefined') { 
        return DOMPurify.sanitize(rawHtml);
      }
      return rawHtml;
    } catch (error) {
      console.error('[MarkdownRenderer] Error processing markdown:', error);
      return '';
    }
  }, [markdown]);

  // Using dangerouslySetInnerHTML because 'remark' produces an HTML string.
  // Ensure that the 'markdown' content is from a trusted source or sanitized.
  // Since in Sparktype, users are creating their own local content first,
  // the trust level is higher for this local-only phase.
  // For remote content later, sanitization will be critical.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}