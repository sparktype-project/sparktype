// src/core/services/renderer/layoutHierarchy.ts

import Handlebars from 'handlebars';
import type { LocalSiteData } from '@/core/types';
import { renderTemplate } from './templateRuntime';
import { getAssetContent, getLayoutManifest, getThemeAssetContent } from '@/core/services/config/configHelpers.service';

/**
 * Layout hierarchy rendering.
 *
 * Order matters here: the page body is rendered first by the orchestrator, then layouts wrap
 * it from the most specific layout outwards (Jekyll-style inheritance) until a layout without
 * a `parentLayout` is reached. Each level receives the previous level's HTML as `{{{body}}}`,
 * so the innermost content is never re-rendered or re-sanitised by an outer layout.
 */

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
export async function renderLayoutHierarchy(
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
    const contextWithBody = {
        ...context,
        body: childHtml ? new Handlebars.SafeString(childHtml) : undefined
    };
    const html = renderTemplate(templateSource, contextWithBody);

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
