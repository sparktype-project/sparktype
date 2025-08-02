// src/features/editor/components/TagsManagerDialog.tsx

import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getTagsInGroup } from '@/core/services/tags.service';
import type { TagGroup, Tag } from '@/core/types';

// UI Components
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/core/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/core/components/ui/alert-dialog';

import { Plus, Search, MoreHorizontal, Trash2, Edit, X } from 'lucide-react';
import { toast } from 'sonner';

interface TagsManagerDialogProps {
  siteId: string;
  tagGroup: TagGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TagsManagerDialog({ siteId, tagGroup, open, onOpenChange }: TagsManagerDialogProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);
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
    if (!siteData || !tagGroup) return [];
    return getTagsInGroup(siteData.manifest, tagGroup.id);
  }, [siteData, tagGroup]);

  const filteredTags = useMemo(() => {
    if (!searchFilter.trim()) return tags;
    const filter = searchFilter.toLowerCase();
    return tags.filter(tag =>
      tag.name.toLowerCase().includes(filter) ||
      tag.description?.toLowerCase().includes(filter)
    );
  }, [tags, searchFilter]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTagName.trim() || !tagGroup) return;
    
    try {
      const tagData: Omit<Tag, 'id'> = {
        name: newTagName.trim(),
        groupId: tagGroup.id,
        description: newTagDescription.trim() || undefined,
      };
      
      await createTag(siteId, tagData);
      
      // Reset form
      setNewTagName('');
      setNewTagDescription('');
      setIsCreating(false);
    } catch (error) {
      // Error handling is done in the store
    }
  };

  const handleUpdateTag = async (tag: Tag, updates: Partial<Omit<Tag, 'id'>>) => {
    try {
      await updateTag(siteId, tag.id, updates);
      setEditingTag(null);
    } catch (error) {
      // Error handling is done in the store
    }
  };

  const handleDeleteTag = (tag: Tag) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return;
    
    try {
      await deleteTag(siteId, tagToDelete.id);
    } catch (error) {
      // Error handling is done in the store
    } finally {
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewTagName('');
    setNewTagDescription('');
    setEditingTag(null);
    setSearchFilter('');
  };

  if (!tagGroup) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Manage Tags: {tagGroup.name}
            </DialogTitle>
            <DialogDescription>
              Add, edit, and organize tags for this tag group. These tags will be available when editing content from the associated collections.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            {/* Search and Add */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search tags..." 
                  value={searchFilter} 
                  onChange={(e) => setSearchFilter(e.target.value)} 
                  className="pl-8" 
                />
              </div>
              <Button 
                onClick={() => setIsCreating(true)} 
                disabled={isCreating}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Tag
              </Button>
            </div>

            {/* Create New Tag Form */}
            {isCreating && (
              <form onSubmit={handleCreateTag} className="border rounded-md p-3 bg-muted/50">
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="new-tag-name">Tag Name *</Label>
                    <Input
                      id="new-tag-name"
                      placeholder="e.g. Technology, Tutorial"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      required
                    />
                  </div>
                  
                  
                  <div className="grid gap-2">
                    <Label htmlFor="new-tag-description">Description (optional)</Label>
                    <Input
                      id="new-tag-description"
                      placeholder="Brief description of this tag"
                      value={newTagDescription}
                      onChange={(e) => setNewTagDescription(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={!newTagName.trim()}>
                      Create Tag
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsCreating(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Tags List */}
            <div className="flex-1 overflow-y-auto max-h-64">
              {filteredTags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {tags.length === 0 ? (
                    <div>
                      <p className="text-sm">No tags in this group yet.</p>
                      <p className="text-xs">Click "Add Tag" to create your first tag.</p>
                    </div>
                  ) : (
                    <p className="text-sm">No tags match your search.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTags.map((tag) => (
                    <TagItem
                      key={tag.id}
                      tag={tag}
                      tagGroup={tagGroup}
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
          </div>
        </DialogContent>
      </Dialog>

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
  tagGroup: TagGroup;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<Omit<Tag, 'id'>>) => void;
  onDelete: () => void;
}

function TagItem({ tag, tagGroup, isEditing, onEdit, onCancelEdit, onUpdate, onDelete }: TagItemProps) {
  const [editName, setEditName] = useState(tag.name);
  const [editDescription, setEditDescription] = useState(tag.description || '');

  const handleSave = () => {
    const updates: Partial<Omit<Tag, 'id'>> = {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    };
    onUpdate(updates);
  };

  const handleCancel = () => {
    setEditName(tag.name);
    setEditDescription(tag.description || '');
    onCancelEdit();
  };

  if (isEditing) {
    return (
      <div className="border rounded-md p-3 bg-background">
        <div className="grid gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Tag name"
            className="text-sm"
          />
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description (optional)"
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={!editName.trim()}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{tag.name}</div>
          {tag.description && (
            <div className="text-xs text-muted-foreground truncate">{tag.description}</div>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0">
            <MoreHorizontal className="h-3 w-3" />
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
  );
}