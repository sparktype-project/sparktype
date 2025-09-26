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
    try {
        console.log(`[SiteExporter] Starting site export for: ${siteData.siteId}`);

        // 1. Call the builder service to generate the complete site bundle in memory.
        console.log(`[SiteExporter] Building site bundle...`);
        const bundle = await buildSiteBundle(siteData);
        console.log(`[SiteExporter] ✅ Site bundle completed with ${Object.keys(bundle).length} files`);

        // 2. Create a new ZIP instance.
        console.log(`[SiteExporter] Creating ZIP archive...`);
        const zip = new JSZip();

        // 3. Iterate through the in-memory bundle and add each file to the zip.
        let fileCount = 0;
        for (const [filePath, content] of Object.entries(bundle)) {
            zip.file(filePath, content);
            fileCount++;

            if (fileCount % 10 === 0) {
                console.log(`[SiteExporter] Added ${fileCount} files to ZIP...`);
            }
        }
        console.log(`[SiteExporter] ✅ Added all ${fileCount} files to ZIP`);

        // 4. Generate the final ZIP blob and return it.
        console.log(`[SiteExporter] Generating ZIP blob...`);
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 9,
            },
        });

        console.log(`[SiteExporter] ✅ ZIP export completed! Size: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);
        return zipBlob;

    } catch (error) {
        console.error(`[SiteExporter] ❌ Export failed:`, error);
        console.error(`[SiteExporter] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        throw error;
    }
}