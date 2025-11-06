// src/features/editor/components/TagSelector.tsx

import { useMemo } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getTagsInGroup } from '@/core/services/tags.service';
import type { TagGroup } from '@/core/types';

// UI Components
import { Label } from '@/core/components/ui/label';
import { SimpleMultiSelect, type SimpleMultiSelectOption } from './SimpleMultiSelect';

interface TagSelectorProps {
  siteId: string;
  tagGroup: TagGroup;
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export default function TagSelector({ siteId, tagGroup, selectedTagIds, onTagsChange }: TagSelectorProps) {
  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  const availableTags = useMemo(() => {
    if (!siteData) return [];
    return getTagsInGroup(siteData.manifest, tagGroup.id);
  }, [siteData, tagGroup.id]);

  // Convert tags to SimpleMultiSelect options format
  const options: SimpleMultiSelectOption[] = useMemo(() => {
    return availableTags.map(tag => ({
      label: tag.name,
      value: tag.id,
    }));
  }, [availableTags]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{tagGroup.name}</Label>
      {availableTags.length > 0 ? (
        <>
          <SimpleMultiSelect
            options={options}
            selected={selectedTagIds}
            onChange={onTagsChange}
            placeholder={`Select ${tagGroup.name.toLowerCase()}...`}
            className="w-full"
          />
          {tagGroup.description && (
            <div className="text-xs text-muted-foreground mt-1">
              {tagGroup.description}
            </div>
          )}
        </>
      ) : (
        <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
          No tags available in this group. Create tags in the Tag Groups manager to start organizing your content.
        </div>
      )}
    </div>
  );
}

// Multi-group tag selector for use in the frontmatter sidebar
interface MultiTagSelectorProps {
  siteId: string;
  collectionId: string;
  contentTags: Record<string, string[]>; // groupId -> tagIds
  onTagsChange: (groupId: string, tagIds: string[]) => void;
}

export function MultiTagSelector({ siteId, collectionId, contentTags, onTagsChange }: MultiTagSelectorProps) {
  const getApplicableTagGroups = useAppStore(state => state.getApplicableTagGroups);
  const applicableTagGroups = getApplicableTagGroups(siteId, collectionId);

  if (applicableTagGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">Tags</div>
      <div className="space-y-3">
        {applicableTagGroups.map(tagGroup => (
          <TagSelector
            key={tagGroup.id}
            siteId={siteId}
            tagGroup={tagGroup}
            selectedTagIds={contentTags[tagGroup.id] || []}
            onTagsChange={(tagIds) => onTagsChange(tagGroup.id, tagIds)}
          />
        ))}
      </div>
    </div>
  );
}