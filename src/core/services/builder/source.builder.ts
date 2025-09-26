// src/core/services/builder/source.builder.ts

import type { LocalSiteData, SiteBundle } from '@/core/types';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import * as localSiteFs from '@/core/services/localFileSystem.service';

/**
 * Bundles all raw source files (Markdown, manifest) into the `_site` directory.
 */
export async function bundleSourceFiles(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
    // 1. Add the synchronized manifest with data files reference
    const manifestWithDataFiles = {
        ...siteData.manifest,
        // Include data files reference if media.json will be generated
        dataFiles: ['data/media.json']
    };
    bundle['_site/manifest.json'] = JSON.stringify(manifestWithDataFiles, null, 2);

    // 2. Add all published content files only
    siteData.contentFiles?.forEach(file => {
        // Only include published content in the source bundle
        const isPublished = file.frontmatter.published !== false;
        if (isPublished) {
            bundle[`_site/${file.path}`] = stringifyToMarkdown(file.frontmatter, file.content);
        }
    });

    // 3. Add all data files (e.g., categories.json)
    const dataFiles = await localSiteFs.getAllDataFiles(siteData.siteId);
    for (const [path, content] of Object.entries(dataFiles)) {
        if (typeof content === 'string') {
            bundle[`_site/${path}`] = content;
        }
    }
}