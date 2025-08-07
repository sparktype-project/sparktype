// src/lib/remoteSiteFetcher.ts
import { type LocalSiteData, type ParsedMarkdownFile, type Manifest } from '@/core/types';
import { parseMarkdownString } from './markdownParser';
import { flattenStructure } from '../services/fileTree.service';

async function fetchRemoteFile(baseUrl: string, filePath: string): Promise<string> {
  const url = new URL(filePath, baseUrl).href;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Fetches and reconstructs an entire remote Sparktype site into the LocalSiteData format.
 * It fetches the manifest, then fetches all content files listed within it.
 * @param remoteSiteUrl The base URL of the remote Sparktype site.
 * @returns A Promise that resolves to a complete LocalSiteData object, or null if fetching fails.
 */
export async function fetchRemoteSiteData(remoteSiteUrl: string): Promise<LocalSiteData | null> {
  if (!remoteSiteUrl || !remoteSiteUrl.startsWith('http')) {
    console.error(`Invalid remoteSiteUrl provided: ${remoteSiteUrl}`);
    return null;
  }

  try {
    // 1. Fetch manifest.json, which is now the single source of truth.
    const manifestString = await fetchRemoteFile(remoteSiteUrl, '_site/manifest.json');
    const manifest: Manifest = JSON.parse(manifestString);

    if (!manifest || !manifest.siteId || !manifest.structure) {
        throw new Error("Invalid manifest structure fetched from remote site.");
    }
    
    // 2. Collect all unique file paths from the manifest structure.
    const allPageNodes = flattenStructure(manifest.structure);
    const contentFilePaths = [...new Set(allPageNodes.map(node => node.path))];

    // 3. Fetch all content files in parallel.
    const contentFilesPromises = contentFilePaths.map(async (path) => {
        try {
            const rawMarkdown = await fetchRemoteFile(remoteSiteUrl, `_site/${path}`);
            const { frontmatter, content } = parseMarkdownString(rawMarkdown);
            const slug = path.replace(/^content\//, '').replace(/\.md$/, '');
            return { slug, path, frontmatter, content, blocks: [], hasBlocks: false };
        } catch (error) {
            console.warn(`Could not fetch or parse content file: ${path}`, error);
            return null; // Return null on failure for this specific file
        }
    });
    
    const resolvedContentFiles = await Promise.all(contentFilesPromises);
    const validContentFiles = resolvedContentFiles.filter(file => file !== null) as ParsedMarkdownFile[];

    // 4. Construct the final LocalSiteData object.
    const finalSiteData: LocalSiteData = {
      siteId: `remote-${manifest.siteId}`, // Prefix to distinguish in local state
      manifest: manifest,
      contentFiles: validContentFiles,
    };

    return finalSiteData;

  } catch (error) {
    console.error(`CRITICAL ERROR fetching remote site data for ${remoteSiteUrl}:`, error);
    return null;
  }
}