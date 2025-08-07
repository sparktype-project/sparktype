// src/features/editor/components/TagList.tsx

import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getTagsInGroup } from '@/core/services/tags.service';
import type { Tag } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Badge } from '@/core/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/core/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/core/components/ui/alert-dialog';

import { Search, MoreHorizontal, Trash2, Edit } from 'lucide-react';

interface TagListProps {
  siteId: string;
  tagGroupId: string;
}

export default function TagList({ siteId, tagGroupId }: TagListProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const getSiteById = useAppStore(state => state.getSiteById);
  const createTag = useAppStore(state => state.createTag);
  const updateTag = useAppStore(state => state.updateTag);
  const deleteTag = useAppStore(state => state.deleteTag);
  const siteData = getSiteById(siteId);

  const tags = useMemo(() => {
    if (!siteData) return [];
    return getTagsInGroup(siteData.manifest, tagGroupId);
  }, [siteData, tagGroupId]);

  const filteredTags = useMemo(() => {
    let filteredList = tags;
    
    if (searchFilter.trim()) {
      const filter = searchFilter.toLowerCase();
      filteredList = tags.filter(tag =>
        tag.name.toLowerCase().includes(filter) ||
        tag.description?.toLowerCase().includes(filter)
      );
    }
    
    // Sort alphabetically by name
    return filteredList.sort((a, b) => a.name.localeCompare(b.name));
  }, [tags, searchFilter]);

  const handleCreateTag = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTagName.trim()) return;
    
    try {
      const tagData: Omit<Tag, 'id'> = {
        name: newTagName.trim(),
        groupId: tagGroupId,
        description: newTagDescription.trim() || undefined,
      };
      
      await createTag(siteId, tagData);
      
      // Reset form but keep it open
      setNewTagName('');
      setNewTagDescription('');
    } catch (error) {
      // Error handling is done in the store
    }
  }, [newTagName, newTagDescription, tagGroupId, siteId, createTag]);

  const handleUpdateTag = useCallback(async (tag: Tag, updates: Partial<Omit<Tag, 'id'>>) => {
    try {
      await updateTag(siteId, tag.id, updates);
      setEditingTag(null);
    } catch (error) {
      // Error handling is done in the store
    }
  }, [siteId, updateTag]);

  const handleDeleteTag = useCallback((tag: Tag) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteTag = useCallback(async () => {
    if (!tagToDelete) return;
    
    try {
      await deleteTag(siteId, tagToDelete.id);
    } catch (error) {
      // Error handling is done in the store
    } finally {
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    }
  }, [tagToDelete, siteId, deleteTag]);


  return (
    <>
      <div className="space-y-6">
        {/* Header Actions */}
        

        {/* Add New Tag Form - Always Visible */}
        <form onSubmit={handleCreateTag} className="border rounded-lg p-4 bg-muted/50">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-tag-name">Add New Tag</Label>
              <Input
                id="new-tag-name"
                placeholder="Tag name (press Enter to add)"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTagName.trim()) {
                    handleCreateTag(e);
                  }
                }}
                autoComplete="off"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-tag-description">Description (optional)</Label>
              <Input
                id="new-tag-description"
                placeholder="Brief description of this tag"
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTagName.trim()) {
                    handleCreateTag(e);
                  }
                }}
                autoComplete="off"
              />
            </div>
          </div>
        </form>

        {/* Tags Grid */}
        {filteredTags.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {tags.length === 0 ? (
              <div className="space-y-2">
                <p>No tags in this group yet.</p>
                <p className="text-sm">Click "Add Tag" to create your first tag.</p>
              </div>
            ) : (
              <p>No tags match your search.</p>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredTags.map((tag) => (
              <TagItem
                key={tag.id}
                tag={tag}
                isEditing={editingTag?.id === tag.id}
                onEdit={() => setEditingTag(tag)}
                onCancelEdit={() => setEditingTag(null)}
                onUpdate={(updates) => handleUpdateTag(tag, updates)}
                onDelete={() => handleDeleteTag(tag)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{tagToDelete?.name}"? This will remove it from any content that uses this tag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTag} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface TagItemProps {
  tag: Tag;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<Omit<Tag, 'id'>>) => void;
  onDelete: () => void;
}

function TagItem({ tag, isEditing, onEdit, onCancelEdit, onUpdate, onDelete }: TagItemProps) {
  const [editName, setEditName] = useState(tag.name);
  const [editDescription, setEditDescription] = useState(tag.description || '');

  const handleSave = useCallback(() => {
    const updates: Partial<Omit<Tag, 'id'>> = {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    };
    onUpdate(updates);
  }, [editName, editDescription, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditName(tag.name);
    setEditDescription(tag.description || '');
    onCancelEdit();
  }, [tag.name, tag.description, onCancelEdit]);

  if (isEditing) {
    return (
      <div className="border rounded-lg p-4 bg-background">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-tag-name-${tag.id}`}>Tag Name</Label>
            <Input
              id={`edit-tag-name-${tag.id}`}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Tag name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-tag-description-${tag.id}`}>Description</Label>
            <Input
              id={`edit-tag-description-${tag.id}`}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!editName.trim()}>
              Save Changes
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group border rounded-lg p-4 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-lg">{tag.name}</h3>
          </div>
          {tag.description && (
            <p className="text-sm text-muted-foreground">{tag.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />Edit Tag
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Delete Tag
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}