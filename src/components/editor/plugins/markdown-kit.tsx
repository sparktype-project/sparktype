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
          deserialize: (mdastNode: any) => {
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
          deserialize: (mdastNode: any) => {
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
      }
    },
  }),
  ];
}

// Export the default kit for backward compatibility
export const MarkdownKit = createMarkdownKit();
