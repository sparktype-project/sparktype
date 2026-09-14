// src/core/services/backup/backupValidation.ts

import JSZip from 'jszip';
import type { Manifest, MediaManifest, SiteSecrets } from '@/core/types';
import { validateMediaManifest } from '../images/mediaManifest.service';
import { MANIFEST_FILE, MEDIA_INDEX_PATH, SECRETS_FILE, SIGNUM_FOLDER } from './backupFormat';

/** The header every backup archive must carry, read and validated up front. */
export interface BackupArchiveHeader {
  manifest: Manifest;
  secrets: SiteSecrets;
  /** `null` for legacy archives written before the media index existed. */
  mediaIndex: MediaManifest | null;
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
 * Parses a required JSON entry.
 *
 * A backup is machine-written, so unparseable JSON means the archive is damaged.
 * Damaged archives are rejected rather than silently restored without the data
 * they failed to yield — the same policy for `secrets.json` and `media.json`.
 */
function parseJsonEntry(raw: string, entryName: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid backup file: ${entryName} is not valid JSON (${(error as Error).message}).`);
  }
}

/**
 * Rejects manifests that cannot identify a restorable site. `siteId` and `title`
 * are the same fields the storage layer's own manifest guard requires, so an
 * import can never produce a site the app refuses to list.
 */
export function validateManifest(value: unknown): Manifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid backup file: ${MANIFEST_FILE} must be a JSON object.`);
  }
  const candidate = value as Partial<Manifest>;
  if (typeof candidate.siteId !== 'string' || candidate.siteId.trim() === '') {
    throw new Error(`Invalid backup file: ${MANIFEST_FILE} is missing a siteId.`);
  }
  if (typeof candidate.title !== 'string') {
    throw new Error(`Invalid backup file: ${MANIFEST_FILE} is missing a title.`);
  }
  if (candidate.generatorVersion !== undefined && typeof candidate.generatorVersion !== 'string') {
    throw new Error(`Invalid backup file: ${MANIFEST_FILE} has an invalid generatorVersion.`);
  }
  return candidate as Manifest;
}

/**
 * Reads the manifest, secrets and media index before anything else is extracted,
 * so an archive that cannot yield a usable site is rejected before storage is
 * touched.
 *
 * `zip.folder(SIGNUM_FOLDER)` cannot prove the folder exists — JSZip creates a
 * folder on demand — so the manifest entry itself is the presence check.
 */
export async function readBackupHeader(zip: JSZip): Promise<BackupArchiveHeader> {
  const manifestEntry = zip.file(`${SIGNUM_FOLDER}/${MANIFEST_FILE}`);
  if (!manifestEntry) {
    throw new Error(`Invalid backup file: ${SIGNUM_FOLDER}/${MANIFEST_FILE} is missing.`);
  }
  const manifest = validateManifest(parseJsonEntry(await manifestEntry.async('string'), MANIFEST_FILE));

  const secretsEntry = zip.file(`${SIGNUM_FOLDER}/${SECRETS_FILE}`);
  let secrets: SiteSecrets = {};
  if (secretsEntry) {
    const parsedSecrets = parseJsonEntry(await secretsEntry.async('string'), SECRETS_FILE);
    if (typeof parsedSecrets !== 'object' || parsedSecrets === null || Array.isArray(parsedSecrets)) {
      throw new Error(`Invalid backup file: ${SECRETS_FILE} must be a JSON object.`);
    }
    secrets = parsedSecrets as SiteSecrets;
  }

  const mediaIndexEntry = zip.file(`${SIGNUM_FOLDER}/${MEDIA_INDEX_PATH}`);
  let mediaIndex: MediaManifest | null = null;
  if (mediaIndexEntry) {
    const parsedIndex = parseJsonEntry(await mediaIndexEntry.async('string'), MEDIA_INDEX_PATH);
    const index = (typeof parsedIndex === 'object' && parsedIndex !== null ? parsedIndex : {}) as Partial<MediaManifest>;
    const validation = validateMediaManifest(parsedIndex);

    // Structural problems stop the index doing its job — `importMediaManifest`
    // cannot rebuild a registry from an index in this shape, and the same index
    // is what `restoreImportedImageRegistry` reads after a restore — so they are
    // fatal rather than merely warned about.
    const structuralProblems: string[] = [];
    if (typeof index.version !== 'number') structuralProblems.push('a numeric version is required');
    if (typeof index.providerId !== 'string' && typeof index.imageService !== 'string') {
      structuralProblems.push('a string providerId is required');
    }
    if (typeof index.images !== 'object' || index.images === null || Array.isArray(index.images)) {
      structuralProblems.push('an images object is required');
    }
    if (structuralProblems.length > 0) {
      throw new Error(
        `Invalid backup file: ${MEDIA_INDEX_PATH} cannot be imported (${structuralProblems.join('; ')}).`
      );
    }

    // Everything else the validator reports is entry-level metadata (dimensions,
    // alt text, reference paths) that does not stop the bytes being restored, so
    // it is reported rather than fatal — but never silently dropped.
    [...validation.errors, ...validation.warnings].forEach((problem) => {
      console.warn(`[SiteBackup] ${MEDIA_INDEX_PATH}: ${problem}`);
    });
    mediaIndex = index as MediaManifest;
  }

  return { manifest, secrets, mediaIndex };
}
