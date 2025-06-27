// src/features/editor/components/FrontmatterSidebar.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Manifest, RawFile, StructureNode, ParsedMarkdownFile, MarkdownFrontmatter } from '@/core/types';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import { type LayoutManifest } from '@/core/types';

// UI Component Imports
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/core/components/ui/accordion";
import { Button } from '@/core/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/core/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';

// Form & Sub-component Imports
import ContentTypeSelector from '@/features/editor/components/forms/ContentTypeSelector';
import CollectionSettingsForm from '@/features/editor/components/forms/CollectionSettingsForm';
import PageMetadataForm from '@/features/editor/components/forms/PageMetaDataForm';
import AdvancedSettingsForm from '@/features/editor/components/forms/AdvancedSettingsForm';

interface FrontmatterSidebarProps {
  siteId: string;
  filePath: string;
  manifest: Manifest;
  layoutFiles: RawFile[] | undefined;
  themeFiles: RawFile[] | undefined;
  allContentFiles: ParsedMarkdownFile[];
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (newFrontmatter: Partial<MarkdownFrontmatter>) => void;
  isNewFileMode: boolean;
  slug: string;
  onSlugChange: (newSlug: string) => void;
  onDelete: () => Promise<void>;
}

export default function FrontmatterSidebar({
  siteId, filePath, manifest, layoutFiles, themeFiles, allContentFiles,
  frontmatter, onFrontmatterChange, isNewFileMode, slug, onSlugChange, onDelete,
}: FrontmatterSidebarProps) {

  const [allLayouts, setAllLayouts] = useState<LayoutManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAllLayouts() {
      setIsLoading(true);
      
      const siteDataForAssets = { manifest, layoutFiles, themeFiles };
      const layouts = await getAvailableLayouts(siteDataForAssets);
      setAllLayouts(layouts);
      setIsLoading(false);
    }
    fetchAllLayouts();
    // This effect should only re-run if the core site assets change.
  }, [manifest, layoutFiles, themeFiles]);

  const { isCollectionPage, isCollectionItem, parentFile } = useMemo(() => {
    const isCollection = !!frontmatter.collection;
    if (isCollection) return { isCollectionPage: true, isCollectionItem: false, parentFile: null };
    
    // For new files, check if the parent directory is a collection
    if (isNewFileMode) {
      const parentPath = `${filePath}.md`; // Convert parent dir to collection page path
      const pFile = allContentFiles.find(f => f.path === parentPath);
      if (pFile?.frontmatter.collection) {
        return { isCollectionPage: false, isCollectionItem: true, parentFile: pFile };
      }
    } else {
      // For existing files, check if this file is a child of a collection page by searching the structure
      function findParentCollection(nodes: StructureNode[], targetPath: string): string | null {
        for (const node of nodes) {
          if (node.children) {
            // Check if targetPath is in this node's children
            const isChild = node.children.some(child => child.path === targetPath);
            if (isChild) {
              return node.path;
            }
            // Recursively search in children
            const found = findParentCollection(node.children, targetPath);
            if (found) return found;
          }
        }
        return null;
      }
      
      const parentPath = findParentCollection(manifest.structure, filePath);
      if (parentPath) {
        const pFile = allContentFiles.find(f => f.path === parentPath);
        if (pFile?.frontmatter.collection) {
          return { isCollectionPage: false, isCollectionItem: true, parentFile: pFile };
        }
      }
    }
    
    return { isCollectionPage: false, isCollectionItem: false, parentFile: null };
  }, [frontmatter.collection, manifest.structure, allContentFiles, filePath, isNewFileMode]);

  const currentLayoutManifest = useMemo(() => {
    if (!frontmatter.layout) return null;
    return allLayouts.find(l => l.id === frontmatter.layout) ?? null;
  }, [allLayouts, frontmatter.layout]);

  const parentLayoutManifest = useMemo(() => {
    if (!isCollectionItem || !parentFile?.frontmatter.layout) return null;
    return allLayouts.find(l => l.id === parentFile.frontmatter.layout) ?? null;
  }, [allLayouts, isCollectionItem, parentFile]);

  const availableContentTypes = useMemo(() => {
    const requiredType = isCollectionPage ? 'collection' : 'page';
    const filtered = allLayouts.filter(layout => layout.layoutType === requiredType);

    // De-duplicate by id to prevent React key warnings
    const unique = Array.from(new Map(filtered.map(item => [item.id, item])).values());
    return unique;
    
  }, [allLayouts, isCollectionPage]);

  const handleContentTypeChange = useCallback((newLayoutId: string) => {
    onFrontmatterChange({ layout: newLayoutId });
  }, [onFrontmatterChange]);

  // FIX #2: Add a loading guard to prevent rendering with incomplete data.
  // This ensures `currentLayoutManifest` is populated before children render.
  if (isLoading || !frontmatter) {
    return <div className="p-4 text-sm text-center text-muted-foreground">Loading settings...</div>;
  }

  const defaultOpenSections = ['content-type', 'metadata', 'advanced'];
  if (isCollectionPage) {
    defaultOpenSections.push('list-settings');
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-grow overflow-y-auto p-3">
        <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">
          
          {!isCollectionItem && (
            <AccordionItem value="content-type">
              <AccordionTrigger>Content Type</AccordionTrigger>
              <AccordionContent className="pt-4">
                <ContentTypeSelector
                  availableTypes={availableContentTypes}
                  selectedType={frontmatter.layout || (isCollectionPage ? 'blog' : 'page')}
                  onChange={handleContentTypeChange}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {isCollectionPage && (
            <AccordionItem value="list-settings">
              <AccordionTrigger>List Settings</AccordionTrigger>
              <AccordionContent className="pt-4">
                <CollectionSettingsForm
                  frontmatter={frontmatter}
                  onFrontmatterChange={onFrontmatterChange}
                  layoutManifest={currentLayoutManifest}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="metadata">
            <AccordionTrigger>Metadata</AccordionTrigger>
            <AccordionContent className="pt-4">
              <PageMetadataForm
                siteId={siteId}
                frontmatter={frontmatter}
                onFrontmatterChange={onFrontmatterChange}
                layoutManifest={isCollectionItem ? parentLayoutManifest : currentLayoutManifest}
                isCollectionItem={isCollectionItem}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="advanced">
            <AccordionTrigger>Advanced</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <AdvancedSettingsForm
                slug={slug}
                onSlugChange={onSlugChange}
                isNewFileMode={isNewFileMode}
              />
              {!isNewFileMode && (
                <div className="pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete page
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