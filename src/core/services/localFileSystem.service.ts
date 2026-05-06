import localforage from 'localforage';
import { type LocalSiteData, type ParsedMarkdownFile, type Manifest, type RawFile } from '@/core/types';
import { stringifyToMarkdown, parseMarkdownString } from '@/core/libraries/markdownParser';
import {
  clearBlobNamespace,
  getStorageHealth,
  listBlobPaths,
  listMetadataValues,
  markStorageHealth,
  readBlob,
  readMetadata,
  removeBlob,
  removeMetadata,
  withSiteOperation,
  writeBlob,
  writeMetadata,
} from '@/core/services/storage/siteStorage.service';

const DB_NAME = 'SparktypeDB';
const LEGACY_IMAGE_ASSET_STORE = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteImageAssets',
});
const LEGACY_MANIFEST_STORE = localforage.createInstance({
  name: DB_NAME,
  storeName: 'siteManifests',
});

const STORE_NAMES = {
  manifests: 'siteManifests',
  content: 'siteContentFiles',
  layouts: 'siteLayoutFiles',
  themes: 'siteThemeFiles',
  dataFiles: 'siteDataFiles',
} as const;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Storage operation timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function extractStoredValue<T>(value: unknown): T | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && value !== null && 'value' in value) {
    return (value as { value: T }).value;
  }

  return value as T;
}

function isManifest(value: unknown): value is Manifest {
  return typeof value === 'object' && value !== null && 'siteId' in value && 'title' in value;
}

function getImageMimeTypeFromPath(imagePath: string): string {
  const extension = imagePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function ensureBlob(imageData: Blob | ArrayBuffer, imagePath: string): Blob {
  if (imageData instanceof Blob) {
    return imageData;
  }

  return new Blob([imageData], { type: getImageMimeTypeFromPath(imagePath) });
}

async function migrateLegacyImageAssetsForSite(siteId: string): Promise<Record<string, Blob>> {
  const legacyMap = (await LEGACY_IMAGE_ASSET_STORE.getItem<Record<string, Blob | ArrayBuffer>>(siteId)) || {};
  const migrated: Record<string, Blob> = {};

  await Promise.all(
    Object.entries(legacyMap).map(async ([path, data]) => {
      const blob = ensureBlob(data, path);
      migrated[path] = blob;
      await writeBlob('images', siteId, path, blob);
    })
  );

  return migrated;
}

export async function loadAllSiteManifests(): Promise<Manifest[]> {
  const manifestsFromLegacyStore: Manifest[] = [];

  try {
    await withTimeout(
      LEGACY_MANIFEST_STORE.iterate((value: unknown) => {
        const extracted = extractStoredValue<Manifest>(value);
        if (isManifest(extracted)) {
          manifestsFromLegacyStore.push(extracted);
        }
      }),
      4000
    );

    if (manifestsFromLegacyStore.length > 0) {
      return manifestsFromLegacyStore;
    }
  } catch (error) {
    console.warn('Legacy manifest scan failed, trying metadata path:', error);
  }

  try {
    return await withTimeout(listMetadataValues<Manifest>(STORE_NAMES.manifests), 4000);
  } catch (error) {
    await markStorageHealth(
      'degraded',
      'Failed to enumerate site manifests',
      error instanceof Error ? error.message : String(error),
      'metadata'
    );
    console.error('Failed to load site manifests from storage:', error);
    return manifestsFromLegacyStore;
  }
}

export async function getManifestById(siteId: string): Promise<Manifest | null> {
  return readMetadata<Manifest>(STORE_NAMES.manifests, siteId);
}

export async function getSiteContentFiles(siteId: string): Promise<ParsedMarkdownFile[]> {
  return (await readMetadata<ParsedMarkdownFile[]>(STORE_NAMES.content, siteId)) ?? [];
}

export async function getSiteLayoutFiles(siteId: string): Promise<RawFile[]> {
  return (await readMetadata<RawFile[]>(STORE_NAMES.layouts, siteId)) ?? [];
}

export async function getSiteThemeFiles(siteId: string): Promise<RawFile[]> {
  return (await readMetadata<RawFile[]>(STORE_NAMES.themes, siteId)) ?? [];
}

export async function saveSite(siteData: LocalSiteData): Promise<void> {
  await withSiteOperation(siteData.siteId, 'site-save', async () => {
    await Promise.all([
      writeMetadata(STORE_NAMES.manifests, siteData.siteId, siteData.manifest),
      writeMetadata(STORE_NAMES.content, siteData.siteId, siteData.contentFiles ?? []),
      writeMetadata(STORE_NAMES.layouts, siteData.siteId, siteData.layoutFiles ?? []),
      writeMetadata(STORE_NAMES.themes, siteData.siteId, siteData.themeFiles ?? []),
    ]);
  });
}

export async function deleteSite(siteId: string): Promise<void> {
  const { clearSiteDerivativeCache } = await import('./images/derivativeCache.service');
  const { deleteSiteSecretsFromDb } = await import('./siteSecrets.service');
  const { deleteImageRegistry } = await import('./images/imageRegistry.service');
  const { deleteCustomAssetsForSite } = await import('./assetStorage.service');
  const { gitSyncService } = await import('./publishing/gitSync.service');

  await withSiteOperation(siteId, 'site-delete', async () => {
    await Promise.all([
      removeMetadata(STORE_NAMES.manifests, siteId),
      removeMetadata(STORE_NAMES.content, siteId),
      removeMetadata(STORE_NAMES.layouts, siteId),
      removeMetadata(STORE_NAMES.themes, siteId),
      removeMetadata(STORE_NAMES.dataFiles, siteId),
      deleteSiteSecretsFromDb(siteId),
      deleteImageRegistry(siteId),
      deleteCustomAssetsForSite(siteId),
      gitSyncService.clearSyncState(siteId),
      clearBlobNamespace('images', siteId),
      clearSiteDerivativeCache(siteId),
      LEGACY_IMAGE_ASSET_STORE.removeItem(siteId),
    ]);
  });
}

export async function saveManifest(siteId: string, manifest: Manifest): Promise<void> {
  await withSiteOperation(siteId, 'manifest-save', async () => {
    await writeMetadata(STORE_NAMES.manifests, siteId, manifest);
  }, { title: manifest.title });
}

export async function saveContentFile(siteId: string, filePath: string, rawMarkdownContent: string): Promise<ParsedMarkdownFile> {
  return withSiteOperation(siteId, 'content-save', async () => {
    const contentFiles = (await readMetadata<ParsedMarkdownFile[]>(STORE_NAMES.content, siteId)) ?? [];
    const { frontmatter, content } = parseMarkdownString(rawMarkdownContent);
    const fileSlug = filePath.replace(/^content\//, '').replace(/\.md$/, '');
    const savedFile: ParsedMarkdownFile = { slug: fileSlug, path: filePath, frontmatter, content };

    const fileIndex = contentFiles.findIndex((file) => file.path === filePath);
    if (fileIndex > -1) {
      contentFiles[fileIndex] = savedFile;
    } else {
      contentFiles.push(savedFile);
    }

    await writeMetadata(STORE_NAMES.content, siteId, contentFiles);
    return savedFile;
  }, { filePath });
}

export async function deleteContentFile(siteId: string, filePath: string): Promise<void> {
  await withSiteOperation(siteId, 'content-delete', async () => {
    const contentFiles = (await readMetadata<ParsedMarkdownFile[]>(STORE_NAMES.content, siteId)) ?? [];
    const updatedContentFiles = contentFiles.filter((file) => file.path !== filePath);
    await writeMetadata(STORE_NAMES.content, siteId, updatedContentFiles);
  }, { filePath });
}

export async function getContentFileRaw(siteId: string, filePath: string): Promise<string | null> {
  const allFiles = (await readMetadata<ParsedMarkdownFile[]>(STORE_NAMES.content, siteId)) ?? [];
  const fileData = allFiles.find((file) => file.path === filePath);
  if (!fileData) {
    return null;
  }

  return stringifyToMarkdown(fileData.frontmatter, fileData.content);
}

export async function moveContentFiles(siteId: string, pathsToMove: { oldPath: string; newPath: string }[]): Promise<void> {
  await withSiteOperation(siteId, 'content-move', async () => {
    const contentFiles = (await readMetadata<ParsedMarkdownFile[]>(STORE_NAMES.content, siteId)) ?? [];

    const updatedFiles = contentFiles.map((file) => {
      const moveInstruction = pathsToMove.find((pathMapping) => pathMapping.oldPath === file.path);
      if (!moveInstruction) {
        return file;
      }

      const newSlug = moveInstruction.newPath.replace(/^content\//, '').replace(/\.md$/, '');
      return { ...file, path: moveInstruction.newPath, slug: newSlug };
    });

    await writeMetadata(STORE_NAMES.content, siteId, updatedFiles);
  }, { count: pathsToMove.length });
}

export async function saveImageAsset(siteId: string, imagePath: string, imageData: Blob): Promise<void> {
  if (!(imageData instanceof Blob)) {
    throw new Error(`Invalid image data: expected Blob, got ${typeof imageData}`);
  }

  if (imageData.size === 0) {
    throw new Error('Cannot save empty image data');
  }

  await withSiteOperation(siteId, 'image-upload', async () => {
    await writeBlob('images', siteId, imagePath, imageData);
  }, { imagePath, sizeBytes: imageData.size });
}

export async function getImageAsset(siteId: string, imagePath: string): Promise<Blob | null> {
  const storedBlob = await readBlob('images', siteId, imagePath);
  if (storedBlob) {
    return storedBlob;
  }

  const legacyMap = await LEGACY_IMAGE_ASSET_STORE.getItem<Record<string, Blob | ArrayBuffer>>(siteId);
  const legacyData = legacyMap?.[imagePath];
  if (!legacyData) {
    return null;
  }

  const migrated = ensureBlob(legacyData, imagePath);
  await writeBlob('images', siteId, imagePath, migrated);
  return migrated;
}

export async function getAllImageAssetsForSite(siteId: string): Promise<Record<string, Blob>> {
  const storedPaths = await listBlobPaths('images', siteId);
  const result: Record<string, Blob> = {};

  await Promise.all(
    storedPaths.map(async (path) => {
      const blob = await readBlob('images', siteId, path);
      if (blob) {
        result[path] = blob;
      }
    })
  );

  const legacyAssets = await migrateLegacyImageAssetsForSite(siteId);
  for (const [path, blob] of Object.entries(legacyAssets)) {
    if (!result[path]) {
      result[path] = blob;
    }
  }

  return result;
}

export async function saveAllImageAssetsForSite(siteId: string, assets: Record<string, Blob>): Promise<void> {
  await withSiteOperation(siteId, 'image-bulk-import', async () => {
    await Promise.all(
      Object.entries(assets).map(async ([path, blob]) => {
        await writeBlob('images', siteId, path, blob);
      })
    );
  }, { count: Object.keys(assets).length });
}

export async function deleteImageAsset(siteId: string, imagePath: string): Promise<void> {
  await withSiteOperation(siteId, 'image-delete', async () => {
    await removeBlob('images', siteId, imagePath);
  }, { imagePath });
}

export async function saveDataFile(siteId: string, dataFilePath: string, content: string): Promise<void> {
  const dataFileMap = (await readMetadata<Record<string, string>>(STORE_NAMES.dataFiles, siteId)) ?? {};
  dataFileMap[dataFilePath] = content;
  await writeMetadata(STORE_NAMES.dataFiles, siteId, dataFileMap);
}

export async function getDataFileContent(siteId: string, dataFilePath: string): Promise<string | null> {
  const dataFileMap = await readMetadata<Record<string, string>>(STORE_NAMES.dataFiles, siteId);
  return dataFileMap?.[dataFilePath] || null;
}

export async function getAllDataFiles(siteId: string): Promise<Record<string, string>> {
  return (await readMetadata<Record<string, string>>(STORE_NAMES.dataFiles, siteId)) ?? {};
}

export { getStorageHealth };
