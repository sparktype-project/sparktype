import type { ImageServiceContext, Manifest } from '@/core/types';

const CLOUDINARY_UPLOAD_WIDGET_SCRIPT_SRC = 'https://widget.cloudinary.com/v2.0/global/all.js';

function createManifest(): Manifest {
  return {
    siteId: 'test-site',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'Test Site Description',
    theme: { name: 'default', config: {} },
    structure: [],
    settings: {
      imageService: 'cloudinary',
      imageProvider: { id: 'cloudinary' },
      imageProviders: {
        cloudinary: {
          cloudName: 'demo-cloud',
        },
      },
    },
  };
}

function createContext(): ImageServiceContext {
  const manifest = createManifest();

  return {
    manifest,
    secrets: {
      imageProviders: {
        cloudinary: {
          uploadPreset: 'unsigned-preset',
        },
      },
    },
    site: {
      siteId: 'test-site',
      manifest,
      contentFiles: [],
    },
  };
}

describe('cloudinaryImageService', () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.cloudinary;
    document.getElementById('cloudinary-upload-widget')?.remove();
  });

  test('loads the Cloudinary widget script before opening the upload widget', async () => {
    const widgetResult = {
      event: 'success' as const,
      info: {
        public_id: 'images/hero',
        version: 7,
        format: 'png',
        secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/v7/images/hero.png',
        width: 1200,
        height: 630,
        original_filename: 'hero',
      },
    };
    const close = vi.fn();
    const open = vi.fn();

    const appendChildSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        queueMicrotask(() => {
          window.cloudinary = {
            createUploadWidget: vi.fn((_options, callback) => {
              const widget = {
                open: () => {
                  open();
                  callback(null, widgetResult);
                },
                close,
              };

              return widget;
            }),
          };

          node.onload?.(new Event('load'));
        });
      }

      return node;
    });

    const { cloudinaryImageService } = await import('../cloudinaryImage.service');

    const uploadPromise = cloudinaryImageService.upload(
      new File(['file'], 'hero.png', { type: 'image/png' }),
      'test-site',
      createContext()
    );

    await expect(uploadPromise).resolves.toEqual({
      serviceId: 'cloudinary',
      src: 'images/hero',
      alt: 'hero',
      width: 1200,
      height: 630,
      providerData: {
        publicId: 'images/hero',
        version: 7,
        format: 'png',
        originalFilename: 'hero',
        secureUrl: 'https://res.cloudinary.com/demo-cloud/image/upload/v7/images/hero.png',
      },
    });

    const script = appendChildSpy.mock.calls
      .map(([node]) => node)
      .find((node): node is HTMLScriptElement => node instanceof HTMLScriptElement && node.src === CLOUDINARY_UPLOAD_WIDGET_SCRIPT_SRC);
    expect(script).toBeInstanceOf(HTMLScriptElement);
    expect(script?.src).toBe(CLOUDINARY_UPLOAD_WIDGET_SCRIPT_SRC);
    expect(open).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('surfaces a clear error when the widget script fails to load', async () => {
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        queueMicrotask(() => {
          node.onerror?.(new Event('error'));
        });
      }

      return node;
    });

    const { cloudinaryImageService } = await import('../cloudinaryImage.service');

    await expect(
      cloudinaryImageService.upload(
        new File(['file'], 'hero.png', { type: 'image/png' }),
        'test-site',
        createContext()
      )
    ).rejects.toThrow('Failed to load Cloudinary upload widget.');
  });

  test('rejects cleanly when the user closes the widget without uploading', async () => {
    const close = vi.fn();
    const createUploadWidget = vi.fn((_options, callback) => {
      const widget = {
        open: () => {
          callback(null, {
            event: 'close' as const,
          });
        },
        close,
      };

      return widget;
    });

    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        queueMicrotask(() => {
          window.cloudinary = {
            createUploadWidget,
          };
          node.onload?.(new Event('load'));
        });
      }

      return node;
    });

    const { cloudinaryImageService } = await import('../cloudinaryImage.service');

    await expect(
      cloudinaryImageService.startUpload?.(
        'test-site',
        createContext()
      )
    ).rejects.toThrow('Upload cancelled.');

    expect(createUploadWidget).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('uploads videos through the Cloudinary widget and returns a VideoRef', async () => {
    const close = vi.fn();
    const createUploadWidget = vi.fn((_options, callback) => {
      const widget = {
        open: () => {
          callback(null, {
            event: 'success' as const,
            info: {
              public_id: 'videos/demo-reel',
              version: 3,
              format: 'mp4',
              width: 1920,
              height: 1080,
              duration: 24.6,
              resource_type: 'video',
              secure_url: 'https://res.cloudinary.com/demo-cloud/video/upload/v3/videos/demo-reel.mp4',
              thumbnail_url: 'https://res.cloudinary.com/demo-cloud/video/upload/so_0/videos/demo-reel.jpg',
              original_filename: 'demo-reel',
            },
          });
        },
        close,
      };

      return widget;
    });

    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        queueMicrotask(() => {
          window.cloudinary = {
            createUploadWidget,
          };
          node.onload?.(new Event('load'));
        });
      }

      return node;
    });

    const { cloudinaryImageService } = await import('../cloudinaryImage.service');

    await expect(
      cloudinaryImageService.uploadVideo?.(
        new File(['file'], 'demo-reel.mp4', { type: 'video/mp4' }),
        'test-site',
        createContext()
      )
    ).resolves.toEqual({
      serviceId: 'cloudinary',
      src: 'videos/demo-reel',
      width: 1920,
      height: 1080,
      duration: 24.6,
      providerData: {
        publicId: 'videos/demo-reel',
        version: 3,
        format: 'mp4',
        originalFilename: 'demo-reel',
        resourceType: 'video',
        secureUrl: 'https://res.cloudinary.com/demo-cloud/video/upload/v3/videos/demo-reel.mp4',
        poster: 'https://res.cloudinary.com/demo-cloud/video/upload/so_0/videos/demo-reel.jpg',
      },
    });

    expect(createUploadWidget).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
