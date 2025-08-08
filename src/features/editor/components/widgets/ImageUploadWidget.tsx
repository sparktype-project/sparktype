// src/features/editor/components/ImageUploadWidget.tsx

import { useEffect, useState } from 'react';
import type { WidgetProps } from '@rjsf/utils';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { Button } from '@/core/components/ui/button';
// import { Label } from '@/core/components/ui/label'; // Unused import
import { UploadCloud, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MEMORY_CONFIG } from '@/config/editorConfig';

export default function ImageUploadWidget(props: WidgetProps) {
  const { id, label, value: imageRef, onChange, formContext } = props;
  const siteId = formContext.siteId as string;

  const site = useAppStore(state => state.getSiteById(siteId));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    const generatePreview = async () => {
      if (imageRef && site?.manifest) {
        try {
          const service = getActiveImageService(site.manifest);
          const url = await service.getDisplayUrl(site.manifest, imageRef, { width: 256, crop: 'fit' }, false);
          setPreviewUrl(url);
          if (url.startsWith('blob:')) {
            objectUrl = url;
          }
        } catch (error) {
          console.error(`Could not generate preview for ${label}:`, error);
          setPreviewUrl(null);
        }
      } else {
        setPreviewUrl(null);
      }
    };
    generatePreview();
    
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageRef, site, label]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !site?.manifest) return;

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
    try {
      const service = getActiveImageService(site.manifest);
      const newRef = await service.upload(file, siteId);
      onChange(newRef);
      toast.success(`${label} uploaded successfully.`);
    } catch (error) {
      console.error(`Upload failed for ${label}:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
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
      ) : (
        <label
          htmlFor={id}
          className="flex flex-col items-center justify-center w-full  border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80 p-0"
        >
          <div className="flex flex-row items-center justify-center py-3 px-0 w-full gap-3">
            <UploadCloud className="w-8 h-8  text-muted-foreground" />
            <div>
            <p className="mb-1 text-sm text-muted-foreground">
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