// src/core/services/images/imageHealth.service.ts

import { getAllImageAssetsForSite } from '../localFileSystem.service';
import { getAllCacheKeys } from './derivativeCache.service';
import { getMediaManifest } from './mediaManifest.service';

/**
 * Health check result structure
 */
export interface ImageHealthResult {
  status: 'healthy' | 'warning' | 'error';
  issues: string[];
  metrics: {
    originalsCount: number;
    derivativesCount: number;
    totalStorageMB: number;
    orphanedInStorage: number;
    missingFromStorage: number;
  };
}

/**
 * Pattern for identifying derivative image filenames
 * Format: {name}_w{width}_h{height}_c-{crop}_g-{gravity}.{ext}
 * Example: image_w600_h400_c-fill_g-center.jpg
 */
const DERIVATIVE_PATTERN = /_w(auto|\d+)_h(auto|\d+)_c-[^_]+_g-[^_]+/;

/**
 * Calculates total size of blobs in megabytes
 */
function calculateStorageSize(blobs: Record<string, Blob>): number {
  const totalBytes = Object.values(blobs).reduce(
    (sum, blob) => sum + (blob?.size || 0),
    0
  );
  return totalBytes / (1024 * 1024); // Convert to MB
}

/**
 * Comprehensive health check for image storage architecture.
 *
 * Verifies:
 * 1. No derivatives in originals store (siteImageAssetsStore)
 * 2. Cache keys follow proper naming convention
 * 3. media.json is in sync with storage
 * 4. No orphaned or missing images
 *
 * @param siteId The site ID to check
 * @returns Health check results with status, issues, and metrics
 *
 * @example
 * const health = await checkImageStorageHealth('my-site-123');
 * if (health.status === 'error') {
 *   console.error('Critical issues:', health.issues);
 * }
 */
export async function checkImageStorageHealth(siteId: string): Promise<ImageHealthResult> {
  const issues: string[] = [];

  try {
    // Check 1: Verify no derivatives in originals store
    console.log('[ImageHealth] Checking originals store...');
    const originals = await getAllImageAssetsForSite(siteId);
    const originalPaths = Object.keys(originals);

    for (const path of originalPaths) {
      const filename = path.split('/').pop() || '';
      if (DERIVATIVE_PATTERN.test(filename)) {
        issues.push(`❌ CRITICAL: Derivative found in originals store: ${path}`);
      }
    }

    // Check 2: Verify all originals are in assets/originals/ path
    for (const path of originalPaths) {
      if (!path.startsWith('assets/originals/')) {
        issues.push(`⚠️  WARNING: Unexpected path format: ${path}`);
      }
    }

    // Check 3: Verify cache keys follow convention
    console.log('[ImageHealth] Checking derivative cache...');
    const cacheKeys = await getAllCacheKeys(siteId);

    for (const key of cacheKeys) {
      // Must start with siteId prefix
      if (!key.startsWith(`${siteId}/`)) {
        issues.push(`❌ CRITICAL: Invalid cache key format (missing siteId prefix): ${key}`);
      }

      // Must have derivative parameters in filename
      if (!DERIVATIVE_PATTERN.test(key)) {
        issues.push(`⚠️  WARNING: Cache key doesn't match derivative pattern: ${key}`);
      }
    }

    // Check 4: Verify media.json sync with storage
    console.log('[ImageHealth] Checking media.json sync...');
    try {
      const mediaManifest = await getMediaManifest(siteId);
      const mediaPaths = Object.keys(mediaManifest.images || {});

      // Find orphaned images (in storage but not in media.json)
      const orphanedInStorage = originalPaths.filter(p => !mediaPaths.includes(p));
      if (orphanedInStorage.length > 0) {
        issues.push(`⚠️  ${orphanedInStorage.length} image(s) in storage but not in media.json`);
        console.log('[ImageHealth] Orphaned images:', orphanedInStorage);
      }

      // Find missing images (in media.json but not in storage)
      const missingFromStorage = mediaPaths.filter(p => !originalPaths.includes(p));
      if (missingFromStorage.length > 0) {
        issues.push(`❌ ERROR: ${missingFromStorage.length} image(s) in media.json but missing from storage`);
        console.log('[ImageHealth] Missing images:', missingFromStorage);
      }

      // Calculate metrics
      const totalStorageMB = calculateStorageSize(originals);

      const result: ImageHealthResult = {
        status: issues.some(i => i.startsWith('❌ CRITICAL')) ? 'error' :
                issues.some(i => i.startsWith('❌ ERROR')) ? 'error' :
                issues.length > 0 ? 'warning' : 'healthy',
        issues,
        metrics: {
          originalsCount: originalPaths.length,
          derivativesCount: cacheKeys.length,
          totalStorageMB: parseFloat(totalStorageMB.toFixed(2)),
          orphanedInStorage: orphanedInStorage.length,
          missingFromStorage: missingFromStorage.length
        }
      };

      console.log('[ImageHealth] Check complete:', result.status);
      return result;

    } catch (mediaError) {
      issues.push(`❌ ERROR: Failed to read media.json: ${mediaError}`);

      // Return partial results
      return {
        status: 'error',
        issues,
        metrics: {
          originalsCount: originalPaths.length,
          derivativesCount: cacheKeys.length,
          totalStorageMB: parseFloat(calculateStorageSize(originals).toFixed(2)),
          orphanedInStorage: 0,
          missingFromStorage: 0
        }
      };
    }

  } catch (error) {
    console.error('[ImageHealth] Health check failed:', error);
    return {
      status: 'error',
      issues: [`❌ CRITICAL: Health check failed: ${error}`],
      metrics: {
        originalsCount: 0,
        derivativesCount: 0,
        totalStorageMB: 0,
        orphanedInStorage: 0,
        missingFromStorage: 0
      }
    };
  }
}

/**
 * Quick diagnostic check that can be called from browser console.
 * Logs results in a formatted way.
 *
 * @param siteId The site ID to check
 *
 * @example
 * // In browser console:
 * await __checkImageHealth('my-site-123')
 */
export async function diagnoseImageHealth(siteId: string): Promise<void> {
  console.log('🏥 Starting Image Storage Health Check...');
  console.log(`Site ID: ${siteId}`);
  console.log('─'.repeat(50));

  const result = await checkImageStorageHealth(siteId);

  // Format output
  const statusEmoji = {
    'healthy': '✅',
    'warning': '⚠️ ',
    'error': '❌'
  };

  console.log(`\nStatus: ${statusEmoji[result.status]} ${result.status.toUpperCase()}\n`);

  if (result.issues.length > 0) {
    console.log('Issues Found:');
    result.issues.forEach(issue => console.log(`  ${issue}`));
    console.log('');
  } else {
    console.log('✅ No issues found!\n');
  }

  console.log('Metrics:');
  console.log(`  Originals: ${result.metrics.originalsCount} images`);
  console.log(`  Derivatives: ${result.metrics.derivativesCount} cached`);
  console.log(`  Storage: ${result.metrics.totalStorageMB} MB`);
  if (result.metrics.orphanedInStorage > 0) {
    console.log(`  Orphaned: ${result.metrics.orphanedInStorage} images`);
  }
  if (result.metrics.missingFromStorage > 0) {
    console.log(`  Missing: ${result.metrics.missingFromStorage} images`);
  }

  console.log('─'.repeat(50));

  if (result.status === 'healthy') {
    console.log('✅ Image storage is healthy!');
  } else if (result.status === 'warning') {
    console.log('⚠️  Image storage has warnings but is functional');
  } else {
    console.log('❌ Image storage has critical issues that need attention');
  }
}

// Make health check available in browser console for debugging
if (typeof window !== 'undefined') {
  (window as any).__checkImageHealth = diagnoseImageHealth;
  console.log('💡 Image health check available: __checkImageHealth("site-id")');
}