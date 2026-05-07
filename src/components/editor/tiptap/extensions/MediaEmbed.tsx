import ReactPlayer from 'react-player';
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { escapeHtmlAttribute, getEmbedProvider, getEmbedSrc } from '../helpers';
import { NODE_NAMES } from '../constants';

function MediaEmbedView({ node, selected }: ReactNodeViewProps<HTMLDivElement>) {
  const url = node.attrs.url as string;
  const provider = (node.attrs.provider as string | null) ?? getEmbedProvider(url);

  return (
    <NodeViewWrapper className="my-4" contentEditable={false}>
      <div className={`overflow-hidden rounded-md border border-border/50 bg-muted/20 ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
        {provider === 'twitter' ? (
          <div className="p-4 text-sm">
            <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
              {url}
            </a>
          </div>
        ) : (
          <div className="aspect-video w-full bg-black">
            <ReactPlayer src={url} width="100%" height="100%" controls />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const MediaEmbed = Node.create({
  name: NODE_NAMES.mediaEmbed,
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: {
        default: '',
      },
      embedSrc: {
        default: '',
      },
      provider: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'iframe[src]',
        getAttrs: (element) => {
          const iframe = element as HTMLIFrameElement;
          const url = iframe.getAttribute('data-sparktype-embed-url') || iframe.getAttribute('src') || '';

          return {
            url,
            embedSrc: iframe.getAttribute('src') || getEmbedSrc(url),
            provider: getEmbedProvider(url),
          };
        },
      },
      {
        tag: 'div[data-sparktype-media-embed]',
        getAttrs: (element) => {
          const url = element.getAttribute('data-url') || '';

          return {
            url,
            embedSrc: element.getAttribute('data-embed-src') || getEmbedSrc(url),
            provider: getEmbedProvider(url),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const url = (HTMLAttributes.url as string) || '';
    const embedSrc = (HTMLAttributes.embedSrc as string) || getEmbedSrc(url);

    return [
      'iframe',
      {
        src: embedSrc,
        'data-sparktype-embed-url': url,
        allowfullscreen: 'true',
        sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
      },
    ];
  },

  renderMarkdown(node) {
    const url = (node.attrs?.url as string) || '';
    const embedSrc = ((node.attrs?.embedSrc as string) || getEmbedSrc(url)) || url;

    return `<iframe src="${escapeHtmlAttribute(embedSrc)}" data-sparktype-embed-url="${escapeHtmlAttribute(url)}" allowfullscreen="true"></iframe>`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaEmbedView);
  },
});
