import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  areRemindersActive,
  loadReminderSettings,
  setRemindersEnabled,
  snoozeReminders,
  subscribeToReminderSettings,
} from '../reminderSettings';

describe('reminder settings', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  test('default to on and not snoozed', () => {
    const settings = loadReminderSettings();
    expect(settings).toEqual({ enabled: true, snoozedUntil: null });
    expect(areRemindersActive(settings, 0)).toBe(true);
  });

  test('can be turned off and back on, and subscribers hear about it', () => {
    const listener = vi.fn();
    subscribeToReminderSettings(listener);

    setRemindersEnabled(false);
    expect(areRemindersActive(loadReminderSettings(), 0)).toBe(false);
    setRemindersEnabled(true);
    expect(areRemindersActive(loadReminderSettings(), 0)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('snoozing silences reminders for a day only', () => {
    const now = Date.parse('2026-06-10T12:00:00Z');
    snoozeReminders(now);
    const settings = loadReminderSettings();
    expect(areRemindersActive(settings, now + 60_000)).toBe(false);
    expect(areRemindersActive(settings, now + 24 * 60 * 60 * 1000)).toBe(true);
  });

  test('falls back to on when stored data is corrupt', () => {
    localStorage.setItem('sparktype:backup-reminders', '{not json');
    expect(loadReminderSettings()).toEqual({ enabled: true, snoozedUntil: null });
  });

  test('survives storage that throws on read and write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(loadReminderSettings().enabled).toBe(true);
    expect(() => setRemindersEnabled(false)).not.toThrow();
    expect(() => snoozeReminders(0)).not.toThrow();
  });
});
