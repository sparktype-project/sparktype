'use client';

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollection, getCollectionContent } from '@/core/services/collections.service';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';
import type { Collection } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Separator } from '@/core/components/ui/separator';

// Icons
import { FileText, PlusCircle, ArrowLeft, FolderOpen } from 'lucide-react';

interface CollectionViewProps {
  siteId: string;
  collectionId: string;
}

export default function CollectionView({ siteId, collectionId }: CollectionViewProps) {
  const navigate = useNavigate();
  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  // Get collection configuration
  const collection = useMemo(() => {
    if (!siteData) return null;
    return getCollection(siteData.manifest, collectionId);
  }, [siteData, collectionId]);

  // Get collection items (files in the collection's content path)
  const collectionItems = useMemo(() => {
    if (!siteData || !collection) return [];
    return getCollectionContent(siteData, collection.id);
  }, [siteData, collection]);

  if (!siteData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p>Loading site data...</p>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Collection Not Found</h2>
          <p className="text-sm mb-4">The collection "{collectionId}" could not be found.</p>
          <Button onClick={() => navigate(`/sites/${siteId}/edit`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Editor
          </Button>
        </div>
      </div>
    );
  }

  // Path for creating new items in this collection
  const newItemPath = `/sites/${siteId}/edit/content/${collection.contentPath.replace('content/', '').replace(/\/$/, '')}/${NEW_FILE_SLUG_MARKER}`;

  return (
    <div className="h-full flex flex-col p-6 bg-muted/30">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between mb-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(`/sites/${siteId}/edit`)}
            className="p-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{collection.name}</h1>
              <Badge variant="outline">{collection.typeId}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Collection • {collectionItems.length} items • {collection.contentPath}
            </p>
            {collection.settings?.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {collection.settings.description as string}
              </p>
            )}
          </div>
        </div>
        <Button asChild>
          <Link to={newItemPath}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Item
          </Link>
        </Button>
      </div>

      {/* Collection Items */}
      <div className="flex-grow rounded-lg bg-background p-1 overflow-y-auto">
        {collectionItems.length > 0 ? (
          <div className="space-y-1">
            {collectionItems.map((item) => {
              // Convert file path to editor route
              const editorSlug = item.path.replace(/^content\//, '').replace(/\.md$/, '');
              const itemEditorPath = `/sites/${siteId}/edit/content/${editorSlug}`;

              return (
                <Link
                  key={item.path}
                  to={itemEditorPath}
                  className="flex items-center justify-between rounded-md p-3 transition-colors hover:bg-muted group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {item.frontmatter.title || item.slug}
                      </div>
                      {item.frontmatter.description && (
                        <div className="text-xs text-muted-foreground">
                          {item.frontmatter.description as string}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.frontmatter.date && (
                      <span>
                        {new Date(item.frontmatter.date as string).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-16">
            <FolderOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Items Yet</h3>
            <p className="text-sm mb-6">
              No content has been added to this collection yet.
            </p>
            <Button asChild variant="outline">
              <Link to={newItemPath}>
                <PlusCircle className="mr-2 h-4 w-4" /> Create First Item
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}