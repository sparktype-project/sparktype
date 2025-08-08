// src/core/services/tags.service.ts

import type { Manifest, Tag, ParsedMarkdownFile } from '@/core/types';
import { getTagGroup } from './tagGroups.service';

/**
 * ============================================================================
 * Tag Management Service
 * ============================================================================
 * This service is responsible for all CRUD (Create, Read, Update, Delete)
 * operations on individual tags within tag groups, as well as tag assignment
 * to content files.
 * ============================================================================
 */

// --- READ HELPERS ---

/**
 * Safely gets all tags from a manifest, returning an empty array if none exist.
 * @param manifest The site's manifest.
 * @returns An array of Tag objects.
 */
export function getTags(manifest: Manifest): Tag[] {
  return manifest.tags || [];
}

/**
 * Finds a specific tag by its ID within a manifest.
 * @param manifest The site's manifest.
 * @param tagId The ID of the tag to find.
 * @returns The Tag object or null if not found.
 */
export function getTag(manifest: Manifest, tagId: string): Tag | null {
  return getTags(manifest).find(t => t.id === tagId) || null;
}

/**
 * Gets all tags that belong to a specific tag group.
 * @param manifest The site's manifest.
 * @param tagGroupId The ID of the tag group.
 * @returns An array of Tag objects belonging to the group.
 */
export function getTagsInGroup(manifest: Manifest, tagGroupId: string): Tag[] {
  return getTags(manifest).filter(tag => tag.groupId === tagGroupId);
}

/**
 * Gets tags by their IDs.
 * @param manifest The site's manifest.
 * @param tagIds Array of tag IDs to retrieve.
 * @returns An array of Tag objects.
 */
export function getTagsByIds(manifest: Manifest, tagIds: string[]): Tag[] {
  const allTags = getTags(manifest);
  return tagIds.map(id => allTags.find(tag => tag.id === id)).filter((tag): tag is Tag => tag !== undefined);
}

/**
 * Gets all content files that have a specific tag assigned.
 * @param siteData The complete data for the site.
 * @param tagId The ID of the tag.
 * @returns An array of ParsedMarkdownFile objects that have the tag.
 */
export function getContentWithTag(siteData: { manifest: Manifest; contentFiles?: ParsedMarkdownFile[] }, tagId: string): ParsedMarkdownFile[] {
  if (!siteData.contentFiles) return [];
  
  return siteData.contentFiles.filter(file => {
    if (!file.frontmatter.tags) return false;
    
    // Check all tag groups in frontmatter for this tag
    return Object.values(file.frontmatter.tags).some(tagIds => 
      Array.isArray(tagIds) && tagIds.includes(tagId)
    );
  });
}

/**
 * Gets all tags assigned to a content file, organized by tag group.
 * @param manifest The site's manifest.
 * @param contentFile The content file to analyze.
 * @returns A record mapping tag group IDs to arrays of Tag objects.
 */
export function getContentTags(manifest: Manifest, contentFile: ParsedMarkdownFile): Record<string, Tag[]> {
  const result: Record<string, Tag[]> = {};
  
  if (!contentFile.frontmatter.tags) return result;
  
  for (const [groupId, tagIds] of Object.entries(contentFile.frontmatter.tags)) {
    if (Array.isArray(tagIds)) {
      result[groupId] = getTagsByIds(manifest, tagIds);
    }
  }
  
  return result;
}

// --- VALIDATION & UTILITY HELPERS ---

/**
 * Validates a tag configuration object.
 * @param tag The tag object to validate.
 * @param manifest The site's manifest (to validate group exists).
 * @returns An object indicating if the tag is valid, with an array of errors.
 */
export function validateTag(tag: Tag, manifest: Manifest): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!tag.id?.trim()) errors.push('Tag ID is required');
  if (!tag.name?.trim()) errors.push('Tag name is required');
  if (!tag.groupId?.trim()) errors.push('Tag group ID is required');
  
  // Validate that the tag group exists
  const tagGroup = getTagGroup(manifest, tag.groupId);
  if (!tagGroup) errors.push(`Tag group '${tag.groupId}' does not exist`);
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Checks if a tag ID is unique within the manifest.
 * @param manifest The site's manifest.
 * @param tagId The ID to check for uniqueness.
 * @param excludeId An optional ID to exclude from the check (used when updating).
 * @returns True if the ID is unique.
 */
export function isTagIdUnique(manifest: Manifest, tagId: string, excludeId?: string): boolean {
  return !getTags(manifest).some(t => t.id === tagId && t.id !== excludeId);
}

/**
 * Checks if a tag name is unique within a specific tag group.
 * @param manifest The site's manifest.
 * @param tagGroupId The ID of the tag group.
 * @param tagName The name to check for uniqueness.
 * @param excludeId An optional tag ID to exclude from the check.
 * @returns True if the name is unique within the group.
 */
export function isTagNameUniqueInGroup(manifest: Manifest, tagGroupId: string, tagName: string, excludeId?: string): boolean {
  const tagsInGroup = getTagsInGroup(manifest, tagGroupId);
  return !tagsInGroup.some(t => t.name.toLowerCase() === tagName.toLowerCase() && t.id !== excludeId);
}

/**
 * Generates a unique, URL-friendly ID for a new tag based on its name and group.
 * @param manifest The site's manifest.
 * @param tagGroupId The ID of the tag group.
 * @param baseName The human-readable name of the tag.
 * @returns A unique string ID.
 */
export function generateUniqueTagId(manifest: Manifest, tagGroupId: string, baseName: string): string {
  let baseId = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!baseId) baseId = 'tag';

  // Prefix with group ID to help avoid conflicts
  const groupPrefix = tagGroupId.replace(/[^a-z0-9]/g, '');
  baseId = `${groupPrefix}-${baseId}`;

  let id = baseId;
  let counter = 1;
  while (!isTagIdUnique(manifest, id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }
  return id;
}

/**
 * Generates a URL-friendly slug for a tag.
 * @param tagName The name of the tag.
 * @returns A URL-friendly slug.
 */
export function generateTagSlug(tagName: string): string {
  return tagName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// --- WRITE (CRUD) OPERATIONS ---

/**
 * Ensures the `tags` array exists on the manifest.
 * @param manifest The site's manifest.
 * @returns A manifest object guaranteed to have a `tags` array.
 */
function ensureTagsArray(manifest: Manifest): Manifest {
  if (!Array.isArray(manifest.tags)) {
    return { ...manifest, tags: [] };
  }
  return manifest;
}

/**
 * Creates a new tag and adds it to the manifest.
 * @param manifest The current site manifest.
 * @param tagData The data for the new tag, excluding the `id`.
 * @returns An object containing the updated manifest and the newly created tag.
 */
export function createTag(manifest: Manifest, tagData: Omit<Tag, 'id'>): { manifest: Manifest; tag: Tag } {
  const updatedManifest = ensureTagsArray(manifest);
  
  // Generate slug if not provided
  const slug = tagData.slug || generateTagSlug(tagData.name);
  
  const newTag: Tag = {
    ...tagData,
    id: generateUniqueTagId(updatedManifest, tagData.groupId, tagData.name),
    slug
  };

  const validation = validateTag(newTag, updatedManifest);
  if (!validation.isValid) throw new Error(`Invalid tag: ${validation.errors.join(', ')}`);
  
  if (!isTagNameUniqueInGroup(updatedManifest, newTag.groupId, newTag.name)) {
    throw new Error(`Tag name '${newTag.name}' already exists in this group`);
  }

  const finalManifest = { ...updatedManifest, tags: [...updatedManifest.tags!, newTag] };
  return { manifest: finalManifest, tag: newTag };
}

/**
 * Updates an existing tag in the manifest.
 * @param manifest The current site manifest.
 * @param tagId The ID of the tag to update.
 * @param updates A partial object of properties to update.
 * @returns The updated manifest.
 */
export function updateTag(manifest: Manifest, tagId: string, updates: Partial<Omit<Tag, 'id'>>): Manifest {
  const tags = getTags(manifest);
  const existingIndex = tags.findIndex(t => t.id === tagId);
  if (existingIndex === -1) throw new Error(`Tag '${tagId}' not found`);

  const existingTag = tags[existingIndex];
  const updatedTag: Tag = { ...existingTag, ...updates };
  
  // Update slug if name changed
  if (updates.name && updates.name !== existingTag.name) {
    updatedTag.slug = generateTagSlug(updates.name);
  }

  const validation = validateTag(updatedTag, manifest);
  if (!validation.isValid) throw new Error(`Invalid tag update: ${validation.errors.join(', ')}`);
  
  if (updates.name && !isTagNameUniqueInGroup(manifest, updatedTag.groupId, updates.name, tagId)) {
    throw new Error(`Tag name '${updates.name}' already exists in this group`);
  }

  const updatedTags = [...tags];
  updatedTags[existingIndex] = updatedTag;

  return { ...manifest, tags: updatedTags };
}

/**
 * Deletes a tag from the manifest.
 * @param manifest The current site manifest.
 * @param tagId The ID of the tag to delete.
 * @returns An object containing the updated manifest.
 */
export function deleteTag(manifest: Manifest, tagId: string): { manifest: Manifest } {
  const tags = getTags(manifest);
  if (!tags.some(t => t.id === tagId)) throw new Error(`Tag '${tagId}' not found`);

  const updatedTags = tags.filter(t => t.id !== tagId);
  return { manifest: { ...manifest, tags: updatedTags } };
}

// --- CONTENT TAG ASSIGNMENT OPERATIONS ---

/**
 * Assigns a tag to a content file's frontmatter.
 * @param contentFile The content file to update.
 * @param tagGroupId The ID of the tag group.
 * @param tagId The ID of the tag to assign.
 * @returns The updated content file.
 */
export function assignTagToContent(contentFile: ParsedMarkdownFile, tagGroupId: string, tagId: string): ParsedMarkdownFile {
  const updatedFile = { ...contentFile };
  
  if (!updatedFile.frontmatter.tags) {
    updatedFile.frontmatter.tags = {};
  }
  
  if (!updatedFile.frontmatter.tags[tagGroupId]) {
    updatedFile.frontmatter.tags[tagGroupId] = [];
  }
  
  const currentTags = [...updatedFile.frontmatter.tags[tagGroupId]];
  if (!currentTags.includes(tagId)) {
    currentTags.push(tagId);
    updatedFile.frontmatter.tags[tagGroupId] = currentTags;
  }
  
  return updatedFile;
}

/**
 * Removes a tag from a content file's frontmatter.
 * @param contentFile The content file to update.
 * @param tagGroupId The ID of the tag group.
 * @param tagId The ID of the tag to remove.
 * @returns The updated content file.
 */
export function removeTagFromContent(contentFile: ParsedMarkdownFile, tagGroupId: string, tagId: string): ParsedMarkdownFile {
  const updatedFile = { ...contentFile };
  
  if (!updatedFile.frontmatter.tags?.[tagGroupId]) {
    return updatedFile; // Nothing to remove
  }
  
  const currentTags = updatedFile.frontmatter.tags[tagGroupId].filter(id => id !== tagId);
  
  if (currentTags.length === 0) {
    // Remove the entire group if no tags left
    const { [tagGroupId]: removed, ...remainingTags } = updatedFile.frontmatter.tags;
    updatedFile.frontmatter.tags = remainingTags;
    
    // If no tag groups left, remove the entire tags property
    if (Object.keys(remainingTags).length === 0) {
      delete updatedFile.frontmatter.tags;
    }
  } else {
    updatedFile.frontmatter.tags[tagGroupId] = currentTags;
  }
  
  return updatedFile;
}

/**
 * Sets all tags for a specific tag group on a content file.
 * @param contentFile The content file to update.
 * @param tagGroupId The ID of the tag group.
 * @param tagIds Array of tag IDs to set.
 * @returns The updated content file.
 */
export function setContentTagsForGroup(contentFile: ParsedMarkdownFile, tagGroupId: string, tagIds: string[]): ParsedMarkdownFile {
  const updatedFile = { ...contentFile };
  
  if (tagIds.length === 0) {
    // Remove the entire group
    if (updatedFile.frontmatter.tags) {
      const { [tagGroupId]: removed, ...remainingTags } = updatedFile.frontmatter.tags;
      updatedFile.frontmatter.tags = remainingTags;
      
      // If no tag groups left, remove the entire tags property
      if (Object.keys(remainingTags).length === 0) {
        delete updatedFile.frontmatter.tags;
      }
    }
  } else {
    // Set the tags for this group
    if (!updatedFile.frontmatter.tags) {
      updatedFile.frontmatter.tags = {};
    }
    updatedFile.frontmatter.tags[tagGroupId] = [...tagIds];
  }
  
  return updatedFile;
}