// src/core/services/backup/backupImport.ts

import type {
  LocalSiteData,
  ParsedMarkdownFile,
  RawFile,
} from '@/core/types';
import { parseMarkdownString } from '@/core/libraries/markdownParser';
import type JSZip from 'jszip';
import { loadBackupArchive, readBackupHeader } from './backupValidation';
import {
  CONTENT_FOLDER,
  LAYOUTS_FOLDER,
  SIGNUM_FOLDER,
  THEMES_FOLDER,
} from './backupFormat';

/** Site data plus the original images the caller must persist alongside it. */
export type ImportedSiteData = LocalSiteData & { imageAssetsToSave?: { [path: string]: Blob } };

/**
 * Parses a ZIP backup file and reconstructs the site data in memory.
 *
 * Reading is side-effect free: nothing is written to storage here, so a caller
 * can validate an archive before deciding to replace an existing site.
 */
export async function importSiteFromZip(zipFile: File): Promise<ImportedSiteData> {
    const zip = await loadBackupArchive(zipFile);
    const { manifest, secrets } = await readBackupHeader(zip);

    const signumFolder = zip.folder(SIGNUM_FOLDER);
    if (!signumFolder) throw new Error(`Invalid backup file: ${SIGNUM_FOLDER} folder not found.`);

    const contentFiles: ParsedMarkdownFile[] = [];
    const contentFolder = signumFolder.folder('content');
    if (contentFolder) {
        for (const relativePath in contentFolder.files) {
            const file = contentFolder.files[relativePath];
            if (!file.dir && typeof file.name === 'string') {
                const fullPath = file.name.replace(`${SIGNUM_FOLDER}/`, '');
                const rawContent = await file.async('string');
                const { frontmatter, content } = parseMarkdownString(rawContent);
                const slug = fullPath.substring(fullPath.lastIndexOf('/') + 1).replace('.md', '');
                contentFiles.push({ path: fullPath, slug, frontmatter, content });
            }
        }
    }


    const themePromises: Promise<RawFile>[] = [];
    signumFolder.folder(THEMES_FOLDER)?.forEach((_relativePath, fileObject) => {
        if (!fileObject.dir) {
            const promise = fileObject.async('string').then(content => ({
                path: fileObject.name.replace(`${SIGNUM_FOLDER}/`, ''),
                content: content,
            }));
            themePromises.push(promise);
        }
    });
    const themeFiles = await Promise.all(themePromises);

    const layoutPromises: Promise<RawFile>[] = [];
    signumFolder.folder(LAYOUTS_FOLDER)?.forEach((_relativePath, fileObject) => {
        if (!fileObject.dir) {
            const promise = fileObject.async('string').then(content => ({
                path: fileObject.name.replace(`${SIGNUM_FOLDER}/`, ''),
                content: content,
            }));
            layoutPromises.push(promise);
        }
    });
    const layoutFiles = await Promise.all(layoutPromises);

    const imageAssets: { [path: string]: Blob } = await readOriginalImages(signumFolder);

    return {
        siteId: manifest.siteId,
        manifest,
        secrets,
        contentFiles,
        themeFiles,
        layoutFiles,
        imageAssetsToSave: imageAssets,
    };
}

/**
 * Reads original images.
 *
 * IMPORTANT: Only import ORIGINAL images listed in media.json.
 * Derivatives will be regenerated automatically on-demand
 * This ensures siteImageAssetsStore only contains user-uploaded originals
 */
async function readOriginalImages(signumFolder: JSZip): Promise<{ [path: string]: Blob }> {
    const imageAssets: { [path: string]: Blob } = {};

    const mediaFile = signumFolder.file('data/media.json');
    if (mediaFile) {
        try {
            const mediaContent = await mediaFile.async('string');
            const mediaManifest = JSON.parse(mediaContent);

            console.log('[SiteBackup] Importing images from media.json...');

            // Import only originals listed in media.json
            if (mediaManifest.images && typeof mediaManifest.images === 'object') {
                for (const imagePath of Object.keys(mediaManifest.images)) {
                    // Extract filename from path (e.g., "assets/originals/photo.jpg" -> "photo.jpg")
                    const filename = imagePath.split('/').pop();
                    if (!filename) continue;

                    // Try to find the image file in the originals folder
                    const imageFile = signumFolder.file(`assets/originals/${filename}`);
                    if (imageFile && !imageFile.dir) {
                        imageAssets[imagePath] = await imageFile.async('blob');
                        console.log(`[SiteBackup] Imported original: ${imagePath}`);
                    } else {
                        console.warn(`[SiteBackup] Image listed in media.json not found: ${imagePath}`);
                    }
                }
            }

            console.log(`[SiteBackup] Imported ${Object.keys(imageAssets).length} original images from media.json`);
        } catch (error) {
            console.error('[SiteBackup] Failed to parse media.json, skipping image import:', error);
        }
    } else {
        console.warn('[SiteBackup] No media.json found, skipping image import');
    }

    return imageAssets;
}
