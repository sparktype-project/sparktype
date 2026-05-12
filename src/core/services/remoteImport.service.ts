// src/core/services/remoteImport.service.ts
import JSZip from 'jszip';
import type {
  LocalSiteData,
  SiteSecrets,
  Manifest,
  ParsedMarkdownFile,
  RawFile,
  MediaManifest,
  ThemeManifest,
  LayoutManifest,
} from '@/core/types';
import { parseMarkdownString } from '@/core/libraries/markdownParser';
import { isTauriApp } from '@/core/utils/platform';
import { importMediaManifest } from './images/mediaManifest.service';
import { flattenStructure } from './fileTree.service';
import type { AuthenticationResult, SiteAuthConfig } from './webauthn.service';

const SIGNUM_FOLDER = '_site';
const REMOTE_IMPORT_PROXY_PATH = '/.netlify/functions/remote-import';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
}

type ImportResult = LocalSiteData & { imageAssetsToSave?: { [path: string]: Blob } };
type AuthenticateSiteImport = (
  siteId: string,
  authConfig: SiteAuthConfig
) => Promise<AuthenticationResult>;

/**
 * Parses a GitHub URL to extract owner, repo, and optional branch information
 */
export function parseGitHubUrl(url: string): GitHubRepoInfo | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'github.com') {
      return null;
    }

    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length < 2) {
      return null;
    }

    const owner = pathParts[0];
    const repo = pathParts[1];
    
    // Check if there's a branch specified in the URL
    let branch: string | undefined;
    if (pathParts.length >= 4 && pathParts[2] === 'tree') {
      branch = pathParts.slice(3).join('/');
    }

    return { owner, repo, branch };
  } catch {
    return null;
  }
}

/**
 * Downloads data from a URL using appropriate fetch method (Tauri or browser)
 */
async function downloadData(url: string): Promise<ArrayBuffer> {
  try {
    const response = await fetchRemoteResponse(url);

    if (!response.ok) {
      throw new Error(`Failed to download from ${url}: ${response.status} ${response.statusText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Failed to download data:', error);
    throw new Error(`Failed to download from ${url}: ${(error as Error).message}`);
  }
}

async function fetchRemoteResponse(url: string): Promise<Response> {
  if (isTauriApp()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(url, { method: 'GET' });
  }

  if (shouldUseRemoteImportProxy(url)) {
    return fetch(`${REMOTE_IMPORT_PROXY_PATH}?url=${encodeURIComponent(url)}`, { method: 'GET' });
  }

  return fetch(url, { method: 'GET' });
}

function shouldUseRemoteImportProxy(url: string): boolean {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return false;
  }

  try {
    const targetUrl = new URL(url);
    const currentOrigin = window.location.origin;
    return targetUrl.origin !== currentOrigin && /^https?:$/.test(targetUrl.protocol);
  } catch {
    return false;
  }
}

function normalizeSiteUrl(siteUrl: string): string {
  let normalized: URL;

  try {
    normalized = new URL(siteUrl.trim());
  } catch {
    throw new Error('Invalid site URL. Please provide a valid Sparktype site URL.');
  }

  normalized.search = '';
  normalized.hash = '';

  if (!normalized.pathname.endsWith('/')) {
    normalized.pathname = `${normalized.pathname}/`;
  }

  return normalized.toString();
}

function getRemoteSiteAssetUrl(siteBaseUrl: string, relativePath: string): string {
  return new URL(relativePath, siteBaseUrl).toString();
}

async function fetchRemoteTextFile(url: string, errorMessage: string, optional = false): Promise<string | null> {
  const response = await fetchRemoteResponse(url);

  if (response.status === 404 && optional) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${errorMessage}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchRemoteBinaryFile(url: string, errorMessage: string, optional = false): Promise<ArrayBuffer | null> {
  const response = await fetchRemoteResponse(url);

  if (response.status === 404 && optional) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${errorMessage}: ${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}

function addFileToZip(zipFolder: JSZip | null, relativePath: string, content: string | ArrayBuffer): void {
  if (!zipFolder) {
    throw new Error('Failed to create site folder structure');
  }

  zipFolder.file(relativePath, content);
}

function getImportedContentPaths(manifest: Manifest): string[] {
  const structurePaths = flattenStructure(manifest.structure).map((node) => node.path);
  const collectionItemPaths = (manifest.collectionItems || []).map((item) => item.path);
  return [...new Set([...structurePaths, ...collectionItemPaths])];
}


/**
 * Processes a ZIP archive and extracts site data, similar to importSiteFromZip
 * Exported for testing purposes.
 */
export async function processSiteZip(zipData: ArrayBuffer): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(zipData);
  const signumFolder = zip.folder(SIGNUM_FOLDER);

  if (!signumFolder) {
    throw new Error(`Invalid site archive: ${SIGNUM_FOLDER} folder not found.`);
  }
  
  const manifestFile = signumFolder.file('manifest.json');
  if (!manifestFile) {
    throw new Error(`Invalid site archive: manifest.json is missing from ${SIGNUM_FOLDER} folder.`);
  }
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

  // Handle data files (e.g., media.json) FIRST to know which images to import
  let mediaManifestProcessed = false;
  const dataFolder = signumFolder.folder('data');
  if (dataFolder && manifest.dataFiles?.includes('data/media.json')) {
    const mediaJsonFile = dataFolder.file('media.json');
    if (mediaJsonFile) {
      try {
        const mediaJsonContent = await mediaJsonFile.async('string');
        const mediaManifest: MediaManifest = JSON.parse(mediaJsonContent);

        console.log(`[ZipImport] Found media.json with ${Object.keys(mediaManifest.images).length} images`);

        // Import the media manifest to rebuild the registry
        const importResult = await importMediaManifest(mediaManifest, manifest.siteId, {
          validateReferences: false, // Skip validation since we're importing
          preserveExisting: false,   // Start fresh for imports
        });

        if (importResult.success) {
          console.log(`[ZipImport] ✅ Media manifest imported: ${importResult.imagesImported} images processed`);
          mediaManifestProcessed = true;

          // Now import the actual image files listed in media.json
          console.log('[ZipImport] Importing original image files from media.json...');
          for (const imagePath of Object.keys(mediaManifest.images)) {
            const filename = imagePath.split('/').pop();
            if (!filename) continue;

            // Try to find the image file in the originals folder
            const imageFile = signumFolder.file(`assets/originals/${filename}`);
            if (imageFile && !imageFile.dir) {
              imageAssets[imagePath] = await imageFile.async('blob');
              console.log(`[ZipImport] Imported original: ${imagePath}`);
            } else {
              console.warn(`[ZipImport] Image listed in media.json not found: ${imagePath}`);
            }
          }
        } else {
          console.warn(`[ZipImport] ⚠️ Media manifest import failed:`, importResult.errors);
        }
      } catch (error) {
        console.error(`[ZipImport] ❌ Failed to process media.json:`, error);
      }
    }
  }

  // Log image import results
  const totalImages = Object.keys(imageAssets).length;
  if (mediaManifestProcessed) {
    console.log(`[ZipImport] ✅ Imported ${totalImages} original images from media.json`);
  } else {
    console.warn(`[ZipImport] ⚠️ No media.json found - no images imported. Derivatives will be regenerated on-demand.`);
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



/**
 * Imports a site from a GitHub repository
 * Downloads the repository archive and extracts the _site folder
 */
export async function importSiteFromGitHub(repoUrl: string, branch?: string): Promise<ImportResult> {

  const repoInfo = parseGitHubUrl(repoUrl);
  if (!repoInfo) {
    throw new Error('Invalid GitHub URL. Please provide a valid GitHub repository URL.');
  }

  const targetBranch = branch || repoInfo.branch || 'main';
  
  try {
    // Use GitHub's API to download repository archive
    const archiveUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/archive/refs/heads/${targetBranch}.zip`;
    
    let zipData: ArrayBuffer;
    try {
      zipData = await downloadData(archiveUrl);
    } catch {
      // If main branch doesn't exist, try master
      if (targetBranch === 'main') {
        const masterUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/archive/refs/heads/master.zip`;
        zipData = await downloadData(masterUrl);
      } else {
        throw new Error(`Branch '${targetBranch}' not found`);
      }
    }

    // GitHub archives come with a root folder named {repo}-{branch}
    // We need to look for the _site folder within this structure
    const zip = await JSZip.loadAsync(zipData);
    
    // Find the repository root folder
    const rootFolderName = Object.keys(zip.files).find(name => 
      name.endsWith('/') && name.includes(`${repoInfo.repo}-`)
    );
    
    if (!rootFolderName) {
      throw new Error('Could not find repository root folder in GitHub archive');
    }

    // Look for _site folder within the repository
    const siteFolderPath = `${rootFolderName}${SIGNUM_FOLDER}/`;
    const hasSiteFolder = Object.keys(zip.files).some(name => name.startsWith(siteFolderPath));
    
    if (!hasSiteFolder) {
      throw new Error(`No ${SIGNUM_FOLDER} folder found in the repository. Make sure the repository contains a built Sparktype site.`);
    }

    // Create a new zip with just the _site folder contents, restructured to match expected format
    const newZip = new JSZip();
    const signumFolder = newZip.folder(SIGNUM_FOLDER);

    if (!signumFolder) {
      throw new Error('Failed to create site folder structure');
    }

    // Copy files from GitHub archive to new structure
    for (const [path, file] of Object.entries(zip.files)) {
      if (path.startsWith(siteFolderPath) && !file.dir) {
        const relativePath = path.substring(siteFolderPath.length);

        // Handle binary files (images) vs text files
        if (relativePath.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf)$/i)) {
          const content = await file.async('arraybuffer');
          signumFolder.file(relativePath, content);
        } else {
          const content = await file.async('string');
          signumFolder.file(relativePath, content);
        }
      }
    }

    // Generate the restructured zip
    const restructuredZipData = await newZip.generateAsync({ 
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return await processSiteZip(restructuredZipData);
  } catch (error) {
    throw new Error(`Failed to import site from GitHub: ${(error as Error).message}`);
  }
}

export async function importSiteFromUrl(
  siteUrl: string,
  authenticate?: AuthenticateSiteImport
): Promise<ImportResult> {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const zip = new JSZip();
  const siteFolder = zip.folder(SIGNUM_FOLDER);

  try {
    const manifestUrl = getRemoteSiteAssetUrl(normalizedSiteUrl, `${SIGNUM_FOLDER}/manifest.json`);
    const manifestContent = await fetchRemoteTextFile(
      manifestUrl,
      'Failed to fetch _site/manifest.json'
    );

    if (!manifestContent) {
      throw new Error('Failed to fetch _site/manifest.json');
    }

    let manifest: Manifest;
    try {
      manifest = JSON.parse(manifestContent) as Manifest;
    } catch (error) {
      throw new Error(`Invalid _site/manifest.json: ${(error as Error).message}`);
    }

    if (!manifest.siteId || !manifest.title || !manifest.theme?.name) {
      throw new Error('Invalid _site/manifest.json: missing required Sparktype site fields.');
    }

    addFileToZip(siteFolder, 'manifest.json', manifestContent);

    if (manifest.auth?.requiresAuth) {
      if (!authenticate) {
        throw new Error('This site is protected and requires passkey authentication before import.');
      }

      const authResult = await authenticate(manifest.siteId, manifest.auth);
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }
    }

    const contentPaths = getImportedContentPaths(manifest);
    if (contentPaths.length === 0) {
      throw new Error('No content files were referenced by the imported site manifest.');
    }

    const layoutIds = new Set<string>();
    for (const contentPath of contentPaths) {
      const contentUrl = getRemoteSiteAssetUrl(normalizedSiteUrl, `${SIGNUM_FOLDER}/${contentPath}`);
      const content = await fetchRemoteTextFile(
        contentUrl,
        `Failed to fetch required content file "${contentPath}"`
      );

      if (!content) {
        throw new Error(`Failed to fetch required content file "${contentPath}"`);
      }

      addFileToZip(siteFolder, contentPath, content);

      const parsed = parseMarkdownString(content);
      if (parsed.frontmatter.layout && typeof parsed.frontmatter.layout === 'string') {
        layoutIds.add(parsed.frontmatter.layout);
      }
    }

    const themeName = manifest.theme.name;
    const themeManifestPath = `themes/${themeName}/theme.json`;
    const themeManifestUrl = getRemoteSiteAssetUrl(normalizedSiteUrl, `${SIGNUM_FOLDER}/${themeManifestPath}`);
    const themeManifestContent = await fetchRemoteTextFile(
      themeManifestUrl,
      `Failed to fetch theme manifest for "${themeName}"`
    );

    if (!themeManifestContent) {
      throw new Error(`Failed to fetch theme manifest for "${themeName}"`);
    }

    addFileToZip(siteFolder, themeManifestPath, themeManifestContent);

    let themeManifest: ThemeManifest;
    try {
      themeManifest = JSON.parse(themeManifestContent) as ThemeManifest;
    } catch (error) {
      throw new Error(`Invalid theme manifest for "${themeName}": ${(error as Error).message}`);
    }

    for (const file of themeManifest.files || []) {
      if (file.path === 'theme.json') continue;

      const themeFilePath = `themes/${themeName}/${file.path}`;
      const themeFileUrl = getRemoteSiteAssetUrl(normalizedSiteUrl, `${SIGNUM_FOLDER}/${themeFilePath}`);
      const themeFileContent = await fetchRemoteTextFile(
        themeFileUrl,
        `Failed to fetch theme file "${themeFilePath}"`
      );

      if (!themeFileContent) {
        throw new Error(`Failed to fetch theme file "${themeFilePath}"`);
      }

      addFileToZip(siteFolder, themeFilePath, themeFileContent);
    }

    for (const layoutId of layoutIds) {
      const layoutManifestPath = `themes/${themeName}/layouts/${layoutId}/layout.json`;
      const layoutManifestUrl = getRemoteSiteAssetUrl(normalizedSiteUrl, `${SIGNUM_FOLDER}/${layoutManifestPath}`);
      const layoutManifestContent = await fetchRemoteTextFile(
        layoutManifestUrl,
        `Failed to fetch layout manifest for "${layoutId}"`
      );

      if (!layoutManifestContent) {
        throw new Error(`Failed to fetch layout manifest for "${layoutId}"`);
      }

      addFileToZip(siteFolder, layoutManifestPath, layoutManifestContent);

      let layoutManifest: LayoutManifest;
      try {
        layoutManifest = JSON.parse(layoutManifestContent) as LayoutManifest;
      } catch (error) {
        throw new Error(`Invalid layout manifest for "${layoutId}": ${(error as Error).message}`);
      }

      for (const file of layoutManifest.files || []) {
        if (file.path === 'layout.json') continue;

        const layoutFilePath = `themes/${themeName}/layouts/${layoutId}/${file.path}`;
        const layoutFileUrl = getRemoteSiteAssetUrl(normalizedSiteUrl, `${SIGNUM_FOLDER}/${layoutFilePath}`);
        const layoutFileContent = await fetchRemoteTextFile(
          layoutFileUrl,
          `Failed to fetch layout file "${layoutFilePath}"`
        );

        if (!layoutFileContent) {
          throw new Error(`Failed to fetch layout file "${layoutFilePath}"`);
        }

        addFileToZip(siteFolder, layoutFilePath, layoutFileContent);
      }
    }

    const secretsPath = 'secrets.json';
    const secretsContent = await fetchRemoteTextFile(
      getRemoteSiteAssetUrl(normalizedSiteUrl, `${SIGNUM_FOLDER}/${secretsPath}`),
      'Failed to fetch _site/secrets.json',
      true
    );
    if (secretsContent) {
      addFileToZip(siteFolder, secretsPath, secretsContent);
    }

    const mediaManifestPath = 'data/media.json';
    const mediaManifestContent = await fetchRemoteTextFile(
      getRemoteSiteAssetUrl(normalizedSiteUrl, `${SIGNUM_FOLDER}/${mediaManifestPath}`),
      'Failed to fetch _site/data/media.json',
      true
    );

    if (mediaManifestContent) {
      addFileToZip(siteFolder, mediaManifestPath, mediaManifestContent);

      try {
        const mediaManifest = JSON.parse(mediaManifestContent) as MediaManifest;
        for (const imagePath of Object.keys(mediaManifest.images || {})) {
          const filename = imagePath.split('/').pop();
          if (!filename) continue;

          const binaryContent = await fetchRemoteBinaryFile(
            getRemoteSiteAssetUrl(normalizedSiteUrl, `${SIGNUM_FOLDER}/assets/originals/${filename}`),
            `Failed to fetch image asset "${imagePath}"`,
            true
          );

          if (binaryContent) {
            addFileToZip(siteFolder, `assets/originals/${filename}`, binaryContent);
          }
        }
      } catch (error) {
        console.warn('[UrlImport] Failed to parse media.json, continuing without original image fetch:', error);
      }
    }

    const restructuredZipData = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return processSiteZip(restructuredZipData);
  } catch (error) {
    throw new Error(`Failed to import site from URL: ${(error as Error).message}`);
  }
}
