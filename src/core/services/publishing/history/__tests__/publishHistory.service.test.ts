import { beforeEach, describe, expect, test } from 'vitest';
import { resetIndexedDbForTests } from '@/test/support/storage';
import {
  MAX_HISTORY_ENTRIES,
  clearPublishHistory,
  readPublishHistory,
  recordPublishEntry,
  type PublishHistoryEntry,
} from '../publishHistory.service';

function entry(id: string, overrides: Partial<PublishHistoryEntry> = {}): PublishHistoryEntry {
  return {
    id,
    kind: 'publish',
    startedAt: '2025-01-01T10:00:00.000Z',
    finishedAt: '2025-01-01T10:00:05.000Z',
    provider: 'github',
    target: 'o/r#main',
    outcome: 'success',
    findings: { blocking: 0, warning: 1 },
    log: [{ at: '2025-01-01T10:00:01.000Z', step: 'build', status: 'started' }],
    ...overrides,
  };
}

describe('publish history', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  test('is empty for a site that has never published', async () => {
    expect(await readPublishHistory('s1')).toEqual([]);
  });

  test('returns entries newest first', async () => {
    await recordPublishEntry('s1', entry('a'));
    await recordPublishEntry('s1', entry('b'));
    expect((await readPublishHistory('s1')).map((e) => e.id)).toEqual(['b', 'a']);
  });

  test('keeps the last 20 entries per site and leaves other sites alone', async () => {
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i += 1) {
      await recordPublishEntry('s1', entry(`e${i}`));
    }
    await recordPublishEntry('s2', entry('other'));

    const history = await readPublishHistory('s1');
    expect(history).toHaveLength(20);
    expect(history[0].id).toBe(`e${MAX_HISTORY_ENTRIES + 4}`);
    expect(history.at(-1)?.id).toBe('e5');
    expect(await readPublishHistory('s2')).toHaveLength(1);
  });

  test('keeps the latest successful entry even when later failures push it past the cap', async () => {
    await recordPublishEntry('s1', entry('good', { commitSHA: 'abc123' }));
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i += 1) {
      await recordPublishEntry('s1', entry(`bad${i}`, { outcome: 'failed', error: 'boom' }));
    }

    const history = await readPublishHistory('s1');
    expect(history).toHaveLength(MAX_HISTORY_ENTRIES + 1);
    expect(history.at(-1)).toMatchObject({ id: 'good', commitSHA: 'abc123' });
  });

  test('a failed publish records its error and leaves the previous success untouched', async () => {
    const success = entry('ok', { commitSHA: 'abc123', url: 'https://github.com/o/r' });
    await recordPublishEntry('s1', success);
    const before = structuredClone((await readPublishHistory('s1'))[0]);

    await recordPublishEntry('s1', entry('bad', { outcome: 'failed', error: 'Update is not a fast forward' }));

    const [failed, previous] = await readPublishHistory('s1');
    expect(failed).toMatchObject({ id: 'bad', outcome: 'failed', error: 'Update is not a fast forward' });
    expect(previous).toEqual(before);
  });

  test('concurrent writes are all kept', async () => {
    await Promise.all(['a', 'b', 'c', 'd'].map((id) => recordPublishEntry('s1', entry(id))));
    expect(await readPublishHistory('s1')).toHaveLength(4);
  });

  test('ignores malformed stored data instead of throwing', async () => {
    const { writeMetadata } = await import('@/core/services/storage/siteStorage.service');
    await writeMetadata('publishHistory', 's1', { not: 'an array' });
    expect(await readPublishHistory('s1')).toEqual([]);
  });

  test('clearPublishHistory removes a site’s entries', async () => {
    await recordPublishEntry('s1', entry('a'));
    await clearPublishHistory('s1');
    expect(await readPublishHistory('s1')).toEqual([]);
  });
});
