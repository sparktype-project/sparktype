import { MarkdownPlugin, remarkMdx, remarkMention } from '@platejs/markdown';
import { KEYS } from 'platejs';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

// Create a factory function to inject siteId into deserialization
export function createMarkdownKit(siteId?: string) {
  return [
    MarkdownPlugin.configure({
    options: {
      disallowedNodes: [KEYS.suggestion],
      remarkPlugins: [remarkMath, remarkGfm, remarkMdx, remarkMention],
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
        }
      }
    },
  }),
  ];
}

// Export the default kit for backward compatibility
export const MarkdownKit = createMarkdownKit();
