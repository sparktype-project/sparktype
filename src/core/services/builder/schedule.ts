// src/core/services/builder/schedule.ts

import type { ParsedMarkdownFile } from '@/core/types';

// An offset is required: a bare local time has no single meaning once the site is built on a
// different machine or timezone than the one it was written on.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Epoch milliseconds for a `publishAt` value, or `null` when it is absent or not a valid ISO datetime with offset. */
export function parsePublishAt(value: unknown): number | null {
  if (typeof value !== 'string' || !ISO_WITH_OFFSET.test(value.trim())) return null;
  const time = Date.parse(value.trim());
  return Number.isNaN(time) ? null : time;
}

/** Whether a `publishAt` value is set but unusable; the build ignores it, so the item goes live at once. */
export function isInvalidPublishAt(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && parsePublishAt(value) === null;
}

type FileLike = Pick<ParsedMarkdownFile, 'frontmatter'> | undefined;

/** Whether the file is held back because its `publishAt` is later than `now`. A time equal to `now` is live. */
export function isScheduledAfter(file: FileLike, now: number): boolean {
  const at = parsePublishAt(file?.frontmatter.publishAt);
  return at !== null && at > now;
}
