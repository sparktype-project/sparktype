

import { useState, useEffect, useMemo } from 'react';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement, useReadOnly } from 'platejs/react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Settings, List, Grid, LayoutGrid } from 'lucide-react';
import { getAvailableCollectionLayouts, type CollectionLayoutOption } from '@/core/services/collectionLayout.service';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';
import { getCollections } from '@/core/services/collections.service';
import { useAppStore } from '@/core/state/useAppStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/core/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
interface CollectionViewElementData {
  collection?: string;
  layout?: string; // List layout ID like 'list-view', 'grid-view'
  displayType?: string; // Display partial to use (from item layout)
  maxItems?: number;
  sortBy?: 'date' | 'title' | 'order';
  sortOrder?: 'asc' | 'desc';
  tagFilters?: string[];
}

interface CollectionViewElementProps extends PlateElementProps {
  collections?: Array<{ id: string; name: string }>;
}

export function CollectionViewElement(props: CollectionViewElementProps) {
  const { editor, element, attributes, children, collections = [] } = props;
  const readOnly = useReadOnly();
  const { activeSiteId, getSiteById } = useAppStore();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [availableLayouts, setAvailableLayouts] = useState<CollectionLayoutOption[]>([]);
  const [availableDisplayTypes, setAvailableDisplayTypes] = useState<Array<{
    value: string;
    label: string;
    description?: string;
    isDefault?: boolean;
  }>>([]);
  const [localConfig, setLocalConfig] = useState<CollectionViewElementData>({
    collection: element.collection as string || '',
    layout: element.layout as string || 'list-view',
    displayType: element.displayType as string || '',
    maxItems: element.maxItems as number || 10,
    sortBy: element.sortBy as 'date' | 'title' | 'order' || 'date',
    sortOrder: element.sortOrder as 'asc' | 'desc' || 'desc',
    tagFilters: element.tagFilters as string[] || [],
  });

  // Load available collection layouts
  useEffect(() => {
    async function loadLayouts() {
      if (activeSiteId) {
        const siteData = getSiteById(activeSiteId);
        if (siteData) {
          const layouts = await getAvailableCollectionLayouts(siteData);
          setAvailableLayouts(layouts);

          // Set default layout if none selected
          if (!localConfig.layout && layouts.length > 0) {
            setLocalConfig(prev => ({ ...prev, layout: layouts[0].id }));
          }
        }
      }
    }
    loadLayouts();
  }, [activeSiteId, getSiteById, localConfig.layout]);

  // Load available display types from the collection's item layout
  useEffect(() => {
    async function loadDisplayTypes() {
      if (!activeSiteId || !localConfig.collection) {
        setAvailableDisplayTypes([]);
        return;
      }

      const siteData = getSiteById(activeSiteId);
      if (!siteData) {
        setAvailableDisplayTypes([]);
        return;
      }

      // Get all collections to find the selected one
      const allCollections = getCollections(siteData.manifest);
      const selectedCollection = allCollections.find(c => c.id === localConfig.collection);
      if (!selectedCollection) {
        setAvailableDisplayTypes([]);
        return;
      }

      const itemLayoutId = selectedCollection.defaultItemLayout;
      if (!itemLayoutId) {
        setAvailableDisplayTypes([]);
        return;
      }

      try {
        // Load the item layout manifest
        const itemLayoutManifest = await getLayoutManifest(siteData, itemLayoutId);
        if (!itemLayoutManifest?.partials) {
          setAvailableDisplayTypes([]);
          return;
        }

        // Map partials to display types
        const displayTypes = itemLayoutManifest.partials.map(partial => {
          const pathParts = partial.path.split('/');
          const filename = pathParts[pathParts.length - 1]?.replace('.hbs', '') || '';
          return {
            value: filename,
            label: partial.name,
            description: partial.description,
            isDefault: partial.isDefault
          };
        });

        setAvailableDisplayTypes(displayTypes);

        // Set default display type if none selected
        const defaultType = displayTypes.find(t => t.isDefault) || displayTypes[0];
        if (!localConfig.displayType && defaultType) {
          setLocalConfig(prev => ({ ...prev, displayType: defaultType.value }));
        }
      } catch (error) {
        console.error('[CollectionViewNode] Failed to load item layout partials:', error);
        setAvailableDisplayTypes([]);
      }
    }

    loadDisplayTypes();
  }, [activeSiteId, getSiteById, localConfig.collection, localConfig.displayType]);

  const selectedCollection = useMemo(() => {
    return collections.find(c => c.id === localConfig.collection);
  }, [collections, localConfig.collection]);

  const selectedLayout = useMemo(() => {
    return availableLayouts.find(l => l.id === localConfig.layout);
  }, [availableLayouts, localConfig.layout]);

  // Simple icon mapping based on layout name
  const getLayoutIcon = (layoutName: string) => {
    if (layoutName.includes('grid')) return Grid;
    if (layoutName.includes('list')) return List;
    return LayoutGrid;
  };

  const LayoutIcon = selectedLayout ? getLayoutIcon(selectedLayout.name) : List;

  const handleSaveConfig = () => {
    editor.tf.setNodes(
      {
        collection: localConfig.collection,
        layout: localConfig.layout,
        displayType: localConfig.displayType,
        maxItems: localConfig.maxItems,
        sortBy: localConfig.sortBy,
        sortOrder: localConfig.sortOrder,
        tagFilters: localConfig.tagFilters,
      },
      { at: element }
    );
    setIsEditOpen(false);
  };

  const handleCancel = () => {
    setLocalConfig({
      collection: element.collection as string || '',
      layout: element.layout as string || 'list-view',
      displayType: element.displayType as string || '',
      maxItems: element.maxItems as number || 10,
      sortBy: element.sortBy as 'date' | 'title' | 'order' || 'date',
      sortOrder: element.sortOrder as 'asc' | 'desc' || 'desc',
      tagFilters: element.tagFilters as string[] || [],
    });
    setIsEditOpen(false);
  };

  const previewContent = (
    <Card className="my-4 cursor-pointer hover:bg-muted/50 transition-colors">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutIcon className="h-4 w-4" />
          Collection View
          {!readOnly && (
            <Button variant="ghost" size="sm" className="ml-auto">
              <Settings className="h-3 w-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium">Collection:</span>
            {selectedCollection ? (
              <Badge variant="secondary">{selectedCollection.name}</Badge>
            ) : (
              <Badge variant="destructive">Not selected</Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              <span className="font-medium">Layout:</span> {selectedLayout?.name || localConfig.layout}
            </span>
            <span>
              <span className="font-medium">Max items:</span> {localConfig.maxItems}
            </span>
            <span>
              <span className="font-medium">Sort:</span> {localConfig.sortBy} ({localConfig.sortOrder})
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (readOnly) {
    return (
      <PlateElement
        {...props}
        className="block"
        attributes={{
          ...attributes,
          contentEditable: false,
        }}
      >
        {previewContent}
        {children}
      </PlateElement>
    );
  }

  return (
    <PlateElement
      {...props}
      className="block"
      attributes={{
        ...attributes,
        contentEditable: false,
      }}
    >
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogTrigger asChild>
          <div>{previewContent}</div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configure Collection View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="collection">Collection</Label>
              <Select
                value={localConfig.collection}
                onValueChange={(value) => setLocalConfig(prev => ({ ...prev, collection: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="layout">Layout</Label>
              <Select
                value={localConfig.layout}
                onValueChange={(value) =>
                  setLocalConfig(prev => ({ ...prev, layout: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a layout" />
                </SelectTrigger>
                <SelectContent>
                  {availableLayouts.map((layout) => (
                    <SelectItem key={layout.id} value={layout.id}>
                      {layout.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableDisplayTypes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="displayType">Display Type</Label>
                <Select
                  value={localConfig.displayType}
                  onValueChange={(value) =>
                    setLocalConfig(prev => ({ ...prev, displayType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select display type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDisplayTypes.map((displayType) => (
                      <SelectItem key={displayType.value} value={displayType.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{displayType.label}</span>
                          {displayType.description && (
                            <span className="text-xs text-muted-foreground">{displayType.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Choose how collection items are displayed</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxItems">Max Items</Label>
                <Input
                  id="maxItems"
                  type="number"
                  min="1"
                  max="50"
                  value={localConfig.maxItems}
                  onChange={(e) => setLocalConfig(prev => ({
                    ...prev,
                    maxItems: parseInt(e.target.value) || 10
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Select
                  value={localConfig.sortOrder}
                  onValueChange={(value) =>
                    setLocalConfig(prev => ({ ...prev, sortOrder: value as 'asc' | 'desc' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortBy">Sort By</Label>
              <Select
                value={localConfig.sortBy}
                onValueChange={(value) =>
                  setLocalConfig(prev => ({ ...prev, sortBy: value as 'date' | 'title' | 'order' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="order">Custom Order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSaveConfig}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {children}
    </PlateElement>
  );
}