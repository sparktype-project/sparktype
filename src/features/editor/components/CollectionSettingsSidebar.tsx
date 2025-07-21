'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { 
  getCollection, 
  updateCollection, 
  deleteCollection,
  getCollectionStats 
} from '@/core/services/collections.service';
import { getCollectionTypeManifest } from '@/core/services/collectionTypes.service';
import type { Collection, CollectionTypeManifest } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import { Separator } from '@/core/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/core/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/core/components/ui/alert-dialog';

// Icons
import { Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CollectionSettingsSidebarProps {
  siteId: string;
  collectionId: string;
}

export default function CollectionSettingsSidebar({ siteId, collectionId }: CollectionSettingsSidebarProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [collectionType, setCollectionType] = useState<CollectionTypeManifest | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Store actions
  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  const siteData = getSiteById(siteId);

  // Get collection
  const collection = useMemo(() => {
    if (!siteData) return null;
    return getCollection(siteData.manifest, collectionId);
  }, [siteData, collectionId]);

  // Get collection stats
  const stats = useMemo(() => {
    if (!siteData || !collection) return null;
    return getCollectionStats(siteData, collection.id);
  }, [siteData, collection]);

  // Load collection type manifest
  useEffect(() => {
    if (collection?.typeId) {
      getCollectionTypeManifest(collection.typeId)
        .then(setCollectionType)
        .catch(error => {
          console.error('Failed to load collection type:', error);
          setCollectionType(null);
        });
    }
  }, [collection?.typeId]);

  // Initialize form with collection data
  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setDescription((collection.settings?.description as string) || '');
    }
  }, [collection]);

  const handleSave = useCallback(async () => {
    if (!siteData || !collection) return;

    try {
      setIsLoading(true);

      const updates = {
        name: name.trim(),
        settings: description ? { description: description.trim() } : undefined,
      };

      const updatedManifest = updateCollection(siteData.manifest, collection.id, updates);
      await updateManifest(siteId, updatedManifest);

      toast.success('Collection updated successfully');
    } catch (error) {
      console.error('Failed to update collection:', error);
      toast.error(`Failed to update collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [siteData, collection, name, description, siteId, updateManifest]);

  const handleDelete = useCallback(async () => {
    if (!siteData || !collection) return;

    try {
      setIsLoading(true);

      const { manifest: updatedManifest } = deleteCollection(siteData.manifest, collection.id);
      await updateManifest(siteId, updatedManifest);

      toast.success(`Collection "${collection.name}" deleted successfully`);
      navigate(`/sites/${siteId}/edit`);
    } catch (error) {
      console.error('Failed to delete collection:', error);
      toast.error(`Failed to delete collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setDeleteDialogOpen(false);
    }
  }, [siteData, collection, siteId, updateManifest, navigate]);

  if (!collection) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  const hasChanges = name !== collection.name || description !== ((collection.settings?.description as string) || '');

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Collection Settings</h3>
      </div>
      
      <div className="flex-grow overflow-y-auto">
        <Accordion type="multiple" defaultValue={['basic', 'stats', 'type-info']}>
          
          {/* Basic Settings */}
          <AccordionItem value="basic">
            <AccordionTrigger className="px-4">Basic Settings</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="collection-name">Name</Label>
                  <Input
                    id="collection-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="collection-description">Description</Label>
                  <Textarea
                    id="collection-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isLoading}
                    rows={3}
                    placeholder="Optional description..."
                  />
                </div>

                {hasChanges && (
                  <Button 
                    onClick={handleSave} 
                    disabled={isLoading || !name.trim()}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Collection Stats */}
          <AccordionItem value="stats">
            <AccordionTrigger className="px-4">Statistics</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Items</span>
                  <Badge variant="secondary">{stats?.itemCount || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Content Path</span>
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                    {collection.contentPath}
                  </span>
                </div>
                {stats?.lastModified && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Last Modified</span>
                    <span className="text-xs text-muted-foreground">
                      {stats.lastModified.toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Collection Type Info */}
          <AccordionItem value="type-info">
            <AccordionTrigger className="px-4">Collection Type</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{collection.typeId}</Badge>
                  {collectionType && (
                    <span className="text-sm text-muted-foreground">
                      {collectionType.name}
                    </span>
                  )}
                </div>
                
                {collectionType?.description && (
                  <p className="text-xs text-muted-foreground">
                    {collectionType.description}
                  </p>
                )}

                {collectionType && (
                  <div>
                    <Label className="text-xs font-medium">Available Layouts</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(collectionType.layouts).map(([layoutId, layout]) => (
                        <Badge key={layoutId} variant="secondary" className="text-xs">
                          {layout.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      {/* Danger Zone */}
      <div className="p-4 border-t">
        <Separator className="mb-4" />
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Collection
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Collection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{collection.name}"? 
                This will not delete the content files ({stats?.itemCount || 0} items), 
                but they will no longer be organized as a collection.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  'Delete Collection'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}