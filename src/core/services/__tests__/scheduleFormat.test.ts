import { describe, expect, test } from 'vitest';
import { parsePublishAt } from '@/core/services/builder/schedule';
import { formatScheduledAt, getScheduledLabel, fromLocalInputValue, toLocalInputValue } from '../scheduleFormat';

describe('scheduleFormat', () => {
  test('stores local input as ISO with an offset', () => {
    const stored = fromLocalInputValue('2026-06-01T09:30')!;
    expect(stored).toMatch(/^2026-06-01T09:30:00[+-]\d{2}:\d{2}$/);
    expect(parsePublishAt(stored)).toBe(new Date(2026, 5, 1, 9, 30).getTime());
  });

  test('round-trips between the stored value and the input value in the same instant', () => {
    expect(toLocalInputValue(fromLocalInputValue('2026-12-25T23:05'))).toBe('2026-12-25T23:05');
  });

  test('renders another offset in local time without changing the instant', () => {
    const input = toLocalInputValue('2026-06-01T12:00:00Z');
    expect(new Date(input).getTime()).toBe(Date.parse('2026-06-01T12:00:00Z'));
  });

  test('empty, partial and invalid values yield nothing', () => {
    expect(fromLocalInputValue('')).toBeUndefined();
    expect(fromLocalInputValue('2026-06-01')).toBeUndefined();
    expect(toLocalInputValue(undefined)).toBe('');
    expect(toLocalInputValue('soon')).toBe('');
    expect(formatScheduledAt('soon')).toBeNull();
    expect(formatScheduledAt('2026-06-01T12:00:00Z')).toEqual(expect.any(String));
  });

  test('labels only non-draft items that are still held back', () => {
    const now = Date.parse('2026-06-01T12:00:00Z');
    expect(getScheduledLabel({ publishAt: '2026-06-02T12:00:00Z' }, now)).toMatch(/^Scheduled for .+/);
    expect(getScheduledLabel({ publishAt: '2026-06-01T12:00:00Z' }, now)).toBeNull();
    expect(getScheduledLabel({ publishAt: '2026-06-02T12:00:00Z', published: false }, now)).toBeNull();
    expect(getScheduledLabel({ publishAt: 'soon' }, now)).toBeNull();
    expect(getScheduledLabel({}, now)).toBeNull();
  });
});
