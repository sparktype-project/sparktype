// src/core/services/backup/backupValidation.ts

import JSZip from 'jszip';
import type { Manifest, SiteSecrets } from '@/core/types';
import { MANIFEST_FILE, SECRETS_FILE, SIGNUM_FOLDER } from './backupFormat';

/** The header every backup archive must carry, read and validated up front. */
export interface BackupArchiveHeader {
  manifest: Manifest;
  secrets: SiteSecrets;
}

/** Reads a ZIP archive, reporting unreadable files as an invalid backup. */
export async function loadBackupArchive(zipFile: Blob): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(zipFile);
  } catch (error) {
    throw new Error(`Invalid backup file: the archive could not be read (${(error as Error).message}).`);
  }
}

/**
 * Reads the manifest and secrets before anything else is extracted, so an
 * archive that cannot yield a usable site is rejected before storage is touched.
 */
export async function readBackupHeader(zip: JSZip): Promise<BackupArchiveHeader> {
  const signumFolder = zip.folder(SIGNUM_FOLDER);

  if (!signumFolder) throw new Error(`Invalid backup file: ${SIGNUM_FOLDER} folder not found.`);

  const manifestFile = signumFolder.file(MANIFEST_FILE);
  if (!manifestFile) throw new Error(`Invalid backup file: ${MANIFEST_FILE} is missing.`);
  const manifest: Manifest = JSON.parse(await manifestFile.async('string'));

  const secretsFile = signumFolder.file(SECRETS_FILE);
  const secrets: SiteSecrets = secretsFile ? JSON.parse(await secretsFile.async('string')) : {};

  return { manifest, secrets };
}
