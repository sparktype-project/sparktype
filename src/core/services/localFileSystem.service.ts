// src/lib/localSiteFs.ts
import { type LocalSiteData, type ParsedMarkdownFile, type Manifest, type RawFile } from '@/core/types';
import localforage from 'localforage';
import { stringifyToMarkdown, parseMarkdownString } from '@/core/libraries/markdownParser';

const DB_NAME = 'SparktypeDB';

const siteManifestsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteManifests',
});

const siteContentFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteContentFiles',
});

const siteLayoutFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteLayoutFiles',
});

const siteThemeFilesStore = localforage.createInstance({
    name: DB_NAME,
    storeName: 'siteThemeFiles',
});

const siteImageAssetsStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteImageAssets',
});

const siteDataFilesStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteDataFiles',
});

// --- Function to load only manifests for a fast initial load ---
export async function loadAllSiteManifests(): Promise<Manifest[]> {
  const manifests: Manifest[] = [];
  
  try {
    // Add timeout to prevent IndexedDB from hanging indefinitely
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('IndexedDB operation timed out after 10 seconds')), 10000);
    });
    
    const iteratePromise = siteManifestsStore.iterate((value: Manifest) => {
      manifests.push(value);
    });
    
    await Promise.race([iteratePromise, timeoutPromise]);
  } catch (error) {
    console.error('Failed to load site manifests from IndexedDB:', error);
    
    // Attempt recovery by clearing potentially corrupted data
    if (error instanceof Error && error.message.includes('timed out')) {
      console.warn('IndexedDB appears to be corrupted. Attempting recovery...');
      await recoverIndexedDB();
    }
    
    // Return empty array to allow app to continue
  }
  
  return manifests;
}

/**
 * Attempts to recover from IndexedDB corruption by clearing all stores.
 * This is a last resort when the database becomes unresponsive.
 */
async function recoverIndexedDB(): Promise<void> {
  try {
    console.log('Starting IndexedDB recovery...');
    
    // Clear all stores to remove potential corruption
    await Promise.allSettled([
      siteManifestsStore.clear(),
      siteContentFilesStore.clear(), 
      siteLayoutFilesStore.clear(),
      siteThemeFilesStore.clear(),
      siteImageAssetsStore.clear(),
      siteDataFilesStore.clear(),
    ]);
    
    // Also clear derivative cache and secrets
    const { clearAllDerivativeCache } = await import('./images/derivativeCache.service');
    await clearAllDerivativeCache();
    
    console.log('IndexedDB recovery completed. All data has been cleared.');
    
    // Show user notification about recovery
    if (typeof window !== 'undefined' && 'toast' in window) {
      const windowWithToast = window as unknown as { toast?: { error?: (message: string) => void } };
      windowWithToast.toast?.error?.('Database corruption detected. All local data has been cleared. Please reimport your sites.');
    }
  } catch (recoveryError) {
    console.error('IndexedDB recovery failed:', recoveryError);
  }
}

/**
 * Fetches the manifest for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<Manifest | null>} A Promise that resolves to the Manifest object, or null if not found.
 */
export async function getManifestById(siteId: string): Promise<Manifest | null> {
  const manifest = await siteManifestsStore.getItem<Manifest>(siteId);
  return manifest ?? null;
}

/**
 * Fetches the content files for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<ParsedMarkdownFile[]>} A Promise that resolves to an array of parsed markdown files.
 */
export async function getSiteContentFiles(siteId: string): Promise<ParsedMarkdownFile[]> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId);
    return contentFiles ?? [];
}

/**
 * Fetches the custom layout files for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<RawFile[]>} A Promise that resolves to an array of raw layout files.
 */
export async function getSiteLayoutFiles(siteId: string): Promise<RawFile[]> {
    const layoutFiles = await siteLayoutFilesStore.getItem<RawFile[]>(siteId);
    return layoutFiles ?? [];
}

/**
 * Fetches the custom theme files for a single site by its ID.
 * @param {string} siteId The unique identifier for the site.
 * @returns {Promise<RawFile[]>} A Promise that resolves to an array of raw theme files.
 */
export async function getSiteThemeFiles(siteId: string): Promise<RawFile[]> {
    const themeFiles = await siteThemeFilesStore.getItem<RawFile[]>(siteId);
    return themeFiles ?? [];
}

export async function saveSite(siteData: LocalSiteData): Promise<void> {
  await Promise.all([
    siteManifestsStore.setItem(siteData.siteId, siteData.manifest),
    siteContentFilesStore.setItem(siteData.siteId, siteData.contentFiles ?? []),
    siteLayoutFilesStore.setItem(siteData.siteId, siteData.layoutFiles ?? []),
    siteThemeFilesStore.setItem(siteData.siteId, siteData.themeFiles ?? []),
  ]);
}

export async function deleteSite(siteId: string): Promise<void> {
  // Import required cleanup functions
  const { clearSiteDerivativeCache } = await import('./images/derivativeCache.service');
  const { deleteSiteSecretsFromDb } = await import('./siteSecrets.service');
  
  await Promise.all([
    // Core site data
    siteManifestsStore.removeItem(siteId),
    siteContentFilesStore.removeItem(siteId),
    siteLayoutFilesStore.removeItem(siteId),
    siteThemeFilesStore.removeItem(siteId),
    
    // Previously missing cleanup operations
    siteImageAssetsStore.removeItem(siteId),
    siteDataFilesStore.removeItem(siteId),
    deleteSiteSecretsFromDb(siteId),
    clearSiteDerivativeCache(siteId),
  ]);
}

export async function saveManifest(siteId: string, manifest: Manifest): Promise<void> {
    await siteManifestsStore.setItem(siteId, manifest);
}

export async function saveContentFile(siteId: string, filePath: string, rawMarkdownContent: string): Promise<ParsedMarkdownFile> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];

    const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
    const fileSlug = filePath.replace(/^content\//, '').replace(/\.md$/, '');
    const savedFile: ParsedMarkdownFile = { slug: fileSlug, path: filePath, frontmatter, content, blocks: [], hasBlocks: false };

    const fileIndex = contentFiles.findIndex(f => f.path === filePath);
    if (fileIndex > -1) {
      contentFiles[fileIndex] = savedFile;
    } else {
      contentFiles.push(savedFile);
    }

    await siteContentFilesStore.setItem(siteId, contentFiles);
    return savedFile;
}

export async function deleteContentFile(siteId: string, filePath: string): Promise<void> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    const updatedContentFiles = contentFiles.filter(f => f.path !== filePath);
    await siteContentFilesStore.setItem(siteId, updatedContentFiles);
}

export async function getContentFileRaw(siteId: string, filePath: string): Promise<string | null> {
    const allFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    const fileData = allFiles.find(f => f.path === filePath);
    if (!fileData) return null;
    
    return stringifyToMarkdown(fileData.frontmatter, fileData.content);
}

/**
 * Moves a set of content files from old paths to new paths in a single transaction.
 * @param {string} siteId - The ID of the site.
 * @param {{oldPath: string, newPath: string}[]} pathsToMove - An array of path mapping objects.
 * @returns {Promise<void>}
 */
export async function moveContentFiles(siteId: string, pathsToMove: { oldPath: string, newPath: string }[]): Promise<void> {
    const contentFiles = await siteContentFilesStore.getItem<ParsedMarkdownFile[]>(siteId) ?? [];
    
    const updatedFiles = contentFiles.map(file => {
        const moveInstruction = pathsToMove.find(p => p.oldPath === file.path);
        if (moveInstruction) {
            const newSlug = moveInstruction.newPath.replace(/^content\//, '').replace(/\.md$/, '');
            return { ...file, path: moveInstruction.newPath, slug: newSlug };
        }
        return file;
    });
    
    await siteContentFilesStore.setItem(siteId, updatedFiles);
}

/**
 * Saves a binary image asset (as a Blob) to storage for a specific site.
 * @param siteId The ID of the site.
 * @param imagePath The relative path to the image (e.g., 'assets/images/foo.jpg').
 * @param imageData The image data as a Blob.
 */
export async function saveImageAsset(siteId: string, imagePath: string, imageData: Blob): Promise<void> {
  try {
    const imageMap = await siteImageAssetsStore.getItem<Record<string, Blob>>(siteId) || {};
    
    // Ensure we have a valid Blob before storing
    if (!(imageData instanceof Blob)) {
      throw new Error(`Invalid image data: expected Blob, got ${typeof imageData}`);
    }
    
    if (imageData.size === 0) {
      throw new Error('Cannot save empty image data');
    }
    
    // Try to store the Blob directly first
    imageMap[imagePath] = imageData;
    await siteImageAssetsStore.setItem(siteId, imageMap);
  } catch (error) {
    console.error('Error saving image asset:', error);
    console.error('Site ID:', siteId);
    console.error('Image path:', imagePath);
    console.error('Image data type:', typeof imageData);
    console.error('Image data size:', imageData instanceof Blob ? imageData.size : 'N/A');
    
    // If direct Blob storage fails, try converting to ArrayBuffer as fallback
    try {
      console.warn('Direct Blob storage failed, attempting ArrayBuffer fallback...');
      const arrayBuffer = await imageData.arrayBuffer();
      const imageMap = await siteImageAssetsStore.getItem<Record<string, Blob | ArrayBuffer>>(siteId) || {};
      imageMap[imagePath] = arrayBuffer;
      await siteImageAssetsStore.setItem(siteId, imageMap);
      console.log('Successfully saved image as ArrayBuffer fallback');
    } catch (fallbackError) {
      console.error('ArrayBuffer fallback also failed:', fallbackError);
      throw new Error(`Error preparing Blob/File data to be stored in object store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Retrieves a binary image asset (as a Blob) from storage for a specific site.
 * @param siteId The ID of the site to look within.
 * @param imagePath The relative path of the image to retrieve.
 * @returns A Promise that resolves to the image Blob, or null if not found.
 */
export async function getImageAsset(siteId: string, imagePath: string): Promise<Blob | null> {

  // 1. Get the image map for the specific site.
  const imageMap = await siteImageAssetsStore.getItem<Record<string, Blob | ArrayBuffer>>(siteId);
  if (!imageMap) {
    return null; // The site has no images.
  }
  
  // 2. Get the image data from the map
  const imageData = imageMap[imagePath];
  if (!imageData) {
    return null;
  }
  
  // 3. If it's already a Blob, return it directly
  if (imageData instanceof Blob) {
    return imageData;
  }
  
  // 4. If it's an ArrayBuffer (from fallback storage), convert back to Blob
  if (imageData instanceof ArrayBuffer) {
    // We need to determine the MIME type from the file path extension
    const extension = imagePath.split('.').pop()?.toLowerCase();
    let mimeType = 'application/octet-stream'; // default
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        mimeType = 'image/jpeg';
        break;
      case 'png':
        mimeType = 'image/png';
        break;
      case 'gif':
        mimeType = 'image/gif';
        break;
      case 'webp':
        mimeType = 'image/webp';
        break;
      case 'svg':
        mimeType = 'image/svg+xml';
        break;
    }
    
    return new Blob([imageData], { type: mimeType });
  }
  
  return null;
}

/**
 * Retrieves the entire map of image paths to image Blobs for a given site.
 * @param siteId The ID of the site.
 * @returns A promise that resolves to a record mapping image paths to their Blob data.
 */
export async function getAllImageAssetsForSite(siteId: string): Promise<Record<string, Blob>> {
    const imageMap = await siteImageAssetsStore.getItem<Record<string, Blob | ArrayBuffer>>(siteId) || {};
    
    // Convert any ArrayBuffers back to Blobs for consistency
    const result: Record<string, Blob> = {};
    for (const [path, data] of Object.entries(imageMap)) {
      if (data instanceof Blob) {
        result[path] = data;
      } else if (data instanceof ArrayBuffer) {
        // Convert ArrayBuffer back to Blob with appropriate MIME type
        const extension = path.split('.').pop()?.toLowerCase();
        let mimeType = 'application/octet-stream';
        
        switch (extension) {
          case 'jpg':
          case 'jpeg':
            mimeType = 'image/jpeg';
            break;
          case 'png':
            mimeType = 'image/png';
            break;
          case 'gif':
            mimeType = 'image/gif';
            break;
          case 'webp':
            mimeType = 'image/webp';
            break;
          case 'svg':
            mimeType = 'image/svg+xml';
            break;
        }
        
        result[path] = new Blob([data], { type: mimeType });
      }
    }
    
    return result;
}

/**
 * Saves a complete map of image assets for a site.
 * This is used during the site import process to restore all images at once.
 * @param siteId The ID of the site to save images for.
 * @param assets A record mapping image paths to their Blob data.
 */
export async function saveAllImageAssetsForSite(siteId: string, assets: Record<string, Blob>): Promise<void> {
  await siteImageAssetsStore.setItem(siteId, assets);
}

/**
 * Saves a single data file (e.g., categories.json) for a site.
 * @param siteId The ID of the site.
 * @param dataFilePath The path to the data file (e.g., 'data/blog_categories.json').
 * @param content The JSON string content to save.
 */
export async function saveDataFile(siteId: string, dataFilePath: string, content: string): Promise<void> {
    const dataFileMap = await siteDataFilesStore.getItem<Record<string, string>>(siteId) || {};
    dataFileMap[dataFilePath] = content;
    await siteDataFilesStore.setItem(siteId, dataFileMap);
}

/**
 * Retrieves the content of a single data file for a site.
 * @param siteId The ID of the site.
 * @param dataFilePath The path to the data file.
 * @returns The file's content as a string, or null if not found.
 */
export async function getDataFileContent(siteId: string, dataFilePath: string): Promise<string | null> {
    const dataFileMap = await siteDataFilesStore.getItem<Record<string, string>>(siteId);
    return dataFileMap?.[dataFilePath] || null;
}

/**
 * Retrieves all data files for a site as a path-to-content map.
 * @param siteId The ID of the site.
 * @returns A record mapping data file paths to their string content.
 */
export async function getAllDataFiles(siteId: string): Promise<Record<string, string>> {
    return (await siteDataFilesStore.getItem<Record<string, string>>(siteId)) || {};
}