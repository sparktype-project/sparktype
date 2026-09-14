// src/core/state/slices/content/tagActions.ts

import { produce } from 'immer';
import { toast } from 'sonner';

import type { Tag, TagGroup } from '@/core/types';
import { createTag, deleteTag, getTags, getTagsInGroup, updateTag } from '@/core/services/tags.service';
import { createTagGroup, deleteTagGroup, getTagGroups, getTagGroupsForCollection, updateTagGroup } from '@/core/services/tagGroups.service';
import type { SiteSlice } from '@/core/state/slices/siteSlice';
import type { ContentSlice, ContentSliceFragment } from '@/core/state/slices/contentSlice';

/**
 * Tag and tag-group operations. Each write goes through the tag services, which own
 * the manifest shape, then persists the whole manifest via `updateManifest`.
 */
export const createTagActions: ContentSliceFragment<
  Pick<
    ContentSlice,
    | 'createTagGroup'
    | 'updateTagGroup'
    | 'deleteTagGroup'
    | 'getApplicableTagGroups'
    | 'createTag'
    | 'updateTag'
    | 'deleteTag'
    | 'getTagsForGroup'
  >
> = (set, get) => ({
  // === TAG GROUP OPERATIONS ===

  createTagGroup: async (siteId: string, tagGroupData: Omit<TagGroup, 'id'>) => {
    try {
      const siteData = get().getSiteById(siteId);
      if (!siteData) {
        toast.error("Site not found");
        return;
      }

      const { manifest: updatedManifest, tagGroup } = createTagGroup(siteData.manifest, tagGroupData);

      // Update state
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = updatedManifest;
        }
      }));

      // Persist to filesystem
      await get().updateManifest(siteId, updatedManifest);

      toast.success(`Tag group "${tagGroup.name}" created successfully!`);
    } catch (error) {
      console.error("Failed to create tag group:", error);
      toast.error(`Failed to create tag group: ${(error as Error).message}`);
    }
  },

  updateTagGroup: async (siteId: string, groupId: string, updates: Partial<Omit<TagGroup, 'id'>>) => {
    try {
      const siteData = get().getSiteById(siteId);
      if (!siteData) {
        toast.error("Site not found");
        return;
      }

      const updatedManifest = updateTagGroup(siteData.manifest, groupId, updates);

      // Update state
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = updatedManifest;
        }
      }));

      // Persist to filesystem
      await get().updateManifest(siteId, updatedManifest);

      toast.success("Tag group updated successfully!");
    } catch (error) {
      console.error("Failed to update tag group:", error);
      toast.error(`Failed to update tag group: ${(error as Error).message}`);
    }
  },

  deleteTagGroup: async (siteId: string, groupId: string) => {
    try {
      const siteData = get().getSiteById(siteId);
      if (!siteData) {
        toast.error("Site not found");
        return;
      }

      const tagGroup = getTagGroups(siteData.manifest).find(tg => tg.id === groupId);
      const { manifest: updatedManifest } = deleteTagGroup(siteData.manifest, groupId);

      // Update state
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = updatedManifest;
        }
      }));

      // Persist to filesystem
      await get().updateManifest(siteId, updatedManifest);

      toast.success(`Tag group "${tagGroup?.name}" deleted successfully!`);
    } catch (error) {
      console.error("Failed to delete tag group:", error);
      toast.error(`Failed to delete tag group: ${(error as Error).message}`);
    }
  },

  getApplicableTagGroups: (siteId: string, collectionId?: string) => {
    const siteData = get().getSiteById(siteId);
    if (!siteData) return [];

    if (collectionId) {
      return getTagGroupsForCollection(siteData.manifest, collectionId);
    }

    return getTagGroups(siteData.manifest);
  },

  // === TAG OPERATIONS ===

  createTag: async (siteId: string, tagData: Omit<Tag, 'id'>) => {
    try {
      const siteData = get().getSiteById(siteId);
      if (!siteData) {
        toast.error("Site not found");
        return;
      }

      const { manifest: updatedManifest, tag } = createTag(siteData.manifest, tagData);

      // Update state
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = updatedManifest;
        }
      }));

      // Persist to filesystem
      await get().updateManifest(siteId, updatedManifest);

      toast.success(`Tag "${tag.name}" created successfully!`);
    } catch (error) {
      console.error("Failed to create tag:", error);
      toast.error(`Failed to create tag: ${(error as Error).message}`);
    }
  },

  updateTag: async (siteId: string, tagId: string, updates: Partial<Omit<Tag, 'id'>>) => {
    try {
      const siteData = get().getSiteById(siteId);
      if (!siteData) {
        toast.error("Site not found");
        return;
      }

      const updatedManifest = updateTag(siteData.manifest, tagId, updates);

      // Update state
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = updatedManifest;
        }
      }));

      // Persist to filesystem
      await get().updateManifest(siteId, updatedManifest);

      toast.success("Tag updated successfully!");
    } catch (error) {
      console.error("Failed to update tag:", error);
      toast.error(`Failed to update tag: ${(error as Error).message}`);
    }
  },

  deleteTag: async (siteId: string, tagId: string) => {
    try {
      const siteData = get().getSiteById(siteId);
      if (!siteData) {
        toast.error("Site not found");
        return;
      }

      const tag = getTags(siteData.manifest).find(t => t.id === tagId);
      const { manifest: updatedManifest } = deleteTag(siteData.manifest, tagId);

      // Update state
      set(produce((draft: SiteSlice) => {
        const siteToUpdate = draft.sites.find(s => s.siteId === siteId);
        if (siteToUpdate) {
          siteToUpdate.manifest = updatedManifest;
        }
      }));

      // Persist to filesystem
      await get().updateManifest(siteId, updatedManifest);

      toast.success(`Tag "${tag?.name}" deleted successfully!`);
    } catch (error) {
      console.error("Failed to delete tag:", error);
      toast.error(`Failed to delete tag: ${(error as Error).message}`);
    }
  },

  getTagsForGroup: (siteId: string, groupId: string) => {
    const siteData = get().getSiteById(siteId);
    if (!siteData) return [];

    return getTagsInGroup(siteData.manifest, groupId);
  },
});
