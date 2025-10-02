// src/core/services/navigationStructure.service.ts
import { type LocalSiteData, type NavLinkItem, type StructureNode } from '@/core/types';
import { generatePreviewUrl, generateExportUrl } from '@/core/services/urlUtils.service';
import { getRelativePath } from '@/core/services/relativePaths.service';
import { type RenderOptions } from '@/core/services/renderer/render.service';

/**
 * Recursively builds a navigation link structure with context-aware paths.
 * @param siteData - The full site data, needed for URL generation.
 * @param nodes - The site structure nodes to build links from.
 * @param currentPagePath - The path of the page being currently rendered.
 * @param options - The render options, containing isExport and siteRootPath.
 * @returns An array of navigation link objects.
 */

function buildNavLinks(
    siteData: LocalSiteData,
    nodes: StructureNode[],
    currentPagePath: string,
    options: Pick<RenderOptions, 'isExport' | 'siteRootPath' | 'forIframe'>
): NavLinkItem[] {
  const siteId = siteData.manifest.siteId || 'unknown';

  return nodes
    .filter(node => node.type === 'page' && node.navOrder !== undefined)
    .sort((a, b) => (a.navOrder || 0) - (b.navOrder || 0))
    .map(node => {
      let href: string;

      if (options.isExport || options.forIframe) {
        // For export mode and iframe, generate clean directory URLs and relative paths
        const exportUrl = generateExportUrl(node, siteData.manifest, undefined, siteData, undefined, false, options.forIframe);
        if (options.forIframe) {
          // For iframe, use the URL directly - convert empty string to "/" for homepage
          href = exportUrl === '' ? '/' : exportUrl;
        } else if (exportUrl === '') {
          // Homepage - calculate relative path to homepage
          href = getRelativePath(currentPagePath, 'index.html');
        } else {
          // Other pages - calculate relative path
          href = getRelativePath(currentPagePath, `${exportUrl}/index.html`);
        }
      } else {
        // For preview mode, generate direct hash-based URLs
        href = generatePreviewUrl(node, siteData.manifest, siteId, undefined, siteData);
      }

      const nodeFile = siteData.contentFiles?.find(f => f.path === node.path);
      const isCollectionPage = !!nodeFile?.frontmatter.collection;

      const children = (node.children && node.children.length > 0 && !isCollectionPage)
        ? buildNavLinks(siteData, node.children, currentPagePath, options)
        : [];

      return {
        href: href,
        label: node.menuTitle || node.title,
        children: children,
      };
    });
}

export function generateNavLinks(
  siteData: LocalSiteData,
  currentPagePath: string,
  options: Pick<RenderOptions, 'isExport' | 'siteRootPath' | 'forIframe'>
): NavLinkItem[] {
  const { structure } = siteData.manifest;
  return buildNavLinks(siteData, structure, currentPagePath, options);
}