// src/core/services/renderer/listLayoutEnrichment.ts

import type { LayoutManifest, LocalSiteData, RenderablePageResolution, StructureNode } from '@/core/types';
import {
  createPaginationData,
  getCollectionItemsForLayoutConfig,
  getCollectionPaginationState,
  getItemsPerPage,
  isPaginationEnabled,
} from '@/core/services/collectionPagination.service';
import { generateExportUrl, generatePreviewUrl } from '@/core/services/urlUtils.service';
import { getRelativePath } from '@/core/services/relativePaths.service';
import type { RenderOptions } from './render.types';

/**
 * Enriches a resolution for `layoutType: 'list'` layouts: it attaches the collection items and,
 * when pagination is enabled, the page slice plus previous/next page URLs.
 *
 * This runs before contexts and templates are built, because both read the enriched resolution
 * (`collectionItems`, `pagination`, `pageNumber`). Pager URLs follow the same preview / iframe /
 * export rules as the rest of the renderer, and must be produced here so the list template can
 * link to pages that may not have been rendered yet.
 */

export interface ListLayoutEnrichment {
  /** The original resolution, or a copy with collection items and pagination attached. */
  resolution: RenderablePageResolution;
  /** Default item layout of the list's collection, when it is known. */
  itemLayoutId?: string;
}

export function enrichListLayoutResolution(
  siteData: LocalSiteData,
  resolution: RenderablePageResolution,
  pageLayoutManifest: LayoutManifest,
  options: RenderOptions,
): ListLayoutEnrichment {
  if (pageLayoutManifest.layoutType !== 'list') {
    return { resolution };
  }

  const layoutConfig = resolution.contentFile.frontmatter.layoutConfig;
  if (!layoutConfig || !layoutConfig.collectionId) {
    return { resolution };
  }

  const collectionItems = getCollectionItemsForLayoutConfig(siteData, layoutConfig);

  // Get the collection to retrieve its default item layout
  const collection = siteData.manifest.collections?.find(c => c.id === layoutConfig.collectionId);
  let itemLayoutId: string | undefined;
  if (collection) {
    itemLayoutId = collection.defaultItemLayout;
    console.log('[Render Service] Collection uses item layout:', itemLayoutId);
  }

  const requestedPage = resolution.pageNumber;
  const currentPageNode: StructureNode = {
    type: 'page',
    title: resolution.contentFile.frontmatter.title,
    path: resolution.contentFile.path,
    slug: resolution.contentFile.slug,
  };

  if (!isPaginationEnabled(layoutConfig)) {
    return {
      resolution: {
        ...resolution,
        collectionItems,
      },
      itemLayoutId,
    };
  }

  const paginationState = getCollectionPaginationState(
    collectionItems.length,
    requestedPage,
    getItemsPerPage(layoutConfig),
  );
  const currentPagePath = generateExportUrl(
    currentPageNode,
    siteData.manifest,
    paginationState.currentPage,
    siteData,
    undefined,
    true,
  );
  const previousPageNumber = paginationState.currentPage > 1 ? paginationState.currentPage - 1 : undefined;
  const nextPageNumber = paginationState.currentPage < paginationState.totalPages
    ? paginationState.currentPage + 1
    : undefined;
  const getPaginationPageUrl = (targetPage: number | undefined) => {
    if (!targetPage) {
      return undefined;
    }

    if (options.forIframe) {
      const iframeUrl = generateExportUrl(
        currentPageNode,
        siteData.manifest,
        targetPage,
        siteData,
        undefined,
        false,
        true,
      );
      return iframeUrl === '' ? '/' : iframeUrl;
    }

    if (options.isExport) {
      const exportFilePath = generateExportUrl(
        currentPageNode,
        siteData.manifest,
        targetPage,
        siteData,
        undefined,
        true,
      );
      return getRelativePath(currentPagePath, exportFilePath);
    }

    return generatePreviewUrl(
      currentPageNode,
      siteData.manifest,
      siteData.siteId,
      targetPage,
      siteData,
    );
  };
  const prevPageUrl = previousPageNumber
    ? getPaginationPageUrl(previousPageNumber)
    : undefined;
  const nextPageUrl = nextPageNumber
    ? getPaginationPageUrl(nextPageNumber)
    : undefined;

  return {
    resolution: {
      ...resolution,
      pageNumber: paginationState.currentPage,
      collectionItems: collectionItems.slice(paginationState.startIndex, paginationState.endIndex),
      pagination: createPaginationData(paginationState, prevPageUrl, nextPageUrl),
    },
    itemLayoutId,
  };
}
