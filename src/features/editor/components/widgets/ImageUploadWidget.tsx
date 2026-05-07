// src/features/editor/components/ImageUploadWidget.tsx

import { useEffect, useState } from 'react';
import type { WidgetProps } from '@rjsf/utils';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { UPLOAD_CANCELLED_MESSAGE } from '@/core/services/images/cloudinaryImage.service';
import { useEditor } from '@/features/editor/contexts/useEditor';
import { Button } from '@/core/components/ui/button';
import { UploadCloud, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MEMORY_CONFIG } from '@/config/editorConfig';

const IMAGE_WIDGET_PREVIEW_OPTIONS = {
  width: 960,
  height: 540,
  crop: 'fit' as const,
};

function getProviderPreviewUrl(providerData: unknown): string | null {
  if (!providerData || typeof providerData !== 'object') {
    return null;
  }

  const secureUrl = (providerData as Record<string, unknown>).secureUrl;
  return typeof secureUrl === 'string' ? secureUrl : null;
}

export default function ImageUploadWidget(props: WidgetProps) {
  const { id, label, value: imageRef, onChange, formContext } = props;
  const siteId = formContext.siteId as string;

  const site = useAppStore(state => state.getSiteById(siteId));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { beginProviderUpload, endProviderUpload } = useEditor();
  const service = site?.manifest ? getActiveImageService(site.manifest) : undefined;
  const usesProviderWidget = service?.capabilities?.uploadInteraction === 'provider-widget' && typeof service.startUpload === 'function';

  useEffect(() => {
    const generatePreview = async () => {
      if (imageRef && site?.manifest && service) {
        try {
          console.log(`[ImageUploadWidget] Generating preview for ${label}`);
          console.log(`[ImageUploadWidget] Using image service:`, service.constructor.name);
          const startTime = Date.now();

          const url = await service.getDisplayUrl(
            site.manifest,
            imageRef,
            IMAGE_WIDGET_PREVIEW_OPTIONS,
            false,
            false,
            true
          );
          const endTime = Date.now();
          const previewUrl = url || getProviderPreviewUrl(imageRef.providerData);
          console.log(`[ImageUploadWidget] Preview generated in ${endTime - startTime}ms, url:`, previewUrl);
          setPreviewUrl(previewUrl);
        } catch (error) {
          console.error(`[ImageUploadWidget] Could not generate preview for ${label}:`, error);
          setPreviewUrl(getProviderPreviewUrl(imageRef.providerData));
        }
      } else {
        console.log(`[ImageUploadWidget] No preview - imageRef: ${imageRef}, site: ${!!site?.manifest}`);
        setPreviewUrl(null);
      }
    };
    generatePreview();
  }, [imageRef, label, service, site]);

  // Cleanup blob URLs only on actual component unmount (not recreation)
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []); // Empty dependency array - only run on unmount

  const uploadContext = site?.manifest
    ? {
        manifest: site.manifest,
        secrets: site.secrets,
        site,
      }
    : undefined;

  const handleProviderUpload = async () => {
    if (!site?.manifest || !service?.startUpload || !uploadContext) {
      return;
    }

    console.log(`[ImageUploadWidget] Starting provider upload for ${label}`);
    beginProviderUpload();

    try {
      const uploadStartTime = Date.now();
      const newRef = await service.startUpload(siteId, uploadContext);
      const uploadEndTime = Date.now();
      console.log(`[ImageUploadWidget] Provider upload completed in ${uploadEndTime - uploadStartTime}ms`);
      onChange(newRef);
      toast.success(`${label} uploaded successfully.`);
    } catch (error) {
      if (error instanceof Error && error.message === UPLOAD_CANCELLED_MESSAGE) {
        console.log(`[ImageUploadWidget] Provider upload cancelled for ${label}`);
        return;
      }

      console.error(`[ImageUploadWidget] Provider upload failed for ${label}:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      toast.error(errorMsg);
    } finally {
      endProviderUpload();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !site?.manifest || !service || !uploadContext) return;

    console.log(`[ImageUploadWidget] File selected: ${file.name}, size: ${file.size}, type: ${file.type}`);

    const isSvg = file.type === 'image/svg+xml';
    if (!MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type as typeof MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES[number])) {
      toast.error(`Unsupported file type.`);
      return;
    }
    const maxSize = isSvg ? MEMORY_CONFIG.MAX_SVG_SIZE : MEMORY_CONFIG.MAX_UPLOAD_SIZE;
    if (file.size > maxSize) {
      const maxSizeFormatted = (maxSize / 1024 / (isSvg ? 1 : 1024)).toFixed(1);
      const unit = isSvg ? 'KB' : 'MB';
      toast.error(`Image is too large. Max size is ${maxSizeFormatted}${unit}.`);
      return;
    }

    setIsUploading(true);
    console.log(`[ImageUploadWidget] Starting upload for ${file.name}`);
    try {
      console.log(`[ImageUploadWidget] Using upload service:`, service.constructor.name);
      const uploadStartTime = Date.now();
      const newRef = await service.upload(file, siteId, uploadContext);
      const uploadEndTime = Date.now();
      console.log(`[ImageUploadWidget] Upload completed in ${uploadEndTime - uploadStartTime}ms`);
      onChange(newRef);
      console.log(`[ImageUploadWidget] onChange called with new ref`);
      toast.success(`${label} uploaded successfully.`);
    } catch (error) {
      console.error(`[ImageUploadWidget] Upload failed for ${label}:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
      console.log(`[ImageUploadWidget] Upload process finished, isUploading set to false`);
      event.target.value = '';
    }
  };

  const handleRemove = () => {
    onChange(undefined);
  };

  return (
    <div className="space-y-2">


      {previewUrl ? (
        <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden">
          <img src={previewUrl} alt={`${label} preview`} className="absolute inset-0 w-full h-full object-contain" />
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={handleRemove}
            aria-label={`Remove ${label}`}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ) : usesProviderWidget ? (
        <Button
          type="button"
          variant="outline"
          className="flex h-auto w-full flex-row items-center justify-center gap-3 rounded-lg bg-muted p-3 text-left hover:bg-muted/80"
          onClick={handleProviderUpload}
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              <span className="font-semibold">{`Upload via ${service.name}`}</span>
            </p>
            <p className="text-xs text-muted-foreground">Use your configured provider picker.</p>
          </div>
        </Button>
      ) : (
        <label
          htmlFor={id}
          className="flex flex-col items-center justify-center w-full  rounded-lg cursor-pointer bg-muted hover:bg-muted/80 p-0"
        >
          <div className="flex flex-row items-center justify-center py-3 px-0 w-full gap-3">
            <UploadCloud className="w-8 h-8  text-muted-foreground" />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP (Max 5MB)</p>
            </div>
          </div>
          <input
            id={id}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept={MEMORY_CONFIG.SUPPORTED_EXTENSIONS.join(',')}
            disabled={isUploading}
          />
        </label>
      )}


      {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
    </div>
  );
}
