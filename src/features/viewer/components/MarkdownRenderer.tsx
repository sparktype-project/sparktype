// src/components/browsing/MarkdownRenderer.tsx
'use client'; 

import { marked } from 'marked';
import { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  markdown: string;
}

export default function MarkdownRenderer({ markdown }: MarkdownRendererProps) {
  // Parse the markdown string to HTML.
  // useMemo will re-calculate only if the 'markdown' prop changes.
  const html = useMemo(() => {
    if (typeof window === 'undefined') {

    }
    const rawHtml = marked.parse(markdown) as string;
    if (typeof window !== 'undefined') { 
    return DOMPurify.sanitize(rawHtml);
     }
    return rawHtml;
  }, [markdown]);

  // Using dangerouslySetInnerHTML because 'marked' produces an HTML string.
  // Ensure that the 'markdown' content is from a trusted source or sanitized.
  // Since in Signum, users are creating their own local content first,
  // the trust level is higher for this local-only phase.
  // For remote content later, sanitization will be critical.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}