// src/core/services/images/imageCleanup.service.ts

import type { LocalSiteData } from '@/core/types';
import { deleteImageAsset, getAllImageAssetsForSite } from '@/core/services/localFileSystem.service';
import { listBlobPaths } from '@/core/services/storage/siteStorage.service';
import { getAllCustomThemeFiles } from '@/core/services/assetStorage.service';
import { getAvailableThemes, isCoreTheme } from '@/core/services/config/configHelpers.service';
import { findImagesInContentFile, findImagesInObject } from './imageReferenceFinder.service';
import { getCachedDerivative, removeCachedDerivative } from './derivativeCache.service';
import { getOrphanedImages, removeImageFromRegistry, getImageUsageStats as getRegistryImageStats } from './imageRegistry.service';
import { ensureImageRegistry, validateAndRepairRegistry } from './registryMigration.service';

/** Deadline for the post-deletion derivative listing; matches the cache's own listing budget. */
const DERIVATIVE_LISTING_TIMEOUT_MS = 10_000;

/**
 * Result of an image cleanup operation
 */
export interface CleanupResult {
  originalImagesRemoved: number;
  derivativesRemoved: number;
  /** Sum of the sizes of the blobs that were confirmed deleted, and only those. */
  bytesFreed: number;
  /** Image and derivative paths whose deletion failed and that were therefore left in place. */
  failures: string[];
  cleanupLog: string[];
}

/**
 * Collects every image the site currently references, from the places the reference finder parses:
 * content frontmatter and inline markdown, and the manifest.
 */
function collectLiveImageReferences(siteData: LocalSiteData): Set<string> {
  const references = new Set<string>();

  siteData.contentFiles?.forEach((file) => {
    findImagesInContentFile(file).forEach((imagePath) => references.add(imagePath));
  });
  findImagesInObject(siteData.manifest).forEach((imagePath) => references.add(imagePath));

  return references;
}

/**
 * The reason cleanup must not delete anything, or `null` when the site's reference set is known.
 *
 * Both an absent and an empty content list refuse. `contentFiles` is absent on a site the store has
 * only ever been given a manifest for (`initializeSites`), and an empty array is what
 * `getSiteContentFiles` returns when storage holds no content array — a state a half-finished
 * restore or a cleared content key also produces. Nothing here can tell those apart from a site
 * that genuinely has no content, and in each of them the registry repair would zero every
 * reference, so the honest answer is to refuse. Shared so cleanup and the preview agree.
 */
function describeUnsafeReferenceSet(siteData: LocalSiteData): string | null {
  if (siteData.contentFiles?.length) {
    return null;
  }
  return siteData.contentFiles ? 'empty' : 'not loaded';
}

/**
 * The text of every file that can reference an image but that the reference finder does not parse.
 *
 * A rendered partial emits `<img src="assets/…" data-sparktype-asset="true">` and the renderer
 * resolves that path straight out of storage, so an image that only a template mentions is still in
 * use even though no content file names it. Such a path appears in Handlebars source in no
 * structured shape, so a literal mention is the only signal available — and the failure modes are
 * asymmetric: a false positive keeps a file that might have been deletable, a false negative
 * deletes an image a page still renders.
 *
 * The templates that actually render come from the `customThemeFiles` store, not from
 * `siteData.themeFiles`: `getThemeAssetContent` → `getAssetContent` serves core themes from
 * `/public` and every custom theme from `assetStorage.getCustomThemeFileContent`
 * (`configHelpers.service.ts:88-115`). A theme imported as a bundle lives only in that store
 * (`themeImport.service.ts:236`), so it is the one that protects real sites.
 * `siteData.themeFiles`/`layoutFiles` are scanned too — they carry the import/backup payload — and
 * the data files because layouts render their values.
 */
async function collectTemplateText(siteData: LocalSiteData): Promise<string> {
  const importedFiles = [...(siteData.layoutFiles ?? []), ...(siteData.themeFiles ?? [])];
  const parts = importedFiles.map((file) => file.content);

  const customThemes = getAvailableThemes(siteData.manifest).filter((theme) => !isCoreTheme(theme.path));
  const themeBundles = await Promise.all(
    customThemes.map((theme) => getAllCustomThemeFiles(siteData.siteId, theme.path)),
  );
  themeBundles.forEach((bundle) => {
    Object.values(bundle).forEach((fileContent) => {
      if (typeof fileContent === 'string') {
        parts.push(fileContent);
      }
    });
  });

  parts.push(...Object.values(siteData.dataFiles ?? {}));

  return parts.join('\n');
}

/**
 * Splits the orphans the registry reports into the ones that are safe to delete and the ones the
 * site still references.
 *
 * The registry supplies the candidates, but it is not the authority on whether an image is in use:
 * its references are written by `syncImageReferences`, which swallows its own failures, and the
 * validator rewrites them from the same scan used here. So every candidate is re-checked against
 * the site's own files — parsed content and manifest references, and literal mentions in the
 * templates and data files the parser does not reach. Deletion requires both sources to agree that
 * nothing references the image; anything else keeps its blob and its registry record.
 */
async function partitionReferencedOrphans(
  siteData: LocalSiteData,
  orphanedOriginals: string[],
): Promise<{ deletable: string[]; stillReferenced: string[] }> {
  const parsedReferences = collectLiveImageReferences(siteData);
  const templateText = await collectTemplateText(siteData);

  const deletable: string[] = [];
  const stillReferenced: string[] = [];

  for (const imagePath of orphanedOriginals) {
    if (parsedReferences.has(imagePath) || templateText.includes(imagePath)) {
      stillReferenced.push(imagePath);
    } else {
      deletable.push(imagePath);
    }
  }

  return { deletable, stillReferenced };
}

/**
 * Fallback cleanup that only removes obvious orphans when registry is unavailable.
 * This is much safer than the old complex approach.
 */
async function fallbackCleanup(siteData: LocalSiteData, log: string[]): Promise<CleanupResult> {
  log.push(`[ImageCleanup] Using fallback cleanup mode (registry unavailable)`);

  try {
    // In fallback mode, we only clean up images that are clearly unused
    // We skip derivatives entirely to avoid complex path inference
    const allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
    const storedPaths = Object.keys(allStoredImages);

    log.push(`[ImageCleanup] Found ${storedPaths.length} stored images in fallback mode`);

    // For now, don't remove anything in fallback mode - just report what we have
    // This is the safest approach when we can't reliably determine usage
    const result: CleanupResult = {
      originalImagesRemoved: 0,
      derivativesRemoved: 0,
      bytesFreed: 0,
      failures: [],
      cleanupLog: [...log, `[ImageCleanup] Fallback mode: no images removed (safety measure)`]
    };

    log.push(`[ImageCleanup] Fallback cleanup complete - no changes made for safety`);
    return result;

  } catch (error) {
    log.push(`[ImageCleanup] Fallback cleanup also failed: ${error}`);
    throw new Error(`Both registry and fallback cleanup failed: ${error}`);
  }
}

/**
 * Calculates the total size of blobs in bytes.
 * 
 * @param blobs Array of Blob objects to measure
 * @returns Total size in bytes
 * 
 * @example
 * const size = await calculateBlobSizes([blob1, blob2]);
 * // Returns: 2048576 (2MB in bytes)
 */
async function calculateBlobSizes(blobs: Blob[]): Promise<number> {
  return blobs.reduce((total, blob) => total + blob.size, 0);
}

/**
 * Deletes the stored blobs of orphaned originals and then drops each one's registry record.
 *
 * The registry record comes out only after its blob is confirmed gone. The registry is the only
 * description of what exists, so dropping a record while the blob survives is what makes an
 * interrupted cleanup unrecoverable: the blob is then invisible to every registry-based pass and
 * is re-adopted by the next registry rebuild. An original whose deletion fails keeps its record
 * and contributes nothing to `bytesFreed`.
 */
async function deleteOrphanedOriginals(
  siteId: string,
  orphanedOriginals: string[],
  storedImages: Record<string, Blob>,
  log: string[],
): Promise<{ removed: number; bytesFreed: number; failures: string[] }> {
  let removed = 0;
  let bytesFreed = 0;
  const failures: string[] = [];

  for (const imagePath of orphanedOriginals) {
    const blob = storedImages[imagePath];

    if (!blob) {
      // A registry entry whose bytes never landed (an import whose image was not restored).
      // There is nothing to free, so this is a registry repair rather than a deletion.
      log.push(`[ImageCleanup] No stored blob for registry entry ${imagePath}; dropped the record without counting a deletion`);
      try {
        await removeImageFromRegistry(siteId, imagePath);
      } catch (error) {
        log.push(`[ImageCleanup] Failed to drop registry entry ${imagePath}: ${error}`);
      }
      continue;
    }

    try {
      await deleteImageAsset(siteId, imagePath);
    } catch (error) {
      failures.push(imagePath);
      log.push(`[ImageCleanup] Failed to delete orphaned original ${imagePath}; its registry entry was kept: ${error}`);
      console.error(`[ImageCleanup] Failed to delete orphaned original ${imagePath}:`, error);
      continue;
    }

    try {
      await removeImageFromRegistry(siteId, imagePath);
    } catch (error) {
      // The blob is gone, so the deletion stands. A leftover record is pruned by the next
      // registry repair, and dropping it from the count here would understate what was freed.
      log.push(`[ImageCleanup] Deleted ${imagePath} but could not drop its registry entry: ${error}`);
    }

    removed += 1;
    bytesFreed += blob.size;
    log.push(`[ImageCleanup] Deleted orphaned original: ${imagePath} (${blob.size} bytes)`);
  }

  return { removed, bytesFreed, failures };
}

/**
 * Deletes the cache entries of orphaned derivatives.
 *
 * Sizes come from the cache, but the verdict on whether a removal happened comes from one listing
 * of the derivative namespace taken after every removal: `getCachedDerivative` reports a read
 * error and a 2s timeout as "absent", so it cannot tell a deleted derivative from an unreadable
 * one, and the OPFS backend swallows removal errors. Only derivatives the listing no longer
 * contains are counted, which is also what makes a repeated cleanup report zero.
 *
 * A listing that fails or times out leaves every removal unverified: nothing is counted and every
 * candidate is reported as a failure. The alternative — letting the rejection escape to cleanup's
 * catch — would run the fallback path and discard the counts for the originals already deleted in
 * this same run, telling a user who just lost files that nothing happened.
 */
async function deleteOrphanedDerivatives(
  siteId: string,
  orphanedDerivatives: string[],
  log: string[],
): Promise<{ removed: number; bytesFreed: number; failures: string[] }> {
  const failures: string[] = [];
  const sizes = new Map<string, number>();

  for (const derivativePath of orphanedDerivatives) {
    const cacheKey = `${siteId}/${derivativePath}`;

    try {
      const blob = await getCachedDerivative(cacheKey);
      if (blob) {
        sizes.set(derivativePath, blob.size);
      }

      await removeCachedDerivative(cacheKey);
    } catch (error) {
      failures.push(derivativePath);
      log.push(`[ImageCleanup] Failed to delete orphaned derivative ${derivativePath}: ${error}`);
      console.warn(`[ImageCleanup] Failed to remove derivative ${derivativePath}:`, error);
    }
  }

  let remaining: Set<string>;
  try {
    // Same deadline the derivative cache itself puts on this call. It rejects rather than falling
    // back to an empty list, which here would read as "every derivative was deleted".
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Listing derivatives timed out after ${DERIVATIVE_LISTING_TIMEOUT_MS}ms`)), DERIVATIVE_LISTING_TIMEOUT_MS);
    });
    remaining = new Set(await Promise.race([listBlobPaths('derivatives', siteId), timeout]));
  } catch (error) {
    const unverified = orphanedDerivatives.filter((path) => !failures.includes(path));
    log.push(
      `[ImageCleanup] Could not list the derivative namespace, so ${unverified.length} derivative ` +
      `deletion(s) are unverified and no bytes are counted as freed: ${error}`
    );
    console.error('[ImageCleanup] Failed to list derivatives after deletion:', error);
    return { removed: 0, bytesFreed: 0, failures: [...failures, ...unverified] };
  }

  let removed = 0;
  let bytesFreed = 0;

  for (const derivativePath of orphanedDerivatives) {
    if (remaining.has(derivativePath)) {
      if (!failures.includes(derivativePath)) {
        failures.push(derivativePath);
        log.push(`[ImageCleanup] Failed to delete orphaned derivative ${derivativePath}: it is still cached`);
      }
      continue;
    }

    const size = sizes.get(derivativePath);
    if (size === undefined) {
      log.push(`[ImageCleanup] Orphaned derivative ${derivativePath} was already absent`);
      continue;
    }

    removed += 1;
    bytesFreed += size;
    log.push(`[ImageCleanup] Deleted orphaned derivative: ${derivativePath} (${size} bytes)`);
  }

  return { removed, bytesFreed, failures };
}

/**
 * Removes images that nothing references any more, from storage and from the registry.
 *
 * This is destructive: it deletes stored originals. It is only ever called by an explicit user
 * action (or a storage repair), never by a build — an export must not delete a site's images.
 *
 * Deletion is gated three ways, because the mistake is permanent:
 * - the site's content must be loaded, or the reference set is unknown and nothing is deleted;
 * - the registry supplies candidates only, after being reconciled against storage and content;
 * - every candidate is re-checked against the site's own files, including the layout, theme and
 *   data files the reference parser does not reach.
 *
 * A deleted image's registry record is dropped only after the blob is confirmed gone.
 *
 * @param siteData The complete site data to clean up
 * @returns Promise resolving to cleanup results with metrics and logs
 *
 * @example
 * const result = await cleanupOrphanedImages(siteData);
 * console.log(`Freed ${(result.bytesFreed / 1024 / 1024).toFixed(2)} MB of ${result.originalImagesRemoved} images`);
 */
export async function cleanupOrphanedImages(siteData: LocalSiteData): Promise<CleanupResult> {
  const log: string[] = [];

  log.push(`[ImageCleanup] Starting registry-based cleanup for site: ${siteData.siteId}`);

  try {
    const unsafeReferenceSet = describeUnsafeReferenceSet(siteData);
    if (unsafeReferenceSet) {
      log.push(
        `[ImageCleanup] The site's content files are ${unsafeReferenceSet}, so the reference set is ` +
        `unknown; refusing to delete anything`
      );
      return {
        originalImagesRemoved: 0,
        derivativesRemoved: 0,
        bytesFreed: 0,
        failures: [],
        cleanupLog: log,
      };
    }

    // Reconcile before deciding anything: this drops registry records whose blob is gone and
    // refreshes `referencedIn` from the site's current content, so the orphan set below is
    // computed against what the site actually contains. Its failures are only logged — the
    // freshly scanned references are re-checked against every deletion regardless.
    const repair = await validateAndRepairRegistry(siteData);
    repair.issues.forEach((issue) => log.push(`[ImageCleanup] Registry repair: ${issue}`));

    const { orphanedOriginals, orphanedDerivatives } = await getOrphanedImages(siteData.siteId);
    log.push(`[ImageCleanup] Found ${orphanedOriginals.length} orphaned originals, ${orphanedDerivatives.length} orphaned derivatives`);

    const { deletable: deletableOriginals, stillReferenced } = await partitionReferencedOrphans(
      siteData,
      orphanedOriginals,
    );
    stillReferenced.forEach((imagePath) => {
      log.push(
        `[ImageCleanup] Skipping ${imagePath}: the registry has no references for it, but the site still references it. ` +
        `Its registry entry was kept.`
      );
    });

    const storedImages = deletableOriginals.length > 0
      ? await getAllImageAssetsForSite(siteData.siteId)
      : {};

    const originals = await deleteOrphanedOriginals(siteData.siteId, deletableOriginals, storedImages, log);
    const derivatives = await deleteOrphanedDerivatives(siteData.siteId, orphanedDerivatives, log);

    const bytesFreed = originals.bytesFreed + derivatives.bytesFreed;
    const failures = [...originals.failures, ...derivatives.failures];

    log.push(
      `[ImageCleanup] Cleanup complete. Deleted ${originals.removed} of ${orphanedOriginals.length} orphaned originals and ` +
      `${derivatives.removed} of ${orphanedDerivatives.length} orphaned derivatives, freeing ` +
      `${(bytesFreed / 1024 / 1024).toFixed(2)} MB` +
      (failures.length > 0 ? `; ${failures.length} deletion(s) failed and were left in place` : '')
    );

    return {
      originalImagesRemoved: originals.removed,
      derivativesRemoved: derivatives.removed,
      bytesFreed,
      failures,
      cleanupLog: log,
    };

  } catch (error) {
    log.push(`[ImageCleanup] Registry-based cleanup failed: ${error}`);
    console.error('[ImageCleanup] Registry-based cleanup failed:', error);

    // Fall back to safe cleanup mode
    return await fallbackCleanup(siteData, log);
  }
}

/**
 * Performs a dry run cleanup using the registry to show what would be cleaned.
 *
 * This is much faster and more reliable than the old approach since it uses
 * explicit registry data instead of complex inference.
 *
 * @param siteData The site data to analyze
 * @returns Promise with preview results including paths and estimated storage savings
 *
 * @example
 * const preview = await previewCleanup(siteData);
 * if (preview.orphanedOriginals.length > 0) {
 *   const mb = (preview.estimatedBytesFreed / 1024 / 1024).toFixed(1);
 *   console.log(`Would free ${mb} MB by removing ${preview.orphanedOriginals.length} images`);
 * }
 */
export async function previewCleanup(siteData: LocalSiteData): Promise<{
  orphanedOriginals: string[];
  orphanedDerivatives: string[];
  estimatedBytesFreed: number;
}> {
  try {
    // Agree with cleanup: when the reference set is unknown, cleanup deletes nothing, so the
    // preview must not advertise savings for a run that will do nothing.
    const unsafeReferenceSet = describeUnsafeReferenceSet(siteData);
    if (unsafeReferenceSet) {
      console.warn(
        `[ImageCleanup] Preview: the site's content files are ${unsafeReferenceSet}, so the reference ` +
        `set is unknown and cleanup would delete nothing`
      );
      return { orphanedOriginals: [], orphanedDerivatives: [], estimatedBytesFreed: 0 };
    }

    // Ensure registry is available
    await ensureImageRegistry(siteData);

    // Get orphaned images from registry, then apply the same reference veto that cleanup applies:
    // nothing the site's files still reference is reported as deletable.
    const { orphanedOriginals: registryOrphans, orphanedDerivatives } = await getOrphanedImages(siteData.siteId);
    const { deletable: orphanedOriginals } = await partitionReferencedOrphans(siteData, registryOrphans);

    // Estimate bytes that would be freed
    let estimatedBytes = 0;

    // Calculate size of orphaned originals
    if (orphanedOriginals.length > 0) {
      try {
        const allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
        const orphanedBlobs = orphanedOriginals
          .map(path => allStoredImages[path])
          .filter(blob => blob && blob instanceof Blob);
        estimatedBytes += await calculateBlobSizes(orphanedBlobs);
      } catch (error) {
        console.error('[ImageCleanup] Error calculating orphaned original sizes:', error);
      }
    }

    // Calculate size of orphaned derivatives
    if (orphanedDerivatives.length > 0) {
      try {
        const derivativeBlobs: Blob[] = [];
        for (const derivativePath of orphanedDerivatives) {
          try {
            const cacheKey = `${siteData.siteId}/${derivativePath}`;
            const blob = await getCachedDerivative(cacheKey);
            if (blob && blob instanceof Blob) {
              derivativeBlobs.push(blob);
            }
          } catch (error) {
            console.warn(`[ImageCleanup] Error accessing derivative ${derivativePath}:`, error);
          }
        }
        estimatedBytes += await calculateBlobSizes(derivativeBlobs);
      } catch (error) {
        console.error('[ImageCleanup] Error calculating orphaned derivative sizes:', error);
      }
    }

    return {
      orphanedOriginals,
      orphanedDerivatives,
      estimatedBytesFreed: estimatedBytes
    };
  } catch (error) {
    console.error('[ImageCleanup] Error in previewCleanup:', error);
    return {
      orphanedOriginals: [],
      orphanedDerivatives: [],
      estimatedBytesFreed: 0
    };
  }
}

/**
 * Gets comprehensive statistics about image usage for a site using the registry.
 *
 * This is now much faster since it uses explicit registry data instead of
 * complex analysis and recursive traversal.
 *
 * @param siteData The site data to analyze
 * @returns Promise with complete image usage statistics
 *
 * @example
 * const stats = await getImageUsageStats(siteData);
 * const efficiencyPct = (stats.referencedImages / stats.totalOriginalImages * 100).toFixed(1);
 * console.log(`Storage efficiency: ${efficiencyPct}% (${stats.referencedImages}/${stats.totalOriginalImages} images used)`);
 * console.log(`Total storage: ${(stats.totalStorageBytes / 1024 / 1024).toFixed(2)} MB`);
 */
export async function getImageUsageStats(siteData: LocalSiteData): Promise<{
  totalOriginalImages: number;
  totalDerivatives: number;
  referencedImages: number;
  orphanedOriginals: number;
  orphanedDerivatives: number;
  totalStorageBytes: number;
}> {
  try {
    // Use the registry-based stats which are much faster and more reliable
    const registryStats = await getRegistryImageStats(siteData.siteId);
    return {
      ...registryStats,
      totalStorageBytes: registryStats.totalRegistryBytes,
    };
  } catch (error) {
    console.error('[ImageCleanup] Registry-based stats failed, falling back to basic counts:', error);

    // Fallback to basic storage counts if registry fails
    try {
      const allStoredImages = await getAllImageAssetsForSite(siteData.siteId);
      const originalBlobs = Object.values(allStoredImages);
      const totalStorageBytes = await calculateBlobSizes(originalBlobs);

      return {
        totalOriginalImages: Object.keys(allStoredImages).length,
        totalDerivatives: 0, // Unknown in fallback mode
        referencedImages: 0, // Unknown in fallback mode
        orphanedOriginals: 0, // Unknown in fallback mode
        orphanedDerivatives: 0, // Unknown in fallback mode
        totalStorageBytes
      };
    } catch (fallbackError) {
      console.error('[ImageCleanup] Both registry and fallback stats failed:', fallbackError);
      return {
        totalOriginalImages: 0,
        totalDerivatives: 0,
        referencedImages: 0,
        orphanedOriginals: 0,
        orphanedDerivatives: 0,
        totalStorageBytes: 0
      };
    }
  }
}