/**
 * These are the only tests that exercise real image deletion, so every assertion is made
 * against storage (`getAllImageAssetsForSite`, `getImageAsset`, the derivative cache) rather
 * than against the registry: a registry-only assertion passes even when the blob survives,
 * which is exactly the defect this suite guards against.
 */
import type * as StorageModule from '@/core/services/storage/siteStorage.service';
import type { LocalSiteData } from '@/core/types';
import localforage from 'localforage';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetInMemoryBlobStore } from '@/test/support/blobStorageStub';
import { resetIndexedDbForTests } from '@/test/support/storage';
import {
  deleteImageAsset,
  getAllImageAssetsForSite,
  getImageAsset,
  saveAllImageAssetsForSite,
  saveImageAsset,
} from '@/core/services/localFileSystem.service';
import {
  addDerivativeToRegistry,
  addImageToRegistry,
  createEmptyRegistry,
  getImageRegistry,
  saveImageRegistry,
  updateImageReferences,
} from '../imageRegistry.service';
import { getCachedDerivative, setCachedDerivative } from '../derivativeCache.service';
import { ensureImageRegistry, validateAndRepairRegistry } from '../registryMigration.service';
import { cleanupOrphanedImages } from '../imageCleanup.service';
import { localImageService } from '../localImage.service';

const blobMocks = vi.hoisted(() => ({
  removeBlob: vi.fn(),
  realRemoveBlob: null as null | ((
    namespace: 'images' | 'derivatives' | 'imports' | 'exports' | 'snapshots',
    siteId: string,
    relativePath: string,
  ) => Promise<void>),
}));

vi.mock('@/core/services/storage/siteStorage.service', async (importOriginal) => {
  const { stubBlobBackend } = await import('@/test/support/blobStorageStub');
  const stubbed = await stubBlobBackend(() => importOriginal<typeof StorageModule>());
  blobMocks.realRemoveBlob = stubbed.removeBlob;
  blobMocks.removeBlob.mockImplementation(stubbed.removeBlob);
  return { ...stubbed, removeBlob: blobMocks.removeBlob };
});

const LEGACY_IMAGE_STORE = localforage.createInstance({
  name: 'SparktypeDB',
  storeName: 'siteImageAssets',
});

const USED_IMAGE = 'assets/originals/used.jpg';
const ORPHAN_IMAGE = 'assets/originals/orphan.jpg';

function createSiteWithReferences(siteId: string, references: string[]): LocalSiteData {
  const site = createSiteFixture('basicSite', { siteId });
  site.contentFiles = [
    {
      path: 'content/home.md',
      slug: 'home',
      frontmatter: { title: 'Home', layout: 'page' },
      content: references.map((src) => `![image](${src})`).join('\n'),
    },
  ];
  return site;
}

async function storeOriginal(siteId: string, imagePath: string, contents: string): Promise<Blob> {
  const blob = new Blob([contents], { type: 'image/jpeg' });
  await saveImageAsset(siteId, imagePath, blob);
  await addImageToRegistry(siteId, imagePath, { sizeBytes: blob.size });
  return blob;
}

/** Mirrors what `syncImageReferences` records when the referencing content file is saved. */
async function markReferenced(siteId: string, imagePath: string): Promise<void> {
  await updateImageReferences(siteId, 'content/home.md', [imagePath]);
}

describe('imageCleanup.service', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
    resetInMemoryBlobStore();
    blobMocks.removeBlob.mockReset();
    blobMocks.removeBlob.mockImplementation(blobMocks.realRemoveBlob!);
  });

  test('deletes orphaned originals from storage and leaves referenced originals byte-identical', async () => {
    const siteId = 'cleanup-site';
    const site = createSiteWithReferences(siteId, [USED_IMAGE]);
    await storeOriginal(siteId, USED_IMAGE, 'used-image-bytes');
    const orphan = await storeOriginal(siteId, ORPHAN_IMAGE, 'orphan-image-bytes');
    await markReferenced(siteId, USED_IMAGE);

    const result = await cleanupOrphanedImages(site);

    const stored = await getAllImageAssetsForSite(siteId);
    expect(Object.keys(stored)).toEqual([USED_IMAGE]);
    expect(await stored[USED_IMAGE].text()).toBe('used-image-bytes');
    expect(await getImageAsset(siteId, ORPHAN_IMAGE)).toBeNull();

    expect(result.originalImagesRemoved).toBe(1);
    expect(result.bytesFreed).toBe(orphan.size);
    expect(result.failures).toEqual([]);

    const registry = await getImageRegistry(siteId);
    expect(Object.keys(registry.images)).toEqual([USED_IMAGE]);
  });

  test('counts only confirmed deletions and keeps the registry entry when a deletion fails', async () => {
    const siteId = 'cleanup-failure-site';
    const site = createSiteWithReferences(siteId, []);
    await storeOriginal(siteId, 'assets/originals/stuck.jpg', 'stuck-bytes');
    const doomed = await storeOriginal(siteId, 'assets/originals/doomed.jpg', 'doomed-image-bytes');

    // The OPFS backend swallows removal errors, so a backend can report success while the blob
    // is still there. The deletion must be verified rather than trusted.
    blobMocks.removeBlob.mockImplementation(async (namespace, id, relativePath) => {
      if (relativePath === 'assets/originals/stuck.jpg') return;
      await blobMocks.realRemoveBlob!(namespace, id, relativePath);
    });

    const result = await cleanupOrphanedImages(site);

    expect(result.originalImagesRemoved).toBe(1);
    expect(result.bytesFreed).toBe(doomed.size);
    expect(result.failures).toEqual(['assets/originals/stuck.jpg']);

    const stored = await getAllImageAssetsForSite(siteId);
    expect(Object.keys(stored)).toEqual(['assets/originals/stuck.jpg']);
    expect(await stored['assets/originals/stuck.jpg'].text()).toBe('stuck-bytes');

    const registry = await getImageRegistry(siteId);
    expect(registry.images['assets/originals/stuck.jpg']).toBeDefined();
    expect(registry.images['assets/originals/doomed.jpg']).toBeUndefined();

    const failureLine = result.cleanupLog.find((line) => line.includes('stuck.jpg'));
    expect(failureLine).toMatch(/failed/i);
    expect(result.cleanupLog.some((line) => line.includes('Successfully removed'))).toBe(false);
  });

  test('does not delete an original whose registry entry is stale but the site still references', async () => {
    const siteId = 'cleanup-stale-registry-site';
    const site = createSiteWithReferences(siteId, [USED_IMAGE]);
    await storeOriginal(siteId, USED_IMAGE, 'used-image-bytes');

    const result = await cleanupOrphanedImages(site);

    const stored = await getAllImageAssetsForSite(siteId);
    expect(Object.keys(stored)).toEqual([USED_IMAGE]);
    expect(result.originalImagesRemoved).toBe(0);
    expect(result.bytesFreed).toBe(0);

    const registry = await getImageRegistry(siteId);
    expect(registry.images[USED_IMAGE]).toBeDefined();
    expect(registry.images[USED_IMAGE].referencedIn).toEqual(['content/home.md']);
  });

  test('does not re-register deleted originals when the registry is rebuilt or repaired', async () => {
    const siteId = 'cleanup-reopen-site';
    const site = createSiteWithReferences(siteId, [USED_IMAGE]);
    await storeOriginal(siteId, USED_IMAGE, 'used-image-bytes');
    await storeOriginal(siteId, ORPHAN_IMAGE, 'orphan-image-bytes');
    await markReferenced(siteId, USED_IMAGE);

    await cleanupOrphanedImages(site);

    const repaired = await validateAndRepairRegistry(site);
    expect(repaired.issues).toEqual([]);
    expect(Object.keys((await getImageRegistry(siteId)).images)).toEqual([USED_IMAGE]);

    // A fully emptied registry is the state a site whose images were all orphaned reaches; the
    // read path rebuilds it from storage, which must not find the deleted blob.
    await saveImageRegistry(createEmptyRegistry(siteId));
    const rebuilt = await ensureImageRegistry(site);
    expect(Object.keys(rebuilt.images)).toEqual([USED_IMAGE]);
  });

  test('leaves nothing to re-register when every original was orphaned', async () => {
    const siteId = 'cleanup-all-orphans-site';
    const site = createSiteWithReferences(siteId, []);
    await storeOriginal(siteId, ORPHAN_IMAGE, 'orphan-image-bytes');

    const result = await cleanupOrphanedImages(site);

    expect(result.originalImagesRemoved).toBe(1);
    expect(Object.keys(await getAllImageAssetsForSite(siteId))).toEqual([]);

    await saveImageRegistry(createEmptyRegistry(siteId));
    const rebuilt = await ensureImageRegistry(site);
    expect(Object.keys(rebuilt.images)).toEqual([]);
  });

  test('clears the legacy asset store so a deleted original cannot return on read', async () => {
    const siteId = 'cleanup-legacy-site';
    const site = createSiteWithReferences(siteId, []);
    const legacyBytes = new TextEncoder().encode('legacy-bytes');
    await LEGACY_IMAGE_STORE.setItem(siteId, { [ORPHAN_IMAGE]: legacyBytes.buffer });
    await addImageToRegistry(siteId, ORPHAN_IMAGE, { sizeBytes: legacyBytes.byteLength });

    expect(Object.keys(await getAllImageAssetsForSite(siteId))).toContain(ORPHAN_IMAGE);

    const result = await cleanupOrphanedImages(site);

    expect(result.originalImagesRemoved).toBe(1);
    expect(result.bytesFreed).toBe(legacyBytes.byteLength);
    expect(await getImageAsset(siteId, ORPHAN_IMAGE)).toBeNull();
    expect(Object.keys(await getAllImageAssetsForSite(siteId))).toEqual([]);
  });

  test('deletes only the orphaned derivatives and reports the ones it actually removed', async () => {
    const siteId = 'cleanup-derivatives-site';
    const site = createSiteWithReferences(siteId, [USED_IMAGE]);
    await storeOriginal(siteId, USED_IMAGE, 'used-image-bytes');
    await storeOriginal(siteId, ORPHAN_IMAGE, 'orphan-image-bytes');
    await markReferenced(siteId, USED_IMAGE);

    const usedDerivativePath = 'assets/derivatives/used_w300_hauto_c-scale_g-center.jpg';
    const orphanDerivativePath = 'assets/derivatives/orphan_w300_hauto_c-scale_g-center.jpg';
    const orphanDerivative = new Blob(['orphan-derivative'], { type: 'image/jpeg' });
    await setCachedDerivative(`${siteId}/${usedDerivativePath}`, new Blob(['used-derivative'], { type: 'image/jpeg' }));
    await setCachedDerivative(`${siteId}/${orphanDerivativePath}`, orphanDerivative);
    await addDerivativeToRegistry(siteId, USED_IMAGE, usedDerivativePath);
    await addDerivativeToRegistry(siteId, ORPHAN_IMAGE, orphanDerivativePath);

    const result = await cleanupOrphanedImages(site);

    expect(result.derivativesRemoved).toBe(1);
    expect(result.bytesFreed).toBe('orphan-image-bytes'.length + orphanDerivative.size);
    expect(await getCachedDerivative(`${siteId}/${orphanDerivativePath}`)).toBeNull();
    expect(await (await getCachedDerivative(`${siteId}/${usedDerivativePath}`))!.text()).toBe('used-derivative');

    const secondRun = await cleanupOrphanedImages(site);
    expect(secondRun).toMatchObject({ originalImagesRemoved: 0, derivativesRemoved: 0, bytesFreed: 0 });
  });

  test('does not count a phantom registry entry as freed bytes', async () => {
    const siteId = 'cleanup-phantom-site';
    const site = createSiteWithReferences(siteId, []);
    await addImageToRegistry(siteId, 'assets/originals/missing.jpg', { sizeBytes: 4096 });

    const result = await cleanupOrphanedImages(site);

    expect(result.originalImagesRemoved).toBe(0);
    expect(result.bytesFreed).toBe(0);
    expect(Object.keys((await getImageRegistry(siteId)).images)).toEqual([]);
  });

  test('export after cleanup omits the deleted original and keeps the retained bytes', async () => {
    const siteId = 'cleanup-export-site';
    const site = createSiteWithReferences(siteId, [USED_IMAGE]);
    await storeOriginal(siteId, USED_IMAGE, 'used-image-bytes');
    await storeOriginal(siteId, ORPHAN_IMAGE, 'orphan-image-bytes');
    await markReferenced(siteId, USED_IMAGE);

    await cleanupOrphanedImages(site);

    const assets = await localImageService.getExportableAssets(siteId, [
      { serviceId: 'local', src: USED_IMAGE },
      { serviceId: 'local', src: ORPHAN_IMAGE },
    ]);

    expect(assets.map((asset) => asset.path)).toEqual(['_site/assets/originals/used.jpg']);
    expect(await assets[0].data.text()).toBe('used-image-bytes');
  });

  test('keeps saveAllImageAssetsForSite additive', async () => {
    const siteId = 'cleanup-additive-site';
    await storeOriginal(siteId, USED_IMAGE, 'used-image-bytes');
    await storeOriginal(siteId, ORPHAN_IMAGE, 'orphan-image-bytes');

    await saveAllImageAssetsForSite(siteId, {
      [USED_IMAGE]: new Blob(['rewritten'], { type: 'image/jpeg' }),
    });

    const stored = await getAllImageAssetsForSite(siteId);
    expect(Object.keys(stored).sort()).toEqual([ORPHAN_IMAGE, USED_IMAGE].sort());
    expect(await stored[ORPHAN_IMAGE].text()).toBe('orphan-image-bytes');
    expect(await stored[USED_IMAGE].text()).toBe('rewritten');
  });

  test('deleteImageAsset reports failure when the blob survives the removal', async () => {
    const siteId = 'cleanup-delete-primitive-site';
    await storeOriginal(siteId, USED_IMAGE, 'used-image-bytes');
    blobMocks.removeBlob.mockImplementation(async () => {});

    await expect(deleteImageAsset(siteId, USED_IMAGE)).rejects.toThrow(USED_IMAGE);
    expect(await getImageAsset(siteId, USED_IMAGE)).not.toBeNull();
  });
});
