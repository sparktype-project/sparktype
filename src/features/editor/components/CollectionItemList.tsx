// src/features/editor/components/CollectionItemList.tsx

import { useMemo } from 'react';
import { Link } from 'react-router-dom'; // Use Link from react-router-dom

// State Management
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore'; // Import the store type

// Services & Config
import { findChildNodes } from '@/core/services/fileTree.service';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { FileText, PlusCircle } from 'lucide-react';

interface CollectionItemListProps {
  siteId: string;
  collectionPagePath: string; // e.g., 'content/blog.md'
}

export default function CollectionItemList({ siteId, collectionPagePath }: CollectionItemListProps) {
  // Explicitly type the state selector for Zustand
  const site = useAppStore((state: AppStore) => state.getSiteById(siteId));

  // This logic to find child nodes is correct and remains unchanged
  const collectionItems = useMemo(() => {
    if (!site?.manifest) return [];
    return findChildNodes(site.manifest.structure, collectionPagePath);
  }, [site?.manifest, collectionPagePath]);

  // The path for the "New Item" button is also updated to be a correct hash route
  const newItemPath = `/sites/${siteId}/edit/content/${collectionPagePath.replace('content/', '').replace('.md', '')}/${NEW_FILE_SLUG_MARKER}`;

  return (
    <div className="h-full flex flex-col p-6 bg-muted/30">
      <div className="flex shrink-0 items-center justify-between mb-4 pb-4 border-b">
        <h1 className="text-2xl font-bold">Collection Items</h1>
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