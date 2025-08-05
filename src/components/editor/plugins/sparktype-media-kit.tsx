'use client';

import { CaptionPlugin } from '@platejs/caption/react';
import {
  AudioPlugin,
  FilePlugin,
  ImagePlugin,
  MediaEmbedPlugin,
  PlaceholderPlugin,
  VideoPlugin,
} from '@platejs/media/react';
import { KEYS } from 'platejs';

import { AudioElement } from '@/components/ui/media-audio-node';
import { MediaEmbedElement } from '@/components/ui/media-embed-node';
import { FileElement } from '@/components/ui/media-file-node';
import { SparkTypeImageElement } from '@/components/ui/sparktype-image-element';
import { SparkTypePlaceholderElement } from '@/components/ui/sparktype-media-placeholder';
import { MediaPreviewDialog } from '@/components/ui/media-preview-dialog';
import { MediaUploadToast } from '@/components/ui/media-upload-toast';
import { VideoElement } from '@/components/ui/media-video-node';
import { createMarkdownKit } from './markdown-kit';

export function createSparkTypeMediaKit(siteId: string) {
  return [
    // Include siteId-aware MarkdownKit for proper ImageRef handling
    ...createMarkdownKit(siteId),
    ImagePlugin.configure({
      options: { disableUploadInsert: false },
      render: { afterEditable: MediaPreviewDialog, node: SparkTypeImageElement },
    }),
    MediaEmbedPlugin.withComponent(MediaEmbedElement),
    VideoPlugin.withComponent(VideoElement),
    AudioPlugin.withComponent(AudioElement),
    FilePlugin.withComponent(FileElement),
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