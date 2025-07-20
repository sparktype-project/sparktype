// src/features/editor/components/CollectionItemList.tsx

import { useMemo } from 'react';
import { Link } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// Services & Config
import { findChildNodes } from '@/core/services/fileTree.service';
import { getCollection, getCollectionContent } from '@/core/services/collections.service';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { FileText, PlusCircle } from 'lucide-react';

interface CollectionItemListProps {
  siteId: string;
  collectionPagePath?: string; // e.g., 'content/blog.md' - for backward compatibility
  collectionId?: string; // e.g., 'blog' - new collection-based approach
}

export default function CollectionItemList({ siteId, collectionPagePath, collectionId }: CollectionItemListProps) {
  const site = useAppStore((state: AppStore) => state.getSiteById(siteId));

  // Get collection config when using new approach
  const collection = useMemo(() => {
    if (!site || !collectionId) return null;
    return getCollection(site.manifest, collectionId);
  }, [site, collectionId]);

  // Get collection items using the appropriate method
  const collectionItems = useMemo(() => {
    if (!site) return [];

    if (collectionId && collection) {
      // New approach: get items directly from collection config
      return getCollectionContent(site, collectionId);
    } else if (collectionPagePath) {
      // Legacy approach: find child nodes in site structure
      return findChildNodes(site.manifest.structure, collectionPagePath);
    }
    
    return [];
  }, [site, collectionId, collection, collectionPagePath]);

  // Determine the path for the "New Item" button
  const newItemPath = useMemo(() => {
    if (collection) {
      // New approach: use collection's contentPath
      const contentPathSlug = collection.contentPath.replace('content/', '').replace(/\/$/, '');
      return `/sites/${siteId}/edit/content/${contentPathSlug}/${NEW_FILE_SLUG_MARKER}`;
    } else if (collectionPagePath) {
      // Legacy approach: derive from collectionPagePath
      return `/sites/${siteId}/edit/content/${collectionPagePath.replace('content/', '').replace('.md', '')}/${NEW_FILE_SLUG_MARKER}`;
    }
    return `/sites/${siteId}/edit/content/${NEW_FILE_SLUG_MARKER}`;
  }, [collection, collectionPagePath, siteId]);

  // Determine the collection name for display
  const collectionName = collection?.name || 'Collection Items';

  return (
    <div className="h-full flex flex-col p-6 bg-muted/30">
      <div className="flex shrink-0 items-center justify-between mb-4 pb-4 border-b">
        <h1 className="text-2xl font-bold">{collectionName}</h1>
        <Button asChild>
          <Link to={newItemPath}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Item
          </Link>
        </Button>
      </div>
      <div className="flex-grow rounded-lg bg-background p-1 overflow-y-auto">
        {collectionItems.length > 0 ? (
          <ul className="space-y-1">
            {collectionItems.map((item) => {
              // --- CONFIRMED FIX FOR NEW ROUTING ---
              // The editor slug is correctly derived from the item's full, unambiguous path.
              // This avoids issues with nested slugs or duplicate filenames.
              const editorSlug = item.path.replace(/^content\//, '').replace(/\.md$/, '');
              const itemEditorPath = `/sites/${siteId}/edit/content/${editorSlug}`;

              return (
                <li key={item.path}>
                  <Link to={itemEditorPath} className="flex items-center rounded-md p-2 transition-colors hover:bg-muted">
                    <FileText className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{item.title || item.slug}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center text-muted-foreground py-10">
            <p>No items have been added to this collection yet.</p>
            <Button asChild variant="outline" className="mt-4">
               <Link to={newItemPath}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add your first item
                </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}