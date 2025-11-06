// src/features/editor/components/CreateCollectionDialog.tsx

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { createCollection } from '@/core/services/collections.service';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import type { LayoutManifest } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { toast } from 'sonner';

// Icons
import { Loader2, FolderPlus } from 'lucide-react';

interface CreateCollectionDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A dialog for creating a new Collection instance within a site.
 * A Collection is a logical grouping of content items (e.g., a "Blog" or "News" section).
 * This component has been updated to use the unified Layout model.
 */
export default function CreateCollectionDialog({
  siteId,
  open,
  onOpenChange,
}: CreateCollectionDialogProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [itemLayouts, setItemLayouts] = useState<LayoutManifest[]>([]);
  const [loadingLayouts, setLoadingLayouts] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [defaultItemLayout, setDefaultItemLayout] = useState('');

  // Store actions
  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);

  const siteData = getSiteById(siteId);

  // Load available item layouts (layouts with type 'single') when the dialog opens.
  useEffect(() => {
    if (!open || !siteData) return;

    const loadItemLayouts = async () => {
      try {
        setLoadingLayouts(true);
        // Fetch only layouts suitable for being collection items.
        const layouts = await getAvailableLayouts(siteData, 'item');
        setItemLayouts(layouts);
        if (layouts.length > 0) {
          // Pre-select the first available item layout.
          setDefaultItemLayout(layouts[0].id);
        }
      } catch (error) {
        console.error('Failed to load item layouts:', error);
        toast.error('Failed to load available item layouts');
        setItemLayouts([]);
      } finally {
        setLoadingLayouts(false);
      }
    };

    loadItemLayouts();
  }, [open, siteData]);

  const selectedLayout = useMemo(() => {
    return itemLayouts.find(l => l.id === defaultItemLayout);
  }, [itemLayouts, defaultItemLayout]);

  const isValid = useMemo(() => name.trim() !== '' && defaultItemLayout !== '', [name, defaultItemLayout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !siteData) return;

    try {
      setIsLoading(true);

      const contentPath = `content/${name.trim().toLowerCase().replace(/\s+/g, '-')}/`;

      const { manifest: updatedManifest, collection: newCollection } = createCollection(siteData.manifest, {
        name: name.trim(),
        contentPath,
        defaultItemLayout
      });

      await updateManifest(siteId, updatedManifest);

      toast.success(`Collection "${name}" created successfully!`);

      onOpenChange(false);
      navigate(`/sites/${siteId}/collections/${newCollection.id}`);
    } catch (error) {
      console.error('Failed to create collection:', error);
      toast.error(`Failed to create collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form on close
      setName('');
      setDefaultItemLayout(itemLayouts.length > 0 ? itemLayouts[0].id : '');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Create New Collection
          </DialogTitle>
          <DialogDescription>
            A collection is a folder for organizing similar content, like blog posts or projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">Collection Name</Label>
            <Input
              id="collection-name"
              placeholder="e.g., Blog, News, Projects"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-layout-select">Default Item Layout</Label>
            <Select value={defaultItemLayout} onValueChange={setDefaultItemLayout} disabled={isLoading || loadingLayouts}>
              <SelectTrigger id="item-layout-select">
                <SelectValue placeholder={loadingLayouts ? "Loading layouts..." : "Choose a layout for items..."} />
              </SelectTrigger>
              <SelectContent>
                {itemLayouts.map((layout) => (
                  <SelectItem key={layout.id} value={layout.id}>
                    {layout.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedLayout?.description || "Select the blueprint for items you'll create in this collection."}
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 mr-2" />}
            {isLoading ? 'Creating...' : 'Create Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}