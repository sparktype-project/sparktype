// src/core/services/siteExporter.service.ts (REFACTORED)

import JSZip from 'jszip';
import type { LocalSiteData } from '@/core/types';
import { buildSiteBundle } from './siteBuilder.service';

/**
 * Takes a complete site data object, uses the siteBuilder service to generate
 * all static assets, and then packages them into a ZIP archive for download.
 *
 * This service is a "deployment target". Other targets could be created
 * for different platforms (e.g., Netlify, Vercel).
 *
 * @param siteData The fully loaded local site data.
 * @returns A promise that resolves to a Blob containing the ZIP file.
 */
export async function exportSiteToZip(siteData: LocalSiteData): Promise<Blob> {
    // 1. Call the builder service to generate the complete site bundle in memory.
    const bundle = await buildSiteBundle(siteData);

    // 2. Create a new ZIP instance.
    const zip = new JSZip();

    // 3. Iterate through the in-memory bundle and add each file to the zip.
    for (const [filePath, content] of Object.entries(bundle)) {
        zip.file(filePath, content);
    }

    // 4. Generate the final ZIP blob and return it.
    return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 9,
        },
    });
}