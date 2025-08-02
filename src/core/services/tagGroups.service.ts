// src/core/services/tagGroups.service.ts

import type { Manifest, TagGroup } from '@/core/types';

/**
 * ============================================================================
 * Tag Group Management Service
 * ============================================================================
 * This service is responsible for all CRUD (Create, Read, Update, Delete)
 * operations on the `tagGroups` array within a site's `manifest.json`.
 *
 * It manages the user-created tag groups that can contain multiple tags
 * and can be applied to specific collections.
 * ============================================================================
 */

// --- READ HELPERS ---

/**
 * Safely gets all tag groups from a manifest, returning an empty array if none exist.
 * @param manifest The site's manifest.
 * @returns An array of TagGroup objects.
 */
export function getTagGroups(manifest: Manifest): TagGroup[] {
  return manifest.tagGroups || [];
}

/**
 * Finds a specific tag group by its ID within a manifest.
 * @param manifest The site's manifest.
 * @param tagGroupId The ID of the tag group to find.
 * @returns The TagGroup object or null if not found.
 */
export function getTagGroup(manifest: Manifest, tagGroupId: string): TagGroup | null {
  return getTagGroups(manifest).find(tg => tg.id === tagGroupId) || null;
}

/**
 * Gets all tag groups that are applicable to a specific collection.
 * @param manifest The site's manifest.
 * @param collectionId The ID of the collection.
 * @returns An array of TagGroup objects applicable to the collection.
 */
export function getTagGroupsForCollection(manifest: Manifest, collectionId: string): TagGroup[] {
  return getTagGroups(manifest).filter(tagGroup =>
    tagGroup.applicableCollections.includes(collectionId)
  );
}

/**
 * Gets all tag groups that can be applied to any collection (have at least one applicable collection).
 * @param manifest The site's manifest.
 * @returns An array of TagGroup objects that are applied to collections.
 */
export function getActiveTagGroups(manifest: Manifest): TagGroup[] {
  return getTagGroups(manifest).filter(tagGroup =>
    tagGroup.applicableCollections.length > 0
  );
}

// --- VALIDATION & UTILITY HELPERS ---

/**
 * Validates a tag group configuration object.
 * @param tagGroup The tag group object to validate.
 * @returns An object indicating if the tag group is valid, with an array of errors.
 */
export function validateTagGroup(tagGroup: TagGroup): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!tagGroup.id?.trim()) errors.push('Tag group ID is required');
  if (!tagGroup.name?.trim()) errors.push('Tag group name is required');
  if (!Array.isArray(tagGroup.applicableCollections)) errors.push('Applicable collections must be an array');
  
  // Validate color if provided
  if (tagGroup.color && !/^#[0-9A-F]{6}$/i.test(tagGroup.color)) {
    errors.push('Color must be a valid hex color (e.g., #FF0000)');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Checks if a tag group ID is unique within the manifest.
 * @param manifest The site's manifest.
 * @param tagGroupId The ID to check for uniqueness.
 * @param excludeId An optional ID to exclude from the check (used when updating).
 * @returns True if the ID is unique.
 */
export function isTagGroupIdUnique(manifest: Manifest, tagGroupId: string, excludeId?: string): boolean {
  return !getTagGroups(manifest).some(tg => tg.id === tagGroupId && tg.id !== excludeId);
}

/**
 * Generates a unique, URL-friendly ID for a new tag group based on its name.
 * @param manifest The site's manifest.
 * @param baseName The human-readable name of the tag group.
 * @returns A unique string ID.
 */
export function generateUniqueTagGroupId(manifest: Manifest, baseName: string): string {
  let baseId = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!baseId) baseId = 'tag-group';

  let id = baseId;
  let counter = 1;
  while (!isTagGroupIdUnique(manifest, id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }
  return id;
}

/**
 * Validates that all collections in applicableCollections exist in the manifest.
 * @param manifest The site's manifest.
 * @param collectionIds Array of collection IDs to validate.
 * @returns An object with validation result and invalid collection IDs.
 */
export function validateCollectionIds(manifest: Manifest, collectionIds: string[]): { isValid: boolean; invalidIds: string[] } {
  const existingCollectionIds = (manifest.collections || []).map(c => c.id);
  const invalidIds = collectionIds.filter(id => !existingCollectionIds.includes(id));
  return { isValid: invalidIds.length === 0, invalidIds };
}

// --- WRITE (CRUD) OPERATIONS ---

/**
 * Ensures the `tagGroups` array exists on the manifest.
 * @param manifest The site's manifest.
 * @returns A manifest object guaranteed to have a `tagGroups` array.
 */
function ensureTagGroupsArray(manifest: Manifest): Manifest {
  if (!Array.isArray(manifest.tagGroups)) {
    return { ...manifest, tagGroups: [] };
  }
  return manifest;
}

/**
 * Creates a new tag group and adds it to the manifest.
 * @param manifest The current site manifest.
 * @param tagGroupData The data for the new tag group, excluding the `id`.
 * @returns An object containing the updated manifest and the newly created tag group.
 */
export function createTagGroup(manifest: Manifest, tagGroupData: Omit<TagGroup, 'id'>): { manifest: Manifest; tagGroup: TagGroup } {
  const updatedManifest = ensureTagGroupsArray(manifest);
  const newTagGroup: TagGroup = {
    ...tagGroupData,
    id: generateUniqueTagGroupId(updatedManifest, tagGroupData.name)
  };

  const validation = validateTagGroup(newTagGroup);
  if (!validation.isValid) throw new Error(`Invalid tag group: ${validation.errors.join(', ')}`);
  
  const collectionValidation = validateCollectionIds(updatedManifest, newTagGroup.applicableCollections);
  if (!collectionValidation.isValid) {
    throw new Error(`Invalid collection IDs: ${collectionValidation.invalidIds.join(', ')}`);
  }

  const finalManifest = { ...updatedManifest, tagGroups: [...updatedManifest.tagGroups!, newTagGroup] };
  return { manifest: finalManifest, tagGroup: newTagGroup };
}

/**
 * Updates an existing tag group in the manifest.
 * @param manifest The current site manifest.
 * @param tagGroupId The ID of the tag group to update.
 * @param updates A partial object of properties to update.
 * @returns The updated manifest.
 */
export function updateTagGroup(manifest: Manifest, tagGroupId: string, updates: Partial<Omit<TagGroup, 'id'>>): Manifest {
  const tagGroups = getTagGroups(manifest);
  const existingIndex = tagGroups.findIndex(tg => tg.id === tagGroupId);
  if (existingIndex === -1) throw new Error(`Tag group '${tagGroupId}' not found`);

  const updatedTagGroup: TagGroup = { ...tagGroups[existingIndex], ...updates };

  const validation = validateTagGroup(updatedTagGroup);
  if (!validation.isValid) throw new Error(`Invalid tag group update: ${validation.errors.join(', ')}`);
  
  if (updates.applicableCollections) {
    const collectionValidation = validateCollectionIds(manifest, updates.applicableCollections);
    if (!collectionValidation.isValid) {
      throw new Error(`Invalid collection IDs: ${collectionValidation.invalidIds.join(', ')}`);
    }
  }

  const updatedTagGroups = [...tagGroups];
  updatedTagGroups[existingIndex] = updatedTagGroup;

  return { ...manifest, tagGroups: updatedTagGroups };
}

/**
 * Deletes a tag group from the manifest.
 * @param manifest The current site manifest.
 * @param tagGroupId The ID of the tag group to delete.
 * @returns An object containing the updated manifest.
 */
export function deleteTagGroup(manifest: Manifest, tagGroupId: string): { manifest: Manifest } {
  const tagGroups = getTagGroups(manifest);
  if (!tagGroups.some(tg => tg.id === tagGroupId)) throw new Error(`Tag group '${tagGroupId}' not found`);

  const updatedTagGroups = tagGroups.filter(tg => tg.id !== tagGroupId);
  
  // Also remove any tags belonging to this group
  const updatedTags = (manifest.tags || []).filter(tag => tag.groupId !== tagGroupId);
  
  return { 
    manifest: { 
      ...manifest, 
      tagGroups: updatedTagGroups,
      tags: updatedTags
    } 
  };
}

/**
 * Adds a collection to a tag group's applicable collections.
 * @param manifest The current site manifest.
 * @param tagGroupId The ID of the tag group.
 * @param collectionId The ID of the collection to add.
 * @returns The updated manifest.
 */
export function addCollectionToTagGroup(manifest: Manifest, tagGroupId: string, collectionId: string): Manifest {
  const tagGroup = getTagGroup(manifest, tagGroupId);
  if (!tagGroup) throw new Error(`Tag group '${tagGroupId}' not found`);
  
  const collectionValidation = validateCollectionIds(manifest, [collectionId]);
  if (!collectionValidation.isValid) {
    throw new Error(`Invalid collection ID: ${collectionId}`);
  }
  
  if (tagGroup.applicableCollections.includes(collectionId)) {
    return manifest; // Already included, no change needed
  }
  
  const updatedApplicableCollections = [...tagGroup.applicableCollections, collectionId];
  return updateTagGroup(manifest, tagGroupId, { applicableCollections: updatedApplicableCollections });
}

/**
 * Removes a collection from a tag group's applicable collections.
 * @param manifest The current site manifest.
 * @param tagGroupId The ID of the tag group.
 * @param collectionId The ID of the collection to remove.
 * @returns The updated manifest.
 */
export function removeCollectionFromTagGroup(manifest: Manifest, tagGroupId: string, collectionId: string): Manifest {
  const tagGroup = getTagGroup(manifest, tagGroupId);
  if (!tagGroup) throw new Error(`Tag group '${tagGroupId}' not found`);
  
  const updatedApplicableCollections = tagGroup.applicableCollections.filter(id => id !== collectionId);
  return updateTagGroup(manifest, tagGroupId, { applicableCollections: updatedApplicableCollections });
}