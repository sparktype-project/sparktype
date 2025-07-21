// src/features/editor/components/CollectionItemList.tsx

import { useMemo } from 'react';
import { Link } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// Services & Config
import { getCollection, getCollectionContent } from '@/core/services/collections.service';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { FileText, PlusCircle } from 'lucide-react';
// CORRECTED: Removed unused type imports for ParsedMarkdownFile and StructureNode.
// We can use a type-only import for the type we do need.
import type { ParsedMarkdownFile } from '@/core/types';

interface CollectionItemListProps {
  siteId: string;
  collectionId?: string;
}

/**
 * Displays a list of items within a specific collection, providing links
 * to edit each item and a button to create a new one.
 */
export default function CollectionItemList({ siteId, collectionId }: CollectionItemListProps) {
  const site = useAppStore((state: AppStore) => state.getSiteById(siteId));

  const collection = useMemo(() => {
    if (!site || !collectionId) return null;
    return getCollection(site.manifest, collectionId);
  }, [site, collectionId]);

  const collectionItems: ParsedMarkdownFile[] = useMemo(() => {
    if (!site || !collection) return [];
    return getCollectionContent(site, collection.id);
  }, [site, collection]);

  const newItemPath = useMemo(() => {
    if (!collection) return '#';
    const contentPathSlug = collection.contentPath.replace('content/', '').replace(/\/$/, '');
    return `/sites/${siteId}/edit/content/${contentPathSlug}/${NEW_FILE_SLUG_MARKER}`;
  }, [collection, siteId]);

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
              const editorSlug = item.path.replace(/^content\//, '').replace(/\.md$/, '');
              const itemEditorPath = `/sites/${siteId}/edit/content/${editorSlug}`;

              // CORRECTED: The title is always accessed from `item.frontmatter.title`
              // as the `collectionItems` array is strongly typed to `ParsedMarkdownFile[]`.
              const title = item.frontmatter.title;

              return (
                <li key={item.path}>
                  <Link to={itemEditorPath} className="flex items-center rounded-md p-2 transition-colors hover:bg-muted">
                    <FileText className="mr-3 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{title || item.slug}</span>
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