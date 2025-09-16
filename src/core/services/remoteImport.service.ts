// src/core/services/remoteImport.service.ts
import JSZip from 'jszip';
import type {
  LocalSiteData,
  SiteSecrets,
  Manifest,
  ParsedMarkdownFile,
  RawFile,
} from '@/core/types';
import { parseMarkdownString } from '@/core/libraries/markdownParser';
import { isTauriApp } from '@/core/utils/platform';

const SIGNUM_FOLDER = '_site';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
}

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
    let response: Response;

    if (isTauriApp()) {
      // Use Tauri HTTP plugin in desktop app
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      response = await tauriFetch(url, { method: 'GET' });
    } else {
      // Use standard fetch in browser
      response = await fetch(url, { method: 'GET' });
    }

    if (!response.ok) {
      throw new Error(`Failed to download from ${url}: ${response.status} ${response.statusText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error('Failed to download data:', error);
    throw new Error(`Failed to download from ${url}: ${(error as Error).message}`);
  }
}


/**
 * Processes a ZIP archive and extracts site data, similar to importSiteFromZip
 */
async function processSiteZip(zipData: ArrayBuffer): Promise<LocalSiteData & { imageAssetsToSave?: { [path: string]: Blob } }> {
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
  
  // Handle originals
  const originalsFolder = signumFolder.folder('assets/originals');
  if (originalsFolder) {
    for (const filename in originalsFolder.files) {
      const file = originalsFolder.files[filename];
      if (!file.dir) {
        const path = `assets/originals/${file.name.split('/').pop()}`;
        imageAssets[path] = await file.async('blob');
      }
    }
  }

  // Handle derivatives  
  const derivativesFolder = signumFolder.folder('assets/derivatives');
  if (derivativesFolder) {
    for (const filename in derivativesFolder.files) {
      const file = derivativesFolder.files[filename];
      if (!file.dir) {
        const path = `assets/derivatives/${file.name.split('/').pop()}`;
        imageAssets[path] = await file.async('blob');
      }
    }
  }

  // Images are now discovered from content - no separate manifest tracking needed
  console.log(`[ZipImport] Discovered ${Object.keys(imageAssets).length} images from content scanning`);

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
export async function importSiteFromGitHub(repoUrl: string, branch?: string): Promise<LocalSiteData & { imageAssetsToSave?: { [path: string]: Blob } }> {

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
        const content = await file.async('string');
        signumFolder.file(relativePath, content);
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