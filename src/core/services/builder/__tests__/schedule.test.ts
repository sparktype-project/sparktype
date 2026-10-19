import { describe, expect, test } from 'vitest';
import { isInvalidPublishAt, isScheduledAfter, parsePublishAt } from '../schedule';

const file = (publishAt?: string) => ({
  frontmatter: { title: 'A', layout: 'page', ...(publishAt === undefined ? {} : { publishAt }) },
});
const NOW = Date.parse('2026-06-01T12:00:00Z');

describe('parsePublishAt', () => {
  test('accepts ISO datetimes with an offset, in any timezone notation', () => {
    expect(parsePublishAt('2026-06-01T12:00:00Z')).toBe(NOW);
    expect(parsePublishAt('2026-06-01T13:00:00+01:00')).toBe(NOW);
    expect(parsePublishAt('2026-06-01T07:00:00-05:00')).toBe(NOW);
    expect(parsePublishAt('2026-06-01T17:30+05:30')).toBe(NOW);
  });

  test.each([undefined, null, '', 'soon', 42, '2026-06-01', '2026-06-01T12:00', '2026-13-45T12:00:00Z'])(
    'rejects %j',
    (value) => expect(parsePublishAt(value)).toBeNull(),
  );
});

describe('isInvalidPublishAt', () => {
  test('flags only values that are set but unusable', () => {
    expect(isInvalidPublishAt(undefined)).toBe(false);
    expect(isInvalidPublishAt('')).toBe(false);
    expect(isInvalidPublishAt('2026-06-01T12:00:00Z')).toBe(false);
    expect(isInvalidPublishAt('next week')).toBe(true);
  });
});

describe('isScheduledAfter', () => {
  test('holds back a future time and releases one equal to or before now', () => {
    expect(isScheduledAfter(file('2026-06-01T12:00:01Z'), NOW)).toBe(true);
    expect(isScheduledAfter(file('2026-06-01T12:00:00Z'), NOW)).toBe(false);
    expect(isScheduledAfter(file('2026-06-01T11:59:59Z'), NOW)).toBe(false);
  });

  test('compares instants, not wall-clock strings', () => {
    expect(isScheduledAfter(file('2026-06-01T12:30:00+01:00'), NOW)).toBe(false);
    expect(isScheduledAfter(file('2026-06-01T12:30:00-01:00'), NOW)).toBe(true);
  });

  test('ignores invalid, missing and absent files', () => {
    expect(isScheduledAfter(file('garbage'), NOW)).toBe(false);
    expect(isScheduledAfter(file(), NOW)).toBe(false);
    expect(isScheduledAfter(undefined, NOW)).toBe(false);
  });
});
