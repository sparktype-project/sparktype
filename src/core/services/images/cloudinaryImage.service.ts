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
  VideoRef,
} from '@/core/types';
import { getImageProviderPublicConfig } from './images.service';

interface UploadWidgetResultInfo {
  public_id: string;
  version: number;
  format: string;
  width?: number;
  height?: number;
  duration?: number;
  resource_type?: 'image' | 'video' | string;
  secure_url?: string;
  thumbnail_url?: string;
  original_filename?: string;
}

interface UploadWidgetResult {
  event: 'abort' | 'batch-cancelled' | 'close' | 'queues-end' | 'queues-start' | 'success' | 'upload-added';
  info?: UploadWidgetResultInfo | string | Record<string, unknown>;
}

interface UploadWidgetError {
  message: string;
}

interface CloudinaryWidget {
  open: () => void;
  close: () => void;
}

const UPLOAD_CANCELLED_MESSAGE = 'Upload cancelled.';

const CLOUDINARY_UPLOAD_WIDGET_SCRIPT_ID = 'cloudinary-upload-widget';
const CLOUDINARY_UPLOAD_WIDGET_SCRIPT_SRC = 'https://widget.cloudinary.com/v2.0/global/all.js';

let cloudinaryUploadWidgetLoader: Promise<void> | null = null;

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

function getCloudinaryWidgetApi() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.cloudinary;
}

async function ensureUploadWidgetLoaded(): Promise<void> {
  const cloudinary = getCloudinaryWidgetApi();
  if (cloudinary?.createUploadWidget) {
    return;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Cloudinary upload widget is not available in this environment.');
  }

  if (cloudinaryUploadWidgetLoader) {
    return cloudinaryUploadWidgetLoader;
  }

  cloudinaryUploadWidgetLoader = new Promise<void>((resolve, reject) => {
    const finalizeLoad = () => {
      const widgetApi = getCloudinaryWidgetApi();
      if (widgetApi?.createUploadWidget) {
        resolve();
        return;
      }

      cloudinaryUploadWidgetLoader = null;
      reject(new Error('Cloudinary upload widget failed to initialize.'));
    };

    const handleError = () => {
      document.getElementById(CLOUDINARY_UPLOAD_WIDGET_SCRIPT_ID)?.remove();
      cloudinaryUploadWidgetLoader = null;
      reject(new Error('Failed to load Cloudinary upload widget.'));
    };

    const existingScript = document.getElementById(CLOUDINARY_UPLOAD_WIDGET_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.dataset.status === 'loaded') {
        finalizeLoad();
        return;
      }

      if (existingScript.dataset.status !== 'error') {
        existingScript.addEventListener('load', finalizeLoad, { once: true });
        existingScript.addEventListener('error', handleError, { once: true });
        return;
      }

      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = CLOUDINARY_UPLOAD_WIDGET_SCRIPT_ID;
    script.src = CLOUDINARY_UPLOAD_WIDGET_SCRIPT_SRC;
    script.async = true;
    script.dataset.status = 'loading';
    script.onload = () => {
      script.dataset.status = 'loaded';
      finalizeLoad();
    };
    script.onerror = () => {
      script.dataset.status = 'error';
      handleError();
    };
    document.head.appendChild(script);
  });

  return cloudinaryUploadWidgetLoader;
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
  resourceType: 'image' | 'video',
  onResult: (error: UploadWidgetError | null, result: UploadWidgetResult | null, widget: CloudinaryWidget) => void
): CloudinaryWidget {
  const cloudinary = getCloudinaryWidgetApi();
  if (!cloudinary?.createUploadWidget) {
    throw new Error('Cloudinary upload widget is not available in this environment.');
  }

  const widget = cloudinary.createUploadWidget(
    {
      cloudName,
      uploadPreset,
      multiple: false,
      resourceType,
      clientAllowedFormats: resourceType === 'video'
        ? ['mp4', 'mov', 'm4v', 'webm', 'ogv']
        : undefined,
      sources: ['local', 'url', 'camera'],
    },
    (error, result) => onResult(error, result, widget)
  );

  return widget;
}

function buildCloudinaryVideoUrl(cloudName: string, ref: VideoRef): string {
  const secureUrl = typeof ref.providerData?.secureUrl === 'string'
    ? ref.providerData.secureUrl
    : undefined;
  if (secureUrl) {
    return secureUrl;
  }

  const version = typeof ref.providerData?.version === 'number'
    ? `v${ref.providerData.version}/`
    : '';
  const format = typeof ref.providerData?.format === 'string'
    ? `.${ref.providerData.format}`
    : '';

  return `https://res.cloudinary.com/${cloudName}/video/upload/${version}${ref.src}${format}`;
}

function isSuccessResult(result: UploadWidgetResult | null): result is UploadWidgetResult & { event: 'success'; info: UploadWidgetResultInfo } {
  return result?.event === 'success' && typeof result.info === 'object' && result.info !== null && 'public_id' in result.info;
}

class CloudinaryImageService implements ImageService {
  id = 'cloudinary';
  name = 'Upload to Cloudinary';
  kind = 'remote' as const;
  capabilities = {
    upload: true,
    uploadInteraction: 'provider-widget' as const,
    transforms: true,
    exportMode: 'metadata-only' as const,
    importMode: 'metadata-only' as const,
    videoUpload: true,
    videoTransforms: true,
    videoExportMode: 'metadata-only' as const,
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
      {
        key: 'videoUploadPreset',
        label: 'Cloudinary Video Upload Preset',
        description: 'Unsigned upload preset used by the Cloudinary widget for video uploads. Falls back to the image preset when omitted.',
        placeholder: 'video_unsigned',
        type: 'password' as const,
        secret: true,
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
    return this.startUpload(siteId, context);
  }

  async startUpload(siteId: string, context?: ImageServiceContext): Promise<ImageRef> {
    if (!context?.manifest) {
      throw new Error(`Cloudinary upload for ${siteId} requires manifest context.`);
    }

    const { cloudName, uploadPreset } = getCloudinaryConfig(context.manifest, context);
    if (!cloudName || !uploadPreset) {
      throw new Error('Cloudinary Cloud Name and Upload Preset must be configured.');
    }

    await ensureUploadWidgetLoaded();

    return new Promise((resolve, reject) => {
      let widget: CloudinaryWidget;

      try {
        widget = createUploadWidget(cloudName, uploadPreset, 'image', (error, result, uploadWidget) => {
          if (result?.event === 'close' || result?.event === 'abort' || result?.event === 'batch-cancelled') {
            uploadWidget.close();
            reject(new Error(UPLOAD_CANCELLED_MESSAGE));
            return;
          }

          if (error) {
            uploadWidget.close();
            reject(new Error(error.message || 'Image upload failed. Please try again.'));
            return;
          }

          if (isSuccessResult(result)) {
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
                secureUrl: result.info.secure_url,
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

  async uploadVideo(_file: File, siteId: string, context?: ImageServiceContext): Promise<VideoRef> {
    if (!context?.manifest) {
      throw new Error(`Cloudinary video upload for ${siteId} requires manifest context.`);
    }

    const { cloudName, uploadPreset } = getCloudinaryConfig(context.manifest, context);
    const videoUploadPreset =
      (typeof context.secrets?.imageProviders?.cloudinary?.videoUploadPreset === 'string' &&
        context.secrets.imageProviders.cloudinary.videoUploadPreset) ||
      context.secrets?.cloudinary?.videoUploadPreset ||
      uploadPreset;

    if (!cloudName || !videoUploadPreset) {
      throw new Error('Cloudinary Cloud Name and video Upload Preset must be configured.');
    }

    await ensureUploadWidgetLoaded();

    return new Promise((resolve, reject) => {
      let widget: CloudinaryWidget;

      try {
        widget = createUploadWidget(
          cloudName,
          videoUploadPreset,
          'video',
          (error, result, uploadWidget) => {
            if (result?.event === 'close' || result?.event === 'abort' || result?.event === 'batch-cancelled') {
              uploadWidget.close();
              reject(new Error(UPLOAD_CANCELLED_MESSAGE));
              return;
            }

            if (error) {
              uploadWidget.close();
              reject(new Error(error.message || 'Video upload failed. Please try again.'));
              return;
            }

            if (isSuccessResult(result)) {
              uploadWidget.close();

              resolve({
                serviceId: this.id,
                src: result.info.public_id,
                width: result.info.width,
                height: result.info.height,
                duration: result.info.duration,
                providerData: {
                  publicId: result.info.public_id,
                  version: result.info.version,
                  format: result.info.format,
                  originalFilename: result.info.original_filename,
                  resourceType: result.info.resource_type || 'video',
                  secureUrl: result.info.secure_url,
                  poster: result.info.thumbnail_url,
                },
              });
            }
          }
        );
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

  async getVideoDisplayUrl(manifest: Manifest, ref: VideoRef): Promise<string> {
    const { cloudName } = getCloudinaryConfig(manifest);
    if (!cloudName) {
      return '';
    }

    return buildCloudinaryVideoUrl(cloudName, ref);
  }

  createMediaEntry(ref: ImageRef): Record<string, unknown> | undefined {
    return ref.providerData ? { ...ref.providerData } : undefined;
  }

  createVideoMediaEntry(ref: VideoRef): Record<string, unknown> | undefined {
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
export { UPLOAD_CANCELLED_MESSAGE };
