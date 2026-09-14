// src/core/services/backup/backupExport.ts

import JSZip from 'jszip';
import type { LocalSiteData } from '@/core/types';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import { isCoreTheme, isCoreLayout } from '../config/configHelpers.service';
import * as localSiteFs from '../localFileSystem.service';
import {
  CONTENT_FOLDER,
  LAYOUTS_FOLDER,
  MANIFEST_FILE,
  SECRETS_FILE,
  SIGNUM_FOLDER,
  THEMES_FOLDER,
} from './backupFormat';

/**
 * Exports a complete backup of a Sparktype site's source data into a ZIP archive.
 *
 * See `backupFormat.ts` for the archive layout, and `backupImport.ts` for the
 * reading side. Images come from storage (`getAllImageAssetsForSite`) rather
 * than from the in-memory site, so a caller does not have to have loaded them.
 */
export async function exportSiteBackup(siteData: LocalSiteData): Promise<Blob> {
  const zip = new JSZip();
  const signumFolder = zip.folder(SIGNUM_FOLDER);

  if (!signumFolder) {
    throw new Error("Failed to create root backup folder in ZIP archive.");
  }

  signumFolder.file(MANIFEST_FILE, JSON.stringify(siteData.manifest, null, 2));
  signumFolder.file(SECRETS_FILE, JSON.stringify(siteData.secrets || {}, null, 2));

  const contentFolder = signumFolder.folder(CONTENT_FOLDER);
  siteData.contentFiles?.forEach(file => {
    contentFolder?.file(
      file.path.replace(CONTENT_FOLDER, ''),
      stringifyToMarkdown(file.frontmatter, file.content)
    );
  });

  const imagesFolder = signumFolder.folder('assets/originals');
  const imageAssets = await localSiteFs.getAllImageAssetsForSite(siteData.siteId);
  for (const [path, blob] of Object.entries(imageAssets)) {
      const filename = path.split('/').pop();
      if (filename) imagesFolder?.file(filename, blob);
  }

  if (siteData.themeFiles?.length) {
    const themeName = siteData.manifest.theme.name;
    if (!isCoreTheme(themeName)) {
      const themeFolder = signumFolder.folder(`${THEMES_FOLDER}${themeName}`);
      siteData.themeFiles.forEach(file => {
        const relativePath = file.path.substring(`${THEMES_FOLDER}${themeName}/`.length);
        themeFolder?.file(relativePath, file.content);
      });
    }
  }

  if (siteData.layoutFiles?.length) {
    const layoutsFolder = signumFolder.folder(LAYOUTS_FOLDER);
    const seenLayouts = new Set<string>();
    siteData.contentFiles?.forEach(cf => {
      const layoutId = cf.frontmatter.layout;
      if (layoutId && !isCoreLayout(layoutId) && !seenLayouts.has(layoutId)) {
        const layoutFolder = layoutsFolder?.folder(layoutId);
        const layoutFiles = siteData.layoutFiles?.filter(lf => lf.path.startsWith(`${LAYOUTS_FOLDER}${layoutId}/`));
        layoutFiles?.forEach(file => {
          const relativePath = file.path.substring(`${LAYOUTS_FOLDER}${layoutId}/`.length);
          layoutFolder?.file(relativePath, file.content);
        });
        seenLayouts.add(layoutId);
      }
    });
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}
