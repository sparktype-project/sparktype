// src/core/services/images/cloudinaryImage.service.ts
import type { ImageService, ImageRef, ImageTransformOptions, Manifest } from '@/core/types';
import { useAppStore } from '@/core/state/useAppStore';
import { Cloudinary } from "@cloudinary/url-gen";
import { fill, fit, scale } from "@cloudinary/url-gen/actions/resize";
import { Gravity } from "@cloudinary/url-gen/qualifiers/gravity";
import { format, quality } from "@cloudinary/url-gen/actions/delivery";

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

declare const cloudinary: {
  createUploadWidget: (
    options: object,
    callback: (error: UploadWidgetError | null, result: UploadWidgetResult | null) => void
  ) => { open: () => void; close: () => void; };
};

class CloudinaryImageService implements ImageService {
  id = 'cloudinary';
  name = 'Upload to Cloudinary';

  async upload(_file: File, siteId: string, site?: any): Promise<ImageRef> {
    // Note: site parameter added to avoid getState() call
    // This service should be called with site data from React components
    if (!site) {
      // Fallback to getState() only if site not provided (for backward compatibility)
      const storeState = useAppStore.getState();
      site = storeState.getSiteById(siteId);
      if (!site) throw new Error(`Site with ID "${siteId}" not found in state.`);
    }

    const cloudName = site.manifest?.settings?.cloudinary?.cloudName;
    const uploadPreset = site.secrets?.cloudinary?.uploadPreset;

    if (!cloudName || !uploadPreset) throw new Error("Cloudinary Cloud Name and Upload Preset must be configured.");

    return new Promise((resolve, reject) => {
      const widget = cloudinary.createUploadWidget(
        { cloudName, uploadPreset, sources: ['local', 'url', 'camera'], multiple: false },
        (error, result) => {
          if (error) {
            console.error('Cloudinary Upload Error:', error);
            widget.close();
            return reject(new Error(error.message || 'Image upload failed. Please try again.'));
          }

          if (result && result.event === 'success') {
            const { public_id, width, height } = result.info;
            const srcPath = public_id;
            
            widget.close();
            resolve({
              serviceId: 'cloudinary', src: srcPath,
              alt: result.info.original_filename || 'Uploaded image', width, height,
            });
          }
        }
      );
      widget.open();
    });
  }

  async getDisplayUrl(manifest: Manifest, ref: ImageRef, options: ImageTransformOptions, _isExport?: boolean, _forIframe?: boolean): Promise<string> {
    const cloudName = manifest.settings?.cloudinary?.cloudName;
    if (!cloudName) return ''; // Return empty string or a placeholder if not configured
    
    const cld = new Cloudinary({ cloud: { cloudName: cloudName } });
    const cldImage = cld.image(ref.src);

    const { width, height, crop = 'scale', gravity } = options;

    switch (crop) {
        case 'fill':
            const fillResize = fill(width, height);
            if (gravity === 'auto') fillResize.gravity(Gravity.autoGravity());
            else if (gravity && ['north', 'south', 'east', 'west'].includes(gravity)) fillResize.gravity(Gravity.compass(gravity));
            else if (gravity === 'center') fillResize.gravity(Gravity.xyCenter());
            cldImage.resize(fillResize);
            break;
        case 'fit': cldImage.resize(fit(width, height)); break;
        case 'scale': default: cldImage.resize(scale(width, height)); break;
    }

    cldImage.delivery(format('auto')).delivery(quality('auto'));
    return cldImage.toURL();
  }

  async getExportableAssets(): Promise<{ path: string; data: Blob; }[]> {
    // Cloudinary assets are remote, so there are no local files to export.
    return Promise.resolve([]);
  }
}

export const cloudinaryImageService = new CloudinaryImageService();