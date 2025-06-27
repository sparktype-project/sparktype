// src/core/services/builder/source.builder.ts

import type { LocalSiteData, SiteBundle } from '@/core/types';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import * as localSiteFs from '@/core/services/localFileSystem.service';

/**
 * Bundles all raw source files (Markdown, manifest) into the `_signum` directory.
 */
export async function bundleSourceFiles(bundle: SiteBundle, siteData: LocalSiteData): Promise<void> {
    // 1. Add the synchronized manifest
    bundle['_signum/manifest.json'] = JSON.stringify(siteData.manifest, null, 2);

    // 2. Add all content files
    siteData.contentFiles?.forEach(file => {
        bundle[`_signum/${file.path}`] = stringifyToMarkdown(file.frontmatter, file.content);
    });

    // 3. Add all data files (e.g., categories.json)
    const dataFiles = await localSiteFs.getAllDataFiles(siteData.siteId);
    for (const [path, content] of Object.entries(dataFiles)) {
        if (typeof content === 'string') {
            bundle[`_signum/${path}`] = content;
        }
    }
}