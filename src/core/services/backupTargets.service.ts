import type { BackupTargetConfig, LocalSiteData } from '@/core/types';
import { exportSiteBackup } from './siteBackup.service';
import { readMetadata, saveStorageSnapshot, writeMetadata } from './storage/siteStorage.service';

export interface BackupRunResult {
  targetId: string;
  type: BackupTargetConfig['type'];
  success: boolean;
  createdAt: number;
  bytesWritten?: number;
  message?: string;
}

export interface BackupTargetRuntime {
  type: BackupTargetConfig['type'];
  write(siteData: LocalSiteData, blob: Blob, target: BackupTargetConfig): Promise<BackupRunResult>;
}

interface DirectoryPickerHandle {
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<DirectoryPickerHandle>;
}

const BACKUP_TARGET_STORE = 'backupTargets';
const BACKUP_STATUS_STORE = 'backupStatuses';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function writeBlobToDirectory(blob: Blob, filename: string): Promise<void> {
  const windowWithPicker = window as DirectoryPickerWindow;

  if (!windowWithPicker.showDirectoryPicker) {
    throw new Error('Directory picker is not available in this browser.');
  }

  const directoryHandle = await windowWithPicker.showDirectoryPicker();
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

const runtimes: Record<BackupTargetConfig['type'], BackupTargetRuntime> = {
  'local-file': {
    type: 'local-file',
    async write(siteData, blob, target) {
      const filename = `${siteData.manifest.title || siteData.siteId}-${new Date().toISOString()}.sparktype.zip`;
      downloadBlob(blob, filename);
      return {
        targetId: target.id,
        type: target.type,
        success: true,
        createdAt: Date.now(),
        bytesWritten: blob.size,
        message: 'Backup downloaded locally.',
      };
    },
  },
  'local-folder': {
    type: 'local-folder',
    async write(siteData, blob, target) {
      const filename = `${siteData.siteId}-${new Date().toISOString()}.sparktype.zip`;
      await writeBlobToDirectory(blob, filename);
      return {
        targetId: target.id,
        type: target.type,
        success: true,
        createdAt: Date.now(),
        bytesWritten: blob.size,
        message: 'Backup written to local folder.',
      };
    },
  },
  webdav: {
    type: 'webdav',
    async write(_siteData, _blob, target) {
      throw new Error(`Backup target "${target.name}" is configured but WebDAV delivery is not implemented yet.`);
    },
  },
  's3-compatible': {
    type: 's3-compatible',
    async write(_siteData, _blob, target) {
      throw new Error(`Backup target "${target.name}" is configured but S3-compatible delivery is not implemented yet.`);
    },
  },
};

export async function getBackupTargets(siteId: string): Promise<BackupTargetConfig[]> {
  return (await readMetadata<BackupTargetConfig[]>(BACKUP_TARGET_STORE, siteId)) || [];
}

export async function saveBackupTargets(siteId: string, targets: BackupTargetConfig[]): Promise<void> {
  await writeMetadata(BACKUP_TARGET_STORE, siteId, targets);
}

export async function runBackupTarget(siteData: LocalSiteData, target: BackupTargetConfig): Promise<BackupRunResult> {
  const blob = await exportSiteBackup(siteData);
  const snapshot = await saveStorageSnapshot(siteData.siteId, blob, target.name);
  const runtime = runtimes[target.type];
  const result = await runtime.write(siteData, blob, target);

  await writeMetadata(`${BACKUP_STATUS_STORE}:${siteData.siteId}`, target.id, {
    ...result,
    snapshotId: snapshot.id,
  });

  return result;
}

export async function getBackupTargetStatus(siteId: string, targetId: string): Promise<BackupRunResult | null> {
  return readMetadata<BackupRunResult>(`${BACKUP_STATUS_STORE}:${siteId}`, targetId);
}
