// src/core/services/renderer/markdownPipeline.ts

import Handlebars from 'handlebars';
import type { ImageRef, ImageService, LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import type { Node as UnistNode } from 'unist';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { getRelativePath } from '@/core/services/relativePaths.service';
import { isAbsoluteOrSpecialImageUrl, isExternalOrDataImageUrl } from './images';
import type {
    CollectionDirectiveAttributes,
    HastElementNode,
    HastRootNode,
    MdastDirectiveNode,
    MdastImageNode,
    MdxJsxAttribute,
    MdxJsxFlowElementNode,
    MdxJsxElementLike,
    RenderOptions,
} from './render.types';

/**
 * Markdown/MDX → HTML conversion.
 *
 * This is the first HTML-producing stage of the render pipeline, and its internal order is
 * load-bearing:
 *
 * 1. `::collection_view` directives become `<div data-collection-directive="true" ...>`
 *    placeholders in the mdast, so the expanded HTML is produced later, once, in
 *    collectionDirectives.ts.
 * 2. MDX JSX elements are classified before conversion: `column_group`/`column` get their
 *    classes, and raw HTML elements the editor emitted (video, audio, embed iframes) are
 *    turned back into HTML so they survive remark-mdx.
 * 3. Markdown image URLs are rewritten to preprocessed URLs *before* `remarkRehype`, while
 *    the alt text and node structure are still available.
 * 4. `remarkRehype` with `allowDangerousHtml: true` converts the tree; `rehypeStringify` with
 *    the same option emits the raw HTML nodes. Without `allowDangerousHtml` the
 *    `data-sparktype-*` markers disappear and the later image/directive stages silently
 *    no-op.
 *
 * The output of this stage is *unsanitised* HTML; the caller owns the sanitisation boundary.
 */
export interface MarkdownPipelineInput {
    /** Raw markdown/MDX source of the page being rendered. */
    markdownContent: string;
    /** Site data with the resolved theme config. */
    siteData: LocalSiteData;
    /** Content file being rendered (its path/title/slug drive image URL rewriting). */
    contentFile: ParsedMarkdownFile;
    /** Current collection page number, used for export-relative image paths. */
    pageNumber?: number;
    imageService: ImageService;
    options: RenderOptions;
}

function getDirectiveAttributes(node: MdastDirectiveNode): CollectionDirectiveAttributes {
    if (typeof node.attributes !== 'object' || node.attributes === null) {
        return {};
    }

    return node.attributes;
}

function escapeDirectiveAttr(value: unknown): string {
    return Handlebars.escapeExpression(String(value || ''));
}

function escapeHtmlAttribute(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function serializeMdxJsxAttributes(attributes: MdxJsxAttribute[] = []): string {
    return attributes
        .map((attribute) => {
            if (attribute.value === null) {
                return attribute.name;
            }

            return `${attribute.name}="${escapeHtmlAttribute(attribute.value)}"`;
        })
        .join(' ');
}

function isCustomMdxElement(node: MdxJsxElementLike): boolean {
    return node.name === 'column_group' || node.name === 'column';
}

function hasMdxAttribute(node: MdxJsxElementLike, name: string): boolean {
    return Boolean(node.attributes?.some((attribute) => attribute.name === name));
}

function shouldPreserveHtmlMdxElement(node: MdxJsxElementLike): boolean {
    if (!node.name || isCustomMdxElement(node) || node.name !== node.name.toLowerCase()) {
        return false;
    }

    if (node.name === 'video' || node.name === 'audio') {
        return true;
    }

    if (node.name === 'iframe' && hasMdxAttribute(node, 'data-sparktype-embed-url')) {
        return true;
    }

    return false;
}

/**
 * Converts a page's markdown/MDX into HTML, leaving the result unsanitised.
 */
export async function renderMarkdownToHtml({
    markdownContent,
    siteData,
    contentFile,
    pageNumber,
    imageService,
    options,
}: MarkdownPipelineInput): Promise<string> {
    // Import the remark processing logic. These stay dynamic on purpose: the renderer is only
    // reached at render time, and static imports would pull remark/rehype into the initial
    // bundle for every entry point that imports the render service.
    const { remark } = await import('remark');
    const { default: remarkDirective } = await import('remark-directive');
    const { default: remarkMdx } = await import('remark-mdx');
    const { default: remarkRehype } = await import('remark-rehype');
    const { default: rehypeSlug } = await import('rehype-slug');
    const { default: rehypeStringify } = await import('rehype-stringify');
    const { visit } = await import('unist-util-visit');

    // Configure remark with directive support, MDX support, and custom image handling
    const processor = remark()
      .use(remarkDirective)
      .use(remarkMdx)
      .use(() => {
        return async (tree: UnistNode) => {
          // Process collection_view directives (both leaf and container types)
          const processCollectionDirective = (node: MdastDirectiveNode) => {
            if (node.name === 'collection_view') {
              // Convert directive to HTML placeholder for post-processing
              const attrs = getDirectiveAttributes(node);

              // Escape all attributes to prevent HTML injection
              const collection = escapeDirectiveAttr(attrs.collection);
              const layout = escapeDirectiveAttr(attrs.layout);
              const displayType = escapeDirectiveAttr(attrs.displayType);
              const maxItems = escapeDirectiveAttr(attrs.maxItems);
              const sortBy = escapeDirectiveAttr(attrs.sortBy);
              const sortOrder = escapeDirectiveAttr(attrs.sortOrder);
              const tagFilters = escapeDirectiveAttr(attrs.tagFilters);

              const directiveHtml = `<div data-collection-directive="true" data-collection="${collection}" data-layout="${layout}" data-display-type="${displayType}" data-max-items="${maxItems}" data-sort-by="${sortBy}" data-sort-order="${sortOrder}" data-tag-filters="${tagFilters}"></div>`;

              // Replace the directive node with an HTML node
              node.type = 'html';
              node.value = directiveHtml;
              delete node.name;
              delete node.attributes;
              delete node.children;
            }
          };

          visit(tree, 'leafDirective', processCollectionDirective);
          visit(tree, 'containerDirective', processCollectionDirective);

          // Track unique column configurations to generate CSS
          const columnConfigs = new Set<number>();

          // Process MDX JSX elements (columns) to add classes and preserve attributes
          // First pass: count columns in each column_group
          const columnGroupInfo = new Map<MdxJsxFlowElementNode, number>();
          visit(tree, 'mdxJsxFlowElement', (node) => {
            const flowNode = node as MdxJsxFlowElementNode;
            console.log('[Render Service] Found mdxJsxFlowElement:', flowNode.name);
            if (flowNode.name === 'column_group') {
              // Count direct column children
              const columnCount = flowNode.children?.filter((child) =>
                child.type === 'mdxJsxFlowElement' && child.name === 'column'
              ).length || 0;
              console.log('[Render Service] column_group has', columnCount, 'columns');
              columnGroupInfo.set(flowNode, columnCount);
              columnConfigs.add(columnCount);
            }
          });

          // Second pass: add classes to column_group and columns
          visit(tree, 'mdxJsxFlowElement', (node, _index, parent) => {
            const flowNode = node as MdxJsxFlowElementNode;
            const flowParent = parent as MdxJsxFlowElementNode | undefined;
            if (flowNode.name === 'column_group') {
              console.log('[Render Service] Adding class to column_group');
              // Add class for styling
              flowNode.attributes = flowNode.attributes || [];
              flowNode.attributes.push({
                type: 'mdxJsxAttribute',
                name: 'class',
                value: 'column-group'
              });
            } else if (flowNode.name === 'column' && flowParent) {
              // Find the parent column_group to get total column count
              const parentGroup = flowParent.type === 'mdxJsxFlowElement' && flowParent.name === 'column_group' ? flowParent : null;
              const totalColumns = parentGroup ? columnGroupInfo.get(parentGroup) || 1 : 1;

              console.log('[Render Service] Adding class to column, totalColumns:', totalColumns);

              // Add class with column count for CSS targeting
              flowNode.attributes = flowNode.attributes || [];
              flowNode.attributes.push({
                type: 'mdxJsxAttribute',
                name: 'class',
                value: `column column-${totalColumns}`
              });

              // Store total columns as data attribute for potential JS use
              flowNode.attributes.push({
                type: 'mdxJsxAttribute',
                name: 'data-columns',
                value: String(totalColumns)
              });
            }
          });

          // Preserve raw HTML elements that remark-mdx parses as JSX, such as
          // uploaded videos and embeds generated by the editor.
          visit(tree, 'mdxJsxFlowElement', (node) => {
            const flowNode = node as {
              type: string;
              name?: string;
              attributes?: MdxJsxAttribute[];
              children?: MdxJsxFlowElementNode[];
              value?: string;
            };

            if (!shouldPreserveHtmlMdxElement(flowNode) || !flowNode.name) {
              return;
            }

            const serializedAttributes = serializeMdxJsxAttributes(flowNode.attributes);
            const openTag = serializedAttributes.length > 0
              ? `<${flowNode.name} ${serializedAttributes}>`
              : `<${flowNode.name}>`;

            flowNode.type = 'html';
            flowNode.value = `${openTag}</${flowNode.name}>`;
            delete flowNode.name;
            delete flowNode.attributes;
            delete flowNode.children;
          });

          // Process images to use preprocessed URLs
          const providerImageResolutions: Array<Promise<void>> = [];
          visit(tree, 'image', (node) => {
            const imageNode = node as MdastImageNode;
            if (imageNode.url && (imageNode.url.startsWith('assets/originals/') || imageNode.url.startsWith('assets/images/'))) {
              console.log('[Render Service] Processing Sparktype markdown image:', imageNode.url);

              // Get preprocessed URL (page_display preset for markdown images)
              const contentPath = contentFile.path;
              let processedUrl = imagePreprocessor.getProcessedMarkdownImageUrl(
                siteData.siteId,
                contentPath,
                imageNode.url,
                'page_display'
              );

              if (processedUrl) {
                console.log('[Render Service] Using preprocessed URL:', processedUrl);

                // Convert to relative path for export mode
                if (options.isExport && !isExternalOrDataImageUrl(processedUrl)) {
                  const currentPageNode = {
                    type: 'page' as const,
                    title: contentFile.frontmatter.title,
                    path: contentFile.path,
                    slug: contentFile.slug
                  };
                  const currentPagePath = getUrlForNode(
                    currentPageNode,
                    siteData.manifest,
                    true,
                    pageNumber,
                    siteData,
                  );

                  // Strip leading slash from processed URL if present
                  const cleanProcessedUrl = processedUrl.startsWith('/')
                    ? processedUrl.substring(1)
                    : processedUrl;
                  processedUrl = getRelativePath(currentPagePath, cleanProcessedUrl);
                  console.log('[Render Service] Converted to relative path for export:', processedUrl);
                }

                // Replace with preprocessed URL
                imageNode.url = processedUrl;
              } else {
                console.warn('[Render Service] No preprocessed URL found for:', imageNode.url, '- falling back to original');
                // Fallback: keep original path, which points to assets/originals/
                // This will work for preview/export as originals are copied
              }
            } else if (
              imageNode.url &&
              imageService.id !== 'local' &&
              !isAbsoluteOrSpecialImageUrl(imageNode.url)
            ) {
              console.log('[Render Service] Resolving provider-backed markdown image:', imageNode.url);
              const imageRef: ImageRef = {
                serviceId: imageService.id,
                src: imageNode.url,
                alt: imageNode.alt || '',
              };

              providerImageResolutions.push((async () => {
                imageNode.url = await imageService.getDisplayUrl(
                  siteData.manifest,
                  imageRef,
                  {},
                  options.isExport,
                  options.forIframe,
                );
              })());
            } else {
              console.log('[Render Service] Standard image handling for:', imageNode.url);
            }
          });

          await Promise.all(providerImageResolutions);
        };
      })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeSlug) // Add unique IDs to all headings for TOC anchor navigation
      .use(() => {
        // Rehype plugin to add classes to column elements after HTML conversion
        return (tree: UnistNode) => {
          // Track column groups and their column counts
          const columnGroupCounts = new Map<HastElementNode, number>();

          // First pass: count columns in each group
          visit(tree, 'element', (node) => {
            const elementNode = node as HastElementNode;
            if (elementNode.tagName === 'div' && elementNode.properties?.dataColumn === 'group') {
              const columnCount = elementNode.children?.filter((child) =>
                child.type === 'element' && child.tagName === 'div' && child.properties?.dataColumn === 'item'
              ).length || 0;
              columnGroupCounts.set(elementNode, columnCount);
            }
          });

          // Second pass: add classes
          visit(tree, 'element', (node, _index, parent) => {
            const elementNode = node as HastElementNode;
            const elementParent = parent as HastRootNode | HastElementNode | undefined;
            // Check if this came from an MDX element by looking at raw data
            const isColumnGroup = elementNode.tagName === 'div' &&
              elementNode.children?.some((child) => child.tagName === 'div');

            if (isColumnGroup && elementParent?.type === 'root') {
              // This is likely a column_group
              const columnCount = elementNode.children?.filter((child) =>
                child.type === 'element' && child.tagName === 'div'
              ).length || 0;

              if (columnCount > 1) {
                elementNode.properties = elementNode.properties || {};
                elementNode.properties.className = ['column-group'];
                console.log('[Render Service] Rehype: Added column-group class');

                // Add classes to child columns
                elementNode.children?.forEach((child) => {
                  if (child.type === 'element' && child.tagName === 'div') {
                    child.properties = child.properties || {};
                    child.properties.className = ['column', `column-${columnCount}`];
                    child.properties.dataColumns = String(columnCount);
                    console.log('[Render Service] Rehype: Added column classes');
                  }
                });
              }
            }
          });
        };
      })
      .use(rehypeStringify, { allowDangerousHtml: true });

    // Process markdown to HTML
    const result = await processor.process(markdownContent);
    return String(result);
}
