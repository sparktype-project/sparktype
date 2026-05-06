import { useState, useCallback } from 'react';
import { getActiveImageService } from '@/core/services/images/images.service';
import { useAppStore } from '@/core/state/useAppStore';
import type { ImageRef, VideoRef } from '@/core/types';
import { toast } from 'sonner';
import { KEYS } from 'platejs';

interface UseSparkTypeUploadProps {
  siteId: string;
  mediaType?: string;
  onUploadComplete?: (mediaRef: ImageRef | VideoRef) => void;
  onUploadError?: (error: unknown) => void;
}

export interface SparkTypeUploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  mediaRef: ImageRef | VideoRef;
}

export function useSparkTypeUpload({
  siteId,
  mediaType = KEYS.img,
  onUploadComplete,
  onUploadError,
}: UseSparkTypeUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<SparkTypeUploadedFile>();
  const [uploadingFile, setUploadingFile] = useState<File>();
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(async (file: File): Promise<SparkTypeUploadedFile | undefined> => {
    if (!siteId) {
      const error = new Error('Site ID is required for media upload');
      onUploadError?.(error);
      toast.error('Site ID is required for media upload');
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

      const uploadContext = {
        manifest: site.manifest,
        secrets: site.secrets,
        site,
      };

      const mediaRef =
        mediaType === KEYS.video
          ? await (() => {
              if (!imageService.capabilities?.videoUpload || !imageService.uploadVideo) {
                throw new Error('The active media provider does not support video uploads.');
              }

              return imageService.uploadVideo(file, siteId, uploadContext);
            })()
          : await imageService.upload(file, siteId, uploadContext);
      
      clearInterval(progressInterval);
      setProgress(100);

      const displayUrl = mediaType === KEYS.video
        ? await (() => {
            if (!imageService.getVideoDisplayUrl) {
              throw new Error('The active media provider cannot resolve uploaded videos.');
            }

            return imageService.getVideoDisplayUrl(site.manifest, mediaRef as VideoRef, false);
          })()
        : await imageService.getDisplayUrl(
            site.manifest,
            mediaRef as ImageRef,
            { width: mediaRef.width, height: mediaRef.height },
            false
          );

      const uploadedFile: SparkTypeUploadedFile = {
        url: displayUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        mediaRef,
      };

      setUploadedFile(uploadedFile);
      onUploadComplete?.(mediaRef);

      return uploadedFile;
    } catch (error) {
      console.error('SparkType media upload failed:', error);
      onUploadError?.(error);
      
      const message = error instanceof Error ? error.message : 'Media upload failed';
      toast.error(message);
      
      return undefined;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }, [mediaType, siteId, onUploadComplete, onUploadError]);

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
}
