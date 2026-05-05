import { Cloudinary } from '@cloudinary/url-gen';
import { format, quality } from '@cloudinary/url-gen/actions/delivery';
import { fill, fit, scale } from '@cloudinary/url-gen/actions/resize';
import { Gravity } from '@cloudinary/url-gen/qualifiers/gravity';
import type {
  ImageProviderValidationResult,
  ImageRef,
  ImageService,
  ImageServiceContext,
  ImageTransformOptions,
  Manifest,
} from '@/core/types';
import { getImageProviderPublicConfig } from './images.service';

interface UploadWidgetResultInfo {
  public_id: string;
  version: number;
  format: string;
  width: number;
  height: number;
  original_filename?: string;
}

interface UploadWidgetResult {
  event: 'success';
  info: UploadWidgetResultInfo;
}

interface UploadWidgetError {
  message: string;
}

interface CloudinaryWidget {
  open: () => void;
  close: () => void;
}

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (error: UploadWidgetError | null, result: UploadWidgetResult | null) => void
      ) => CloudinaryWidget;
    };
  }
}

function getCloudinaryConfig(manifest: Manifest, context?: ImageServiceContext): {
  cloudName?: string;
  uploadPreset?: string;
} {
  const providerConfig = getImageProviderPublicConfig(manifest, 'cloudinary');
  const cloudName = typeof providerConfig.cloudName === 'string'
    ? providerConfig.cloudName
    : typeof manifest.settings?.cloudinary?.cloudName === 'string'
      ? manifest.settings.cloudinary.cloudName
      : undefined;

  const secrets = context?.secrets;
  const uploadPreset =
    (typeof secrets?.imageProviders?.cloudinary?.uploadPreset === 'string' && secrets.imageProviders.cloudinary.uploadPreset) ||
    secrets?.cloudinary?.uploadPreset;

  return { cloudName, uploadPreset };
}

function createUploadWidget(
  cloudName: string,
  uploadPreset: string,
  onResult: (error: UploadWidgetError | null, result: UploadWidgetResult | null, widget: CloudinaryWidget) => void
): CloudinaryWidget {
  const cloudinary = window.cloudinary;
  if (!cloudinary?.createUploadWidget) {
    throw new Error('Cloudinary upload widget is not available in this environment.');
  }

  const widget = cloudinary.createUploadWidget(
    { cloudName, uploadPreset, sources: ['local', 'url', 'camera'], multiple: false },
    (error, result) => onResult(error, result, widget)
  );

  return widget;
}

class CloudinaryImageService implements ImageService {
  id = 'cloudinary';
  name = 'Upload to Cloudinary';
  kind = 'remote' as const;
  capabilities = {
    upload: true,
    transforms: true,
    exportMode: 'metadata-only' as const,
    importMode: 'metadata-only' as const,
    migrationTargets: ['local'],
  };
  configFields = {
    public: [
      {
        key: 'cloudName',
        label: 'Cloudinary Cloud Name',
        description: 'Public Cloudinary cloud name used to resolve delivery URLs.',
        placeholder: 'your-cloud-name',
        type: 'text' as const,
        required: true,
      },
    ],
    secret: [
      {
        key: 'uploadPreset',
        label: 'Cloudinary Upload Preset',
        description: 'Unsigned upload preset used by the Cloudinary widget.',
        placeholder: 'ml_default',
        type: 'password' as const,
        secret: true,
        required: true,
      },
    ],
  };

  validateConfig(context: ImageServiceContext): ImageProviderValidationResult {
    const { cloudName, uploadPreset } = getCloudinaryConfig(context.manifest, context);
    const errors: string[] = [];

    if (!cloudName) {
      errors.push('Cloudinary cloud name is missing.');
    }
    if (!uploadPreset) {
      errors.push('Cloudinary upload preset is missing.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async upload(_file: File, siteId: string, context?: ImageServiceContext): Promise<ImageRef> {
    if (!context?.manifest) {
      throw new Error(`Cloudinary upload for ${siteId} requires manifest context.`);
    }

    const { cloudName, uploadPreset } = getCloudinaryConfig(context.manifest, context);
    if (!cloudName || !uploadPreset) {
      throw new Error('Cloudinary Cloud Name and Upload Preset must be configured.');
    }

    return new Promise((resolve, reject) => {
      let widget: CloudinaryWidget;

      try {
        widget = createUploadWidget(cloudName, uploadPreset, (error, result, uploadWidget) => {
          if (error) {
            uploadWidget.close();
            reject(new Error(error.message || 'Image upload failed. Please try again.'));
            return;
          }

          if (result?.event === 'success') {
            uploadWidget.close();
            resolve({
              serviceId: this.id,
              src: result.info.public_id,
              alt: result.info.original_filename || 'Uploaded image',
              width: result.info.width,
              height: result.info.height,
              providerData: {
                publicId: result.info.public_id,
                version: result.info.version,
                format: result.info.format,
                originalFilename: result.info.original_filename,
              },
            });
          }
        });
      } catch (error) {
        reject(error);
        return;
      }

      widget.open();
    });
  }

  async getDisplayUrl(
    manifest: Manifest,
    ref: ImageRef,
    options: ImageTransformOptions,
    _isExport: boolean,
    _forIframe?: boolean,
    _skipDerivatives?: boolean
  ): Promise<string> {
    void _isExport;
    void _forIframe;
    void _skipDerivatives;
    const { cloudName } = getCloudinaryConfig(manifest);
    if (!cloudName) {
      return '';
    }

    const cld = new Cloudinary({ cloud: { cloudName } });
    const cldImage = cld.image(ref.src);
    const { width, height, crop = 'scale', gravity } = options;

    switch (crop) {
      case 'fill': {
        const fillResize = fill(width, height);
        if (gravity === 'auto') fillResize.gravity(Gravity.autoGravity());
        else if (gravity && ['north', 'south', 'east', 'west'].includes(gravity)) {
          fillResize.gravity(Gravity.compass(gravity as 'north' | 'south' | 'east' | 'west'));
        } else if (gravity === 'center') {
          fillResize.gravity(Gravity.xyCenter());
        }
        cldImage.resize(fillResize);
        break;
      }
      case 'fit':
        cldImage.resize(fit(width, height));
        break;
      case 'scale':
      default:
        cldImage.resize(scale(width, height));
        break;
    }

    cldImage.delivery(format('auto')).delivery(quality('auto'));
    return cldImage.toURL();
  }

  async getExportableAssets(): Promise<{ path: string; data: Blob }[]> {
    return [];
  }

  createMediaEntry(ref: ImageRef): Record<string, unknown> | undefined {
    return ref.providerData ? { ...ref.providerData } : undefined;
  }

  migrateAssetPath(originalPath: string, fromProviderId: string): string {
    if (fromProviderId === 'local') {
      return originalPath;
    }
    return originalPath;
  }
}

export const cloudinaryImageService = new CloudinaryImageService();
