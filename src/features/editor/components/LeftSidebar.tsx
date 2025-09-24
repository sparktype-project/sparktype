// src/features/editor/components/LeftSidebar.tsx

import { useMemo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/core/components/ui/accordion';
import FileTree from '@/features/editor/components/FileTree';
import NewPageDialog from '@/features/editor/components/NewPageDialog';
import CollectionsManager from '@/features/editor/components/CollectionsManager';
import TagGroupsManager from '@/features/editor/components/TagGroupsManager';
import CreateCollectionDialog from '@/features/editor/components/CreateCollectionDialog';
import CreateTagGroupDialog from '@/features/editor/components/CreateTagGroupDialog';
// import CreateCollectionPageDialog from '@/features/editor/components/CreateCollectionPageDialog';
import { FilePlus, GripVertical, Archive, CirclePlus, Shield, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/core/components/ui/alert-dialog';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragMoveEvent,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import { flattenTree, type FlattenedNode } from '@/core/services/fileTree.service';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { exportSiteBackup } from '@/core/services/siteBackup.service';
import { slugify } from '@/core/libraries/utils';

interface DndProjection {
  parentId: string | null;
  depth: number;
  index: number;
}

function DragOverlayItem({ id, items }: { id: string; items: FlattenedNode[] }) {
  const item = items.find(i => i.path === id);
  if (!item) return null;
  return (
    <div className="flex items-center gap-2 p-2 bg-background border rounded-md shadow-lg text-sm font-semibold">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span>{item.title}</span>
    </div>
  );
}

export default function LeftSidebar() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const location = useLocation();

  const repositionNode = useAppStore(state => state.repositionNode);
  const loadSite = useAppStore(state => state.loadSite);
  const getSiteById = useAppStore(state => state.getSiteById);
  const authenticateForSite = useAppStore(state => state.authenticateForSite);
  const getSiteAuthStatus = useAppStore(state => state.getSiteAuthStatus);
  
  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));

  // All local state management remains the same
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [isCreateCollectionDialogOpen, setIsCreateCollectionDialogOpen] = useState(false);
  const [isCreateTagGroupDialogOpen, setIsCreateTagGroupDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { setNodeRef: setRootDroppableRef } = useDroppable({ id: '__root_droppable__' });

  const flattenedItems = useMemo(() => {
    if (!site?.manifest.structure || !site.contentFiles) return [];
    const allItems = flattenTree(site.manifest.structure, site.contentFiles);
    
    return allItems.filter(item => {
      // Show collection pages themselves (pages with collection frontmatter)
      if (item.frontmatter?.collection) return true;
      
      // Show root level pages
      if (item.depth === 0) return true;
      
      // Check if parent is a collection page (existing logic for nested structure)
      const parentItem = allItems.find(parent => parent.path === item.parentId);
      return !parentItem?.frontmatter?.collection;
    });
  }, [site?.manifest.structure, site?.contentFiles]);
  
  const homepageItem = useMemo(() => flattenedItems.find(item => item.frontmatter?.homepage === true), [flattenedItems]);
  const sortableItems = useMemo(() => flattenedItems.filter(item => item.frontmatter?.homepage !== true), [flattenedItems]);
  const sortableIds = useMemo(() => sortableItems.map(i => i.path), [sortableItems]);
  
  const activeItem = activeId ? flattenedItems.find(i => i.path === activeId) : null;

  const handleExportBackup = async () => {
    if (!site) return;

    setIsExporting(true);
    try {
      // Check if authentication is required for this site
      const authStatus = getSiteAuthStatus(siteId, site.manifest);
      
      if (authStatus.requiresAuth && !authStatus.isAuthenticated) {
        if (!site.manifest.auth) {
          toast.error('Site requires authentication but no credentials found');
          return;
        }
        
        const authResult = await authenticateForSite(siteId, site.manifest.auth);
        
        if (!authResult.success) {
          toast.error(`Authentication required for export: ${authResult.error}`);
          return;
        }
        
        toast.success('Authentication successful, preparing backup...');
      }

      toast.info("Preparing site backup...");
      
      // Re-fetch site data to ensure it's the latest before exporting
      await loadSite(siteId); 
      const siteToExport = getSiteById(siteId);
      if (!siteToExport) throw new Error("Could not load site data for export.");
      
      const blob = await exportSiteBackup(siteToExport);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${slugify(siteToExport.manifest.title || 'signum-backup')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("Site backup downloaded!");
    } catch (error) {
      console.error("Failed to export site:", error);
      toast.error(`Export failed: ${(error as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const itemsToRender = useMemo(() => {
    return flattenedItems.filter(item => {
        if (item.depth === 0) return true;
        if (item.parentId && collapsedIds.has(item.parentId)) return false;
        const parent = flattenedItems.find(p => p.path === item.parentId);
        if (parent?.parentId && collapsedIds.has(parent.parentId)) return false;
        return true;
    });
  }, [flattenedItems, collapsedIds]);
  
  const projected = useMemo((): DndProjection | null => {
    if (!activeItem || !overId) return null;
    const indentationWidth = 24;
    const dragDepth = Math.round(offsetLeft / indentationWidth);
    const projectedDepth = activeItem.depth + dragDepth;
    const overItemIndex = flattenedItems.findIndex(({ path }) => path === overId);
    const activeItemIndex = flattenedItems.findIndex(({ path }) => path === activeId);
    const newItems = arrayMove(flattenedItems, activeItemIndex, overItemIndex);
    const previousItem = newItems[overItemIndex - 1];
    const nextItem = newItems[overItemIndex + 1];
    const maxDepth = previousItem ? previousItem.depth + 1 : 0;
    const minDepth = nextItem ? nextItem.depth : 0;
    let depth = Math.max(minDepth, Math.min(projectedDepth, maxDepth));
    if (depth > 2) depth = 2;
    
    let parentId = null;
    if (depth > 0 && previousItem) {
        if (depth === previousItem.depth) parentId = previousItem.parentId;
        else if (depth > previousItem.depth) parentId = previousItem.path;
        else parentId = newItems.slice(0, overItemIndex).reverse().find((item) => item.depth === depth)?.parentId ?? null;
    }
    return { depth, parentId, index: overItemIndex };
  }, [activeId, overId, offsetLeft, flattenedItems, activeItem]);

  const handleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOverId(event.active.id as string);
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => setOffsetLeft(event.delta.x), []);
  const handleDragOver = useCallback((event: DragOverEvent) => setOverId(event.over?.id as string ?? null), []);

  const resetState = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (!projected) {
        resetState();
        return;
    }
    const { active, over } = event;
    if (site && active.id && over?.id) {
        if (over.id === '__root_droppable__') {
            repositionNode(siteId, active.id as string, null, flattenedItems.length - 1);
        } else {
            repositionNode(siteId, active.id as string, projected.parentId, projected.index);
        }
    }
    resetState();
  }, [projected, site, siteId, repositionNode, flattenedItems.length, resetState]);

  const activePathForFileTree = useMemo(() => {
    if (!site?.manifest) return undefined;
    const editorRootPath = `/sites/${siteId}/edit/content`;
    if (location.pathname.startsWith(editorRootPath)) {
        const slug = location.pathname.substring(editorRootPath.length).replace(/^\//, '');
        return slug ? `content/${slug}.md` : homepageItem?.path;
    }
    return undefined;
  }, [location.pathname, site, siteId, homepageItem]);

  if (!site) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetState}
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b px-2 py-0">
          <h3 className="px-2 text-xs  uppercase tracking-wider text-muted-foreground">Pages</h3>
          <div className="flex items-center gap-1">
            {/* <CreateCollectionPageDialog siteId={siteId}>
                <Button variant="ghost" className='size-7 p-1' title="New Collection">
                    <LayoutGrid className="h-4 w-4" />
                </Button>
            </CreateCollectionPageDialog> */}
            <NewPageDialog siteId={siteId}>
                <div title="New Page"
                                    className="text-muted-foreground size-7 p-1 rounded-md hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center cursor-pointer" 
>
                    <FilePlus className="h-4 w-4" />
                </div>
            </NewPageDialog>
          </div>
        </div>
        
        <div className=" px-2 pt-2 pb-4" ref={setRootDroppableRef}>
          {itemsToRender.length > 0 ? (
            <FileTree 
              itemsToRender={itemsToRender.map(item => ({...item, collapsed: collapsedIds.has(item.path)}))}
              sortableIds={sortableIds}
              activeId={activeId}
              projected={projected}
              baseEditPath={`/sites/${siteId}/edit`}
              activePath={activePathForFileTree}
              homepagePath={homepageItem?.path || itemsToRender[0]?.path}
              onCollapse={handleCollapse}
            />
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              <p>No pages created yet. Click the button above to add one.</p>
            </div>
          )}
        </div>

        {/* Collections and Tag Groups Accordion */}
        <div className="border-t bg-background">
          <Accordion type="multiple" defaultValue={['collections', 'taggroups']}>
            <AccordionItem value="collections" className="border-b-0">
              <AccordionTrigger className="py-0 hover:no-underline items-center px-3">
                <div className="flex items-center justify-between w-full">
                  <span className="font-normal text-xs uppercase tracking-wider text-muted-foreground">Collections</span>
                  <div 
                    className="size-7 p-1 rounded-md hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreateCollectionDialogOpen(true);
                    }}
                    title="Create Collection"
                  >
                    <CirclePlus className="h-4 w-4" />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <CollectionsManager siteId={siteId} />
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="taggroups" className="border-b-0">
              <AccordionTrigger className="hover:no-underline py-0 px-3 items-center border-t-1 [state=closed]:border-b-0">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-normal uppercase tracking-wider text-muted-foreground">Tags</span>
                  <div 
                    className="size-7 p-1 rounded-md hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreateTagGroupDialogOpen(true);
                    }}
                    title="Create tags"
                  >
                    <CirclePlus className="h-4 w-4" />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <TagGroupsManager siteId={siteId} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className=" border-t p-2 space-y-1">
            {site?.manifest.auth?.requiresAuth ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2" disabled={isExporting}>
                    <Archive className="h-4 w-4" /> 
                    {isExporting ? 'Preparing...' : 'Export site backup'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-amber-500" />
                      Export Protected Site Backup
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        This backup will include your site's authentication credentials and publishing secrets.
                      </p>
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-sm text-amber-800">
                          <p className="font-medium">Keep this backup secure:</p>
                          <ul className="mt-1 space-y-1 text-xs">
                            <li>• Contains credentials that can access your site</li>
                            <li>• Store in a secure location</li>
                            <li>• Don't share with others</li>
                          </ul>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleExportBackup}>
                      I Understand, Export Backup
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button variant="ghost" onClick={handleExportBackup} className="w-full justify-start gap-2" disabled={isExporting}>
                <Archive className="h-4 w-4" /> 
                {isExporting ? 'Preparing...' : 'Export site backup'}
              </Button>
            )}
        </div>
      </div>
      
      {/* Dialog Components */}
      <CreateCollectionDialog 
        siteId={siteId} 
        open={isCreateCollectionDialogOpen} 
        onOpenChange={setIsCreateCollectionDialogOpen} 
      />
      <CreateTagGroupDialog 
        siteId={siteId} 
        open={isCreateTagGroupDialogOpen} 
        onOpenChange={setIsCreateTagGroupDialogOpen} 
      />
      
      {createPortal(
        <DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }}>
          {activeId ? <DragOverlayItem id={activeId} items={flattenedItems} /> : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}