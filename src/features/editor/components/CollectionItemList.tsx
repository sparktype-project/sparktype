// src/features/editor/components/CollectionItemList.tsx

import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// Services & Config
import { getCollection, getCollectionContent } from '@/core/services/collections.service';
import { NEW_FILE_SLUG_MARKER } from '@/config/editorConfig';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/core/components/ui/table';
import { Badge } from '@/core/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/core/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/core/components/ui/alert-dialog';
import { FileText, PlusCircle, MoreHorizontal, Eye, EyeOff, Trash2 } from 'lucide-react';
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
  const updateContentFile = useAppStore(state => state.updateContentFileOnly);
  const deleteContentFile = useAppStore(state => state.deleteContentFileAndState);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ParsedMarkdownFile | null>(null);

  const collection = useMemo(() => {
    if (!site || !collectionId) return null;
    return getCollection(site.manifest, collectionId);
  }, [site, collectionId]);

  const collectionItems: ParsedMarkdownFile[] = useMemo(() => {
    if (!site || !collection) return [];
    const items = getCollectionContent(site, collection.id);

    // Sort by date, most recent first
    return items.sort((a, b) => {
      const dateA = a.frontmatter.date ? new Date(a.frontmatter.date as string).getTime() : 0;
      const dateB = b.frontmatter.date ? new Date(b.frontmatter.date as string).getTime() : 0;
      return dateB - dateA; // Most recent first
    });
  }, [site, collection]);

  const newItemPath = useMemo(() => {
    if (!collection) return '#';
    const contentPathSlug = collection.contentPath.replace('content/', '').replace(/\/$/, '');
    return `/sites/${siteId}/edit/content/${contentPathSlug}/${NEW_FILE_SLUG_MARKER}`;
  }, [collection, siteId]);

  const handleTogglePublish = useCallback(async (item: ParsedMarkdownFile) => {
    const currentPublishedStatus = item.frontmatter.published !== false; // Default to true
    const updatedItem = {
      ...item,
      frontmatter: {
        ...item.frontmatter,
        published: !currentPublishedStatus
      }
    };

    try {
      await updateContentFile(siteId, updatedItem);
    } catch (error) {
      console.error('Failed to toggle publish status:', error);
    }
  }, [siteId, updateContentFile]);

  const handleDeleteClick = useCallback((item: ParsedMarkdownFile) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!itemToDelete) return;

    try {
      await deleteContentFile(siteId, itemToDelete.path);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  }, [itemToDelete, siteId, deleteContentFile]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex shrink-0 items-center justify-between mb-4 pb-4 border-b">
        <Button asChild>
          <Link to={newItemPath}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add post
          </Link>
        </Button>
      </div>
      <div className="flex-grow rounded-lg bg-background overflow-y-auto">
        {collectionItems.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collectionItems.map((item) => {
                const editorSlug = item.path.replace(/^content\//, '').replace(/\.md$/, '');
                const itemEditorPath = `/sites/${siteId}/edit/content/${editorSlug}`;
                const title = item.frontmatter.title || item.slug;
                const date = item.frontmatter.date ? new Date(item.frontmatter.date as string).toLocaleDateString() : '';
                const isPublished = item.frontmatter.published !== false; // Default to true

                return (
                  <TableRow key={item.path} className="hover:bg-muted/50">
                    <TableCell>
                      <Link to={itemEditorPath} className="flex items-center text-foreground hover:text-primary transition-colors">
                        <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{title}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {date}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {isPublished ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleTogglePublish(item)}>
                            {isPublished ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Unpublish
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Publish
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(item)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.frontmatter.title || itemToDelete?.slug}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}