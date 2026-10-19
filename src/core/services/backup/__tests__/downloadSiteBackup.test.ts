import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';

const { exportSiteBackupMock } = vi.hoisted(() => ({ exportSiteBackupMock: vi.fn() }));
vi.mock('../backupExport', () => ({ exportSiteBackup: exportSiteBackupMock }));

import { getLastBackupAt, recordBackup } from '../backupTracking.service';
import { downloadSiteBackup } from '../downloadSiteBackup';

describe('downloadSiteBackup', () => {
  let clicked: HTMLAnchorElement[];

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetIndexedDbForTests();
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:backup'), revokeObjectURL: vi.fn() });
  });

  test('downloads a ZIP named after the site and records the time', async () => {
    const site = createSiteFixture('basicSite', { siteId: 'a' });
    exportSiteBackupMock.mockResolvedValue(new Blob(['zip']));

    await downloadSiteBackup(site, () => new Date('2026-06-01T10:00:00Z'));

    expect(exportSiteBackupMock).toHaveBeenCalledWith(site);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toMatch(/\.zip$/);
    expect(await getLastBackupAt('a')).toBe('2026-06-01T10:00:00.000Z');
  });

  test('a failed export rejects and leaves the previous timestamp', async () => {
    const site = createSiteFixture('basicSite', { siteId: 'a' });
    await recordBackup('a', new Date('2026-05-01T10:00:00Z'));
    exportSiteBackupMock.mockRejectedValue(new Error('disk full'));

    await expect(downloadSiteBackup(site, () => new Date('2026-06-01T10:00:00Z'))).rejects.toThrow('disk full');

    expect(clicked).toHaveLength(0);
    expect(await getLastBackupAt('a')).toBe('2026-05-01T10:00:00.000Z');
  });

  test('a failed first export records nothing', async () => {
    exportSiteBackupMock.mockRejectedValue(new Error('nope'));
    await expect(downloadSiteBackup(createSiteFixture('basicSite', { siteId: 'a' }))).rejects.toThrow();
    expect(await getLastBackupAt('a')).toBeNull();
  });

  test('backing up one site does not touch another', async () => {
    exportSiteBackupMock.mockResolvedValue(new Blob(['zip']));
    await recordBackup('b', new Date('2026-05-01T10:00:00Z'));

    await downloadSiteBackup(createSiteFixture('basicSite', { siteId: 'a' }), () => new Date('2026-06-01T10:00:00Z'));

    expect(await getLastBackupAt('b')).toBe('2026-05-01T10:00:00.000Z');
  });
});
