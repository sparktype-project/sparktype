
import { CaptionPlugin } from '@platejs/caption/react';
import {
  ImagePlugin,
  MediaEmbedPlugin,
  PlaceholderPlugin,
} from '@platejs/media/react';
import { KEYS } from 'platejs';
import { createPlatePlugin } from 'platejs/react';
import { toast } from 'sonner';

import { MediaEmbedElement } from '@/components/ui/media-embed-node';
import { SparkTypeImageElement } from '@/components/ui/sparktype-image-element';
import { SparkTypePlaceholderElement } from '@/components/ui/sparktype-media-placeholder';
import { MediaPreviewDialog } from '@/components/ui/media-preview-dialog';
import { MediaUploadToast } from '@/components/ui/media-upload-toast';
import { getActiveImageService } from '@/core/services/images/images.service';
import { useAppStore } from '@/core/state/useAppStore';
import { createMarkdownKit } from './markdown-kit';

const TEXT_HTML_MIME = 'text/html';
const TEXT_PLAIN_MIME = 'text/plain';

function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer();

  files.forEach((file) => {
    dataTransfer.items.add(file);
  });

  return dataTransfer.files;
}

function stripImagesFromHtml(html: string): string {
  if (!html.trim()) return '';

  try {
    const document = new DOMParser().parseFromString(html, 'text/html');

    document.querySelectorAll('img').forEach((image) => image.remove());

    return document.body.innerHTML;
  } catch {
    return html;
  }
}

function supportsVideoUpload(siteId: string): boolean {
  const site = useAppStore.getState().getSiteById(siteId);
  if (!site) return false;

  return Boolean(getActiveImageService(site.manifest).capabilities?.videoUpload);
}

const createSparkTypeClipboardMediaPlugin = (siteId: string) => createPlatePlugin({
  key: 'sparktype-clipboard-image-upload',
  handlers: {
    onPaste: ({ editor, event }) => {
      const clipboardData = event.clipboardData;

      if (!clipboardData) return false;

      const videoFiles = Array.from(clipboardData.files).filter((file) =>
        file.type.startsWith('video/')
      );

      if (videoFiles.length > 0 && !supportsVideoUpload(siteId)) {
        event.preventDefault();
        event.stopPropagation();
        toast.error('Video file uploads require a remote media provider such as Cloudinary.');
        return true;
      }

      const imageFiles = Array.from(clipboardData.files).filter((file) =>
        file.type.startsWith('image/')
      );

      if (imageFiles.length === 0) return false;

      const originalHtml = clipboardData.getData(TEXT_HTML_MIME);
      const html = stripImagesFromHtml(originalHtml);
      const plainText = clipboardData.getData(TEXT_PLAIN_MIME);
      const hasClipboardContent =
        originalHtml.trim().length > 0 || plainText.trim().length > 0;

      if (!hasClipboardContent) return false;

      event.preventDefault();
      event.stopPropagation();

      const textTransfer = new DataTransfer();

      if (html.trim().length > 0) {
        textTransfer.setData(TEXT_HTML_MIME, html);
      }

      if (plainText.trim().length > 0) {
        textTransfer.setData(TEXT_PLAIN_MIME, plainText);
      }

      if (textTransfer.types.length > 0) {
        editor.tf.insertData(textTransfer);
      }
      editor
        .getTransforms(PlaceholderPlugin)
        .insert.media(createFileList(imageFiles), { nextBlock: false });

      return true;
    },
    onDrop: ({ event }) => {
      const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
        file.type.startsWith('video/')
      );

      if (files.length === 0 || supportsVideoUpload(siteId)) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      toast.error('Video file uploads require a remote media provider such as Cloudinary.');
      return true;
    },
  },
});

export function createSparkTypeMediaKit(siteId: string) {
  return [
    // Include siteId-aware MarkdownKit for proper ImageRef handling
    ...createMarkdownKit(siteId),
    createSparkTypeClipboardMediaPlugin(siteId),
    ImagePlugin.configure({
      options: { disableUploadInsert: true },
      render: { afterEditable: MediaPreviewDialog, node: SparkTypeImageElement },
    }),
    MediaEmbedPlugin.withComponent(MediaEmbedElement),

    PlaceholderPlugin.configure({
      options: { disableEmptyPlaceholder: true },
      render: {
        afterEditable: MediaUploadToast,
        node: (props) => <SparkTypePlaceholderElement {...props} siteId={siteId} />
      },
    }),
    CaptionPlugin.configure({
      options: {
        query: {
          allow: [KEYS.img, KEYS.video, KEYS.audio, KEYS.file, KEYS.mediaEmbed],
        },
      },
    }),
  ];
}
