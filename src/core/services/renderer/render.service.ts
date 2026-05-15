// src/core/services/renderer/render.service.ts

import Handlebars from 'handlebars';
import DOMPurify from 'dompurify';
import type { ImageRef, LocalSiteData, PageResolutionResult, ParsedMarkdownFile, StructureNode } from '@/core/types';
import { PageType } from '@/core/types';
import { clearAssetContentCache, getAssetContent, getLayoutManifest, getThemeAssetContent } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { prepareRenderEnvironment } from './asset.service';
import { assemblePageContext, assembleBaseContext } from './context.service';
import { getCollectionContent, sortCollectionItems } from '@/core/services/collections.service';
import type { ImageService } from '@/core/types';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';
import { generateExportUrl, generatePreviewUrl, getUrlForNode } from '@/core/services/urlUtils.service';
import { getRelativePath } from '@/core/services/relativePaths.service';
import { SECURITY_CONFIG } from '@/config/editorConfig';
import type { Node as UnistNode } from 'unist';
import { replaceCloudinaryHostedVideos } from './cloudinaryVideoPlayer';
import {
  createPaginationData,
  getCollectionItemsForLayoutConfig,
  getCollectionPaginationState,
  getItemsPerPage,
  isPaginationEnabled,
} from '@/core/services/collectionPagination.service';
import { filterContentBySelectedTags } from '@/core/services/tags.service';

interface CollectionDirectiveAttributes {
    collection?: string;
    layout?: string;
    displayType?: string;
    maxItems?: string;
    sortBy?: string;
    sortOrder?: string;
    tagFilters?: string;
    [key: string]: unknown;
}

interface MdastDirectiveNode {
    type: string;
    name?: string;
    attributes?: CollectionDirectiveAttributes;
    children?: unknown[];
    value?: string;
}

interface MdxJsxAttribute {
    type: 'mdxJsxAttribute';
    name: string;
    value: string | null;
}

interface MdxJsxFlowElementNode {
    type: 'mdxJsxFlowElement';
    name?: string;
    attributes?: MdxJsxAttribute[];
    children?: MdxJsxFlowElementNode[];
}

interface MdxJsxElementLike {
    name?: string;
    attributes?: MdxJsxAttribute[];
}

interface MdastImageNode {
    type: 'image';
    url: string;
    alt?: string | null;
}

interface HastElementNode {
    type: 'element';
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: HastElementNode[];
}

interface HastRootNode {
    type: 'root';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getDirectiveAttributes(node: MdastDirectiveNode): CollectionDirectiveAttributes {
    return isRecord(node.attributes) ? node.attributes as CollectionDirectiveAttributes : {};
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

function isAbsoluteOrSpecialImageUrl(url: string): boolean {
    return /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('/');
}

function isExternalOrDataImageUrl(url: string): boolean {
    return /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:');
}

/**
 * Defines the options passed to the main render function.
 */
export interface RenderOptions {
    siteRootPath: string;
    isExport: boolean;
    relativeAssetPath?: string;
    forIframe?: boolean;
}

/**
 * Sanitizes HTML content to prevent XSS while allowing scripts from trusted domains.
 *
 * Security model:
 * - Blocks all inline scripts and event handlers
 * - Allows external scripts only from TRUSTED_SCRIPT_DOMAINS
 * - Preserves safe HTML for content formatting
 * - Protects SiteViewer users from malicious site authors
 *
 * @param htmlContent The HTML to sanitize
 * @returns Sanitized HTML safe for rendering
 */
function sanitizeHtml(htmlContent: string): string {
    if (typeof window === 'undefined') {
        console.warn('[Render Service] DOMPurify not available in Node environment - HTML not sanitized');
        return htmlContent;
    }

    // Configure DOMPurify to allow scripts from trusted domains only
    const config = {
        // Allow most HTML tags for content formatting
        ALLOWED_TAGS: [
            // Text formatting
            'p', 'br', 'span', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'small', 'sub', 'sup',
            // Headings
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            // Lists
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            // Links and media
            'a', 'img', 'figure', 'figcaption', 'picture', 'source',
            // Tables
            'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
            // Blocks
            'div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
            'blockquote', 'pre', 'code', 'hr',
            // Forms (for Alpine.js interactivity)
            'form', 'input', 'button', 'select', 'option', 'textarea', 'label', 'fieldset', 'legend',
            // Other
            'details', 'summary', 'iframe', 'video', 'audio', 'track',
            // Scripts (will be filtered by domain in the hook)
            'script'
        ],
        ALLOWED_ATTR: [
            // Standard attributes
            'id', 'class', 'style', 'title', 'alt', 'src', 'href', 'target', 'rel',
            'width', 'height', 'data-*', 'aria-*', 'role',
            'allow', 'allowfullscreen', 'loading', 'frameborder', 'sandbox',
            // Table attributes
            'colspan', 'rowspan', 'scope',
            // Form attributes
            'type', 'name', 'value', 'placeholder', 'required', 'disabled', 'checked', 'selected',
            // Media attributes
            'controls', 'autoplay', 'loop', 'muted', 'poster',
            // Alpine.js attributes (x-data, x-bind, x-on, etc.)
            'x-data', 'x-bind', 'x-on', 'x-text', 'x-html', 'x-model', 'x-show', 'x-if', 'x-for',
            'x-transition', 'x-cloak', 'x-init', 'x-effect', 'x-ref', 'x-teleport',
            // @click, @input, etc. (Alpine shorthand)
            '@click', '@input', '@change', '@submit', '@keydown', '@keyup',
            // :class, :href, etc. (Alpine shorthand)
            ':class', ':href', ':src', ':style',
        ],
        // Allow data URIs for images
        ALLOW_DATA_ATTR: true,
        // Keep relative URLs
        ALLOW_UNKNOWN_PROTOCOLS: false,
        // Add custom hook to filter scripts
        FORBID_TAGS: [],
        // Block ALL inline event handlers (comprehensive list)
        FORBID_ATTR: [
            'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup',
            'onmousemove', 'onmouseenter', 'onmouseleave', 'ondblclick', 'oncontextmenu',
            'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'onreset', 'onselect',
            'onkeydown', 'onkeyup', 'onkeypress', 'onscroll', 'onresize', 'ondrag', 'ondrop',
            'onabort', 'oncanplay', 'oncanplaythrough', 'ondurationchange', 'onemptied', 'onended',
            'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onpause', 'onplay', 'onplaying',
            'onprogress', 'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend',
            'ontimeupdate', 'onvolumechange', 'onwaiting',
        ],
    };

    // Create a DOMPurify instance and add hooks
    const purify = DOMPurify(window);

    // Hook to validate script sources against trusted domains
    purify.addHook('uponSanitizeElement', (node, data) => {
        if (data.tagName === 'script') {
            const scriptElement = node as HTMLScriptElement;
            const src = scriptElement.getAttribute('src');

            // If no src (inline script), remove it
            if (!src) {
                console.warn('[Render Service] Removed inline script tag (not allowed)');
                if (node.parentNode) node.parentNode.removeChild(node);
                return;
            }

            // Check if src is from a trusted domain
            const isTrusted = SECURITY_CONFIG.TRUSTED_SCRIPT_DOMAINS.some(domain => {
                try {
                    const url = new URL(src, window.location.origin);
                    return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
                } catch {
                    return false;
                }
            });

            if (!isTrusted) {
                console.warn(`[Render Service] Removed script from untrusted domain: ${src}`);
                if (node.parentNode) node.parentNode.removeChild(node);
            }
        }

        // Also validate iframes to prevent embedding malicious content
        if (data.tagName === 'iframe') {
            const iframeElement = node as HTMLIFrameElement;
            const src = iframeElement.getAttribute('src');

            if (!src) {
                // Iframes without src are suspicious - remove them
                console.warn('[Render Service] Removed iframe without src');
                if (node.parentNode) node.parentNode.removeChild(node);
                return;
            }

            // Enforce https:// for iframes (prevent protocol-relative and javascript: URLs)
            try {
                const url = new URL(src, window.location.origin);
                if (url.protocol !== 'https:') {
                    console.warn(`[Render Service] Removed iframe with non-HTTPS protocol: ${src}`);
                    if (node.parentNode) node.parentNode.removeChild(node);
                    return;
                }
            } catch {
                console.warn(`[Render Service] Removed iframe with invalid URL: ${src}`);
                if (node.parentNode) node.parentNode.removeChild(node);
            }

            // Add sandbox attribute for additional security
            if (!iframeElement.hasAttribute('sandbox')) {
                iframeElement.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
            }
        }
    });

    const sanitized = purify.sanitize(htmlContent, config);

    // Clean up hooks
    purify.removeAllHooks();

    return String(sanitized);
}

/**
 * Renders a layout and its parent hierarchy (Jekyll-style inheritance).
 * This function recursively renders layouts from child to parent until reaching the base layout.
 *
 * @param siteData Site data with manifest and theme information
 * @param layoutId The layout ID to render (e.g., "page", "blog-post")
 * @param context The Handlebars context data
 * @param childHtml Optional HTML from child layout (passed as {{{body}}})
 * @returns Rendered HTML string
 */
async function renderLayoutHierarchy(
    siteData: LocalSiteData,
    layoutId: string,
    context: Record<string, unknown>,
    childHtml?: string
): Promise<string> {
    const themeName = siteData.manifest.theme.name;

    console.log(`[renderLayoutHierarchy] Rendering layout: ${layoutId}`);

    // Load theme manifest to determine if this is a content layout or base layout
    const themeManifestContent = await getAssetContent(siteData, 'theme', themeName, 'theme.json');
    if (!themeManifestContent) {
        throw new Error(`Theme manifest not found: ${themeName}`);
    }
    const themeData = JSON.parse(themeManifestContent);

    // Check if this layout ID is in the layouts array (content layout vs base layout)
    const isContentLayout = themeData.layouts?.includes(layoutId);

    let templateSource: string;
    let layoutManifest = null;

    if (isContentLayout) {
        // Content layout: use convention layouts/{id}/index.hbs
        const templatePath = `layouts/${layoutId}/index.hbs`;
        const source = await getThemeAssetContent(siteData, themeName, templatePath);
        if (!source) {
            throw new Error(`Layout template not found: themes/${themeName}/${templatePath}`);
        }
        templateSource = source;

        // Get layout manifest for parentLayout reference
        layoutManifest = await getLayoutManifest(siteData, layoutId);
        if (!layoutManifest) {
            throw new Error(`Layout manifest not found: ${layoutId}`);
        }
    } else {
        // Base layout: at theme root as {id}.hbs
        const templatePath = `${layoutId}.hbs`;
        const source = await getThemeAssetContent(siteData, themeName, templatePath);
        if (!source) {
            throw new Error(`Base template not found: themes/${themeName}/${templatePath}`);
        }
        templateSource = source;
    }

    // Compile and render this layout level
    const template = Handlebars.compile(templateSource);
    const contextWithBody = {
        ...context,
        body: childHtml ? new Handlebars.SafeString(childHtml) : undefined
    };
    const html = template(contextWithBody);

    // If this layout has a parent, recursively render the parent
    if (layoutManifest?.parentLayout) {
        console.log(`[renderLayoutHierarchy] Layout ${layoutId} has parent: ${layoutManifest.parentLayout}`);
        return renderLayoutHierarchy(
            siteData,
            layoutManifest.parentLayout,
            context,
            html  // Pass this level's output as {{{body}}} to parent
        );
    }

    // This is the root layout - return final HTML
    console.log(`[renderLayoutHierarchy] Layout ${layoutId} is root (no parent)`);
    return html;
}

/**

 * Renders a resolved page into a full HTML string. This is the primary
 * orchestration function for the entire rendering pipeline.
 */
export async function render(
    siteData: LocalSiteData,
    resolution: PageResolutionResult,
    options: RenderOptions
): Promise<string> {
    console.log('[Render Service] Using unified markdown renderer');
    clearAssetContentCache();
    
    if (resolution.type === PageType.NotFound) {
        // Escape error message to prevent XSS
        const escapedMessage = Handlebars.escapeExpression(resolution.errorMessage);
        return `<h1>404 - Not Found</h1><p>${escapedMessage}</p>`;
    }

    // 1. Synchronize Data and Prepare Handlebars Environment
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(
        siteData.manifest.theme.name,
        siteData.manifest.theme.config,
        undefined,
        siteData.siteId
    );
    const synchronizedSiteData = { ...siteData, manifest: { ...siteData.manifest, theme: { ...siteData.manifest.theme, config: finalMergedConfig }}};
    await prepareRenderEnvironment(synchronizedSiteData);

    // 2. Get Services and Manifests
    const imageService = getActiveImageService(synchronizedSiteData.manifest);
    const pageLayoutManifest = await getLayoutManifest(synchronizedSiteData, resolution.layoutPath);
    if (!pageLayoutManifest) {
      throw new Error(`Layout manifest not found for layout: "${resolution.layoutPath}"`);
    }

    // 2.5. Pre-process all images based on manifest presets
    console.log('[Render Service] Pre-processing images...');
    await imagePreprocessor.preprocessImages(synchronizedSiteData, options.isExport, options.forIframe);
    console.log('[Render Service] Image pre-processing complete');

    // 2.6. Populate collection items for list layout types
    let enrichedResolution = resolution;
    let itemLayoutId: string | undefined;
    if (pageLayoutManifest.layoutType === 'list') {
      const layoutConfig = resolution.contentFile.frontmatter.layoutConfig;
      if (layoutConfig && layoutConfig.collectionId) {
        const collectionItems = getCollectionItemsForLayoutConfig(synchronizedSiteData, layoutConfig);

        // Get the collection to retrieve its default item layout
        const collection = synchronizedSiteData.manifest.collections?.find(c => c.id === layoutConfig.collectionId);
        if (collection) {
          itemLayoutId = collection.defaultItemLayout;
          console.log('[Render Service] Collection uses item layout:', itemLayoutId);
        }

        const requestedPage = resolution.pageNumber;
        const currentPageNode: StructureNode = {
          type: 'page',
          title: resolution.contentFile.frontmatter.title,
          path: resolution.contentFile.path,
          slug: resolution.contentFile.slug,
        };

        if (isPaginationEnabled(layoutConfig)) {
          const paginationState = getCollectionPaginationState(
            collectionItems.length,
            requestedPage,
            getItemsPerPage(layoutConfig),
          );
          const currentPagePath = generateExportUrl(
            currentPageNode,
            synchronizedSiteData.manifest,
            paginationState.currentPage,
            synchronizedSiteData,
            undefined,
            true,
          );
          const previousPageNumber = paginationState.currentPage > 1 ? paginationState.currentPage - 1 : undefined;
          const nextPageNumber = paginationState.currentPage < paginationState.totalPages
            ? paginationState.currentPage + 1
            : undefined;
          const getPaginationPageUrl = (targetPage: number | undefined) => {
            if (!targetPage) {
              return undefined;
            }

            if (options.forIframe) {
              const iframeUrl = generateExportUrl(
                currentPageNode,
                synchronizedSiteData.manifest,
                targetPage,
                synchronizedSiteData,
                undefined,
                false,
                true,
              );
              return iframeUrl === '' ? '/' : iframeUrl;
            }

            if (options.isExport) {
              const exportFilePath = generateExportUrl(
                currentPageNode,
                synchronizedSiteData.manifest,
                targetPage,
                synchronizedSiteData,
                undefined,
                true,
              );
              return getRelativePath(currentPagePath, exportFilePath);
            }

            return generatePreviewUrl(
              currentPageNode,
              synchronizedSiteData.manifest,
              synchronizedSiteData.siteId,
              targetPage,
              synchronizedSiteData,
            );
          };
          const prevPageUrl = previousPageNumber
            ? getPaginationPageUrl(previousPageNumber)
            : undefined;
          const nextPageUrl = nextPageNumber
            ? getPaginationPageUrl(nextPageNumber)
            : undefined;

          enrichedResolution = {
            ...resolution,
            pageNumber: paginationState.currentPage,
            collectionItems: collectionItems.slice(paginationState.startIndex, paginationState.endIndex),
            pagination: createPaginationData(paginationState, prevPageUrl, nextPageUrl),
          };
        } else {
          enrichedResolution = {
            ...resolution,
            collectionItems,
          };
        }
      }
    }

    // 3. Assemble Data Contexts for the Templates
    const pageContext = await assemblePageContext(synchronizedSiteData, enrichedResolution, options, imageService, pageLayoutManifest);
    const baseContext = await assembleBaseContext(synchronizedSiteData, enrichedResolution, options, imageService, pageContext);

    // 4. Load layout template from theme directory using convention
    const themeName = synchronizedSiteData.manifest.theme.name;
    const bodyTemplatePath = `layouts/${enrichedResolution.layoutPath}/index.hbs`;
    const bodyTemplateSource = await getThemeAssetContent(synchronizedSiteData, themeName, bodyTemplatePath);
    if (!bodyTemplateSource) throw new Error(`Body template not found: themes/${themeName}/${bodyTemplatePath}`);

    // Process markdown content using the existing markdown helper
    const markdownContent = enrichedResolution.contentFile.content || '';
    console.log('[Render Service] Raw markdown content:', markdownContent);
    console.log('[Render Service] Content contains directive:', markdownContent.includes('::collection_view'));
    
    // Import the remark processing logic
    const { remark } = await import('remark');
    const { default: remarkDirective } = await import('remark-directive');
    const { default: remarkMdx } = await import('remark-mdx');
    const { default: remarkRehype } = await import('remark-rehype');
    const { default: rehypeSlug } = await import('rehype-slug');
    const { default: rehypeStringify } = await import('rehype-stringify');
    const { visit } = await import('unist-util-visit');

    let processedContent: string;
    if (markdownContent.trim()) {
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
                  const contentPath = enrichedResolution.contentFile.path;
                  let processedUrl = imagePreprocessor.getProcessedMarkdownImageUrl(
                    synchronizedSiteData.siteId,
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
                        title: enrichedResolution.contentFile.frontmatter.title,
                        path: enrichedResolution.contentFile.path,
                        slug: enrichedResolution.contentFile.slug
                      };
                      const currentPagePath = getUrlForNode(
                        currentPageNode,
                        synchronizedSiteData.manifest,
                        true,
                        enrichedResolution.pageNumber,
                        synchronizedSiteData,
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
                      synchronizedSiteData.manifest,
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
        processedContent = String(result);
        console.log('[Render Service] After remark processing:', processedContent.substring(0, 500));

        // Post-process HTML to convert collection directives (must happen before sanitization)
        processedContent = await postProcessCollectionDirectives(
          processedContent,
          synchronizedSiteData,
          options,
          enrichedResolution.contentFile
        );
        console.log('[Render Service] After directive processing:', processedContent.substring(0, 500));

        processedContent = replaceCloudinaryHostedVideos(processedContent, synchronizedSiteData.manifest);

        // Sanitize HTML AFTER all HTML generation to prevent XSS attacks
        // This includes both user markdown and generated collection directive HTML
        // Uses custom sanitizeHtml() that allows scripts from trusted domains only
        processedContent = sanitizeHtml(processedContent);
        console.log('[Render Service] After security sanitization');
        
        // Calculate current page path for relative asset paths
        const currentPageNode = {
          type: 'page' as const,
          title: enrichedResolution.contentFile.frontmatter.title,
          path: enrichedResolution.contentFile.path,
          slug: enrichedResolution.contentFile.slug
        };
        const currentPagePath = getUrlForNode(
          currentPageNode,
          synchronizedSiteData.manifest,
          options.isExport,
          enrichedResolution.pageNumber,
          synchronizedSiteData,
        );
        
        if (!options.isExport) {
          // For preview: convert asset paths to blob URLs or data URLs
          console.log('[Render Service] Processing images for preview, content before:', processedContent.substring(0, 500));
          processedContent = await postProcessSparkTypeImages(processedContent, synchronizedSiteData, imageService, options.forIframe);
          console.log('[Render Service] Content after image processing:', processedContent.substring(0, 500));
        } else {
          // For export: convert asset paths to relative paths
          console.log('[Render Service] Processing images for export, content before:', processedContent.substring(0, 500));
          processedContent = await postProcessSparkTypeImagesForExport(processedContent, synchronizedSiteData, imageService, currentPagePath);
          console.log('[Render Service] Content after export image processing:', processedContent.substring(0, 500));
        }
        
        console.log('[Render Service] Processed markdown content, length:', processedContent.length);
    } else {
        processedContent = '';
    }
    
    const contentContext = {
        ...pageContext,
        content: new Handlebars.SafeString(processedContent),
        ...(itemLayoutId && { itemLayoutId }) // Add itemLayoutId for list layouts
    };

    const bodyTemplate = Handlebars.compile(bodyTemplateSource);
    const bodyHtml = bodyTemplate(contentContext);

    // 5. Use nested layout rendering (Jekyll-style inheritance)
    console.log(`[Render Service] Starting nested layout rendering for: ${enrichedResolution.layoutPath}`);

    const fullContext = { ...baseContext, ...contentContext };
    const finalHtml = await renderLayoutHierarchy(
        synchronizedSiteData,
        enrichedResolution.layoutPath,
        fullContext,
        bodyHtml
    );

    console.log(`[Render Service] Nested layout rendering complete`);
    return finalHtml;
}

/**
 * Post-processes HTML content to convert Sparktype asset paths to blob URLs for preview
 */
async function postProcessSparkTypeImages(
  htmlContent: string, 
  siteData: LocalSiteData, 
  imageService: ImageService,
  forIframe?: boolean
): Promise<string> {
  // Find all Sparktype asset images (support both legacy and new paths)
  const imageRegex = /<img[^>]*src="(assets\/(originals|images)\/[^"]+)"[^>]*data-sparktype-asset="true"[^>]*>/g;
  
  let processedHtml = htmlContent;
  const matches = Array.from(htmlContent.matchAll(imageRegex));
  
  console.log('[Render Service] Found Sparktype images to process:', matches.length);
  
  for (const match of matches) {
    const [fullMatch, assetPath] = match;
    
    try {
      // Create ImageRef from asset path
      const imageRef = {
        serviceId: 'local' as const,
        src: assetPath,
        alt: '',
        width: 0,
        height: 0
      };
      
      // Generate blob URL or data URL for preview
      const blobUrl = await imageService.getDisplayUrl(
        siteData.manifest,
        imageRef,
        { width: imageRef.width, height: imageRef.height },
        false, // isExport = false for blob URL generation
        forIframe // Use data URLs for iframe contexts
      );
      
      // Replace the entire img tag with blob URL version
      const newImg = fullMatch.replace(`src="${assetPath}"`, `src="${blobUrl}"`).replace(' data-sparktype-asset="true"', '');
      processedHtml = processedHtml.replace(fullMatch, newImg);
      
      console.log('[Render Service] Converted asset to blob URL:', assetPath, '->', blobUrl);
    } catch (error) {
      console.error('[Render Service] Failed to convert asset to blob URL:', assetPath, error);
    }
  }
  
  return processedHtml;
}

/**
 * Post-processes HTML content to convert Sparktype asset paths to relative derivative paths for export
 */
async function postProcessSparkTypeImagesForExport(
  htmlContent: string, 
  siteData: LocalSiteData, 
  imageService: ImageService,
  currentPagePath: string
): Promise<string> {
  // Find all Sparktype asset images (support both legacy and new paths)
  const imageRegex = /<img[^>]*src="(assets\/(originals|images)\/[^"]+)"[^>]*data-sparktype-asset="true"[^>]*>/g;
  
  let processedHtml = htmlContent;
  const matches = Array.from(htmlContent.matchAll(imageRegex));
  
  console.log('[Render Service] Found Sparktype images to process for export:', matches.length);
  
  for (const match of matches) {
    const [fullMatch, assetPath] = match;
    
    try {
      // Create ImageRef from asset path
      const imageRef = {
        serviceId: 'local' as const,
        src: assetPath,
        alt: '',
        width: 0,
        height: 0
      };
      
      // Generate derivative filename for export (with size data appended)
      const derivativeFilename = await imageService.getDisplayUrl(
        siteData.manifest,
        imageRef,
        { width: imageRef.width, height: imageRef.height },
        true // isExport = true for derivative filename
      );
      
      const relativePath = isExternalOrDataImageUrl(derivativeFilename)
        ? derivativeFilename
        : getRelativePath(
            currentPagePath,
            derivativeFilename.startsWith('/') ? derivativeFilename.substring(1) : derivativeFilename
          );
      
      // Replace the entire img tag with relative derivative path
      const newImg = fullMatch.replace(`src="${assetPath}"`, `src="${relativePath}"`).replace(' data-sparktype-asset="true"', '');
      processedHtml = processedHtml.replace(fullMatch, newImg);
      
      console.log('[Render Service] Converted asset to relative derivative path:', assetPath, '->', relativePath);
    } catch (error) {
      console.error('[Render Service] Failed to convert asset to derivative filename:', assetPath, error);
    }
  }
  
  return processedHtml;
}

/**
 * Post-processes HTML content to convert collection view directives to rendered collection content
 */
async function postProcessCollectionDirectives(
  htmlContent: string,
  siteData: LocalSiteData,
  renderOptions: RenderOptions,
  currentPageFile: ParsedMarkdownFile
): Promise<string> {
  // Find all collection directive placeholders
  const directiveRegex = /<div[^>]*data-collection-directive="true"[^>]*>/g;
  
  let processedHtml = htmlContent;
  const matches = Array.from(htmlContent.matchAll(directiveRegex));
  
  console.log('[Render Service] Found collection directives to process:', matches.length);
  
  for (const match of matches) {
    const [fullMatch] = match;
    
    try {
      // Extract attributes from the directive div
      const collectionMatch = fullMatch.match(/data-collection="([^"]*)"/) || [];
      const layoutMatch = fullMatch.match(/data-layout="([^"]*)"/) || [];
      const displayTypeMatch = fullMatch.match(/data-display-type="([^"]*)"/) || [];
      const maxItemsMatch = fullMatch.match(/data-max-items="([^"]*)"/) || [];
      const sortByMatch = fullMatch.match(/data-sort-by="([^"]*)"/) || [];
      const sortOrderMatch = fullMatch.match(/data-sort-order="([^"]*)"/) || [];
      const tagFiltersMatch = fullMatch.match(/data-tag-filters="([^"]*)"/) || [];

      const config = {
        collectionId: collectionMatch[1] || '',
        layout: layoutMatch[1] || 'list',
        displayType: displayTypeMatch[1] || '',
        maxItems: parseInt(maxItemsMatch[1] || '10'),
        sortBy: sortByMatch[1] || 'date',
        sortOrder: (sortOrderMatch[1] || 'desc') as 'asc' | 'desc',
        tagFilters: (tagFiltersMatch[1] || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      };

      console.log('[Render Service] Processing collection directive with config:', config);

      // Validate required attributes
      if (!config.layout) {
        processedHtml = processedHtml.replace(fullMatch + '</div>',
          '<!-- Error: collection_view directive requires a "layout" attribute. Example: ::collection_view{collection="blog" layout="list-view"} -->');
        continue;
      }

      if (config.collectionId) {
        // Get the collection to retrieve its default item layout
        const collection = siteData.manifest.collections?.find(c => c.id === config.collectionId);
        if (!collection) {
          console.warn('[Render Service] Collection not found:', config.collectionId);
          processedHtml = processedHtml.replace(fullMatch + '</div>', `<!-- Collection not found: ${config.collectionId} -->`);
          continue;
        }

        const itemLayoutId = collection.defaultItemLayout;
        console.log('[Render Service] Collection uses item layout:', itemLayoutId);

        // Get collection items
        let items = getCollectionContent(siteData, config.collectionId);

        if (config.tagFilters.length > 0) {
          items = filterContentBySelectedTags(siteData.manifest, items, config.tagFilters);
        }

        if (items && items.length > 0) {
          // Apply sorting
          if (config.sortBy) {
            items = sortCollectionItems(items, config.sortBy, config.sortOrder);
          }

          // Apply max items limit
          if (config.maxItems && config.maxItems > 0) {
            items = items.slice(0, config.maxItems);
          }

          // Add computed properties for template use
          items = items.map(item => ({
            ...item,
            url: `/${item.path.replace(/^content\//, '').replace(/\.md$/, '')}`,
          }));

          try {
            // Get the item layout manifest to find partials
            const itemLayoutManifest = await getLayoutManifest(siteData, itemLayoutId);
            if (!itemLayoutManifest || !itemLayoutManifest.partials || itemLayoutManifest.partials.length === 0) {
              console.warn('[Render Service] Item layout has no partials:', itemLayoutId);
              processedHtml = processedHtml.replace(fullMatch + '</div>', `<!-- Item layout has no display partials: ${itemLayoutId} -->`);
              continue;
            }

            // Determine which partial to use: from displayType or default
            let partialToUse = null;
            if (config.displayType) {
              // Look for the specified displayType
              partialToUse = itemLayoutManifest.partials.find(p => {
                const filename = p.path.split('/').pop()?.replace('.hbs', '');
                return filename === config.displayType;
              });
            }

            // Fall back to default or first partial if displayType not found
            if (!partialToUse) {
              partialToUse = itemLayoutManifest.partials.find(p => p.isDefault) || itemLayoutManifest.partials[0];
            }

            const partialPath = `${itemLayoutId}/partials/${partialToUse.path.split('/').pop()?.replace('.hbs', '')}`;
            console.log('[Render Service] Using item layout partial:', partialPath);

            // Render each item using the layout partial
            const renderedItems = items.map(item => {
              const partialTemplate = Handlebars.partials[partialPath];
              if (partialTemplate) {
                const compiledPartial = typeof partialTemplate === 'string'
                  ? Handlebars.compile(partialTemplate)
                  : partialTemplate;

                // Pass item as context and render options through Handlebars data
                // This ensures helpers can access renderOptions via options.data.root.options
                // Also pass contentFile so image helper can calculate relative paths correctly
                return compiledPartial(item, {
                  data: {
                    root: {
                      ...item,
                      options: renderOptions,
                      contentFile: currentPageFile
                    }
                  }
                });
              }
              return `<!-- Partial not found: ${partialPath} -->`;
            });

            // Wrap the rendered items in a container
            // Validate layoutId contains only safe characters to prevent class injection
            const safeLayoutId = /^[a-z0-9-]+$/i.test(config.layout) ? config.layout : 'list';
            const containerClass = safeLayoutId.includes('grid')
              ? 'collection-grid grid gap-4 not-prose'
              : 'collection-list space-y-4 not-prose';

            const renderedContent = `<div class="${containerClass}">\n${renderedItems.join('\n')}\n</div>`;

            // Replace the directive placeholder with rendered content
            processedHtml = processedHtml.replace(fullMatch + '</div>', renderedContent);
            console.log('[Render Service] Rendered collection directive with partial:', partialPath);
          } catch (error) {
            console.error('[Render Service] Failed to render collection directive:', error);
            processedHtml = processedHtml.replace(fullMatch + '</div>', '<!-- Error rendering collection directive -->');
          }
        } else {
          console.warn('[Render Service] No items found for collection:', config.collectionId);
          processedHtml = processedHtml.replace(fullMatch + '</div>', '<!-- No items found for this collection -->');
        }
      } else {
        console.warn('[Render Service] Collection directive missing collectionId');
        processedHtml = processedHtml.replace(fullMatch + '</div>', '<!-- Collection directive missing collection ID -->');
      }
    } catch (error) {
      console.error('[Render Service] Failed to process collection directive:', error);
      processedHtml = processedHtml.replace(fullMatch + '</div>', '<!-- Error processing collection directive -->');
    }
  }
  
  return processedHtml;
}
