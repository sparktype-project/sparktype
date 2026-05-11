import { toast } from 'sonner';
import { UPLOAD_CANCELLED_MESSAGE } from '@/core/services/images/cloudinaryImage.service';
import type { ImageService, LocalSiteData, VideoRef } from '@/core/types';
import { NODE_NAMES } from './constants';

export type ProviderVideoInsertService =
  Pick<ImageService, 'capabilities'> &
  Required<Pick<ImageService, 'startVideoUpload' | 'getVideoDisplayUrl'>>;

export function supportsUploadedVideoInsert(
  service: Pick<ImageService, 'capabilities' | 'uploadVideo' | 'startVideoUpload'> | undefined,
): boolean {
  return Boolean(
    service?.capabilities?.videoUpload &&
    service.capabilities.videoExportMode !== 'bundle' &&
    (typeof service.uploadVideo === 'function' || typeof service.startVideoUpload === 'function'),
  );
}

export function usesProviderVideoInsert(
  service: Pick<ImageService, 'capabilities' | 'startVideoUpload'> | undefined,
): service is ProviderVideoInsertService {
  return (
    service?.capabilities?.uploadInteraction === 'provider-widget' &&
    service.capabilities.videoUpload === true &&
    service.capabilities.videoExportMode !== 'bundle' &&
    typeof service.startVideoUpload === 'function'
  );
}

interface InsertProviderVideoOptions {
  siteId: string;
  site: LocalSiteData;
  service: ProviderVideoInsertService;
  beginProviderUpload: () => void;
  endProviderUpload: () => void;
  insertVideo: (attrs: {
    src: string;
    poster: string | null;
    isUpload: true;
    videoRef: VideoRef;
  }) => void;
}

export async function insertProviderVideo({
  siteId,
  site,
  service,
  beginProviderUpload,
  endProviderUpload,
  insertVideo,
}: InsertProviderVideoOptions): Promise<boolean> {
  beginProviderUpload();

  try {
    const videoRef = await service.startVideoUpload(siteId, {
      manifest: site.manifest,
      secrets: site.secrets,
      site,
    });

    const displayUrl = await service.getVideoDisplayUrl(
      site.manifest,
      videoRef,
      false,
    );

    insertVideo({
      src: displayUrl,
      poster: videoRef.poster ?? null,
      isUpload: true,
      videoRef,
    });

    return true;
  } catch (error) {
    if (error instanceof Error && error.message === UPLOAD_CANCELLED_MESSAGE) {
      return false;
    }

    const message = error instanceof Error ? error.message : 'Video upload failed';
    toast.error(message);
    return false;
  } finally {
    endProviderUpload();
  }
}

export function createInsertedVideoContent(attrs: {
  src: string;
  poster: string | null;
  isUpload: true;
  videoRef: VideoRef;
}) {
  return {
    type: NODE_NAMES.video,
    attrs,
  } as const;
}
