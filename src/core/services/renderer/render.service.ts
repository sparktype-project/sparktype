// src/core/services/renderer/render.service.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, PageResolutionResult } from '@/core/types';
import { PageType } from '@/core/types';
import { clearAssetContentCache, getLayoutManifest, getThemeAssetContent } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { prepareRenderEnvironment } from './asset.service';
import { assemblePageContext, assembleBaseContext } from './context.service';
import { imagePreprocessor } from '@/core/services/images/imagePreprocessor.service';
import { getUrlForNode } from '@/core/services/urlUtils.service';
import { replaceCloudinaryHostedVideos } from './cloudinaryVideoPlayer';
import { sanitizeHtml } from './sanitize';
import { renderMarkdownToHtml } from './markdownPipeline';
import { enrichListLayoutResolution } from './listLayoutEnrichment';
import { renderLayoutHierarchy } from './layoutHierarchy';
import { postProcessCollectionDirectives } from './collectionDirectives';
import {
    postProcessSparkTypeImages,
    postProcessSparkTypeImagesForExport,
} from './images';
import type { RenderOptions } from './render.types';

// `RenderOptions` lives in a dependency leaf (render.types) so services that feed the
// renderer can import the type without importing the orchestrator. It stays part of this
// module's public surface for existing callers.
export type { RenderOptions } from './render.types';

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

    // 2.6. Populate collection items and pagination for list layout types
    const { resolution: enrichedResolution, itemLayoutId } = enrichListLayoutResolution(
      synchronizedSiteData,
      resolution,
      pageLayoutManifest,
      options,
    );

    // 3. Assemble Data Contexts for the Templates
    const pageContext = await assemblePageContext(synchronizedSiteData, enrichedResolution, options, imageService, pageLayoutManifest);
    const baseContext = await assembleBaseContext(synchronizedSiteData, enrichedResolution, options, imageService, pageContext);

    // 4. Load layout template from theme directory using convention
    const themeName = synchronizedSiteData.manifest.theme.name;
    const bodyTemplatePath = `layouts/${enrichedResolution.layoutPath}/index.hbs`;
    const bodyTemplateSource = await getThemeAssetContent(synchronizedSiteData, themeName, bodyTemplatePath);
    if (!bodyTemplateSource) throw new Error(`Body template not found: themes/${themeName}/${bodyTemplatePath}`);

    // Markdown source for this page; empty content skips the whole HTML pipeline.
    const markdownContent = enrichedResolution.contentFile.content || '';
    console.log('[Render Service] Raw markdown content:', markdownContent);
    console.log('[Render Service] Content contains directive:', markdownContent.includes('::collection_view'));
    
    let processedContent: string;
    if (markdownContent.trim()) {
        // 5. Markdown/MDX to HTML. The pipeline owns its internal ordering (directive
        // placeholders, MDX column handling, raw HTML element preservation, markdown image URL
        // rewriting, then rehype conversion) - see markdownPipeline.ts. Its output is
        // unsanitised HTML and is intentionally not trusted yet.
        processedContent = await renderMarkdownToHtml({
            markdownContent,
            siteData: synchronizedSiteData,
            contentFile: enrichedResolution.contentFile,
            pageNumber: enrichedResolution.pageNumber,
            imageService,
            options,
        });
        console.log('[Render Service] After remark processing:', processedContent.substring(0, 500));

        // Post-process HTML to convert collection directives. This must happen before
        // sanitization: the expanded items are page content and have to cross the security
        // boundary below. It also has to happen after the markdown pipeline, which is what
        // turns the directives into placeholders in the first place.
        processedContent = await postProcessCollectionDirectives(
          processedContent,
          synchronizedSiteData,
          options,
          enrichedResolution.contentFile
        );
        console.log('[Render Service] After directive processing:', processedContent.substring(0, 500));

        processedContent = replaceCloudinaryHostedVideos(processedContent, synchronizedSiteData.manifest);

        // --- Sanitisation boundary -------------------------------------------------------
        // Sanitize HTML AFTER all HTML generation to prevent XSS attacks.
        // This includes both user markdown and generated collection directive HTML.
        // Uses custom sanitizeHtml() that allows scripts from trusted domains only.
        // Nothing that injects HTML may be added after this point except the image URL
        // rewrite below, which only substitutes URLs.
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
        
        // --- Image URL rewriting (preview vs export) --------------------------------------
        // Deliberately after sanitisation. Both branches only replace the `src` of
        // `<img data-sparktype-asset="true">` tags with URLs DOMPurify would otherwise reject
        // (blob:, data:, relative) because ALLOW_UNKNOWN_PROTOCOLS is false. The branches
        // differ in target: preview needs URLs the browser can load from memory, export needs
        // paths that survive being written to disk.
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

    // 6. Use nested layout rendering (Jekyll-style inheritance)
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
