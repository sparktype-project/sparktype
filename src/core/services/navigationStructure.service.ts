// src/core/services/navigationStructure.service.ts
import { type LocalSiteData, type NavLinkItem, type StructureNode } from '@/core/types';
import { getUrlForNode } from '@/core/services/urlUtils.service';
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
    options: Pick<RenderOptions, 'isExport' | 'siteRootPath'>
): NavLinkItem[] {
  return nodes
    .filter(node => node.type === 'page' && node.navOrder !== undefined)
    .sort((a, b) => (a.navOrder || 0) - (b.navOrder || 0))
    .map(node => {
      const urlSegment = getUrlForNode(node, siteData.manifest, options.isExport, undefined, siteData);
      let href: string;

      if (options.isExport) {
        // For export mode, use relative navigation links for portable HTML
        if (!urlSegment || urlSegment === 'index.html') {
          // Homepage link - calculate relative path from current page to index.html
          href = getRelativePath(currentPagePath, 'index.html');
        } else {
          // Other pages - calculate relative path from current page to target page
          href = getRelativePath(currentPagePath, urlSegment);
        }
      } else {
        // 1. Get the base path from options (e.g., "#/sites/123").
        // 2. The urlSegment is the page-specific part (e.g., "about" or "blog/post-1").
        // 3. Combine them into a clean absolute hash path.
        const basePath = options.siteRootPath.replace(/\/$/, ''); // Remove trailing slash
        const segmentPath = urlSegment ? `/${urlSegment}` : '';  // Add leading slash if segment exists
        href = `${basePath}${segmentPath}`;
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
  options: Pick<RenderOptions, 'isExport' | 'siteRootPath'>
): NavLinkItem[] {
  const { structure } = siteData.manifest;
  return buildNavLinks(siteData, structure, currentPagePath, options);
}