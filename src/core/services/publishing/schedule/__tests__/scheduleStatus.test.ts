import { describe, expect, test } from 'vitest';
import type { ParsedMarkdownFile } from '@/core/types';
import type { PublishHistoryEntry } from '../../history/publishHistory.service';
import { getScheduleStatus, lastSuccessfulPublishAt } from '../scheduleStatus';

const NOW = Date.parse('2026-06-10T12:00:00Z');
const LAST = Date.parse('2026-06-05T12:00:00Z');

function file(path: string, frontmatter: Record<string, unknown> = {}): ParsedMarkdownFile {
  return { path, slug: path, content: '', frontmatter: { title: path, layout: 'page', ...frontmatter } };
}

function entry(overrides: Partial<PublishHistoryEntry>): PublishHistoryEntry {
  return {
    id: 'x', kind: 'publish', startedAt: '2026-06-05T12:00:00Z', finishedAt: '2026-06-05T12:01:00Z',
    provider: 'zip', target: 'download', outcome: 'success', findings: { blocking: 0, warning: 0 }, log: [],
    ...overrides,
  };
}

describe('lastSuccessfulPublishAt', () => {
  test('uses the start of the newest successful publish, skipping failures and rollbacks', () => {
    expect(lastSuccessfulPublishAt([
      entry({ outcome: 'failed', startedAt: '2026-06-09T00:00:00Z' }),
      entry({ kind: 'rollback', startedAt: '2026-06-08T00:00:00Z' }),
      entry({ startedAt: '2026-06-07T00:00:00Z' }),
      entry({ startedAt: '2026-06-01T00:00:00Z' }),
    ])).toBe(Date.parse('2026-06-07T00:00:00Z'));
  });

  test('is null with no successful publish', () => {
    expect(lastSuccessfulPublishAt([])).toBeNull();
    expect(lastSuccessfulPublishAt([entry({ outcome: 'failed' })])).toBeNull();
  });
});

describe('getScheduleStatus', () => {
  const files = [
    file('future-late', { publishAt: '2026-07-01T00:00:00Z' }),
    file('future-soon', { publishAt: '2026-06-11T00:00:00Z' }),
    file('due', { publishAt: '2026-06-08T00:00:00Z' }),
    file('exactly-now', { publishAt: '2026-06-10T12:00:00Z' }),
    file('already-live', { publishAt: '2026-06-01T00:00:00Z' }),
    file('draft', { publishAt: '2026-06-08T00:00:00Z', published: false }),
    file('invalid', { publishAt: 'soon' }),
    file('plain'),
  ];

  test('separates held back from due, soonest first', () => {
    const status = getScheduleStatus({ contentFiles: files }, NOW, LAST);
    expect(status.heldBack.map((item) => item.path)).toEqual(['future-soon', 'future-late']);
    expect(status.due.map((item) => item.path)).toEqual(['due', 'exactly-now']);
  });

  test('an item due since before the last publish is already live', () => {
    expect(getScheduleStatus({ contentFiles: files }, NOW, LAST).due.map((i) => i.path)).not.toContain('already-live');
  });

  test('an item whose time equals the last publish is already live', () => {
    const status = getScheduleStatus({ contentFiles: [file('edge', { publishAt: '2026-06-05T12:00:00Z' })] }, NOW, LAST);
    expect(status.due).toEqual([]);
  });

  test('nothing is due before the first publish', () => {
    const status = getScheduleStatus({ contentFiles: files }, NOW, null);
    expect(status.due).toEqual([]);
    expect(status.heldBack).toHaveLength(2);
  });

  test('handles a site with no loaded content', () => {
    expect(getScheduleStatus({}, NOW, LAST)).toEqual({ heldBack: [], due: [] });
  });
});
