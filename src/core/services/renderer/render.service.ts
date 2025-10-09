// src/core/services/renderer/render.service.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, PageResolutionResult } from '@/core/types';
import { PageType } from '@/core/types';
import { getAssetContent, getLayoutManifest, getThemeAssetContent } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { prepareRenderEnvironment } from './asset.service';
import { assemblePageContext, assembleBaseContext } from './context.service';
import { getCollectionContent, sortCollectionItems } from '@/core/services/collections.service';
import type { ImageService } from '@/core/types';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { getRelativePath } from '@/core/services/relativePaths.service';

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

    // Special case: "base" layout is referenced directly from theme root
    if (layoutId === 'base') {
        const templateSource = await getThemeAssetContent(siteData, themeName, 'base.hbs');
        if (!templateSource) {
            throw new Error(`Base template not found: themes/${themeName}/base.hbs`);
        }

        const template = Handlebars.compile(templateSource);
        const contextWithBody = {
            ...context,
            body: childHtml ? new Handlebars.SafeString(childHtml) : undefined
        };

        return template(contextWithBody);
    }

    // Get layout manifest to find its parent
    const layoutManifest = await getLayoutManifest(siteData, layoutId);
    if (!layoutManifest) {
        throw new Error(`Layout manifest not found: ${layoutId}`);
    }

    // Load layout template from theme directory
    const themeManifest = await getAssetContent(siteData, 'theme', themeName, 'theme.json');
    if (!themeManifest) {
        throw new Error(`Theme manifest not found: ${themeName}`);
    }

    const themeData = JSON.parse(themeManifest);
    const layoutRef = themeData.layouts?.find((l: any) => l.id === layoutId);
    if (!layoutRef) {
        throw new Error(`Layout reference not found in theme: ${layoutId}`);
    }

    const templatePath = `${layoutRef.path}/index.hbs`;
    const templateSource = await getThemeAssetContent(siteData, themeName, templatePath);

    if (!templateSource) {
        throw new Error(`Template not found: themes/${themeName}/${templatePath}`);
    }

    // Compile and render this layout level
    const template = Handlebars.compile(templateSource);
    const contextWithBody = {
        ...context,
        body: childHtml ? new Handlebars.SafeString(childHtml) : undefined
    };
    const html = template(contextWithBody);

    // If this layout has a parent, recursively render the parent
    if (layoutManifest.parentLayout) {
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
    
    if (resolution.type === PageType.NotFound) {
        return `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
    }

    // 1. Synchronize Data and Prepare Handlebars Environment
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(siteData.manifest.theme.name, siteData.manifest.theme.config);
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

    // 2.6. Populate collection items for collection layout types
    let enrichedResolution = resolution;
    if (pageLayoutManifest.layoutType === 'collection') {
      const layoutConfig = resolution.contentFile.frontmatter.layoutConfig;
      if (layoutConfig && layoutConfig.collectionId) {
        let collectionItems = getCollectionContent(synchronizedSiteData, layoutConfig.collectionId);
        
        // Apply sorting - always sort by date if no sortBy specified
        const sortBy = layoutConfig.sortBy || 'date';
        const sortOrder = layoutConfig.sortOrder || 'desc';
        
        collectionItems = sortCollectionItems(collectionItems, sortBy, sortOrder);
        
        enrichedResolution = {
          ...resolution,
          collectionItems
        };
      }
    }

    // 3. Assemble Data Contexts for the Templates
    const pageContext = await assemblePageContext(synchronizedSiteData, enrichedResolution, options, imageService, pageLayoutManifest);
    const baseContext = await assembleBaseContext(synchronizedSiteData, enrichedResolution, options, imageService, pageContext);

    // 4. Load layout template from theme directory
    const themeName = synchronizedSiteData.manifest.theme.name;
    const themeManifest = await getAssetContent(synchronizedSiteData, 'theme', themeName, 'theme.json');
    if (!themeManifest) throw new Error(`Theme manifest not found: ${themeName}`);

    const themeData = JSON.parse(themeManifest);
    const layoutRef = themeData.layouts?.find((l: any) => l.id === enrichedResolution.layoutPath);
    if (!layoutRef) throw new Error(`Layout not found in theme: ${enrichedResolution.layoutPath}`);

    const bodyTemplatePath = `${layoutRef.path}/index.hbs`;
    const bodyTemplateSource = await getThemeAssetContent(synchronizedSiteData, themeName, bodyTemplatePath);
    if (!bodyTemplateSource) throw new Error(`Body template not found: themes/${themeName}/${bodyTemplatePath}`);

    // Process markdown content using the existing markdown helper
    const markdownContent = enrichedResolution.contentFile.content || '';
    console.log('[Render Service] Raw markdown content:', markdownContent);
    console.log('[Render Service] Content contains directive:', markdownContent.includes('::collection_view'));
    
    // Import the remark processing logic
    const { remark } = await import('remark');
    const { default: remarkDirective } = await import('remark-directive');
    const { default: remarkRehype } = await import('remark-rehype');
    const { default: rehypeSlug } = await import('rehype-slug');
    const { default: rehypeStringify } = await import('rehype-stringify');
    const { visit } = await import('unist-util-visit');
    
    let processedContent: string;
    if (markdownContent.trim()) {
        // Configure remark with directive support and custom image handling
        const processor = remark()
          .use(remarkDirective)
          .use(() => {
            return (tree: any) => {
              // Process collection_view directives (both leaf and container types)
              const processCollectionDirective = (node: any) => {
                if (node.name === 'collection_view') {
                  // Convert directive to HTML placeholder for post-processing
                  const attrs = node.attributes || {};
                  const directiveHtml = `<div data-collection-directive="true" data-collection="${attrs.collection}" data-layout="${attrs.layout}" data-max-items="${attrs.maxItems}" data-sort-by="${attrs.sortBy}" data-sort-order="${attrs.sortOrder}"></div>`;
                  
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

              // Process images to use preprocessed URLs
              visit(tree, 'image', (node: any) => {
                if (node.url && (node.url.startsWith('assets/originals/') || node.url.startsWith('assets/images/'))) {
                  console.log('[Render Service] Processing Sparktype markdown image:', node.url);

                  // Get preprocessed URL (page_display preset for markdown images)
                  const contentPath = enrichedResolution.contentFile.path;
                  let processedUrl = imagePreprocessor.getProcessedMarkdownImageUrl(contentPath, node.url, 'page_display');

                  if (processedUrl) {
                    console.log('[Render Service] Using preprocessed URL:', processedUrl);

                    // Convert to relative path for export mode
                    if (options.isExport) {
                      const currentPageNode = {
                        type: 'page' as const,
                        title: enrichedResolution.contentFile.frontmatter.title,
                        path: enrichedResolution.contentFile.path,
                        slug: enrichedResolution.contentFile.slug
                      };
                      const currentPagePath = getUrlForNode(currentPageNode, synchronizedSiteData.manifest, true, undefined, synchronizedSiteData);

                      // Strip leading slash from processed URL if present
                      const cleanProcessedUrl = processedUrl.startsWith('/')
                        ? processedUrl.substring(1)
                        : processedUrl;
                      processedUrl = getRelativePath(currentPagePath, cleanProcessedUrl);
                      console.log('[Render Service] Converted to relative path for export:', processedUrl);
                    }

                    // Replace with preprocessed URL
                    node.url = processedUrl;
                  } else {
                    console.warn('[Render Service] No preprocessed URL found for:', node.url, '- falling back to original');
                    // Fallback: keep original path, which points to assets/originals/
                    // This will work for preview/export as originals are copied
                  }
                } else {
                  console.log('[Render Service] Standard image handling for:', node.url);
                }
              });
            };
          })
          .use(remarkRehype, { allowDangerousHtml: true })
          .use(rehypeSlug) // Add unique IDs to all headings for TOC anchor navigation
          .use(rehypeStringify, { allowDangerousHtml: true });
        
        // Process markdown to HTML
        const result = await processor.process(markdownContent);
        processedContent = String(result);
        console.log('[Render Service] After remark processing:', processedContent.substring(0, 500));
        
        // Post-process HTML to convert collection directives and Sparktype asset paths
        processedContent = await postProcessCollectionDirectives(processedContent, synchronizedSiteData);
        console.log('[Render Service] After directive processing:', processedContent.substring(0, 500));
        
        // Calculate current page path for relative asset paths
        const currentPageNode = {
          type: 'page' as const,
          title: enrichedResolution.contentFile.frontmatter.title,
          path: enrichedResolution.contentFile.path,
          slug: enrichedResolution.contentFile.slug
        };
        const currentPagePath = getUrlForNode(currentPageNode, synchronizedSiteData.manifest, options.isExport, undefined, synchronizedSiteData);
        
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
        content: new Handlebars.SafeString(processedContent)
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
      
      // Generate relative path from current page to the asset
      // Strip leading slash from derivative filename if present
      const cleanDerivativeFilename = derivativeFilename.startsWith('/') 
        ? derivativeFilename.substring(1) 
        : derivativeFilename;
      const relativePath = getRelativePath(currentPagePath, cleanDerivativeFilename);
      
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
  siteData: LocalSiteData
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
      const maxItemsMatch = fullMatch.match(/data-max-items="([^"]*)"/) || [];
      const sortByMatch = fullMatch.match(/data-sort-by="([^"]*)"/) || [];
      const sortOrderMatch = fullMatch.match(/data-sort-order="([^"]*)"/) || [];
      
      const config = {
        collectionId: collectionMatch[1] || '',
        layout: layoutMatch[1] || 'list',
        maxItems: parseInt(maxItemsMatch[1] || '10'),
        sortBy: sortByMatch[1] || 'date',
        sortOrder: (sortOrderMatch[1] || 'desc') as 'asc' | 'desc'
      };
      
      console.log('[Render Service] Processing collection directive with config:', config);
      
      if (config.collectionId) {
        // Get collection items
        let items = getCollectionContent(siteData, config.collectionId);
        
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
          
          // Use layout partials instead of block templates
          const layoutId = config.layout || 'blog-listing'; // default to blog-listing
          console.log('[Render Service] Using collection layout:', layoutId);
          
          try {
            // Import the layout discovery service to get partial path
            const { getCollectionLayoutById } = await import('@/core/services/collectionLayout.service');
            const layoutInfo = await getCollectionLayoutById(siteData, layoutId);
            
            if (layoutInfo && layoutInfo.partialPath) {
              console.log('[Render Service] Found layout partial:', layoutInfo.partialPath);
              
              // Render each item using the layout partial
              const renderedItems = items.map(item => {
                // Use Handlebars to render the partial for each item
                const partialTemplate = Handlebars.partials[layoutInfo.partialPath!];
                if (partialTemplate) {
                  const compiledPartial = typeof partialTemplate === 'string' 
                    ? Handlebars.compile(partialTemplate) 
                    : partialTemplate;
                  return compiledPartial(item);
                }
                return `<!-- Partial not found: ${layoutInfo.partialPath} -->`;
              });
              
              // Wrap the rendered items in a container
              const containerClass = layoutId.includes('grid') 
                ? 'collection-grid grid gap-4' 
                : 'collection-list space-y-4';
              
              const renderedContent = `<div class="${containerClass}">\n${renderedItems.join('\n')}\n</div>`;
              
              // Replace the directive placeholder with rendered content
              processedHtml = processedHtml.replace(fullMatch + '</div>', renderedContent);
              console.log('[Render Service] Rendered collection directive with layout partial:', layoutInfo.partialPath);
            } else {
              console.warn('[Render Service] Layout not found or missing partial:', layoutId);
              processedHtml = processedHtml.replace(fullMatch + '</div>', `<!-- Collection layout not found: ${layoutId} -->`);
            }
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

