import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { LocalSiteData, Manifest, VideoRef } from '@/core/types';
import {
  createInsertedVideoContent,
  insertProviderVideo,
  supportsUploadedVideoInsert,
  usesProviderVideoInsert,
} from '../videoInsert';

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

describe('videoInsert', () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  test('detects provider-widget video services that can upload outside the site bundle', () => {
    expect(
      usesProviderVideoInsert({
        capabilities: {
          upload: true,
          uploadInteraction: 'provider-widget',
          transforms: true,
          exportMode: 'metadata-only',
          importMode: 'metadata-only',
          videoUpload: true,
          videoExportMode: 'metadata-only',
        },
        startVideoUpload: vi.fn(),
      }),
    ).toBe(true);

    expect(
      usesProviderVideoInsert({
        capabilities: {
          upload: true,
          uploadInteraction: 'provider-widget',
          transforms: true,
          exportMode: 'bundle',
          importMode: 'full',
          videoUpload: true,
          videoExportMode: 'bundle',
        },
        startVideoUpload: vi.fn(),
      }),
    ).toBe(false);
  });

  test('only exposes uploaded video when the active provider supports non-bundled video uploads', () => {
    expect(
      supportsUploadedVideoInsert({
        capabilities: {
          upload: true,
          uploadInteraction: 'provider-widget',
          transforms: true,
          exportMode: 'metadata-only',
          importMode: 'metadata-only',
          videoUpload: true,
          videoExportMode: 'metadata-only',
        },
        startVideoUpload: vi.fn(),
      }),
    ).toBe(true);

    expect(
      supportsUploadedVideoInsert({
        capabilities: {
          upload: true,
          uploadInteraction: 'file-input',
          transforms: true,
          exportMode: 'bundle',
          importMode: 'full',
          videoUpload: false,
          videoExportMode: 'bundle',
        },
      }),
    ).toBe(false);
  });

  test('starts provider uploads and inserts the resulting video', async () => {
    const site = createSite();
    const videoRef: VideoRef = {
      serviceId: 'cloudinary',
      src: 'videos/demo',
      poster: 'https://res.cloudinary.com/demo/video/upload/so_0/videos/demo.jpg',
      width: 1920,
      height: 1080,
      duration: 42,
    };

    const beginProviderUpload = vi.fn();
    const endProviderUpload = vi.fn();
    const insertVideo = vi.fn();

    const result = await insertProviderVideo({
      siteId: site.siteId,
      site,
      service: {
        startVideoUpload: vi.fn().mockResolvedValue(videoRef),
        getVideoDisplayUrl: vi.fn().mockResolvedValue('https://res.cloudinary.com/demo/video/upload/v1/videos/demo.mp4'),
      },
      beginProviderUpload,
      endProviderUpload,
      insertVideo,
    });

    expect(result).toBe(true);
    expect(beginProviderUpload).toHaveBeenCalledTimes(1);
    expect(endProviderUpload).toHaveBeenCalledTimes(1);
    expect(insertVideo).toHaveBeenCalledWith({
      src: 'https://res.cloudinary.com/demo/video/upload/v1/videos/demo.mp4',
      poster: 'https://res.cloudinary.com/demo/video/upload/so_0/videos/demo.jpg',
      isUpload: true,
      videoRef,
    });
  });

  test('swallows provider upload cancellation without toasting', async () => {
    const site = createSite();
    const beginProviderUpload = vi.fn();
    const endProviderUpload = vi.fn();
    const insertVideo = vi.fn();

    const result = await insertProviderVideo({
      siteId: site.siteId,
      site,
      service: {
        startVideoUpload: vi.fn().mockRejectedValue(new Error('Upload cancelled.')),
        getVideoDisplayUrl: vi.fn(),
      },
      beginProviderUpload,
      endProviderUpload,
      insertVideo,
    });

    expect(result).toBe(false);
    expect(insertVideo).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(endProviderUpload).toHaveBeenCalledTimes(1);
  });

  test('creates the video node payload used by TipTap insertion', () => {
    const videoRef: VideoRef = {
      serviceId: 'cloudinary',
      src: 'videos/demo',
    };

    expect(
      createInsertedVideoContent({
        src: 'https://example.com/demo.mp4',
        poster: null,
        isUpload: true,
        videoRef,
      }),
    ).toEqual({
      type: 'sparktypeVideo',
      attrs: {
        src: 'https://example.com/demo.mp4',
        poster: null,
        isUpload: true,
        videoRef,
      },
    });
  });
});
