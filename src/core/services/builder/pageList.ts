// src/core/services/builder/pageList.ts

import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { flattenStructure } from '@/core/services/fileTree.service';
import { generateExportUrl } from '@/core/services/urlUtils.service';

export interface PageEntry {
  file: ParsedMarkdownFile;
  /** Public URL of the page (`''` for the homepage). */
  url: string;
  /** File the build writes for the page. */
  outputPath: string;
}

/** Every page and collection item the build emits for `data`, with its URL and output file. */
export function listPages(data: LocalSiteData): PageEntry[] {
  const filesByPath = new Map((data.contentFiles ?? []).map((file) => [file.path, file]));
  const nodes = [...flattenStructure(data.manifest.structure), ...(data.manifest.collectionItems ?? [])];
  const pages: PageEntry[] = [];

  for (const node of nodes) {
    const file = filesByPath.get(node.path);
    if (!file) continue;
    pages.push({
      file,
      url: generateExportUrl(node, data.manifest, undefined, data),
      outputPath: generateExportUrl(node, data.manifest, undefined, data, undefined, true),
    });
  }
  return pages;
}
