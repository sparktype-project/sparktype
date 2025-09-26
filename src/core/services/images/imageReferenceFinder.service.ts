// src/core/services/images/imageReferenceFinder.service.ts

/**
 * Image Reference Finder Service
 *
 * Provides utilities for finding image references in content files,
 * frontmatter, and other site data. This is used by the registry system
 * to track where images are being used.
 */

import type { ParsedMarkdownFile, MarkdownFrontmatter } from '@/core/types';

/**
 * Finds all local image references in a content file
 */
export function findImagesInContentFile(contentFile: ParsedMarkdownFile): string[] {
  const imageReferences: string[] = [];

  // 1. Scan frontmatter for ImageRef objects
  scanObjectForImageRefs(contentFile.frontmatter, imageReferences);

  // 2. Scan markdown content for inline images
  const markdownImageMatches = contentFile.content.match(/!\[.*?\]\((assets\/[^)]+)\)/g);
  markdownImageMatches?.forEach(match => {
    const pathMatch = match.match(/\((assets\/[^)]+)\)/);
    if (pathMatch?.[1]) {
      imageReferences.push(pathMatch[1]);
    }
  });

  // Remove duplicates and return
  return Array.from(new Set(imageReferences));
}

/**
 * Finds all local image references in frontmatter and content string
 */
export function findImagesInRawContent(frontmatter: MarkdownFrontmatter, content: string): string[] {
  const imageReferences: string[] = [];

  // 1. Scan frontmatter for ImageRef objects
  scanObjectForImageRefs(frontmatter, imageReferences);

  // 2. Scan markdown content for inline images
  const markdownImageMatches = content.match(/!\[.*?\]\((assets\/[^)]+)\)/g);
  markdownImageMatches?.forEach(match => {
    const pathMatch = match.match(/\((assets\/[^)]+)\)/);
    if (pathMatch?.[1]) {
      imageReferences.push(pathMatch[1]);
    }
  });

  // Remove duplicates and return
  return Array.from(new Set(imageReferences));
}

/**
 * Recursively scans an object for ImageRef patterns with safety limits
 * This is simpler and safer than the complex recursive approach used elsewhere
 */
export function scanObjectForImageRefs(obj: any, found: string[], depth = 0): void {
  // Safety: limit recursion depth to prevent infinite loops
  if (depth > 10 || !obj || typeof obj !== 'object') {
    return;
  }

  // Check if this object is an ImageRef for local images
  if (obj.serviceId === 'local' && typeof obj.src === 'string' && obj.src.startsWith('assets/')) {
    found.push(obj.src);
    return; // Don't recurse into ImageRef objects
  }

  // Recurse into properties, but skip circular references and DOM objects
  if (obj.constructor === Object || Array.isArray(obj)) {
    for (const value of Object.values(obj)) {
      if (value !== obj && value !== null && typeof value !== 'function') {
        scanObjectForImageRefs(value, found, depth + 1);
      }
    }
  }
}

/**
 * Finds all images referenced in any object (manifest, frontmatter, etc.)
 */
export function findImagesInObject(obj: any): string[] {
  const imageReferences: string[] = [];
  scanObjectForImageRefs(obj, imageReferences);
  return Array.from(new Set(imageReferences));
}