import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { LocalSiteData } from '@/core/types';
import type { StoragePersistenceStatus } from '@/core/services/storage/storagePersistence.service';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';

const { storageStatus, toastWarning, storeState, downloadMock } = vi.hoisted(() => ({
  storageStatus: { value: 'persisted' as 'persisted' | 'best-effort' },
  toastWarning: vi.fn(),
  storeState: {} as Record<string, unknown>,
  downloadMock: vi.fn(),
}));

vi.mock('@/core/services/storage/storagePersistence.service', () => ({
  getStoragePersistenceStatus: async () => storageStatus.value as StoragePersistenceStatus,
}));
vi.mock('sonner', () => ({
  toast: { warning: toastWarning, info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
    { getState: () => storeState },
  ),
}));
vi.mock('@/core/services/backup/downloadSiteBackup', () => ({ downloadSiteBackup: downloadMock }));

import { recordBackup } from '@/core/services/backup/backupTracking.service';
import { loadReminderSettings } from '@/core/services/backup/reminderSettings';
import BackupReminderBanner from '../BackupReminderBanner';
import BackupReminderToast from '../BackupReminderToast';
import { resetBackupToastSession } from '../toastSession';
import StoragePersistenceStatusPanel from '@/features/site-settings/components/StoragePersistenceStatus';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 5, 10, 12, 0).getTime();
const now = () => NOW;
const daysAgo = (days: number) => new Date(NOW - days * DAY);

function site(siteId: string, title: string, withContent = true): LocalSiteData {
  const fixture = createSiteFixture('basicSite', { siteId });
  fixture.manifest.title = title;
  if (!withContent) fixture.manifest.structure = [];
  return fixture;
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  storageStatus.value = 'persisted';
  resetBackupToastSession();
  await resetIndexedDbForTests();
  storeState.loadSite = vi.fn(async () => undefined);
  storeState.getSiteById = (id: string) => ({ siteId: id });
});

describe('BackupReminderBanner', () => {
  test('lists a never-backed-up site with a one-click export', async () => {
    const onExport = vi.fn();
    render(<BackupReminderBanner sites={[site('a', 'My Blog')]} onExport={onExport} now={now} />);

    expect(await screen.findByRole('region', { name: 'Backup reminder' })).toHaveTextContent('My Blog');
    expect(screen.getByRole('region')).toHaveTextContent('Never backed up');
    await userEvent.click(screen.getByRole('button', { name: /export backup for my blog/i }));
    expect(onExport).toHaveBeenCalledWith('a');
  });

  test('waits 7 days on persistent storage', async () => {
    await recordBackup('a', daysAgo(6));
    render(<BackupReminderBanner sites={[site('a', 'My Blog')]} onExport={vi.fn()} now={now} />);
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());

    await recordBackup('a', daysAgo(7));
    expect(await screen.findByRole('region')).toHaveTextContent('Last backed up 7 days ago');
  });

  test('waits only 3 days on best-effort storage and says why', async () => {
    storageStatus.value = 'best-effort';
    await recordBackup('a', daysAgo(2));
    render(<BackupReminderBanner sites={[site('a', 'My Blog')]} onExport={vi.fn()} now={now} />);
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());

    await recordBackup('a', daysAgo(3));
    const banner = await screen.findByRole('region');
    expect(banner).toHaveTextContent('after 3 days');
    expect(banner).toHaveTextContent('may clear site data');
  });

  test('ignores sites with no content and sites that are up to date', async () => {
    await recordBackup('fresh', daysAgo(1));
    render(
      <BackupReminderBanner sites={[site('empty', 'Empty', false), site('fresh', 'Fresh')]} onExport={vi.fn()} now={now} />,
    );
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
  });

  test('disappears once the site is backed up', async () => {
    render(<BackupReminderBanner sites={[site('a', 'My Blog')]} onExport={vi.fn()} now={now} />);
    await screen.findByRole('region');

    await act(async () => {
      await recordBackup('a', new Date(NOW));
    });

    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
  });

  test('can be snoozed for a day', async () => {
    render(<BackupReminderBanner sites={[site('a', 'My Blog')]} onExport={vi.fn()} now={now} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remind me tomorrow' }));

    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
    expect(loadReminderSettings().snoozedUntil).toBe(NOW + DAY);
  });

  test('can be turned off, and stays off', async () => {
    const { unmount } = render(<BackupReminderBanner sites={[site('a', 'My Blog')]} onExport={vi.fn()} now={now} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off reminders' }));
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
    unmount();

    render(<BackupReminderBanner sites={[site('a', 'My Blog')]} onExport={vi.fn()} now={now} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});

describe('BackupReminderToast', () => {
  test('shows once per session with an export action for the longest-overdue site', async () => {
    storeState.sites = [site('a', 'Newer'), site('b', 'Older')];
    await recordBackup('a', daysAgo(8));
    await recordBackup('b', daysAgo(20));

    const { rerender } = render(<BackupReminderToast now={now} />);
    await waitFor(() => expect(toastWarning).toHaveBeenCalledTimes(1));
    const [title, options] = toastWarning.mock.calls[0];
    expect(title).toBe('2 sites need a backup');
    expect(options.description).toContain('Older');

    await act(async () => options.action.onClick());
    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith({ siteId: 'b' }));
    expect(storeState.loadSite).toHaveBeenCalledWith('b');

    rerender(<BackupReminderToast now={now} />);
    render(<BackupReminderToast now={now} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(toastWarning).toHaveBeenCalledTimes(1);
  });

  test('stays quiet when nothing is overdue, reminders are off, or the site is empty', async () => {
    storeState.sites = [site('a', 'Fine'), site('empty', 'Empty', false)];
    await recordBackup('a', daysAgo(1));
    render(<BackupReminderToast now={now} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(toastWarning).not.toHaveBeenCalled();
  });

  test('stays quiet when reminders are turned off', async () => {
    localStorage.setItem('sparktype:backup-reminders', JSON.stringify({ enabled: false, snoozedUntil: null }));
    storeState.sites = [site('a', 'Overdue')];
    render(<BackupReminderToast now={now} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(toastWarning).not.toHaveBeenCalled();
  });
});

describe('storage settings panel', () => {
  test('shows when the site was last backed up next to the storage status, and a reminders switch', async () => {
    await recordBackup('a', daysAgo(2));
    render(<StoragePersistenceStatusPanel siteId="a" now={now} />);

    const panel = await screen.findByTestId('storage-persistence-status');
    expect(await screen.findByText('Last backed up 2 days ago')).toBeInTheDocument();
    expect(panel).toBeInTheDocument();

    const toggle = screen.getByRole('switch', { name: /remind me to back up/i });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(loadReminderSettings().enabled).toBe(false);
  });
});
