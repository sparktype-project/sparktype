'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollections } from '@/core/services/collections.service';
import { getCollectionTypeManifest } from '@/core/services/collectionTypes.service';
import { isCollectionTypeLayout } from '@/core/services/config/configHelpers.service';
import type { LayoutConfig, CollectionTypeManifest } from '@/core/types';

// UI Components
import { Label } from '@/core/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/core/components/ui/select';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Switch } from '@/core/components/ui/switch';
import { Badge } from '@/core/components/ui/badge';
import { CollectionErrorBoundary } from '../ErrorBoundary';

interface CollectionLayoutFormProps {
  siteId: string;
  selectedLayout: string;
  layoutConfig?: LayoutConfig;
  onLayoutConfigChange: (config: LayoutConfig) => void;
}

export default function CollectionLayoutForm({ 
  siteId, 
  selectedLayout, 
  layoutConfig, 
  onLayoutConfigChange 
}: CollectionLayoutFormProps) {
  const [collectionTypeManifest, setCollectionTypeManifest] = useState<CollectionTypeManifest | null>(null);
  const [loading, setLoading] = useState(true);

  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  // Get available collections
  const collections = useMemo(() => {
    if (!siteData) return [];
    return getCollections(siteData.manifest);
  }, [siteData]);

  // Parse layout info from selectedLayout
  const { collectionTypeId, layoutId } = useMemo(() => {
    if (!isCollectionTypeLayout(selectedLayout)) {
      return { collectionTypeId: null, layoutId: null };
    }
    const [typeId, layout] = selectedLayout.split('.');
    return { collectionTypeId: typeId, layoutId: layout };
  }, [selectedLayout]);

  // Load collection type manifest
  useEffect(() => {
    if (!collectionTypeId) {
      setCollectionTypeManifest(null);
      setLoading(false);
      return;
    }

    const loadManifest = async () => {
      try {
        setLoading(true);
        const manifest = await getCollectionTypeManifest(collectionTypeId);
        setCollectionTypeManifest(manifest);
      } catch (error) {
        console.error('Failed to load collection type manifest:', error);
        setCollectionTypeManifest(null);
      } finally {
        setLoading(false);
      }
    };

    loadManifest();
  }, [collectionTypeId]);

  // Get current layout definition
  const currentLayoutDef = useMemo(() => {
    if (!collectionTypeManifest || !layoutId) return null;
    return collectionTypeManifest.layouts[layoutId] || null;
  }, [collectionTypeManifest, layoutId]);

  // Filter collections by type
  const availableCollections = useMemo(() => {
    if (!collectionTypeId) return [];
    return collections.filter(collection => collection.typeId === collectionTypeId);
  }, [collections, collectionTypeId]);

  const handleConfigChange = (updates: Partial<LayoutConfig>) => {
    const newConfig: LayoutConfig = {
      collectionId: layoutConfig?.collectionId || '',
      layout: selectedLayout,
      ...layoutConfig,
      ...updates
    };
    onLayoutConfigChange(newConfig);
  };

  if (!isCollectionTypeLayout(selectedLayout)) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">Loading collection configuration...</div>
      </div>
    );
  }

  if (!collectionTypeManifest || !currentLayoutDef) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-red-600">
          Failed to load collection type configuration.
        </div>
      </div>
    );
  }

  return (
    <CollectionErrorBoundary>
      <div className="space-y-4">
      {/* Collection Selection */}
      <div className="space-y-2">
        <Label htmlFor="collection-select">Collection</Label>
        <Select
          value={layoutConfig?.collectionId || ''}
          onValueChange={(value) => handleConfigChange({ collectionId: value })}
        >
          <SelectTrigger id="collection-select">
            <SelectValue placeholder="Select a collection..." />
          </SelectTrigger>
          <SelectContent>
            {availableCollections.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No {collectionTypeId} collections available.
                <br />
                Create one in the Collections panel below.
              </div>
            ) : (
              availableCollections.map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{collection.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {collection.contentPath}
                    </span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {layoutConfig?.collectionId && (
          <div className="text-xs text-muted-foreground">
            Using collection: {collections.find(c => c.id === layoutConfig.collectionId)?.name}
          </div>
        )}
      </div>

      {/* Layout Info */}
      <div className="space-y-2">
        <Label>Layout Details</Label>
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{currentLayoutDef.name}</span>
            <Badge variant="outline" className="text-xs">
              {collectionTypeId}
            </Badge>
          </div>
          {currentLayoutDef.description && (
            <p className="text-muted-foreground text-xs">
              {currentLayoutDef.description}
            </p>
          )}
        </div>
      </div>

      {/* Pagination Settings */}
      {currentLayoutDef.supportsPagination && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-pagination">Enable Pagination</Label>
            <Switch
              id="enable-pagination"
              checked={layoutConfig?.pagination?.enabled || false}
              onCheckedChange={(enabled) => 
                handleConfigChange({ 
                  pagination: { 
                    ...layoutConfig?.pagination, 
                    enabled,
                    itemsPerPage: enabled ? (layoutConfig?.pagination?.itemsPerPage || 10) : undefined
                  }
                })
              }
            />
          </div>
          
          {layoutConfig?.pagination?.enabled && (
            <div className="space-y-2">
              <Label htmlFor="items-per-page">Items per page</Label>
              <Input
                id="items-per-page"
                type="number"
                min="1"
                max="50"
                value={layoutConfig.pagination?.itemsPerPage || 10}
                onChange={(e) => 
                  handleConfigChange({ 
                    pagination: { 
                      enabled: layoutConfig?.pagination?.enabled || false,
                      ...layoutConfig?.pagination, 
                      itemsPerPage: parseInt(e.target.value) || 10 
                    }
                  })
                }
                className="w-20"
              />
            </div>
          )}
        </div>
      )}

      {/* Max Items Setting */}
      {currentLayoutDef.maxItems && (
        <div className="space-y-2">
          <Label htmlFor="max-items">Maximum Items</Label>
          <Input
            id="max-items"
            type="number"
            min="1"
            max={currentLayoutDef.maxItems}
            value={layoutConfig?.maxItems || currentLayoutDef.maxItems}
            onChange={(e) => 
              handleConfigChange({ maxItems: parseInt(e.target.value) || currentLayoutDef.maxItems })
            }
            className="w-20"
          />
          <div className="text-xs text-muted-foreground">
            Maximum: {currentLayoutDef.maxItems}
          </div>
        </div>
      )}

      {/* Sorting Options */}
      <div className="space-y-2">
        <Label htmlFor="sort-by">Sort By</Label>
        <Select
          value={layoutConfig?.sortBy || 'date'}
          onValueChange={(value) => handleConfigChange({ sortBy: value as any })}
        >
          <SelectTrigger id="sort-by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date (newest first)</SelectItem>
            <SelectItem value="date-asc">Date (oldest first)</SelectItem>
            <SelectItem value="title">Title (A-Z)</SelectItem>
            <SelectItem value="title-desc">Title (Z-A)</SelectItem>
            <SelectItem value="manual">Manual order</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filter Options */}
      <div className="space-y-2">
        <Label htmlFor="filter-tags">Filter by tags (comma-separated)</Label>
        <Input
          id="filter-tags"
          placeholder="tag1, tag2, tag3"
          value={layoutConfig?.filterTags?.join(', ') || ''}
          onChange={(e) => {
            const tags = e.target.value
              .split(',')
              .map(tag => tag.trim())
              .filter(tag => tag.length > 0);
            handleConfigChange({ filterTags: tags.length > 0 ? tags : undefined });
          }}
        />
      </div>

      {/* Custom Template Variables */}
      {layoutConfig?.templateVariables && Object.keys(layoutConfig.templateVariables).length > 0 && (
        <div className="space-y-2">
          <Label>Custom Variables</Label>
          <Textarea
            value={JSON.stringify(layoutConfig.templateVariables, null, 2)}
            onChange={(e) => {
              try {
                const vars = JSON.parse(e.target.value);
                handleConfigChange({ templateVariables: vars });
              } catch (error) {
                // Invalid JSON, ignore
              }
            }}
            className="font-mono text-xs"
            rows={4}
          />
          <div className="text-xs text-muted-foreground">
            JSON object for template variables
          </div>
        </div>
      )}
      </div>
    </CollectionErrorBoundary>
  );
}