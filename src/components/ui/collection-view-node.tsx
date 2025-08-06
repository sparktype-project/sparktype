'use client';

import * as React from 'react';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement, useReadOnly } from 'platejs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Settings, List, Grid, LayoutGrid } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/core/components/ui/label';
interface CollectionViewElementData {
  collection?: string;
  layout?: 'list' | 'grid' | 'cards';
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
  
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [localConfig, setLocalConfig] = React.useState<CollectionViewElementData>({
    collection: element.collection as string || '',
    layout: element.layout as 'list' | 'grid' | 'cards' || 'list',
    maxItems: element.maxItems as number || 10,
    sortBy: element.sortBy as 'date' | 'title' | 'order' || 'date',
    sortOrder: element.sortOrder as 'asc' | 'desc' || 'desc',
    tagFilters: element.tagFilters as string[] || [],
  });

  const selectedCollection = React.useMemo(() => {
    return collections.find(c => c.id === localConfig.collection);
  }, [collections, localConfig.collection]);

  const layoutIcons = {
    list: List,
    grid: Grid,
    cards: LayoutGrid,
  };

  const LayoutIcon = layoutIcons[localConfig.layout || 'list'] || List;

  const handleSaveConfig = () => {
    editor.tf.setNodes(
      {
        collection: localConfig.collection,
        layout: localConfig.layout,
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
      layout: element.layout as 'list' | 'grid' | 'cards' || 'list',
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
              <span className="font-medium">Layout:</span> {localConfig.layout}
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
                  setLocalConfig(prev => ({ ...prev, layout: value as 'list' | 'grid' | 'cards' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="cards">Cards</SelectItem>
                </SelectContent>
              </Select>
            </div>

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