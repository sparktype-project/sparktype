// src/core/services/backup/backupImport.ts

import type JSZip from 'jszip';
import type { JSZipObject } from 'jszip';
import type {
  LocalSiteData,
  MediaManifest,
  ParsedMarkdownFile,
  RawFile,
} from '@/core/types';
import { parseMarkdownString } from '@/core/libraries/markdownParser';
import { loadBackupArchive, readBackupHeader } from './backupValidation';
import {
  CONTENT_FOLDER,
  DATA_FOLDER,
  LAYOUTS_FOLDER,
  MEDIA_INDEX_PATH,
  ORIGINALS_FOLDER,
  SIGNUM_FOLDER,
  THEMES_FOLDER,
  contentSlug,
  isSafeRelativePath,
  isSupportedContentEntry,
  toOriginalArchivePath,
  toOriginalStoragePath,
} from './backupFormat';

/** Site data plus the original images the caller must persist alongside it. */
export type ImportedSiteData = LocalSiteData & { imageAssetsToSave?: { [path: string]: Blob } };

/** An archive entry with the site-relative path it maps back to. */
interface ArchiveEntry {
  sitePath: string;
  entry: JSZipObject;
}

/**
 * Parses a ZIP backup file and reconstructs the site data in memory.
 *
 * Reading is side-effect free: nothing is written to storage, so a caller can
 * validate an archive before deciding whether to replace an existing site. The
 * header is validated before any entry is extracted, and a damaged archive
 * throws rather than restoring a partial site.
 */
export async function importSiteFromZip(zipFile: File): Promise<ImportedSiteData> {
  const zip = await loadBackupArchive(zipFile);
  const { manifest, secrets, mediaIndex } = await readBackupHeader(zip);

  const [contentFiles, themeFiles, layoutFiles, dataFiles, imageAssetsToSave] = await Promise.all([
    readContentFiles(zip),
    readTextFolder(zip, THEMES_FOLDER),
    readTextFolder(zip, LAYOUTS_FOLDER),
    readDataFiles(zip),
    // The media index decides which originals to restore; an archive without one
    // predates the index and is restored through the legacy path.
    mediaIndex ? readIndexedOriginals(zip, mediaIndex) : readLegacyOriginals(zip),
  ]);

  return {
    siteId: manifest.siteId,
    manifest,
    secrets,
    contentFiles,
    themeFiles,
    layoutFiles,
    dataFiles,
    imageAssetsToSave,
  };
}

/**
 * Non-directory entries of an archive folder, each with the site-relative path
 * it maps back to (`_site/content/about/team.md` becomes `content/about/team.md`).
 *
 * JSZip's `folder().files` map is archive-global — iterating it yields every
 * entry in the archive, including `manifest.json` and root-level files — so all
 * reads go through the folder-scoped `forEach` here and drop unsafe paths.
 */
function collectFolderEntries(zip: JSZip, folder: string): ArchiveEntry[] {
  const root = zip.folder(`${SIGNUM_FOLDER}/${folder}`);
  const entries: ArchiveEntry[] = [];

  root?.forEach((relativePath, entry) => {
    if (entry.dir || !isSafeRelativePath(relativePath)) return;
    entries.push({ sitePath: `${folder}${relativePath}`, entry });
  });

  return entries;
}

/**
 * Reads Markdown content from `_site/content/` only. Anything else in the folder
 * (a stray `.DS_Store`, a resolved conflict, a non-Markdown asset) is reported
 * and skipped rather than becoming a content file.
 */
async function readContentFiles(zip: JSZip): Promise<ParsedMarkdownFile[]> {
  const entries: ArchiveEntry[] = [];
  for (const entry of collectFolderEntries(zip, CONTENT_FOLDER)) {
    if (isSupportedContentEntry(entry.sitePath)) {
      entries.push(entry);
    } else {
      console.warn(`[SiteBackup] Skipping unsupported content entry: ${entry.sitePath}`);
    }
  }

  return Promise.all(
    entries.map(async ({ sitePath, entry }) => {
      const { frontmatter, content } = parseMarkdownString(await entry.async('string'));
      return { path: sitePath, slug: contentSlug(sitePath), frontmatter, content };
    })
  );
}

/** Reads every text entry of an archive folder (`themes/`, `layouts/`). */
async function readTextFolder(zip: JSZip, folder: string): Promise<RawFile[]> {
  return Promise.all(
    collectFolderEntries(zip, folder).map(async ({ sitePath, entry }) => ({
      path: sitePath,
      content: await entry.async('string'),
    }))
  );
}

/**
 * Reads `_site/data/` into site-relative paths (`data/media.json`), including
 * the media index, so a restored site keeps its image metadata and references.
 */
async function readDataFiles(zip: JSZip): Promise<Record<string, string>> {
  const resolved = await Promise.all(
    collectFolderEntries(zip, DATA_FOLDER).map(
      async ({ sitePath, entry }) => [sitePath, await entry.async('string')] as const
    )
  );

  const dataFiles: Record<string, string> = {};
  for (const [sitePath, content] of resolved) {
    dataFiles[sitePath] = content;
  }
  return dataFiles;
}

/** Originals present in the archive, keyed by their path inside `assets/originals/`. */
function collectOriginals(zip: JSZip): { relativePath: string; entry: JSZipObject }[] {
  return collectFolderEntries(zip, ORIGINALS_FOLDER).map(({ sitePath, entry }) => ({
    relativePath: sitePath.slice(ORIGINALS_FOLDER.length),
    entry,
  }));
}

/**
 * Restores the originals the media index lists, keyed by the index's own image
 * path so metadata and bytes stay aligned. A listed image the archive does not
 * carry, and an archived original the index does not list, are both reported.
 */
async function readIndexedOriginals(zip: JSZip, mediaIndex: MediaManifest): Promise<{ [path: string]: Blob }> {
  const imageAssets: { [path: string]: Blob } = {};
  const listedPaths = new Set<string>();

  for (const imagePath of Object.keys(mediaIndex.images ?? {})) {
    const relativePath = toOriginalArchivePath(imagePath);
    if (!relativePath) {
      console.warn(`[SiteBackup] Image listed in media.json is not an original: ${imagePath}`);
      continue;
    }
    listedPaths.add(relativePath);

    const entry = zip.file(`${SIGNUM_FOLDER}/${ORIGINALS_FOLDER}${relativePath}`);
    if (!entry || entry.dir) {
      console.warn(`[SiteBackup] Image listed in media.json not found: ${imagePath}`);
      continue;
    }
    imageAssets[imagePath] = await entry.async('blob');
  }

  for (const { relativePath } of collectOriginals(zip)) {
    if (!listedPaths.has(relativePath)) {
      console.warn(`[SiteBackup] Original not listed in media.json, skipping: ${toOriginalStoragePath(relativePath)}`);
    }
  }

  return imageAssets;
}

/**
 * Restores a legacy archive: one written before the media index existed, so its
 * originals are discovered from the archive itself and keyed by their own path
 * under `assets/originals/`. Nothing is inferred from content references — the
 * rule is positional and deliberate.
 */
async function readLegacyOriginals(zip: JSZip): Promise<{ [path: string]: Blob }> {
  const entries = collectOriginals(zip);
  const imageAssets: { [path: string]: Blob } = {};

  await Promise.all(
    entries.map(async ({ relativePath, entry }) => {
      imageAssets[toOriginalStoragePath(relativePath)] = await entry.async('blob');
    })
  );

  console.warn(
    `[SiteBackup] Legacy backup without ${MEDIA_INDEX_PATH}: restoring ${entries.length} originals from ${SIGNUM_FOLDER}/${ORIGINALS_FOLDER}`
  );
  return imageAssets;
}
