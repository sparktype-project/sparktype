// src/features/editor/components/EditTagGroupDialog.tsx

import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollections } from '@/core/services/collections.service';
import type { TagGroup } from '@/core/types';

// UI Components
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Checkbox } from '@/core/components/ui/checkbox';

interface EditTagGroupDialogProps {
  siteId: string;
  tagGroup: TagGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditTagGroupDialog({ siteId, tagGroup, open, onOpenChange }: EditTagGroupDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getSiteById = useAppStore(state => state.getSiteById);
  const updateTagGroup = useAppStore(state => state.updateTagGroup);
  const siteData = getSiteById(siteId);

  const collections = useMemo(() => siteData ? getCollections(siteData.manifest) : [], [siteData]);

  // Initialize form when tagGroup changes
  useEffect(() => {
    if (tagGroup) {
      setName(tagGroup.name);
      setDescription(tagGroup.description || '');
      setSelectedCollections(tagGroup.applicableCollections);
    }
  }, [tagGroup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !tagGroup) return;

    setIsSubmitting(true);

    try {
      const updates: Partial<Omit<TagGroup, 'id'>> = {
        name: name.trim(),
        description: description.trim() || undefined,
        applicableCollections: selectedCollections,
      };

      await updateTagGroup(siteId, tagGroup.id, updates);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCollectionToggle = (collectionId: string, checked: boolean) => {
    if (checked) {
      setSelectedCollections(prev => [...prev, collectionId]);
    } else {
      setSelectedCollections(prev => prev.filter(id => id !== collectionId));
    }
  };

  const handleCancel = () => {
    if (tagGroup) {
      setName(tagGroup.name);
      setDescription(tagGroup.description || '');
      setSelectedCollections(tagGroup.applicableCollections);
    }
    onOpenChange(false);
  };

  if (!tagGroup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Tag Group</DialogTitle>
            <DialogDescription>
              Update the tag group settings. Changes to applicable collections will affect where this tag group appears in the content editor.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g. Blog Tags, Product Categories"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Optional description of this tag group"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label>Applicable Collections</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Select which collections this tag group should appear for when editing content.
              </div>

              {collections.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                  No collections available. Create a collection first to assign tag groups to it.
                </div>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {collections.map((collection) => (
                    <div key={collection.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-collection-${collection.id}`}
                        checked={selectedCollections.includes(collection.id)}
                        onCheckedChange={(checked) => handleCollectionToggle(collection.id, !!checked)}
                      />
                      <Label htmlFor={`edit-collection-${collection.id}`} className="text-sm font-normal cursor-pointer">
                        {collection.name}
                        <span className="text-muted-foreground ml-1">({collection.defaultItemLayout})</span>
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Updating...' : 'Update Tag Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}