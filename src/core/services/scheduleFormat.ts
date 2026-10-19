// src/core/services/scheduleFormat.ts

import { parsePublishAt } from '@/core/services/builder/schedule';

const pad = (value: number) => String(Math.abs(value)).padStart(2, '0');

/** `YYYY-MM-DDTHH:mm` in the viewer's local time, the format a datetime-local input uses. Empty for a missing or invalid value. */
export function toLocalInputValue(publishAt: unknown): string {
  const time = parsePublishAt(publishAt);
  if (time === null) return '';
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Turns a datetime-local value (local time) into the stored ISO string with the local offset,
 * e.g. `2026-06-01T09:00:00+01:00`. Returns `undefined` for an empty or unparseable input.
 */
export function fromLocalInputValue(input: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input);
  if (!match) return undefined;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(date.getTime())) return undefined;

  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

/** Human-readable local date and time for badges and messages; `null` when the value is not a valid schedule. */
export function formatScheduledAt(publishAt: unknown): string | null {
  const time = parsePublishAt(publishAt);
  return time === null
    ? null
    : new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** 'Scheduled for <date>' while a non-draft item is still held back at `now`, otherwise `null`. */
export function getScheduledLabel(
  frontmatter: { published?: unknown; publishAt?: unknown },
  now: number,
): string | null {
  if (frontmatter.published === false) return null;
  const time = parsePublishAt(frontmatter.publishAt);
  if (time === null || time <= now) return null;
  return `Scheduled for ${formatScheduledAt(frontmatter.publishAt)}`;
}
