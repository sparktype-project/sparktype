// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFKD') // Normalize accented characters
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except -
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

export function generateSiteId(title: string): string {
  // Keep the random part short to avoid overly long site IDs
  const randomString = Math.random().toString(36).substring(2, 7); 
  const slugBase = slugify(title);
  // Truncate slugBase if it's too long to keep siteId reasonable
  const maxBaseLength = 50; 
  const truncatedSlugBase = slugBase.substring(0, maxBaseLength);
  return `${truncatedSlugBase}-${randomString}`;
}

export function generateContentHash(frontmatter: unknown, content: string): string {
  // Create a hash of the frontmatter + content to detect changes
  const combined = JSON.stringify(frontmatter) + content;
  // Simple hash function (good enough for change detection)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}