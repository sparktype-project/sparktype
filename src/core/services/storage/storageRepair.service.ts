import type { LocalSiteData } from '@/core/types';
import { clearSiteDerivativeCache } from '@/core/services/images/derivativeCache.service';
import { getAllImageAssetsForSite } from '@/core/services/localFileSystem.service';
import { cleanupOrphanedImages } from '@/core/services/images/imageCleanup.service';
import { createEmptyRegistry, getImageRegistry, saveImageRegistry } from '@/core/services/images/imageRegistry.service';
import { findImagesInContentFile } from '@/core/services/images/imageReferenceFinder.service';
import { markStorageHealth, resetStorageHealth } from './siteStorage.service';

export interface StorageRepairResult {
  repaired: boolean;
  issues: string[];
  actions: string[];
}

function collectReferencedImages(siteData: LocalSiteData): Map<string, string[]> {
  const referencedImages = new Map<string, string[]>();

  siteData.contentFiles?.forEach((file) => {
    const refs = findImagesInContentFile(file);
    refs.forEach((imagePath) => {
      const existing = referencedImages.get(imagePath) || [];
      existing.push(file.path);
      referencedImages.set(imagePath, existing);
    });
  });

  const manifestImages = [siteData.manifest.logo, siteData.manifest.favicon].filter(Boolean);
  manifestImages.forEach((imageRef, index) => {
    if (!imageRef) return;
    const key = index === 0 ? 'manifest.logo' : 'manifest.favicon';
    const existing = referencedImages.get(imageRef.src) || [];
    existing.push(key);
    referencedImages.set(imageRef.src, existing);
  });

  return referencedImages;
}

export async function rebuildImageRegistryFromStorage(siteData: LocalSiteData): Promise<StorageRepairResult> {
  const storedImages = await getAllImageAssetsForSite(siteData.siteId);
  const referencedImages = collectReferencedImages(siteData);
  const registry = createEmptyRegistry(siteData.siteId);

  for (const [imagePath, blob] of Object.entries(storedImages)) {
    registry.images[imagePath] = {
      originalPath: imagePath,
      derivativePaths: [],
      referencedIn: referencedImages.get(imagePath) || [],
      lastAccessed: Date.now(),
      sizeBytes: blob.size,
      createdAt: Date.now(),
    };
  }

  await saveImageRegistry(registry);
  await resetStorageHealth();

  return {
    repaired: true,
    issues: [],
    actions: ['Rebuilt image registry from stored originals and content references.'],
  };
}

export async function reconcileImageStorage(siteData: LocalSiteData): Promise<StorageRepairResult> {
  const issues: string[] = [];
  const actions: string[] = [];
  let repaired = false;

  try {
    const registry = await getImageRegistry(siteData.siteId);
    const storedImages = await getAllImageAssetsForSite(siteData.siteId);
    const referencedImages = collectReferencedImages(siteData);

    for (const [imagePath, blob] of Object.entries(storedImages)) {
      if (!registry.images[imagePath]) {
        registry.images[imagePath] = {
          originalPath: imagePath,
          derivativePaths: [],
          referencedIn: referencedImages.get(imagePath) || [],
          lastAccessed: Date.now(),
          sizeBytes: blob.size,
          createdAt: Date.now(),
        };
        repaired = true;
        issues.push(`Missing registry entry for ${imagePath}`);
      }
    }

    for (const [imagePath, metadata] of Object.entries(registry.images)) {
      if (!storedImages[imagePath]) {
        delete registry.images[imagePath];
        repaired = true;
        issues.push(`Registry entry without source blob: ${imagePath}`);
        continue;
      }

      metadata.referencedIn = referencedImages.get(imagePath) || [];
      metadata.lastAccessed = Date.now();
    }

    if (repaired) {
      await saveImageRegistry(registry);
      actions.push('Reconciled registry entries with stored original images.');
    }

    const cleanup = await cleanupOrphanedImages(siteData);
    if (cleanup.derivativesRemoved > 0 || cleanup.originalImagesRemoved > 0) {
      repaired = true;
      actions.push(`Pruned ${cleanup.originalImagesRemoved} orphaned originals and ${cleanup.derivativesRemoved} orphaned derivatives.`);
    }

    if (!repaired) {
      await resetStorageHealth();
    }

    return { repaired, issues, actions };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markStorageHealth('needs-repair', 'Image storage reconciliation failed', message, 'blobs');
    return {
      repaired: false,
      issues: [message],
      actions,
    };
  }
}

export async function resetDerivativeStorage(siteId: string): Promise<void> {
  await clearSiteDerivativeCache(siteId);
}
