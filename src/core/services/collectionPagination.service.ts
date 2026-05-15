import type { LayoutConfig, LocalSiteData, PaginationData, ParsedMarkdownFile } from '@/core/types';
import { getCollectionContent, sortCollectionItems } from './collections.service';
import { filterContentBySelectedTags } from './tags.service';

const DEFAULT_ITEMS_PER_PAGE = 10;

export interface CollectionPaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
}

export function isPaginationEnabled(layoutConfig?: LayoutConfig): boolean {
  return layoutConfig?.pagination?.enabled === true;
}

export function getItemsPerPage(layoutConfig?: LayoutConfig): number {
  const configuredValue = layoutConfig?.pagination?.itemsPerPage ?? layoutConfig?.itemsPerPage ?? DEFAULT_ITEMS_PER_PAGE;
  return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : DEFAULT_ITEMS_PER_PAGE;
}

export function getCollectionItemsForLayoutConfig(
  siteData: LocalSiteData,
  layoutConfig?: LayoutConfig,
): ParsedMarkdownFile[] {
  if (!layoutConfig?.collectionId) {
    return [];
  }

  let collectionItems = getCollectionContent(siteData, layoutConfig.collectionId);

  if (layoutConfig.filterTags?.length) {
    collectionItems = filterContentBySelectedTags(siteData.manifest, collectionItems, layoutConfig.filterTags);
  }

  const sortBy = layoutConfig.sortBy || 'date';
  const sortOrder = layoutConfig.sortOrder || 'desc';

  return sortCollectionItems(collectionItems, sortBy, sortOrder);
}

export function getCollectionPaginationState(
  totalItems: number,
  requestedPage: number | undefined,
  itemsPerPage: number,
): CollectionPaginationState {
  const safeItemsPerPage = Number.isFinite(itemsPerPage) && itemsPerPage > 0 ? itemsPerPage : DEFAULT_ITEMS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
  const currentPage = requestedPage && requestedPage > 1
    ? Math.min(requestedPage, totalPages)
    : 1;
  const startIndex = (currentPage - 1) * safeItemsPerPage;
  const endIndex = startIndex + safeItemsPerPage;

  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage: safeItemsPerPage,
    startIndex,
    endIndex,
  };
}

export function getTotalCollectionPages(
  siteData: LocalSiteData,
  layoutConfig?: LayoutConfig,
): number {
  if (!layoutConfig?.collectionId || !isPaginationEnabled(layoutConfig)) {
    return 1;
  }

  const collectionItems = getCollectionItemsForLayoutConfig(siteData, layoutConfig);
  const paginationState = getCollectionPaginationState(
    collectionItems.length,
    1,
    getItemsPerPage(layoutConfig),
  );

  return paginationState.totalPages;
}

export function createPaginationData(
  paginationState: CollectionPaginationState,
  prevPageUrl?: string,
  nextPageUrl?: string,
): PaginationData {
  return {
    currentPage: paginationState.currentPage,
    totalPages: paginationState.totalPages,
    totalItems: paginationState.totalItems,
    hasPrevPage: paginationState.currentPage > 1,
    hasNextPage: paginationState.currentPage < paginationState.totalPages,
    prevPageUrl,
    nextPageUrl,
  };
}
