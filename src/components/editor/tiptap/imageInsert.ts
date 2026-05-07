import { toast } from 'sonner';
import { UPLOAD_CANCELLED_MESSAGE } from '@/core/services/images/cloudinaryImage.service';
import type { ImageRef, ImageService, LocalSiteData } from '@/core/types';
import { NODE_NAMES } from './constants';

export type ProviderImageInsertService =
  Pick<ImageService, 'capabilities' | 'getDisplayUrl'> &
  Required<Pick<ImageService, 'startUpload'>>;

export function usesProviderImageInsert(
  service: Pick<ImageService, 'capabilities' | 'startUpload'> | undefined,
): service is ProviderImageInsertService {
  return service?.capabilities?.uploadInteraction === 'provider-widget' && typeof service.startUpload === 'function';
}

interface InsertProviderImageOptions {
  siteId: string;
  site: LocalSiteData;
  service: ProviderImageInsertService;
  beginProviderUpload: () => void;
  endProviderUpload: () => void;
  insertImage: (attrs: {
    src: string;
    alt: string;
    title: null;
    imageRef: ImageRef;
  }) => void;
}

export async function insertProviderImage({
  siteId,
  site,
  service,
  beginProviderUpload,
  endProviderUpload,
  insertImage,
}: InsertProviderImageOptions): Promise<boolean> {
  beginProviderUpload();

  try {
    const imageRef = await service.startUpload(siteId, {
      manifest: site.manifest,
      secrets: site.secrets,
      site,
    });

    const displayUrl = await service.getDisplayUrl(
      site.manifest,
      imageRef,
      {
        width: imageRef.width,
        height: imageRef.height,
      },
      false,
    );

    insertImage({
      src: displayUrl,
      alt: imageRef.alt || '',
      title: null,
      imageRef,
    });

    return true;
  } catch (error) {
    if (error instanceof Error && error.message === UPLOAD_CANCELLED_MESSAGE) {
      return false;
    }

    const message = error instanceof Error ? error.message : 'Image upload failed';
    toast.error(message);
    return false;
  } finally {
    endProviderUpload();
  }
}

export function createInsertedImageContent(attrs: {
  src: string;
  alt: string;
  title: null;
  imageRef: ImageRef;
}) {
  return {
    type: NODE_NAMES.image,
    attrs,
  } as const;
}
