import { describe, expect, test } from 'vitest';
import { REMINDER_DAYS, describeLastBackup, isBackupOverdue } from '../backupReminders';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 5, 10, 12, 0, 0).getTime();
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe('isBackupOverdue', () => {
  test('uses 7 days on persistent storage and 3 on best-effort storage', () => {
    expect(REMINDER_DAYS).toEqual({ persisted: 7, 'best-effort': 3 });
    const base = { hasContent: true, now: NOW };

    expect(isBackupOverdue({ ...base, storage: 'persisted', lastBackupAt: ago(6.9) })).toBe(false);
    expect(isBackupOverdue({ ...base, storage: 'persisted', lastBackupAt: ago(7) })).toBe(true);
    expect(isBackupOverdue({ ...base, storage: 'best-effort', lastBackupAt: ago(2.9) })).toBe(false);
    expect(isBackupOverdue({ ...base, storage: 'best-effort', lastBackupAt: ago(3) })).toBe(true);
  });

  test('a site that was never backed up is overdue, an invalid record too', () => {
    const base = { hasContent: true, now: NOW, storage: 'persisted' as const };
    expect(isBackupOverdue({ ...base, lastBackupAt: null })).toBe(true);
    expect(isBackupOverdue({ ...base, lastBackupAt: 'garbage' })).toBe(true);
  });

  test('a site without content is never overdue', () => {
    expect(isBackupOverdue({ hasContent: false, now: NOW, storage: 'best-effort', lastBackupAt: null })).toBe(false);
  });
});

describe('describeLastBackup', () => {
  test('describes the gap in calendar days', () => {
    expect(describeLastBackup(null, NOW)).toBe('Never backed up');
    expect(describeLastBackup(ago(0), NOW)).toBe('Last backed up today');
    expect(describeLastBackup(ago(1), NOW)).toBe('Last backed up yesterday');
    expect(describeLastBackup(ago(5), NOW)).toBe('Last backed up 5 days ago');
  });

  test('treats a timestamp from just before midnight as yesterday', () => {
    const lateLastNight = new Date(2026, 5, 9, 23, 59).getTime();
    expect(describeLastBackup(new Date(lateLastNight).toISOString(), new Date(2026, 5, 10, 0, 1).getTime())).toBe(
      'Last backed up yesterday',
    );
  });
});
