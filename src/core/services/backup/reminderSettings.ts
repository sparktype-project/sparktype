// src/core/services/backup/reminderSettings.ts

/**
 * App-level backup reminder preferences. They belong to this browser rather than to a site, so
 * they live in localStorage; every access is guarded because storage can be blocked or full, and
 * reminders then fall back to on.
 */

const STORAGE_KEY = 'sparktype:backup-reminders';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

export interface ReminderSettings {
  enabled: boolean;
  /** Epoch milliseconds until which reminders stay quiet, or `null`. */
  snoozedUntil: number | null;
}

const DEFAULTS: ReminderSettings = { enabled: true, snoozedUntil: null };

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToReminderSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadReminderSettings(): ReminderSettings {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;
    const { enabled, snoozedUntil } = parsed as Partial<ReminderSettings>;
    return {
      enabled: enabled !== false,
      snoozedUntil: typeof snoozedUntil === 'number' ? snoozedUntil : null,
    };
  } catch {
    return DEFAULTS;
  }
}

function save(settings: ReminderSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Preferences are a convenience; if they cannot be stored the reminder simply stays on.
  }
  listeners.forEach((listener) => listener());
}

export function setRemindersEnabled(enabled: boolean): void {
  save({ ...loadReminderSettings(), enabled });
}

/** Silences reminders for a day. */
export function snoozeReminders(now: number): void {
  save({ ...loadReminderSettings(), snoozedUntil: now + SNOOZE_MS });
}

export function areRemindersActive(settings: ReminderSettings, now: number): boolean {
  return settings.enabled && (settings.snoozedUntil === null || settings.snoozedUntil <= now);
}
