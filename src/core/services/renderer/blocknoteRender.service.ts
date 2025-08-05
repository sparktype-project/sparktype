// src/core/services/renderer/blocknoteRender.service.ts

import Handlebars from 'handlebars';
import type { LocalSiteData, PageResolutionResult, ImageService, LayoutManifest } from '@/core/types';
import { PageType } from '@/core/types';
import { getAssetContent, getLayoutManifest } from '@/core/services/config/configHelpers.service';
import { getActiveImageService } from '@/core/services/images/images.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { prepareRenderEnvironment } from './asset.service';
import { assemblePageContext, assembleBaseContext } from './context.service';
import { getCollectionContent, sortCollectionItems } from '@/core/services/collections.service';
import { BlockNoteEditor } from '@blocknote/core';
import type { Block } from '@blocknote/core';

/**
 * Defines the options passed to the BlockNote render function.
 */
export interface BlockNoteRenderOptions {
    siteRootPath: string;
    isExport: boolean;
    relativeAssetPath?: string;
}

/**
 * Renders a resolved page with BlockNote blocks into a full HTML string.
 * This is the new streamlined rendering pipeline for BlockNote-based content.
 */
export async function renderBlockNotePage(
    siteData: LocalSiteData,
    resolution: PageResolutionResult,
    options: BlockNoteRenderOptions
): Promise<string> {
    if (resolution.type === PageType.NotFound) {
        return `<h1>404 - Not Found</h1><p>${resolution.errorMessage}</p>`;
    }

    // 1. Prepare environment and services
    const { initialConfig: finalMergedConfig } = await getMergedThemeDataForForm(siteData.manifest.theme.name, siteData.manifest.theme.config);
    const synchronizedSiteData = { ...siteData, manifest: { ...siteData.manifest, theme: { ...siteData.manifest.theme, config: finalMergedConfig }}};
    await prepareRenderEnvironment(synchronizedSiteData);

    // 2. Get services and manifests
    const imageService = getActiveImageService(synchronizedSiteData.manifest);
    const pageLayoutManifest = await getLayoutManifest(synchronizedSiteData, resolution.layoutPath);
    if (!pageLayoutManifest) {
      throw new Error(`Layout manifest not found for layout: "${resolution.layoutPath}"`);
    }

    // 3. Handle collection layouts
    let enrichedResolution = resolution;
    if (pageLayoutManifest.layoutType === 'collection') {
      const layoutConfig = resolution.contentFile.frontmatter.layoutConfig;
      if (layoutConfig && layoutConfig.collectionId) {
        let collectionItems = getCollectionContent(synchronizedSiteData, layoutConfig.collectionId);
        
        if (layoutConfig.sortBy) {
          collectionItems = sortCollectionItems(collectionItems, layoutConfig.sortBy, layoutConfig.sortOrder || 'desc');
        }
        
        enrichedResolution = {
          ...resolution,
          collectionItems
        };
      }
    }

    // 4. Assemble contexts
    const pageContext = await assemblePageContext(synchronizedSiteData, enrichedResolution, options, imageService, pageLayoutManifest);
    const baseContext = await assembleBaseContext(synchronizedSiteData, enrichedResolution, options, imageService, pageContext);

    // 5. Render BlockNote content to HTML
    let bodyHtml: string;
    
    try {
        // Check if we have BlockNote blocks
        const blocknoteBlocks = enrichedResolution.contentFile.frontmatter.blocknoteBlocks;
        
        if (blocknoteBlocks && blocknoteBlocks.length > 0) {
            // Use BlockNote's server-side rendering
            const editor = BlockNoteEditor.create();
            const processedContent = await editor.blocksToFullHTML(blocknoteBlocks);
            
            // Get the layout template
            const bodyTemplatePath = pageLayoutManifest.layoutType === 'collection' ? 'index.hbs' : 'index.hbs';
            const bodyTemplateSource = await getAssetContent(synchronizedSiteData, 'layout', enrichedResolution.layoutPath, bodyTemplatePath);
            if (!bodyTemplateSource) throw new Error(`Body template not found: layouts/${enrichedResolution.layoutPath}/${bodyTemplatePath}`);

            const contentContext = {
                ...pageContext,
                content: new Handlebars.SafeString(processedContent)
            };
            
            bodyHtml = await Handlebars.compile(bodyTemplateSource)(contentContext);
        } else {
            // Fallback for legacy content or empty pages
            const bodyTemplatePath = 'index.hbs';
            const bodyTemplateSource = await getAssetContent(synchronizedSiteData, 'layout', enrichedResolution.layoutPath, bodyTemplatePath);
            if (!bodyTemplateSource) throw new Error(`Body template not found: layouts/${enrichedResolution.layoutPath}/${bodyTemplatePath}`);

            const contentContext = {
                ...pageContext,
                content: new Handlebars.SafeString(enrichedResolution.contentFile.content || '')
            };
            
            bodyHtml = await Handlebars.compile(bodyTemplateSource)(contentContext);
        }
    } catch (renderError) {
        console.error('[BlockNote Render Service] Error processing BlockNote content:', renderError);
        throw renderError;
    }

    // 6. Render final page shell
    const baseTemplateSource = await getAssetContent(synchronizedSiteData, 'theme', synchronizedSiteData.manifest.theme.name, 'base.hbs');
    if (!baseTemplateSource) throw new Error('Base theme template (base.hbs) not found.');

    const finalContextWithBody = { ...baseContext, body: new Handlebars.SafeString(bodyHtml) };
    return await Handlebars.compile(baseTemplateSource)(finalContextWithBody);
}