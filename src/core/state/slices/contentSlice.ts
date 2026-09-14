// src/core/state/slices/contentSlice.ts

import { type StateCreator } from 'zustand';

import type { MarkdownFrontmatter, ParsedMarkdownFile, Tag, TagGroup } from '@/core/types';
import { type SiteSlice } from '@/core/state/slices/siteSlice';
import { createContentActions } from '@/core/state/slices/content/contentActions';
import { createNavigationActions } from '@/core/state/slices/content/navigationActions';
import { createSlugActions } from '@/core/state/slices/content/slugActions';
import { createTagActions } from '@/core/state/slices/content/tagActions';

/**
 * The content slice's public store API. This interface is the single source of truth
 * for the API; the `content/*` modules implement it in fragments.
 */
export interface ContentSlice {
  addOrUpdateContentFile: (siteId: string, filePath: string, rawMarkdownContent: string, silent?: boolean) => Promise<boolean>;
  deleteContentFileAndState: (siteId: string, filePath: string) => Promise<void>;
  repositionNode: (siteId: string, activeNodePath: string, newParentPath: string | null, newIndex: number) => Promise<void>;
  updateContentFileOnly: (siteId: string, savedFile: ParsedMarkdownFile, silent?: boolean) => Promise<void>;
  setAsHomepage: (siteId: string, filePath: string) => Promise<void>;
  changePageSlugWithContent: (siteId: string, currentFilePath: string, newSlug: string, frontmatter: MarkdownFrontmatter, content: string) => Promise<{ success: boolean; newFilePath?: string; error?: string }>;

  // Tag Group operations
  createTagGroup: (siteId: string, tagGroupData: Omit<TagGroup, 'id'>) => Promise<void>;
  updateTagGroup: (siteId: string, groupId: string, updates: Partial<Omit<TagGroup, 'id'>>) => Promise<void>;
  deleteTagGroup: (siteId: string, groupId: string) => Promise<void>;
  getApplicableTagGroups: (siteId: string, collectionId?: string) => TagGroup[];

  // Tag operations
  createTag: (siteId: string, tagData: Omit<Tag, 'id'>) => Promise<void>;
  updateTag: (siteId: string, tagId: string, updates: Partial<Omit<Tag, 'id'>>) => Promise<void>;
  deleteTag: (siteId: string, tagId: string) => Promise<void>;
  getTagsForGroup: (siteId: string, groupId: string) => Tag[];
}

/**
 * A fragment creator owns a subset of the slice's actions. Fragments are composed
 * below into the full slice, so `ContentSlice` stays the only place the API is declared
 * while each fragment keeps its own dependencies (imports) explicit.
 */
export type ContentSliceFragment<T> = StateCreator<SiteSlice & ContentSlice, [], [], T>;

export const createContentSlice: StateCreator<SiteSlice & ContentSlice, [], [], ContentSlice> = (set, get, api) => ({
  ...createContentActions(set, get, api),
  ...createNavigationActions(set, get, api),
  ...createSlugActions(set, get, api),
  ...createTagActions(set, get, api),
});
