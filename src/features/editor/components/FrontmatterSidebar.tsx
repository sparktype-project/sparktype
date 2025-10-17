// src/features/editor/components/FrontmatterSidebar.tsx

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Manifest, RawFile, MarkdownFrontmatter, LayoutConfig } from '@/core/types';
import { type CollectionContext } from '@/core/services/collectionContext.service';
import { useAppStore } from '@/core/state/useAppStore';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import { type LayoutManifest } from '@/core/types';

// UI Component Imports
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/core/components/ui/accordion";
import { Button } from '@/core/components/ui/button';
import { Switch } from '@/core/components/ui/switch';
import { Label } from '@/core/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/core/components/ui/alert-dialog";
import { Trash2, Home } from 'lucide-react';

// Form & Sub-component Imports
import LayoutSelector from '@/features/editor/components/forms/LayoutSelector';
import CollectionConfigForm from '@/features/editor/components/forms/CollectionConfigForm';
// CORRECTED: The import casing now exactly matches the actual filename 'PageMetaDataForm.tsx'.
import PageMetadataForm from '@/features/editor/components/forms/PageMetaDataForm';
import AdvancedSettingsForm from '@/features/editor/components/forms/AdvancedSettingsForm';
import { MultiTagSelector } from '@/features/editor/components/TagSelector';

interface FrontmatterSidebarProps {
  siteId: string;
  filePath: string;
  manifest: Manifest;
  layoutFiles: RawFile[] | undefined;
  themeFiles: RawFile[] | undefined;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: Partial<MarkdownFrontmatter>) => void;
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
  onDelete: () => Promise<void>;
  collectionContext: CollectionContext;
}

/**
 * The main sidebar component for editing a page's metadata (frontmatter).
 * It orchestrates various sub-forms based on the selected Layout and the
 * page's role within the site structure (e.g., standard page vs. collection item).
 */
export default function FrontmatterSidebar({
  siteId, filePath, manifest, layoutFiles, themeFiles,
  frontmatter, onFrontmatterChange, isNewFileMode, slug, onSlugChange, onDelete, collectionContext
}: FrontmatterSidebarProps) {

  const setAsHomepage = useAppStore(state => state.setAsHomepage);
  const [allLayouts, setAllLayouts] = useState<LayoutManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Homepage state - read directly from store for reactivity
  const currentFile = useAppStore(useCallback((state) => {
    const site = state.getSiteById(siteId);
    return site?.contentFiles?.find(f => f.path === filePath);
  }, [siteId, filePath]));

  const isHomepage = currentFile?.frontmatter?.homepage === true;

  // Handle homepage toggle
  const handleHomepageToggle = useCallback(async (checked: boolean) => {
    if (checked && !isHomepage) {
      try {
        await setAsHomepage(siteId, filePath);
      } catch (error) {
        console.error('Failed to set as homepage:', error);
      }
    }
    // Note: We don't handle unchecking because there must always be a homepage
  }, [setAsHomepage, siteId, filePath, isHomepage]);

  useEffect(() => {
    async function fetchAllLayouts() {
      setIsLoading(true);
      const siteDataForAssets = { siteId, manifest, layoutFiles, themeFiles };
      const layouts = await getAvailableLayouts(siteDataForAssets);
      setAllLayouts(layouts);
      setIsLoading(false);
    }
    fetchAllLayouts();
  }, [manifest, layoutFiles, themeFiles]);

  // Use the collection context passed from the parent component
  const isCollectionItem = collectionContext.isCollectionItem;
  const parentCollection = collectionContext.collection || null;

  const currentLayoutManifest = useMemo(() => {
    if (!frontmatter.layout) return null;
    return allLayouts.find(l => l.id === frontmatter.layout) ?? null;
  }, [allLayouts, frontmatter.layout]);

  // Display collection toggle state - determines if this page shows collection content
  const isDisplayingCollection = useMemo(() => {
    return currentLayoutManifest?.layoutType === 'list';
  }, [currentLayoutManifest]);

  // If this is a collection item, get its layout manifest
  const itemLayoutManifest = useMemo(() => {
    if (!isCollectionItem || !parentCollection) return null;
    return allLayouts.find(l => l.id === parentCollection.defaultItemLayout) ?? null;
  }, [allLayouts, isCollectionItem, parentCollection]);

  const handleDisplayCollectionToggle = useCallback((checked: boolean) => {
    if (checked) {
      // Switching to list mode - select first available list layout
      const listLayout = allLayouts.find(l => l.layoutType === 'list');
      if (listLayout) {
        onFrontmatterChange({ layout: listLayout.id, layoutConfig: undefined });
      }
    } else {
      // Switching to page mode - select first available page layout
      const pageLayout = allLayouts.find(l => l.layoutType === 'page');
      if (pageLayout) {
        onFrontmatterChange({ layout: pageLayout.id, layoutConfig: undefined });
      }
    }
  }, [allLayouts, onFrontmatterChange]);

  const handleLayoutChange = useCallback((newLayoutId: string) => {
    const selectedLayout = allLayouts.find(l => l.id === newLayoutId);
    if (!selectedLayout) return;

    // When layout changes, reset layoutConfig if the new layout is not a list type.
    const newFrontmatter: Partial<MarkdownFrontmatter> = { layout: newLayoutId };
    if (selectedLayout.layoutType !== 'list') {
      newFrontmatter.layoutConfig = undefined;
    }
    onFrontmatterChange(newFrontmatter);
  }, [onFrontmatterChange, allLayouts]);

  const handleLayoutConfigChange = useCallback((newConfig: LayoutConfig) => {
    onFrontmatterChange({ layoutConfig: newConfig });
  }, [onFrontmatterChange]);

  const handleTagsChange = useCallback((groupId: string, tagIds: string[]) => {
    const currentTags = frontmatter.tags || {};
    const newTags = { ...currentTags };

    if (tagIds.length === 0) {
      // Remove the group if no tags selected
      delete newTags[groupId];
    } else {
      newTags[groupId] = tagIds;
    }

    // If no tag groups left, remove the entire tags property
    const hasAnyTags = Object.keys(newTags).length > 0;
    onFrontmatterChange({
      tags: hasAnyTags ? newTags : undefined
    });
  }, [frontmatter.tags, onFrontmatterChange]);

  if (isLoading || !frontmatter) {
    return <div className="p-4 text-sm text-center text-muted-foreground">Loading settings...</div>;
  }

  const defaultOpenSections = ['layout', 'metadata', 'advanced'];
  if (currentLayoutManifest?.layoutType === 'list') {
    defaultOpenSections.push('collection-config');
  }
  if (isCollectionItem && parentCollection) {
    defaultOpenSections.push('tags');
  }

  return (
    <div className="h-full flex flex-col">


      <div className="flex-grow overflow-y-auto">
        <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">

          {/* Layout Selector - Hidden for collection items as their layout is fixed. */}
          {!isCollectionItem && (
            <AccordionItem value="layout">
              <AccordionTrigger>Layout</AccordionTrigger>
              <AccordionContent className='p-2 space-y-4'>
                {/* Display Collection Toggle */}
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="display-collection-toggle" className="text-sm font-medium">
                      Display collection
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isDisplayingCollection
                        ? "This page displays a collection of items"
                        : "This page displays standalone content"
                      }
                    </p>
                  </div>
                  <Switch
                    id="display-collection-toggle"
                    checked={isDisplayingCollection}
                    onCheckedChange={handleDisplayCollectionToggle}
                  />
                </div>

                {/* Layout Selector - filtered by mode */}
                <LayoutSelector
                  siteId={siteId}
                  selectedLayoutId={frontmatter.layout || ''}
                  onChange={handleLayoutChange}
                  filterByType={isDisplayingCollection ? 'collection' : 'page'}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Collection Configuration - Shown only when displaying collection */}
          {isDisplayingCollection && (
            <AccordionItem value="collection-config">
              <AccordionTrigger>Collection display</AccordionTrigger>
              <AccordionContent className='p-2'>
                <CollectionConfigForm
                  siteId={siteId}
                  layoutConfig={frontmatter.layoutConfig}
                  onLayoutConfigChange={handleLayoutConfigChange}
                  currentLayout={currentLayoutManifest || undefined}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Metadata Form - Uses the layout's schema regardless of context */}
          <AccordionItem value="metadata">
            <AccordionTrigger>Metadata</AccordionTrigger>
            <AccordionContent className='p-2'>
              <PageMetadataForm
                siteId={siteId}
                frontmatter={frontmatter}
                onFrontmatterChange={onFrontmatterChange}
                // If it's an item, use the parent's item layout. Otherwise, use its own layout.
                layoutManifest={isCollectionItem ? itemLayoutManifest : currentLayoutManifest}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Tags - Shown only for collection items */}
          {isCollectionItem && parentCollection && (
            <AccordionItem value="tags">
              <AccordionTrigger>Tags</AccordionTrigger>
              <AccordionContent className='p-2'>
                <MultiTagSelector
                  siteId={siteId}
                  collectionId={parentCollection.id}
                  contentTags={frontmatter.tags || {}}
                  onTagsChange={handleTagsChange}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Advanced Settings (Slug, Delete) */}
          <AccordionItem value="advanced">
            <AccordionTrigger>Advanced</AccordionTrigger>
            <AccordionContent className="space-y-4 p-2 pb-0">
              <AdvancedSettingsForm
                slug={slug}
                onSlugChange={onSlugChange}
                isNewFileMode={isNewFileMode}
              />

              {/* Homepage Toggle - Only for pages, not collection items */}
              {!isNewFileMode && !isCollectionItem && (
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="homepage-toggle"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Home className="h-4 w-4" />
                      Set as homepage
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isHomepage
                        ? "This page is currently the site homepage"
                        : "Make this page the homepage for your site"
                      }
                    </p>
                  </div>
                  <Switch
                    id="homepage-toggle"
                    checked={isHomepage}
                    onCheckedChange={handleHomepageToggle}
                    disabled={isHomepage} // Prevent unchecking current homepage
                  />
                </div>
              )}

              {!isNewFileMode && (
                <div className="pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete Page
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete this page and cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">Delete Page</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </div>
  );
}