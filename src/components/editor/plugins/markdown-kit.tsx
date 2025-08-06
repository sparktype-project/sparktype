import { MarkdownPlugin, remarkMdx, remarkMention } from '@platejs/markdown';
import { KEYS } from 'platejs';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';

// Create a factory function to inject siteId into deserialization
export function createMarkdownKit(siteId?: string) {
  return [
    MarkdownPlugin.configure({
    options: {
      disallowedNodes: [KEYS.suggestion],
      remarkPlugins: [remarkMath, remarkGfm, remarkMdx, remarkMention, remarkDirective],
      rules: {
        // Custom serialization rule for images to convert blob URLs back to asset paths
        [KEYS.img]: {
          serialize: (slateNode: any) => {
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
          deserialize: (mdastNode: any) => {
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
        // Custom serialization rule for collection view blocks
        collection_view: {
          serialize: (slateNode: any) => {
            // Convert collection view element to directive
            const attributes: Record<string, string> = {};
            
            if (slateNode.collection) attributes.collection = slateNode.collection;
            if (slateNode.layout) attributes.layout = slateNode.layout;
            if (slateNode.maxItems) attributes.maxItems = slateNode.maxItems.toString();
            if (slateNode.sortBy) attributes.sortBy = slateNode.sortBy;
            if (slateNode.sortOrder) attributes.sortOrder = slateNode.sortOrder;
            if (slateNode.tagFilters && slateNode.tagFilters.length > 0) {
              attributes.tagFilters = slateNode.tagFilters.join(',');
            }
            
            console.log('Serializing collection view to directive:', attributes);
            
            return {
              type: 'leafDirective',
              name: 'collection_view',
              attributes: attributes,
            };
          },
          deserialize: (mdastNode: any) => {
            // Convert directive back to collection view element
            console.log('Deserializing collection view from directive:', mdastNode);
            
            const tagFilters = mdastNode.attributes?.tagFilters 
              ? mdastNode.attributes.tagFilters.split(',')
              : [];
            
            return {
              type: 'collection_view',
              collection: mdastNode.attributes?.collection || '',
              layout: mdastNode.attributes?.layout || 'list',
              maxItems: parseInt(mdastNode.attributes?.maxItems || '10'),
              sortBy: mdastNode.attributes?.sortBy || 'date',
              sortOrder: mdastNode.attributes?.sortOrder || 'desc',
              tagFilters: tagFilters,
              children: [{ text: '' }]
            };
          }
        }
      }
    },
  }),
  ];
}

// Export the default kit for backward compatibility
export const MarkdownKit = createMarkdownKit();
