// src/features/editor/components/CollectionSettingsSidebar.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import {
  getCollection,
  updateCollection,
  deleteCollection,
} from '@/core/services/collections.service';
import type { LayoutManifest, ParsedMarkdownFile, LayoutInfo } from '@/core/types';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';

// Icons
import { Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CollectionSettingsSidebarProps {
  siteId: string;
  collectionId: string;
}

/**
 * A sidebar component for managing the settings of a single Collection.
 * This has been refactored to remove all dependencies on the old "Collection Type" system.
 */
export default function CollectionSettingsSidebar({ siteId, collectionId }: CollectionSettingsSidebarProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemLayout, setItemLayout] = useState<LayoutManifest | null>(null);
  const [itemLayouts, setItemLayouts] = useState<LayoutInfo[]>([]);
  const [loadingLayouts, setLoadingLayouts] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultItemLayout, setDefaultItemLayout] = useState('');

  // Store actions
  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  const siteData = getSiteById(siteId);

  const collection = useMemo(() => {
    if (!siteData) return null;
    return getCollection(siteData.manifest, collectionId);
  }, [siteData, collectionId]);

  const itemCount = useMemo(() => {
      if (!siteData || !collection) return 0;
      return (siteData.contentFiles || []).filter((file: ParsedMarkdownFile) => file.path.startsWith(collection.contentPath)).length;
  }, [siteData, collection]);

  // Load the manifest for the collection's default item layout
  useEffect(() => {
    if (collection?.defaultItemLayout && siteData) {
      getAvailableLayouts(siteData, 'single')
        .then(layouts => {
          const layout = layouts.find(l => l.id === collection.defaultItemLayout);
          setItemLayout(layout || null);
        })
        .catch(error => {
          console.error('Failed to load item layout:', error);
          setItemLayout(null);
        });
    }
  }, [collection?.defaultItemLayout, siteData]);

  // Load available item layouts
  useEffect(() => {
    if (!siteData) return;

    const loadItemLayouts = async () => {
      try {
        setLoadingLayouts(true);
        const layouts = await getAvailableLayouts(siteData, 'single');
        const layoutInfos: LayoutInfo[] = layouts.map(layout => ({
          id: layout.id,
          name: layout.name || layout.id,
          type: layout.layoutType,
          path: '', // LayoutManifest doesn't have path property
          description: layout.description
        }));
        setItemLayouts(layoutInfos);
      } catch (error) {
        console.error('Failed to load item layouts:', error);
        setItemLayouts([]);
      } finally {
        setLoadingLayouts(false);
      }
    };

    loadItemLayouts();
  }, [siteData]);

  // Initialize form with collection data
  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setDescription((collection.settings?.description as string) || '');
      setDefaultItemLayout(collection.defaultItemLayout);
    }
  }, [collection]);

  const handleSave = useCallback(async () => {
    if (!siteData || !collection) return;
    try {
      setIsLoading(true);
      const updates = { 
        name: name.trim(), 
        defaultItemLayout: defaultItemLayout,
        settings: description ? { description: description.trim() } : undefined 
      };
      const updatedManifest = updateCollection(siteData.manifest, collection.id, updates);
      await updateManifest(siteId, updatedManifest);
      toast.success('Collection updated successfully');
    } catch (error) {
      toast.error(`Failed to update collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [siteData, collection, name, description, defaultItemLayout, siteId, updateManifest]);

  const handleDelete = useCallback(async () => {
    if (!siteData || !collection) return;
    try {
      setIsLoading(true);
      const { manifest: updatedManifest } = deleteCollection(siteData.manifest, collection.id);
      await updateManifest(siteId, updatedManifest);
      toast.success(`Collection "${collection.name}" deleted successfully`);
      navigate(`/sites/${siteId}/edit`);
    } catch (error) {
      toast.error(`Failed to delete collection: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setDeleteDialogOpen(false);
    }
  }, [siteData, collection, siteId, updateManifest, navigate]);

  if (!collection) {
    return <div className="p-4"><p className="text-sm text-muted-foreground">Collection not found</p></div>;
  }

  const hasChanges = name !== collection.name || 
                    description !== ((collection.settings?.description as string) || '') ||
                    defaultItemLayout !== collection.defaultItemLayout;

  return (
    <div className="h-full flex flex-col">
      
      <div className="flex-grow overflow-y-auto">
        <Accordion type="multiple" defaultValue={['basic', 'info']}>
          <AccordionItem value="basic">
            <AccordionTrigger className="px-4">Collection settings</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="collection-name">Name</Label>
                  <Input id="collection-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collection-description">Description</Label>
                  <Textarea id="collection-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLoading} rows={3} placeholder="Optional description..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-layout-select">Item layout</Label>
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
                </div>
                {hasChanges && (
                  <Button onClick={handleSave} disabled={isLoading || !name.trim() || !defaultItemLayout} className="w-full">
                    {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
      <div className="p-4 border-t">
        <Separator className="mb-4" />
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />Delete Collection
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Collection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{collection.name}"? This will not delete the {itemCount} content files, but they will no longer be part of a collection. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isLoading}>
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : 'Delete Collection'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}