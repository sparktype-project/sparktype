'use client';

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { createCollection } from '@/core/services/collections.service';
import { getAvailableCollectionTypes } from '@/core/services/collectionTypes.service';
import type { CollectionTypeManifest } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
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
import { Badge } from '@/core/components/ui/badge';
import { toast } from 'sonner';

// Icons
import { Loader2, FolderPlus } from 'lucide-react';

interface CreateCollectionDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateCollectionDialog({
  siteId,
  open,
  onOpenChange,
}: CreateCollectionDialogProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [collectionTypes, setCollectionTypes] = useState<Array<{id: string, manifest: CollectionTypeManifest}>>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState('');
  const [description, setDescription] = useState('');

  // Store actions
  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  
  const siteData = getSiteById(siteId);

  // Load available collection types
  useEffect(() => {
    if (!open) return;
    
    const loadCollectionTypes = async () => {
      try {
        setLoadingTypes(true);
        const types = await getAvailableCollectionTypes();
        setCollectionTypes(types);
      } catch (error) {
        console.error('Failed to load collection types:', error);
        toast.error('Failed to load collection types');
        setCollectionTypes([]);
      } finally {
        setLoadingTypes(false);
      }
    };

    loadCollectionTypes();
  }, [open]);


  // Get selected collection type manifest
  const selectedTypeManifest = useMemo(() => {
    if (!typeId) return null;
    return collectionTypes.find(ct => ct.id === typeId)?.manifest || null;
  }, [typeId, collectionTypes]);

  // Validation
  const isValid = useMemo(() => {
    return (
      name.trim() !== '' &&
      typeId !== '' &&
      selectedTypeManifest !== null
    );
  }, [name, typeId, selectedTypeManifest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid || !siteData) return;

    try {
      setIsLoading(true);

      // Generate content path from collection name
      const contentPath = `content/${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}/`;

      // Create the collection
      const { manifest: updatedManifest, collection: newCollection } = createCollection(siteData.manifest, {
        name: name.trim(),
        typeId,
        contentPath,
        settings: description ? { description: description.trim() } : undefined,
      });

      // Update the site manifest in the store
      await updateManifest(siteId, updatedManifest);

      toast.success(`Collection "${name}" created successfully!`);
      
      // Reset form and close dialog
      resetForm();
      onOpenChange(false);

      // Navigate to the new collection management page
      navigate(`/sites/${siteId}/collections/${newCollection.id}`);

    } catch (error) {
      console.error('Failed to create collection:', error);
      toast.error(`Failed to create collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setTypeId('');
    setDescription('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Create Collection
          </DialogTitle>
          <DialogDescription>
            Create a new collection to organize and display your content.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Collection Name */}
          <div className="space-y-2">
            <Label htmlFor="collection-name">Collection Name *</Label>
            <Input
              id="collection-name"
              placeholder="My Blog"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {/* Collection Type */}
          <div className="space-y-2">
            <Label htmlFor="collection-type">Collection Type *</Label>
            {loadingTypes ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading collection types...
              </div>
            ) : (
              <Select value={typeId} onValueChange={setTypeId} disabled={isLoading}>
                <SelectTrigger id="collection-type">
                  <SelectValue placeholder="Choose a collection type..." />
                </SelectTrigger>
                <SelectContent>
                  {collectionTypes.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No collection types available
                    </div>
                  ) : (
                    collectionTypes.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{ct.manifest.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {ct.id}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            {selectedTypeManifest?.description && (
              <p className="text-xs text-muted-foreground">
                {selectedTypeManifest.description}
              </p>
            )}
          </div>


          {/* Description (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description for this collection..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          {/* Collection Type Layouts Preview */}
          {selectedTypeManifest && (
            <div className="space-y-2">
              <Label>Available Layouts</Label>
              <div className="flex flex-wrap gap-1">
                {Object.entries(selectedTypeManifest.layouts).map(([layoutId, layout]) => (
                  <Badge key={layoutId} variant="secondary" className="text-xs">
                    {layout.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Collection
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}