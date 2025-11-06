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
  // Use cryptographically secure UUID for collision-resistant uniqueness
  const uuid = crypto.randomUUID();
  // Take first segment of UUID (8 chars) for shorter IDs while maintaining strong uniqueness
  const shortId = uuid.split('-')[0];

  const slugBase = slugify(title);
  // Truncate slugBase to keep total ID length reasonable
  const maxBaseLength = 30;
  const truncatedSlugBase = slugBase.substring(0, maxBaseLength);
  return `${truncatedSlugBase}-${shortId}`;
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