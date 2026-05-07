import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import type { VideoRef } from '@/core/types';
import { escapeHtmlAttribute, normalizeProviderAttributeKey } from '../helpers';
import { NODE_NAMES } from '../constants';

function SparktypeVideoView({ node, selected }: ReactNodeViewProps<HTMLDivElement>) {
  const serviceId = (node.attrs.videoRef as VideoRef | null)?.serviceId;

  return (
    <NodeViewWrapper className="my-4" contentEditable={false}>
      <figure className={`overflow-hidden rounded-md border border-border/50 bg-muted/20 ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
        <video
          src={node.attrs.src as string}
          poster={(node.attrs.poster as string) || undefined}
          controls
          preload="metadata"
          className="aspect-video w-full bg-black"
        />
        <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
          <span>{serviceId ? `Uploaded via ${serviceId}` : 'Direct video'}</span>
          {(node.attrs.videoRef as VideoRef | null)?.duration ? (
            <span>{Math.round(((node.attrs.videoRef as VideoRef).duration ?? 0) / 1)}s</span>
          ) : null}
        </figcaption>
      </figure>
    </NodeViewWrapper>
  );
}

export const SparktypeVideo = Node.create({
  name: NODE_NAMES.video,
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: '',
      },
      poster: {
        default: null,
      },
      isUpload: {
        default: false,
      },
      videoRef: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'video[src]',
        getAttrs: (element) => {
          const video = element as HTMLVideoElement;
          const serviceId = video.getAttribute('data-sparktype-service-id');
          const source = video.getAttribute('data-sparktype-video-src');
          const poster = video.getAttribute('data-sparktype-poster') || video.getAttribute('poster');
          const width = video.getAttribute('data-sparktype-width');
          const height = video.getAttribute('data-sparktype-height');
          const duration = video.getAttribute('data-sparktype-duration');

          const providerData = Object.fromEntries(
            [...video.attributes]
              .filter((attribute) => attribute.name.startsWith('data-sparktype-provider-'))
              .map((attribute) => [
                normalizeProviderAttributeKey(attribute.name.replace('data-sparktype-provider-', '')),
                attribute.value,
              ]),
          );

          const videoRef = serviceId && source
            ? {
                serviceId,
                src: source,
                poster: poster ?? undefined,
                width: width ? Number(width) : undefined,
                height: height ? Number(height) : undefined,
                duration: duration ? Number(duration) : undefined,
                providerData: Object.keys(providerData).length > 0 ? providerData : undefined,
              }
            : null;

          return {
            src: video.getAttribute('src') ?? '',
            poster,
            isUpload: video.getAttribute('data-sparktype-upload') === 'true',
            videoRef,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as {
      src?: string;
      poster?: string | null;
      isUpload?: boolean;
      videoRef?: VideoRef | null;
    };

    const videoRef = attrs.videoRef;
    const htmlAttributes: Record<string, string> = {
      src: attrs.src || '',
      controls: '',
      preload: 'metadata',
    };

    if (attrs.poster) {
      htmlAttributes.poster = attrs.poster;
    }
    if (attrs.isUpload) {
      htmlAttributes['data-sparktype-upload'] = 'true';
    }
    if (videoRef?.serviceId) {
      htmlAttributes['data-sparktype-service-id'] = videoRef.serviceId;
    }
    if (videoRef?.src) {
      htmlAttributes['data-sparktype-video-src'] = videoRef.src;
    }
    if (videoRef?.poster) {
      htmlAttributes['data-sparktype-poster'] = videoRef.poster;
    }
    if (videoRef?.width) {
      htmlAttributes['data-sparktype-width'] = String(videoRef.width);
    }
    if (videoRef?.height) {
      htmlAttributes['data-sparktype-height'] = String(videoRef.height);
    }
    if (videoRef?.duration) {
      htmlAttributes['data-sparktype-duration'] = String(videoRef.duration);
    }

    if (videoRef?.providerData) {
      for (const [key, value] of Object.entries(videoRef.providerData)) {
        if (value === undefined || value === null) {
          continue;
        }

        htmlAttributes[`data-sparktype-provider-${key}`] = String(value);
      }
    }

    return ['video', htmlAttributes];
  },

  renderMarkdown(node) {
    const attrs = node.attrs as {
      src: string;
      poster?: string | null;
      isUpload?: boolean;
      videoRef?: VideoRef | null;
    };

    const pieces = [`src="${escapeHtmlAttribute(attrs.src || '')}"`, 'controls', 'preload="metadata"'];

    if (attrs.isUpload) {
      pieces.push('data-sparktype-upload="true"');
    }
    if (attrs.poster) {
      pieces.push(`poster="${escapeHtmlAttribute(attrs.poster)}"`);
    }
    if (attrs.videoRef?.serviceId) {
      pieces.push(`data-sparktype-service-id="${escapeHtmlAttribute(attrs.videoRef.serviceId)}"`);
    }
    if (attrs.videoRef?.src) {
      pieces.push(`data-sparktype-video-src="${escapeHtmlAttribute(attrs.videoRef.src)}"`);
    }
    if (attrs.videoRef?.poster) {
      pieces.push(`data-sparktype-poster="${escapeHtmlAttribute(attrs.videoRef.poster)}"`);
    }
    if (attrs.videoRef?.width) {
      pieces.push(`data-sparktype-width="${String(attrs.videoRef.width)}"`);
    }
    if (attrs.videoRef?.height) {
      pieces.push(`data-sparktype-height="${String(attrs.videoRef.height)}"`);
    }
    if (attrs.videoRef?.duration) {
      pieces.push(`data-sparktype-duration="${String(attrs.videoRef.duration)}"`);
    }

    if (attrs.videoRef?.providerData) {
      for (const [key, value] of Object.entries(attrs.videoRef.providerData)) {
        if (value === undefined || value === null) {
          continue;
        }

        pieces.push(`data-sparktype-provider-${key}="${escapeHtmlAttribute(String(value))}"`);
      }
    }

    return `<video ${pieces.join(' ')}></video>`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(SparktypeVideoView);
  },
});
