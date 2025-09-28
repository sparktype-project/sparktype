// src/features/editor/components/TagSelector.tsx

import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getTagsInGroup } from '@/core/services/tags.service';
import type { TagGroup } from '@/core/types';

// UI Components
import { Label } from '@/core/components/ui/label';
import { Button } from '@/core/components/ui/button';
import { Checkbox } from '@/core/components/ui/checkbox';
import { Badge } from '@/core/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/core/components/ui/collapsible';
import { ChevronDown, ChevronRight, X } from 'lucide-react';

interface TagSelectorProps {
  siteId: string;
  tagGroup: TagGroup;
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export default function TagSelector({ siteId, tagGroup, selectedTagIds, onTagsChange }: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(true);

  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  const availableTags = useMemo(() => {
    if (!siteData) return [];
    return getTagsInGroup(siteData.manifest, tagGroup.id);
  }, [siteData, tagGroup.id]);

  const selectedTags = useMemo(() => {
    return availableTags.filter(tag => selectedTagIds.includes(tag.id));
  }, [availableTags, selectedTagIds]);

  const handleTagToggle = (tagId: string, checked: boolean) => {
    let newTagIds: string[];

    if (checked) {
      newTagIds = [...selectedTagIds, tagId];
    } else {
      newTagIds = selectedTagIds.filter(id => id !== tagId);
    }

    onTagsChange(newTagIds);
  };

  const handleRemoveTag = (tagId: string) => {
    handleTagToggle(tagId, false);
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };


  return (
    <div className="space-y-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0 h-auto font-normal">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium cursor-pointer">{tagGroup.name}</Label>
              {selectedTagIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedTagIds.length}
                </Badge>
              )}
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3">
            {/* Selected Tags Display */}
            {selectedTags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Selected Tags</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleClearAll}
                  >
                    Clear all
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedTags.map(tag => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-xs flex items-center gap-1 pr-1"
                    >
                      {tag.name}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => handleRemoveTag(tag.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Available Tags */}
            {availableTags.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Available Tags</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {availableTags.map(tag => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag.id}`}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={(checked) => handleTagToggle(tag.id, !!checked)}
                      />
                      <Label
                        htmlFor={`tag-${tag.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {tag.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
                No tags available in this group. Create tags in the Tag Groups manager to start organizing your content.
              </div>
            )}

            {tagGroup.description && (
              <div className="text-xs text-muted-foreground">
                {tagGroup.description}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
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