// src/features/editor/components/CollectionsManager.tsx

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollections, deleteCollection } from '@/core/services/collections.service';
import type { Collection, ParsedMarkdownFile } from '@/core/types';
import CreateCollectionDialog from './CreateCollectionDialog';
import EditCollectionDialog from './EditCollectionDialog';
import { CollectionErrorBoundary, CollectionErrorFallback } from './ErrorBoundary';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/core/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/core/components/ui/alert-dialog';

import { Plus, Search, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface CollectionsManagerProps {
  siteId: string;
}

export default function CollectionsManager({ siteId }: CollectionsManagerProps) {
  const navigate = useNavigate();
  const [searchFilter, setSearchFilter] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [collectionToEdit, setCollectionToEdit] = useState<Collection | null>(null);

  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  const siteData = getSiteById(siteId);

  const collections = useMemo(() => siteData ? getCollections(siteData.manifest) : [], [siteData]);

  const filteredCollections = useMemo(() => {
    if (!searchFilter.trim()) return collections;
    const filter = searchFilter.toLowerCase();
    return collections.filter(collection =>
      collection.name.toLowerCase().includes(filter) ||
      collection.defaultItemLayout.toLowerCase().includes(filter)
    );
  }, [collections, searchFilter]);

  const handleDeleteCollection = (collection: Collection) => {
    setCollectionToDelete(collection);
    setDeleteDialogOpen(true);
  };

  const handleEditCollection = (collection: Collection) => {
    setCollectionToEdit(collection);
    setEditDialogOpen(true);
  };

  const handleCollectionClick = (collection: Collection) => {
    navigate(`/sites/${siteId}/collections/${collection.id}`);
  };

  const confirmDeleteCollection = async () => {
    if (!collectionToDelete || !siteData) return;
    try {
      const { manifest: updatedManifest } = deleteCollection(siteData.manifest, collectionToDelete.id);
      await updateManifest(siteId, updatedManifest);
      toast.success(`Collection "${collectionToDelete.name}" deleted successfully!`);
    } catch (error) {
      toast.error(`Failed to delete collection: ${(error as Error).message}`);
    } finally {
      setDeleteDialogOpen(false);
      setCollectionToDelete(null);
    }
  };

  if (!siteData) {
    return <div className="p-4 text-center text-muted-foreground"><p className="text-sm">Loading site data...</p></div>;
  }

  return (
    <CollectionErrorBoundary fallback={CollectionErrorFallback}>
      <div className="flex h-full flex-col">
        {collections.length > 0 && (
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search collections..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {filteredCollections.length === 0 ? (
            <div className="p-4">
              {collections.length === 0 ? (
                <div className="space-y-3">
                  <div className="text-muted-foreground">
                    <p className="text-xs">No collections yet. Click the plus button above to create one.</p>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground"><p className="text-sm">No collections match</p></div>
              )}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredCollections.map((collection) => (
                <CollectionItem
                  key={collection.id}
                  collection={collection}
                  siteData={siteData}
                  onClick={() => handleCollectionClick(collection)}
                  onEdit={() => handleEditCollection(collection)}
                  onDelete={() => handleDeleteCollection(collection)}
                />
              ))}
            </div>
          )}
        </div>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Collection</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete "{collectionToDelete?.name}"? This will not delete the content files, but they will no longer be organized as a collection.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteCollection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Collection</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <CreateCollectionDialog siteId={siteId} open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
        <EditCollectionDialog siteId={siteId} collection={collectionToEdit} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
      </div>
    </CollectionErrorBoundary>
  );
}

interface CollectionItemProps {
  collection: Collection;
  siteData: import('@/core/types').LocalSiteData;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CollectionItem({ collection, siteData, onClick, onEdit, onDelete }: CollectionItemProps) {
  // CORRECTED: Calculate item count directly instead of using an obsolete service.
  const itemCount = useMemo(() => {
    return (siteData.contentFiles || []).filter((file: ParsedMarkdownFile) => file.path.startsWith(collection.contentPath)).length;
  }, [siteData.contentFiles, collection.contentPath]);

  return (
    <div className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick} title="Click to view collection items">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium truncate">{collection.name}</div>
          {/* CORRECTED: Display the more informative `defaultItemLayout` instead of `typeId`. */}
          <div className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{collection.defaultItemLayout}</div>
        </div>
        <div className="text-xs text-muted-foreground">{itemCount} items • {collection.contentPath}</div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"><MoreHorizontal className="h-3 w-3" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}><Edit className="h-4 w-4 mr-2" />Edit Collection</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete Collection</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}