import { useEffect, useState } from 'react';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { getActiveImageService } from '@/core/services/images/images.service';
import { useAppStore } from '@/core/state/useAppStore';
import type { ImageRef } from '@/core/types';
import { inferImageRefFromSource, parseImageRef } from '../helpers';

interface SparktypeImageOptions {
  siteId?: string;
}

function SparktypeImageView(props: ReactNodeViewProps<HTMLDivElement>) {
  const { node, selected, extension } = props;
  const siteId = extension.options.siteId as string | undefined;
  const [displayUrl, setDisplayUrl] = useState<string>(node.attrs.src as string);

  useEffect(() => {
    let cancelled = false;

    async function resolveDisplayUrl() {
      try {
        const fallbackSrc = node.attrs.src as string;
        const fallbackAlt = (node.attrs.alt as string) || '';
        let imageRef = (node.attrs.imageRef as ImageRef | null) ?? parseImageRef(fallbackSrc, fallbackAlt);

        if (!siteId) {
          setDisplayUrl(fallbackSrc);
          return;
        }

        const site = useAppStore.getState().getSiteById(siteId);
        if (!site) {
          setDisplayUrl(fallbackSrc);
          return;
        }

        const imageService = getActiveImageService(site.manifest);
        imageRef ??= inferImageRefFromSource(fallbackSrc, fallbackAlt, imageService.id);

        if (!imageRef) {
          setDisplayUrl(fallbackSrc);
          return;
        }

        const url = await imageService.getDisplayUrl(
          site.manifest,
          imageRef,
          {
            width: imageRef.width,
            height: imageRef.height,
          },
          false,
        );

        if (!cancelled) {
          setDisplayUrl(url || fallbackSrc);
        }
      } catch {
        if (!cancelled) {
          setDisplayUrl(node.attrs.src as string);
        }
      }
    }

    void resolveDisplayUrl();

    return () => {
      cancelled = true;
    };
  }, [node.attrs.alt, node.attrs.imageRef, node.attrs.src, siteId]);

  return (
    <NodeViewWrapper
      className="my-4"
      contentEditable={false}
      data-node-type="image"
    >
      <img
        src={displayUrl}
        alt={(node.attrs.alt as string) || ''}
        title={(node.attrs.title as string) || undefined}
        className={`max-w-full rounded-md border border-border/50 ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      />
    </NodeViewWrapper>
  );
}

export const SparktypeImage = Image.extend<SparktypeImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      siteId: undefined,
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      imageRef: {
        default: null,
        renderHTML: () => ({}),
        parseHTML: () => null,
      },
    };
  },

  parseMarkdown: (token, helpers) => {
    const alt = typeof token.text === 'string' ? token.text : '';
    const src = typeof token.href === 'string' ? token.href : '';
    const imageRef = parseImageRef(src, alt);

    return helpers.createNode('image', {
      src,
      alt,
      title: typeof token.title === 'string' ? token.title : null,
      imageRef,
    });
  },

  renderMarkdown: (node) => {
    const attrs = node.attrs ?? {};
    const imageRef = attrs.imageRef as ImageRef | null;
    const src = typeof imageRef?.src === 'string' ? imageRef.src : (attrs.src as string) || '';
    const alt = (attrs.alt as string) || '';
    const title = (attrs.title as string | null) || null;

    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      {
        src: HTMLAttributes.src,
        alt: HTMLAttributes.alt,
        title: HTMLAttributes.title,
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SparktypeImageView);
  },
});
