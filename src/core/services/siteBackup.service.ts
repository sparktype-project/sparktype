// src/core/services/siteBackup.service.ts
import JSZip from 'jszip';
import type  {
  LocalSiteData,
  SiteSecrets,
  Manifest,
  ParsedMarkdownFile,
  RawFile,
} from '@/core/types';
import { stringifyToMarkdown, parseMarkdownString } from '@/core/libraries/markdownParser';
import { isCoreTheme, isCoreLayout } from './config/configHelpers.service';
import * as localSiteFs from './localFileSystem.service';

const SIGNUM_FOLDER = '_site';

/**
 * Exports a complete backup of a Sparktype site's source data into a ZIP archive.
 * This function's logic is sound and does not require changes.
 */
export async function exportSiteBackup(siteData: LocalSiteData): Promise<Blob> {
  const zip = new JSZip();
  const signumFolder = zip.folder(SIGNUM_FOLDER);

  if (!signumFolder) {
    throw new Error("Failed to create root backup folder in ZIP archive.");
  }

  signumFolder.file('manifest.json', JSON.stringify(siteData.manifest, null, 2));
  signumFolder.file('secrets.json', JSON.stringify(siteData.secrets || {}, null, 2));

  const contentFolder = signumFolder.folder('content');
  siteData.contentFiles?.forEach(file => {
    contentFolder?.file(
      file.path.replace('content/', ''),
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
      const themeFolder = signumFolder.folder(`themes/${themeName}`);
      siteData.themeFiles.forEach(file => {
        const relativePath = file.path.substring(`themes/${themeName}/`.length);
        themeFolder?.file(relativePath, file.content);
      });
    }
  }
  
  if (siteData.layoutFiles?.length) {
    const layoutsFolder = signumFolder.folder('layouts');
    const seenLayouts = new Set<string>();
    siteData.contentFiles?.forEach(cf => {
      const layoutId = cf.frontmatter.layout;
      if (layoutId && !isCoreLayout(layoutId) && !seenLayouts.has(layoutId)) {
        const layoutFolder = layoutsFolder?.folder(layoutId);
        const layoutFiles = siteData.layoutFiles?.filter(lf => lf.path.startsWith(`layouts/${layoutId}/`));
        layoutFiles?.forEach(file => {
          const relativePath = file.path.substring(`layouts/${layoutId}/`.length);
          layoutFolder?.file(relativePath, file.content);
        });
        seenLayouts.add(layoutId);
      }
    });
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

/**
 * Parses a ZIP backup file and reconstructs the site data in memory.
 * This function now uses the correct asynchronous pattern for reading files from the archive.
 */
export async function importSiteFromZip(zipFile: File): Promise<LocalSiteData & { imageAssetsToSave?: { [path: string]: Blob } }> {
    const zip = await JSZip.loadAsync(zipFile);
    const signumFolder = zip.folder(SIGNUM_FOLDER);

    if (!signumFolder) throw new Error("Invalid backup file: _site folder not found.");
    
    const manifestFile = signumFolder.file('manifest.json');
    if (!manifestFile) throw new Error("Invalid backup file: manifest.json is missing.");
    const manifest: Manifest = JSON.parse(await manifestFile.async('string'));

    const secretsFile = signumFolder.file('secrets.json');
    const secrets: SiteSecrets = secretsFile ? JSON.parse(await secretsFile.async('string')) : {};

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
    signumFolder.folder('themes')?.forEach((_relativePath, fileObject) => {
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
    signumFolder.folder('layouts')?.forEach((_relativePath, fileObject) => {
        if (!fileObject.dir) {
            const promise = fileObject.async('string').then(content => ({
                path: fileObject.name.replace(`${SIGNUM_FOLDER}/`, ''),
                content: content,
            }));
            layoutPromises.push(promise);
        }
    });
    const layoutFiles = await Promise.all(layoutPromises);

    const imageAssets: { [path: string]: Blob } = {};

    // IMPORTANT: Only import ORIGINAL images listed in media.json
    // Derivatives will be regenerated automatically on-demand
    // This ensures siteImageAssetsStore only contains user-uploaded originals
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