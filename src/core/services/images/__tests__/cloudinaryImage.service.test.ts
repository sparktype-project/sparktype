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
});
