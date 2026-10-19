// src/core/services/backup/downloadSiteBackup.ts

import type { LocalSiteData } from '@/core/types';
import { slugify } from '@/core/libraries/utils';
import { exportSiteBackup } from './backupExport';
import { recordBackup } from './backupTracking.service';

/** Hands the archive to the browser as a file download; the object URL is released once the click is queued. */
function startDownload(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * The one path every "Export backup" button uses: builds the archive, downloads it, and only
 * then records the backup time. Any failure in building or downloading rejects without touching
 * the previous timestamp. The caller loads the site and handles authentication and messages.
 */
export async function downloadSiteBackup(site: LocalSiteData, now: () => Date = () => new Date()): Promise<void> {
  const blob = await exportSiteBackup(site);
  startDownload(blob, `${slugify(site.manifest.title || 'signum-backup')}.zip`);
  try {
    await recordBackup(site.siteId, now());
  } catch (error) {
    // The file is already saved; failing the export over bookkeeping would hide a good backup.
    console.warn('[Backup] Could not record the backup time:', error);
  }
}
