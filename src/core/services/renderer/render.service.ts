// src/core/services/renderer/render.service.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, PageResolutionResult, ParsedMarkdownFile } from '@/core/types';
import { PageType } from '@/core/types';
import { getAssetContent, getLayoutManifest } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { prepareRenderEnvironment } from './asset.service';
import { assemblePageContext, assembleBaseContext } from './context.service';
import { getCollectionContent, sortCollectionItems } from '@/core/services/collections.service';
import type { ImageService } from '@/core/types';

/**
 * Defines the options passed to the main render function.
 */
export interface RenderOptions {
    siteRootPath: string;
    isExport: boolean;
    relativeAssetPath?: string;
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

    // 2.5. Populate collection items for collection layout types
    let enrichedResolution = resolution;
    if (pageLayoutManifest.layoutType === 'collection') {
      const layoutConfig = resolution.contentFile.frontmatter.layoutConfig;
      if (layoutConfig && layoutConfig.collectionId) {
        let collectionItems = getCollectionContent(synchronizedSiteData, layoutConfig.collectionId);
        
        // Apply sorting if specified in layoutConfig
        if (layoutConfig.sortBy) {
          collectionItems = sortCollectionItems(collectionItems, layoutConfig.sortBy, layoutConfig.sortOrder || 'desc');
        }
        
        enrichedResolution = {
          ...resolution,
          collectionItems
        };
      }
    }

    // 3. Assemble Data Contexts for the Templates
    const pageContext = await assemblePageContext(synchronizedSiteData, enrichedResolution, options, imageService, pageLayoutManifest);
    const baseContext = await assembleBaseContext(synchronizedSiteData, enrichedResolution, options, imageService, pageContext);

    // 4. Compile and Render the Main Body Content (Legacy mode - plain markdown)
    const bodyTemplatePath = pageLayoutManifest.layoutType === 'collection' ? 'index.hbs' : 'index.hbs';
    const bodyTemplateSource = await getAssetContent(synchronizedSiteData, 'layout', enrichedResolution.layoutPath, bodyTemplatePath);
    if (!bodyTemplateSource) throw new Error(`Body template not found: layouts/${enrichedResolution.layoutPath}/${bodyTemplatePath}`);

    // Process markdown content using the existing markdown helper
    const markdownContent = enrichedResolution.contentFile.content || '';
    console.log('[Render Service] Raw markdown content:', markdownContent);
    
    // Import the markdown processing logic
    const { marked } = await import('marked');
    
    let processedContent: string;
    if (markdownContent.trim()) {
        // Configure marked with custom image renderer for Sparktype images
        const renderer = new marked.Renderer();
        
        // Custom image renderer that processes Sparktype assets
        renderer.image = function(href: any, title: any, text: any) {
          console.log('[Render Service] Image renderer called with objects:', { 
            href: href, 
            title: title, 
            text: text,
            hrefKeys: typeof href === 'object' && href !== null ? Object.keys(href) : 'not object',
            hrefValues: typeof href === 'object' && href !== null ? Object.values(href) : 'not object'
          });
          
          // Handle marked.js token object structure - it passes a single token object as href
          let imageUrl = '';
          let imageTitle = '';
          let imageAlt = '';
          
          if (typeof href === 'object' && href !== null) {
            // Log the exact object structure to debug
            console.log('[Render Service] href object properties:', href);
            
            // Try different possible property names for marked.js token
            imageUrl = href.href || href.url || href.src || '';
            imageTitle = href.title || '';
            imageAlt = href.text || href.alt || '';
            
            // If the object has nested properties, check those too
            if (!imageUrl && href.token) {
              imageUrl = href.token.href || href.token.url || href.token.src || '';
              imageTitle = href.token.title || '';
              imageAlt = href.token.text || href.token.alt || '';
            }
          } else {
            // Fallback for direct string parameters (older marked.js versions)
            imageUrl = href;
            imageTitle = title;
            imageAlt = text;
          }
          
          console.log('[Render Service] Extracted values:', { imageUrl, imageTitle, imageAlt });
          
          // Type check for imageUrl
          if (!imageUrl || typeof imageUrl !== 'string') {
            console.log('[Render Service] Invalid imageUrl, returning empty image. Full href object:', href);
            return `<img src="" alt="${imageAlt || ''}" title="${imageTitle || ''}">`;
          }
          
          // If this is a Sparktype asset path, mark it for post-processing
          if (imageUrl.startsWith('assets/images/')) {
            console.log('[Render Service] Marking Sparktype asset for processing:', imageUrl);
            return `<img src="${imageUrl}" alt="${imageAlt || ''}" title="${imageTitle || ''}" data-sparktype-asset="true">`;
          }
          
          // Standard image handling for non-Sparktype images
          console.log('[Render Service] Standard image handling for:', imageUrl);
          return `<img src="${imageUrl}" alt="${imageAlt || ''}" title="${imageTitle || ''}">`;
        };
        
        // Process markdown to HTML with custom renderer
        processedContent = marked.parse(markdownContent, { 
          async: false,
          renderer: renderer
        }) as string;
        
        // Post-process HTML to convert Sparktype asset paths 
        if (!options.isExport) {
          // For preview: convert asset paths to blob URLs
          console.log('[Render Service] Processing images for preview, content before:', processedContent.substring(0, 500));
          processedContent = await postProcessSparkTypeImages(processedContent, synchronizedSiteData, imageService);
          console.log('[Render Service] Content after image processing:', processedContent.substring(0, 500));
        } else {
          // For export: convert asset paths to derivative filenames
          console.log('[Render Service] Processing images for export, content before:', processedContent.substring(0, 500));
          processedContent = await postProcessSparkTypeImagesForExport(processedContent, synchronizedSiteData, imageService);
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
    
    const bodyHtml = await Handlebars.compile(bodyTemplateSource)(contentContext);

    // 5. Compile and Render the Final Page Shell (base.hbs)
    const baseTemplateSource = await getAssetContent(synchronizedSiteData, 'theme', synchronizedSiteData.manifest.theme.name, 'base.hbs');
    if (!baseTemplateSource) throw new Error('Base theme template (base.hbs) not found.');

    const finalContextWithBody = { ...baseContext, body: new Handlebars.SafeString(bodyHtml) };
    return await Handlebars.compile(baseTemplateSource)(finalContextWithBody);
}

/**
 * Post-processes HTML content to convert Sparktype asset paths to blob URLs for preview
 */
async function postProcessSparkTypeImages(
  htmlContent: string, 
  siteData: LocalSiteData, 
  imageService: ImageService
): Promise<string> {
  // Find all Sparktype asset images (simpler regex pattern)
  const imageRegex = /<img[^>]*src="(assets\/images\/[^"]+)"[^>]*data-sparktype-asset="true"[^>]*>/g;
  
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
      
      // Generate blob URL for preview
      const blobUrl = await imageService.getDisplayUrl(
        siteData.manifest,
        imageRef,
        { width: imageRef.width, height: imageRef.height },
        false // isExport = false for blob URL generation
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
 * Post-processes HTML content to convert Sparktype asset paths to derivative filenames for export
 */
async function postProcessSparkTypeImagesForExport(
  htmlContent: string, 
  siteData: LocalSiteData, 
  imageService: ImageService
): Promise<string> {
  // Find all Sparktype asset images
  const imageRegex = /<img[^>]*src="(assets\/images\/[^"]+)"[^>]*data-sparktype-asset="true"[^>]*>/g;
  
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
      
      // Replace the entire img tag with derivative filename
      const newImg = fullMatch.replace(`src="${assetPath}"`, `src="${derivativeFilename}"`).replace(' data-sparktype-asset="true"', '');
      processedHtml = processedHtml.replace(fullMatch, newImg);
      
      console.log('[Render Service] Converted asset to derivative filename:', assetPath, '->', derivativeFilename);
    } catch (error) {
      console.error('[Render Service] Failed to convert asset to derivative filename:', assetPath, error);
    }
  }
  
  return processedHtml;
}

