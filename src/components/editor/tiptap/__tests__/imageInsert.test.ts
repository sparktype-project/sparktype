import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { ImageRef, LocalSiteData, Manifest } from '@/core/types';
import {
  createInsertedImageContent,
  insertProviderImage,
  usesProviderImageInsert,
} from '../imageInsert';

const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

function createManifest(): Manifest {
  return {
    siteId: 'site-1',
    generatorVersion: '1.0.0',
    title: 'Test',
    description: 'Test',
    theme: { name: 'default', config: {} },
    structure: [],
    settings: {},
  };
}

function createSite(): LocalSiteData {
  const manifest = createManifest();

  return {
    siteId: 'site-1',
    manifest,
    contentFiles: [],
  };
}

describe('imageInsert', () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  test('detects provider-widget image services', () => {
    expect(
      usesProviderImageInsert({
        capabilities: {
          upload: true,
          uploadInteraction: 'provider-widget',
          transforms: true,
          exportMode: 'metadata-only',
          importMode: 'metadata-only',
          videoUpload: false,
          videoExportMode: 'metadata-only',
        },
        startUpload: vi.fn(),
      }),
    ).toBe(true);

    expect(
      usesProviderImageInsert({
        capabilities: {
          upload: true,
          uploadInteraction: 'file-input',
          transforms: true,
          exportMode: 'bundle',
          importMode: 'full',
          videoUpload: false,
          videoExportMode: 'bundle',
        },
        startUpload: vi.fn(),
      }),
    ).toBe(false);
  });

  test('starts provider uploads and inserts the resulting image', async () => {
    const site = createSite();
    const imageRef: ImageRef = {
      serviceId: 'cloudinary',
      src: 'images/hero',
      alt: 'Hero',
      width: 1200,
      height: 630,
    };

    const beginProviderUpload = vi.fn();
    const endProviderUpload = vi.fn();
    const insertImage = vi.fn();

    const result = await insertProviderImage({
      siteId: site.siteId,
      site,
      service: {
        startUpload: vi.fn().mockResolvedValue(imageRef),
        getDisplayUrl: vi.fn().mockResolvedValue('https://res.cloudinary.com/demo/image/upload/v1/images/hero.jpg'),
      },
      beginProviderUpload,
      endProviderUpload,
      insertImage,
    });

    expect(result).toBe(true);
    expect(beginProviderUpload).toHaveBeenCalledTimes(1);
    expect(endProviderUpload).toHaveBeenCalledTimes(1);
    expect(insertImage).toHaveBeenCalledWith({
      src: 'https://res.cloudinary.com/demo/image/upload/v1/images/hero.jpg',
      alt: 'Hero',
      title: null,
      imageRef,
    });
  });

  test('swallows provider upload cancellation without toasting', async () => {
    const site = createSite();
    const beginProviderUpload = vi.fn();
    const endProviderUpload = vi.fn();
    const insertImage = vi.fn();

    const result = await insertProviderImage({
      siteId: site.siteId,
      site,
      service: {
        startUpload: vi.fn().mockRejectedValue(new Error('Upload cancelled.')),
        getDisplayUrl: vi.fn(),
      },
      beginProviderUpload,
      endProviderUpload,
      insertImage,
    });

    expect(result).toBe(false);
    expect(insertImage).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(endProviderUpload).toHaveBeenCalledTimes(1);
  });

  test('creates the image node payload used by TipTap insertion', () => {
    const imageRef: ImageRef = {
      serviceId: 'cloudinary',
      src: 'images/hero',
    };

    expect(
      createInsertedImageContent({
        src: 'https://example.com/hero.jpg',
        alt: '',
        title: null,
        imageRef,
      }),
    ).toEqual({
      type: 'image',
      attrs: {
        src: 'https://example.com/hero.jpg',
        alt: '',
        title: null,
        imageRef,
      },
    });
  });
});
