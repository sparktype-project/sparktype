// src/features/editor/components/EditCollectionDialog.tsx

import { useState, useEffect } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { updateCollection } from '@/core/services/collections.service';
import type { Collection } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { toast } from 'sonner';

// Icons
import { Loader2, Edit } from 'lucide-react';

interface EditCollectionDialogProps {
  siteId: string;
  collection: Collection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCollectionDialog({
  siteId,
  collection,
  open,
  onOpenChange,
}: EditCollectionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  const siteData = getSiteById(siteId);

  useEffect(() => {
    if (collection && open) {
      setName(collection.name);
      setDescription((collection.settings?.description as string) || '');
    }
  }, [collection, open]);

  const isValid = name.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !siteData || !collection) return;

    try {
      setIsLoading(true);
      const updates = {
        name: name.trim(),
        settings: description ? { description: description.trim() } : undefined,
      };
      const updatedManifest = updateCollection(siteData.manifest, collection.id, updates);
      await updateManifest(siteId, updatedManifest);
      toast.success(`Collection "${name}" updated successfully!`);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to update collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!collection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" />Edit Collection</DialogTitle>
          <DialogDescription>Update the collection's settings.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-collection-name">Collection Name *</Label>
            <Input id="edit-collection-name" placeholder="My Blog" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} required />
          </div>

          <div className="space-y-2">
            <Label>Default Item Layout</Label>
            {/* CORRECTED: Display the informative `defaultItemLayout` instead of the obsolete `typeId`. */}
            <div className="px-3 py-2 border rounded-md bg-muted text-muted-foreground">{collection.defaultItemLayout}</div>
            <p className="text-xs text-muted-foreground">The item layout cannot be changed after creation.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" placeholder="Optional description for this collection..." value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLoading} rows={3} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
          <Button type="submit" onClick={handleSubmit} disabled={!isValid || isLoading} className="min-w-[100px]">
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating...</> : <><Edit className="h-4 w-4 mr-2" />Update Collection</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}