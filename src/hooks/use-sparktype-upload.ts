import * as React from 'react';
import { getActiveImageService } from '@/core/services/images/images.service';
import { useAppStore } from '@/core/state/useAppStore';
import type { ImageRef } from '@/core/types';
import { toast } from 'sonner';

interface UseSparkTypeUploadProps {
  siteId: string;
  onUploadComplete?: (imageRef: ImageRef) => void;
  onUploadError?: (error: unknown) => void;
}

export interface SparkTypeUploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  imageRef: ImageRef;
}

export function useSparkTypeUpload({
  siteId,
  onUploadComplete,
  onUploadError,
}: UseSparkTypeUploadProps) {
  const [uploadedFile, setUploadedFile] = React.useState<SparkTypeUploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);

  const uploadFile = React.useCallback(async (file: File): Promise<SparkTypeUploadedFile | undefined> => {
    if (!siteId) {
      const error = new Error('Site ID is required for image upload');
      onUploadError?.(error);
      toast.error('Site ID is required for image upload');
      return;
    }

    setIsUploading(true);
    setUploadingFile(file);
    setProgress(0);

    try {
      // Get the site and its manifest to determine which image service to use
      const site = useAppStore.getState().getSiteById(siteId);
      if (!site) {
        throw new Error('Site not found');
      }

      const imageService = getActiveImageService(site.manifest);
      
      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      // Upload the image using the Sparktype image service
      const imageRef = await imageService.upload(file, siteId);
      
      clearInterval(progressInterval);
      setProgress(100);

      // Generate the display URL for the uploaded image (blob URL for editor preview)
      const displayUrl = await imageService.getDisplayUrl(
        site.manifest,
        imageRef,
        { width: imageRef.width, height: imageRef.height },
        false // isExport = false for editor preview (generates blob URLs)
      );

      const uploadedFile: SparkTypeUploadedFile = {
        url: displayUrl, // Use blob URL for editor display
        name: file.name,
        size: file.size,
        type: file.type,
        imageRef,
      };

      setUploadedFile(uploadedFile);
      onUploadComplete?.(imageRef);

      return uploadedFile;
    } catch (error) {
      console.error('SparkType image upload failed:', error);
      onUploadError?.(error);
      
      const message = error instanceof Error ? error.message : 'Image upload failed';
      toast.error(message);
      
      return undefined;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }, [siteId, onUploadComplete, onUploadError]);

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
}