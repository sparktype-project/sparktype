import {
  addDerivativeToRegistry,
  addImageToRegistry,
  createEmptyRegistry,
  deleteImageRegistry,
  getImageRegistry,
  getImageUsageStats,
  getOrphanedImages,
  removeImageFromRegistry,
  updateImageMetadata,
  updateImageReferences,
} from '../imageRegistry.service';
import { resetIndexedDbForTests } from '@/test/support/storage';

describe('imageRegistry.service', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  it('creates an empty registry for new sites', async () => {
    const empty = createEmptyRegistry('site-1');
    expect(empty).toMatchObject({
      siteId: 'site-1',
      version: 1,
      images: {},
    });

    await expect(getImageRegistry('site-1')).resolves.toMatchObject({
      siteId: 'site-1',
      images: {},
    });
  });

  it('adds images, updates metadata, and stores derivative paths once', async () => {
    await addImageToRegistry('site-1', 'assets/originals/photo.jpg', {
      sizeBytes: 245760,
      width: 1200,
      height: 800,
      alt: 'Hero image',
    });

    await addDerivativeToRegistry('site-1', 'assets/originals/photo.jpg', 'assets/derivatives/photo_w300.jpg');
    await addDerivativeToRegistry('site-1', 'assets/originals/photo.jpg', 'assets/derivatives/photo_w300.jpg');
    await updateImageMetadata('site-1', 'assets/originals/photo.jpg', { alt: 'Updated alt', width: 1920 });

    const registry = await getImageRegistry('site-1');

    expect(registry.images['assets/originals/photo.jpg']).toMatchObject({
      originalPath: 'assets/originals/photo.jpg',
      derivativePaths: ['assets/derivatives/photo_w300.jpg'],
      referencedIn: [],
      sizeBytes: 245760,
      width: 1920,
      height: 800,
      alt: 'Updated alt',
    });
  });

  it('tracks references, orphaned assets, usage stats, and removal', async () => {
    await addImageToRegistry('site-1', 'assets/originals/used.jpg', 200);
    await addImageToRegistry('site-1', 'assets/originals/orphan.jpg', 100);
    await addDerivativeToRegistry('site-1', 'assets/originals/orphan.jpg', 'assets/derivatives/orphan_w300.jpg');

    await updateImageReferences('site-1', 'content/home.md', ['assets/originals/used.jpg']);

    const orphanedBeforeDelete = await getOrphanedImages('site-1');
    expect(orphanedBeforeDelete).toEqual({
      orphanedOriginals: ['assets/originals/orphan.jpg'],
      orphanedDerivatives: ['assets/derivatives/orphan_w300.jpg'],
    });

    await expect(getImageUsageStats('site-1')).resolves.toEqual({
      totalOriginalImages: 2,
      totalDerivatives: 1,
      referencedImages: 1,
      orphanedOriginals: 1,
      orphanedDerivatives: 1,
      totalRegistryBytes: 300,
    });

    await removeImageFromRegistry('site-1', 'assets/originals/orphan.jpg');

    const registry = await getImageRegistry('site-1');
    expect(Object.keys(registry.images)).toEqual(['assets/originals/used.jpg']);
  });

  it('clears a saved registry and throws when updating a missing image', async () => {
    await addImageToRegistry('site-1', 'assets/originals/photo.jpg', 123);
    await deleteImageRegistry('site-1');

    await expect(getImageRegistry('site-1')).resolves.toMatchObject({
      siteId: 'site-1',
      images: {},
    });

    await expect(
      updateImageMetadata('site-1', 'assets/originals/missing.jpg', { alt: 'missing' })
    ).rejects.toThrow('Image not found in registry');
  });
});
