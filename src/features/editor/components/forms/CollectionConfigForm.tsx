// src/features/editor/components/forms/CollectionConfigForm.tsx

import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollections } from '@/core/services/collections.service';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';
import type { LayoutConfig, LayoutManifest } from '@/core/types';

// UI Components
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/core/components/ui/select';
import { Switch } from '@/core/components/ui/switch';
import { Input } from '@/core/components/ui/input';

interface CollectionConfigFormProps {
  siteId: string;
  layoutConfig?: LayoutConfig;
  onLayoutConfigChange: (config: LayoutConfig) => void;
}

/**
 * A form for configuring how a page displays a collection.
 * It renders when the user selects a Layout with `layoutType: 'list'`.
 * Its state is saved to the `layoutConfig` object in the page's frontmatter.
 * Display types are loaded from the collection's item layout, not the list layout.
 */
export default function CollectionConfigForm({
  siteId,
  layoutConfig,
  onLayoutConfigChange
}: CollectionConfigFormProps) {

  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  const [availableDisplayTypes, setAvailableDisplayTypes] = useState<Array<{
    value: string;
    label: string;
    description?: string;
    isDefault?: boolean;
  }>>([]);

  // Get all available collections for the site.
  const collections = useMemo(() => {
    if (!siteData) return [];
    return getCollections(siteData.manifest);
  }, [siteData]);

  // Get the selected collection
  const selectedCollection = useMemo(() => {
    if (!layoutConfig?.collectionId) return null;
    return collections.find(c => c.id === layoutConfig.collectionId);
  }, [collections, layoutConfig?.collectionId]);

  // Load available display types from the collection's item layout
  useEffect(() => {
    async function loadDisplayTypes() {
      if (!selectedCollection || !siteData) {
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
      } catch (error) {
        console.error('[CollectionConfigForm] Failed to load item layout partials:', error);
        setAvailableDisplayTypes([]);
      }
    }

    loadDisplayTypes();
  }, [selectedCollection, siteData]);

  // Get the default display type
  const defaultDisplayType = useMemo(() => {
    const defaultPartial = availableDisplayTypes.find(type => type.isDefault);
    return defaultPartial?.value || availableDisplayTypes[0]?.value || '';
  }, [availableDisplayTypes]);

  // A generic handler to update the layoutConfig state.
  const handleConfigChange = (updates: Partial<LayoutConfig>) => {
    const newConfig: LayoutConfig = {
      collectionId: layoutConfig?.collectionId || '',
      layout: layoutConfig?.layout || '',
      ...layoutConfig,
      ...updates
    };
    onLayoutConfigChange(newConfig);
  };


  return (
    <div className="space-y-4">
      {/* Collection Data Source Selection */}
      <div className="space-y-2">
        <Label htmlFor="collection-select">Data Source</Label>
        <Select
          value={layoutConfig?.collectionId || ''}
          onValueChange={(value) => handleConfigChange({ collectionId: value })}
        >
          <SelectTrigger id="collection-select">
            <SelectValue placeholder="Select a collection to display..." />
          </SelectTrigger>
          <SelectContent>
            {collections.map((collection) => (
              <SelectItem key={collection.id} value={collection.id}>
                {collection.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Choose which collection's items to show on this page.</p>
      </div>

      {/* Display Type Selection */}
      {availableDisplayTypes.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="display-type-select">Display Type</Label>
          <Select
            value={layoutConfig?.displayType || defaultDisplayType}
            onValueChange={(value) => handleConfigChange({ displayType: value })}
          >
            <SelectTrigger id="display-type-select">
              <SelectValue placeholder="Select display type..." />
            </SelectTrigger>
            <SelectContent>
              {availableDisplayTypes.map((displayType: { value: string; label: string; description?: string }) => (
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
          <p className="text-xs text-muted-foreground">Choose how collection items are displayed on the page.</p>
        </div>
      )}


      {/* Sorting Options */}
      <div className="space-y-2">
        <Label htmlFor="sort-by">Sort By</Label>
        <Select
          value={layoutConfig?.sortBy || 'date'}
          onValueChange={(value) => handleConfigChange({ sortBy: value as 'date' | 'title' })}
        >
          <SelectTrigger id="sort-by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort Order */}
      <div className="space-y-2">
        <Label htmlFor="sort-order">Sort Order</Label>
        <Select
          value={layoutConfig?.sortOrder || 'desc'}
          onValueChange={(value) => handleConfigChange({ sortOrder: value as 'asc' | 'desc' })}
        >
          <SelectTrigger id="sort-order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Descending</SelectItem>
            <SelectItem value="asc">Ascending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pagination Settings */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="enable-pagination" className="cursor-pointer">Enable Pagination</Label>
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
          <div className="space-y-2 pl-2 border-l-2">
            <Label htmlFor="items-per-page">Items per page</Label>
            <Input
              id="items-per-page"
              type="number"
              min="1"
              max="100"
              value={layoutConfig.pagination?.itemsPerPage || 10}
              onChange={(e) =>
                handleConfigChange({
                  pagination: {
                    enabled: true,
                    itemsPerPage: parseInt(e.target.value, 10) || 10
                  }
                })
              }
              className="w-24"
            />
          </div>
        )}
      </div>
    </div>
  );
}