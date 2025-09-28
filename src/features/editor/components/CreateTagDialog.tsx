// src/features/editor/components/CreateTagDialog.tsx

import { useState } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import type { TagGroup, Tag } from '@/core/types';

// UI Components
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';

interface CreateTagDialogProps {
  siteId: string;
  tagGroup: TagGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateTagDialog({ siteId, tagGroup, open, onOpenChange }: CreateTagDialogProps) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const createTag = useAppStore(state => state.createTag);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTagName.trim() || !tagGroup || isCreating) return;

    setIsCreating(true);

    try {
      const tagData: Omit<Tag, 'id'> = {
        name: newTagName.trim(),
        groupId: tagGroup.id,
        description: newTagDescription.trim() || undefined,
      };

      await createTag(siteId, tagData);

      // Reset form and close dialog
      setNewTagName('');
      setNewTagDescription('');
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the store
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setNewTagName('');
    setNewTagDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Tag</DialogTitle>
          <DialogDescription>
            Create a new tag{tagGroup ? ` in "${tagGroup.name}"` : ''}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateTag} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tag-name">Tag Name *</Label>
            <Input
              id="tag-name"
              placeholder="e.g. Technology, Tutorial"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tag-description">Description (optional)</Label>
            <Input
              id="tag-description"
              placeholder="Brief description of this tag"
              value={newTagDescription}
              onChange={(e) => setNewTagDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!newTagName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Tag'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}