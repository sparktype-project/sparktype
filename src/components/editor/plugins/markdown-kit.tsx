import { MarkdownPlugin, remarkMdx, remarkMention, columnRules } from '@platejs/markdown';
import { KEYS } from 'platejs';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
/* eslint-disable react-refresh/only-export-components */
import type { ContainerDirective, LeafDirective } from 'mdast-util-directive';
import type { MdxJsxAttribute, MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import type { ImageRef, VideoRef } from '@/core/types';

interface MarkdownImageNode {
  url: string;
  alt?: string | null;
  title?: string | null;
}

interface SlateImageNode {
  url: string;
  alt?: string | null;
  title?: string | null;
  imageRef?: ImageRef | null;
}

interface SlateVideoNode {
  url: string;
  isUpload?: boolean;
  poster?: string;
  videoRef?: VideoRef;
}

interface CollectionViewSlateNode {
  collection?: string;
  layout?: string;
  displayType?: string;
  maxItems?: number;
  sortBy?: string;
  sortOrder?: string;
  tagFilters?: string[];
}

function getMdxAttributeValue(
  mdastNode: Pick<MdxJsxFlowElement, 'attributes'>,
  attributeName: string
): string | undefined {
  const attribute = mdastNode.attributes?.find((item): item is MdxJsxAttribute => item.type === 'mdxJsxAttribute' && item.name === attributeName);
  return typeof attribute?.value === 'string' ? attribute.value : undefined;
}

// Create a factory function to inject siteId into deserialization
export function createMarkdownKit(siteId?: string) {
  return [
    MarkdownPlugin.configure({
    options: {
      disallowedNodes: [KEYS.suggestion],
      remarkPlugins: [remarkMath, remarkGfm, remarkMdx, remarkMention, remarkDirective],
      rules: {
        // Import default column rules from PlateJS for MDX-based column serialization
        ...columnRules,

        // Custom serialization rule for images to convert blob URLs back to asset paths
        [KEYS.img]: {
          serialize: (slateNode: SlateImageNode) => {
            let url = slateNode.url;
            
            // Transform blob URLs back to asset paths during serialization
            if (url.startsWith('blob:') && slateNode.imageRef) {
              // Use the original asset path from imageRef
              url = slateNode.imageRef.src;
              console.log('Serializing image: converting blob URL to asset path:', url);
            }
            
            // Return mdast image node
            return {
              type: 'image',
              url: url,
              alt: slateNode.alt || '',
              title: slateNode.title || null
            };
          },
          deserialize: (mdastNode: MarkdownImageNode) => {
            // When loading from markdown, create proper PlateJS image element
            console.log('Deserializing image from markdown:', mdastNode.url);
            
            let imageRef = null;
            
            // If this is an asset path, reconstruct ImageRef for blob URL generation
            if (mdastNode.url.startsWith('assets/images/')) {
              imageRef = {
                serviceId: 'local' as const,
                src: mdastNode.url,
                alt: mdastNode.alt || '',
                width: 0, // Will be determined when image loads
                height: 0
              };
              console.log('Reconstructed ImageRef for asset path:', imageRef);
            }
            
            return {
              type: KEYS.img,
              url: mdastNode.url, // Keep asset path for now, will be transformed to blob URL by image element
              alt: mdastNode.alt || '',
              title: mdastNode.title || null,
              imageRef: imageRef, // Store reconstructed ImageRef
              siteId: siteId, // Add siteId for blob URL generation
              children: [{ text: '' }]
            };
          }
        },
        [KEYS.video]: {
          serialize: (slateNode: SlateVideoNode) => {
            const attributes = [
              { name: 'src', value: slateNode.url },
            ];

            if (slateNode.isUpload) {
              attributes.push({ name: 'data-sparktype-upload', value: 'true' });
            }
            if (slateNode.poster) {
              attributes.push({ name: 'poster', value: slateNode.poster });
            }
            if (slateNode.videoRef?.serviceId) {
              attributes.push({ name: 'data-sparktype-service-id', value: slateNode.videoRef.serviceId });
            }
            if (slateNode.videoRef?.src) {
              attributes.push({ name: 'data-sparktype-video-src', value: slateNode.videoRef.src });
            }
            if (slateNode.videoRef?.poster) {
              attributes.push({ name: 'data-sparktype-poster', value: slateNode.videoRef.poster });
            }
            if (slateNode.videoRef?.width) {
              attributes.push({ name: 'data-sparktype-width', value: String(slateNode.videoRef.width) });
            }
            if (slateNode.videoRef?.height) {
              attributes.push({ name: 'data-sparktype-height', value: String(slateNode.videoRef.height) });
            }
            if (slateNode.videoRef?.duration) {
              attributes.push({ name: 'data-sparktype-duration', value: String(slateNode.videoRef.duration) });
            }

            const providerData = slateNode.videoRef?.providerData;
            if (providerData && typeof providerData === 'object') {
              Object.entries(providerData).forEach(([key, value]) => {
                if (value === undefined || value === null) return;
                attributes.push({
                  name: `data-sparktype-provider-${key}`,
                  value: String(value),
                });
              });
            }

            return {
              type: 'mdxJsxFlowElement',
              name: 'video',
              attributes,
              children: [],
            };
          },
          deserialize: (mdastNode: MdxJsxFlowElement) => {
            const url = getMdxAttributeValue(mdastNode, 'src') || '';
            const isUpload = getMdxAttributeValue(mdastNode, 'data-sparktype-upload') === 'true';

            const providerDataEntries = (mdastNode.attributes || [])
              .filter((attribute): attribute is MdxJsxAttribute =>
                attribute.type === 'mdxJsxAttribute' &&
                typeof attribute?.name === 'string' &&
                attribute.name.startsWith('data-sparktype-provider-') &&
                typeof attribute.value === 'string'
              )
              .map((attribute) => [
                attribute.name.replace('data-sparktype-provider-', ''),
                attribute.value,
              ]);

            const providerData = providerDataEntries.length > 0
              ? Object.fromEntries(providerDataEntries)
              : undefined;

            const serviceId = getMdxAttributeValue(mdastNode, 'data-sparktype-service-id');
            const videoSrc = getMdxAttributeValue(mdastNode, 'data-sparktype-video-src');
            const width = getMdxAttributeValue(mdastNode, 'data-sparktype-width');
            const height = getMdxAttributeValue(mdastNode, 'data-sparktype-height');
            const duration = getMdxAttributeValue(mdastNode, 'data-sparktype-duration');
            const poster =
              getMdxAttributeValue(mdastNode, 'data-sparktype-poster') ||
              getMdxAttributeValue(mdastNode, 'poster');

            return {
              type: KEYS.video,
              url,
              isUpload,
              siteId,
              poster,
              videoRef: serviceId && videoSrc
                ? {
                    serviceId,
                    src: videoSrc,
                    poster,
                    width: width ? Number(width) : undefined,
                    height: height ? Number(height) : undefined,
                    duration: duration ? Number(duration) : undefined,
                    providerData,
                  }
                : undefined,
              children: [{ text: '' }],
            };
          },
        },
        // Custom serialization rule for collection view blocks
        collection_view: {
          serialize: (slateNode: CollectionViewSlateNode) => {
            console.log('PlateJS serializing collection_view node:', slateNode);

            // Convert collection view element to directive
            const attributes: Record<string, string> = {};

            if (slateNode.collection) attributes.collection = slateNode.collection;
            if (slateNode.layout) attributes.layout = slateNode.layout;
            if (slateNode.displayType) attributes.displayType = slateNode.displayType;
            if (slateNode.maxItems) attributes.maxItems = slateNode.maxItems.toString();
            if (slateNode.sortBy) attributes.sortBy = slateNode.sortBy;
            if (slateNode.sortOrder) attributes.sortOrder = slateNode.sortOrder;
            if (slateNode.tagFilters && slateNode.tagFilters.length > 0) {
              attributes.tagFilters = slateNode.tagFilters.join(',');
            }

            console.log('Serializing collection view to directive with attributes:', attributes);

            // Return a containerDirective (block-level) instead of leafDirective
            return {
              type: 'containerDirective',
              name: 'collection_view',
              attributes: attributes,
              children: []
            };
          }
        },
        // Deserialization rule for directives (key must match mdast node type)
        containerDirective: {
          deserialize: (mdastNode: ContainerDirective) => {
            console.log('MarkdownKit: Processing containerDirective:', mdastNode);

            if (mdastNode.name === 'collection_view') {
              console.log('MarkdownKit: Found collection_view containerDirective with attributes:', mdastNode.attributes);

              const tagFilters = mdastNode.attributes?.tagFilters
                ? mdastNode.attributes.tagFilters.split(',')
                : [];

              const plateNode = {
                type: 'collection_view',
                collection: mdastNode.attributes?.collection || '',
                layout: mdastNode.attributes?.layout || 'list',
                displayType: mdastNode.attributes?.displayType || '',
                maxItems: parseInt(mdastNode.attributes?.maxItems || '10'),
                sortBy: mdastNode.attributes?.sortBy || 'date',
                sortOrder: mdastNode.attributes?.sortOrder || 'desc',
                tagFilters: tagFilters,
                children: [{ text: '' }]
              };

              console.log('MarkdownKit: Converted containerDirective to Plate node:', plateNode);
              return plateNode;
            }

            console.log('MarkdownKit: Unhandled containerDirective:', mdastNode.name);
            return null;
          }
        },
        leafDirective: {
          deserialize: (mdastNode: LeafDirective) => {
            console.log('MarkdownKit: Processing leafDirective:', mdastNode);

            if (mdastNode.name === 'collection_view') {
              console.log('MarkdownKit: Found collection_view directive with attributes:', mdastNode.attributes);

              const tagFilters = mdastNode.attributes?.tagFilters
                ? mdastNode.attributes.tagFilters.split(',')
                : [];

              const plateNode = {
                type: 'collection_view',
                collection: mdastNode.attributes?.collection || '',
                layout: mdastNode.attributes?.layout || 'list',
                displayType: mdastNode.attributes?.displayType || '',
                maxItems: parseInt(mdastNode.attributes?.maxItems || '10'),
                sortBy: mdastNode.attributes?.sortBy || 'date',
                sortOrder: mdastNode.attributes?.sortOrder || 'desc',
                tagFilters: tagFilters,
                children: [{ text: '' }]
              };

              console.log('MarkdownKit: Converted to Plate node:', plateNode);
              return plateNode;
            }

            console.log('MarkdownKit: Unhandled directive:', mdastNode.name);
            // Return null for other directives to let default handling take over
            return null;
          }
        }
        // Note: Column serialization/deserialization is handled by the built-in columnRules
        // imported from @platejs/markdown and spread at the top of this rules object
      }
    },
  }),
  ];
}

// Export the default kit for backward compatibility
export const MarkdownKit = createMarkdownKit();
