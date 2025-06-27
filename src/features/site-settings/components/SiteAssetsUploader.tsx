// src/features/site-settings/components/SiteAssetsUploader.tsx

import { useEffect, useState } from 'react';
// REMOVED: import Image from 'next/image';
import { type ImageRef } from '@/core/types';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import { Button } from '@/core/components/ui/button';
import { UploadCloud, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MEMORY_CONFIG } from '@/config/editorConfig';

interface SiteAssetUploaderProps {
  siteId: string;
  label: string;
  value: ImageRef | undefined;
  onChange: (newRef: ImageRef) => void;
  onRemove: () => void;
}

export default function SiteAssetUploader({ siteId, label, value, onChange, onRemove }: SiteAssetUploaderProps) {
  const site = useAppStore(state => state.getSiteById(siteId));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    const generatePreview = async () => {
      if (value && site?.manifest) {
        try {
          const service = getActiveImageService(site.manifest);
          const url = await service.getDisplayUrl(site.manifest, value, { width: 128, height: 128, crop: 'fit' }, false);
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
  }, [value, site, label]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !site?.manifest) return;

    const isSvg = file.type === 'image/svg+xml';
    if (!MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type as typeof MEMORY_CONFIG.SUPPORTED_IMAGE_TYPES[number])) {
      toast.error(`Unsupported file type. Please use one of: ${MEMORY_CONFIG.SUPPORTED_EXTENSIONS.join(', ')}`);
      event.target.value = '';
      return;
    }

    const maxSize = isSvg ? MEMORY_CONFIG.MAX_SVG_SIZE : MEMORY_CONFIG.MAX_UPLOAD_SIZE;
    if (file.size > maxSize) {
      const maxSizeFormatted = (maxSize / 1024 / (isSvg ? 1 : 1024)).toFixed(1);
      const unit = isSvg ? 'KB' : 'MB';
      toast.error(`Image is too large. Max size is ${maxSizeFormatted}${unit}.`);
      event.target.value = '';
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
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const inputId = `uploader-${label.toLowerCase().replace(/\s/g, '-')}`;

  return (
    <div className="flex items-center gap-4">
      {/* The parent container needs `relative` for the absolute positioning of the img tag */}
      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 relative">
        {previewUrl ? (
          // FIX: Replaced next/image's <Image> with a standard <img> tag.
          // The `object-contain` class replicates the default behavior.
          <img src={previewUrl} alt={`${label} preview`} className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <UploadCloud className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-grow">
        <label htmlFor={inputId} className="font-medium text-sm">{label}</label>
        <div className="flex items-center gap-2 mt-1">
          <Button asChild size="sm" variant="outline" disabled={isUploading}>
            <label htmlFor={inputId} className="cursor-pointer">
              {isUploading ? 'Uploading...' : (value ? 'Change...' : 'Upload...')}
            </label>
          </Button>
          <input 
            type="file" 
            id={inputId} 
            className="hidden" 
            onChange={handleFileSelect} 
            accept={MEMORY_CONFIG.SUPPORTED_EXTENSIONS.join(',')} 
          />
          {value && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onRemove}>
              <XCircle className="w-4 h-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}