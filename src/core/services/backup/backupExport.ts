// src/core/services/backup/backupExport.ts

import JSZip from 'jszip';
import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { isCoreTheme, isCoreLayout } from '../config/configHelpers.service';
import { generateMediaManifest } from '../images/mediaManifest.service';
import * as localSiteFs from '../localFileSystem.service';
import {
  CONTENT_FOLDER,
  DATA_FOLDER,
  LAYOUTS_FOLDER,
  MANIFEST_FILE,
  MEDIA_INDEX_FILE,
  ORIGINALS_FOLDER,
  SECRETS_FILE,
  SIGNUM_FOLDER,
  THEMES_FOLDER,
  isSafeRelativePath,
  toContentArchivePath,
  toDataArchivePath,
  toOriginalArchivePath,
} from './backupFormat';

/**
 * Exports a complete backup of a Sparktype site into a ZIP archive.
 *
 * See `backupFormat.ts` for the archive layout and contract, and
 * `backupImport.ts` for the reading side. Images and data files come from
 * storage rather than from the in-memory site, so a caller does not have to have
 * loaded them; an in-memory `dataFiles` entry wins over the stored one.
 */
export async function exportSiteBackup(siteData: LocalSiteData): Promise<Blob> {
  const zip = new JSZip();
  const signumFolder = zip.folder(SIGNUM_FOLDER);

  if (!signumFolder) {
    throw new Error("Failed to create root backup folder in ZIP archive.");
  }

  signumFolder.file(MANIFEST_FILE, JSON.stringify(siteData.manifest, null, 2));
  signumFolder.file(SECRETS_FILE, JSON.stringify(siteData.secrets || {}, null, 2));

  writeContentFiles(signumFolder, siteData.contentFiles);
  await writeSiteDataFiles(signumFolder, siteData);
  await writeOriginalImages(signumFolder, siteData.siteId);
  writeCustomThemeFiles(signumFolder, siteData);
  writeCustomLayoutFiles(signumFolder, siteData);

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

/**
 * Writes Markdown content under `_site/content/`, path preserved.
 *
 * Anything that is not a Markdown file under `content/` is refused: content
 * stores have carried archive entries (manifests, `.DS_Store`) as content files
 * after malformed imports, and those must not reach the archive.
 */
function writeContentFiles(signumFolder: JSZip, contentFiles?: ParsedMarkdownFile[]): void {
  const contentFolder = signumFolder.folder(CONTENT_FOLDER);
  contentFiles?.forEach(file => {
    const relativePath = toContentArchivePath(file.path);
    if (!relativePath) {
      console.warn(`[SiteBackup] Skipping non-content entry during export: ${file.path}`);
      return;
    }
    contentFolder?.file(relativePath, stringifyToMarkdown(file.frontmatter, file.content));
  });
}

/**
 * Writes the site's data files, including the media index restoration reads.
 *
 * The index is regenerated from the image registry with `includeOrphaned: true`:
 * a backup preserves every stored original (unlike a publish bundle, which keeps
 * only referenced images), so the index must describe all of them or import
 * cannot restore them. A failure here fails the export — an archive whose images
 * cannot be restored is not a backup.
 */
async function writeSiteDataFiles(signumFolder: JSZip, siteData: LocalSiteData): Promise<void> {
  const dataFolder = signumFolder.folder(DATA_FOLDER);
  const storedDataFiles = await localSiteFs.getAllDataFiles(siteData.siteId);

  for (const [path, content] of Object.entries({ ...storedDataFiles, ...(siteData.dataFiles ?? {}) })) {
    const relativePath = toDataArchivePath(path);
    if (!relativePath) {
      console.warn(`[SiteBackup] Skipping data file outside ${DATA_FOLDER}: ${path}`);
      continue;
    }
    if (relativePath === MEDIA_INDEX_FILE) continue; // regenerated below
    dataFolder?.file(relativePath, content);
  }

  const mediaIndex = await generateMediaManifest(siteData, { includeOrphaned: true });
  dataFolder?.file(MEDIA_INDEX_FILE, JSON.stringify(mediaIndex, null, 2));
}

/** Writes original uploads under `_site/assets/originals/`, preserving their storage path. */
async function writeOriginalImages(signumFolder: JSZip, siteId: string): Promise<void> {
  const originalsFolder = signumFolder.folder(ORIGINALS_FOLDER);
  const imageAssets = await localSiteFs.getAllImageAssetsForSite(siteId);

  for (const [path, blob] of Object.entries(imageAssets)) {
    const relativePath = toOriginalArchivePath(path);
    if (!relativePath) {
      console.warn(`[SiteBackup] Skipping stored image outside ${ORIGINALS_FOLDER}: ${path}`);
      continue;
    }
    originalsFolder?.file(relativePath, blob);
  }
}

/** Writes custom theme files. Core themes ship with the app and are never archived. */
function writeCustomThemeFiles(signumFolder: JSZip, siteData: LocalSiteData): void {
  const themeName = siteData.manifest.theme?.name;
  if (!siteData.themeFiles?.length || !themeName || isCoreTheme(themeName) || !isSafeRelativePath(themeName)) {
    return;
  }

  const themePrefix = `${THEMES_FOLDER}${themeName}/`;
  const themeFolder = signumFolder.folder(themePrefix);
  siteData.themeFiles.forEach(file => {
    const relativePath = file.path.startsWith(themePrefix) ? file.path.slice(themePrefix.length) : '';
    if (!isSafeRelativePath(relativePath)) {
      console.warn(`[SiteBackup] Skipping theme file outside ${themePrefix}: ${file.path}`);
      return;
    }
    themeFolder?.file(relativePath, file.content);
  });
}

/** Writes the custom layouts a site's content actually references. */
function writeCustomLayoutFiles(signumFolder: JSZip, siteData: LocalSiteData): void {
  if (!siteData.layoutFiles?.length) return;

  const layoutsFolder = signumFolder.folder(LAYOUTS_FOLDER);
  const seenLayouts = new Set<string>();

  siteData.contentFiles?.forEach(contentFile => {
    const layoutId = contentFile.frontmatter.layout;
    if (!layoutId || !isSafeRelativePath(layoutId) || isCoreLayout(layoutId) || seenLayouts.has(layoutId)) {
      return;
    }

    const layoutPrefix = `${LAYOUTS_FOLDER}${layoutId}/`;
    const layoutFiles = siteData.layoutFiles?.filter(file => file.path.startsWith(layoutPrefix)) ?? [];
    if (layoutFiles.length === 0) return;

    const layoutFolder = layoutsFolder?.folder(layoutId);
    layoutFiles.forEach(file => {
      const relativePath = file.path.slice(layoutPrefix.length);
      if (!isSafeRelativePath(relativePath)) return;
      layoutFolder?.file(relativePath, file.content);
    });

    seenLayouts.add(layoutId);
  });
}
