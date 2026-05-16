// src/features/editor/components/forms/CollectionConfigForm.tsx

import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { getCollectionContent, getCollections } from '@/core/services/collections.service';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';
import type { LayoutConfig } from '@/core/types';
import { getAppliedTagsForCollection } from '@/core/services/tags.service';

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
import { SimpleMultiSelect, type SimpleMultiSelectOption } from '@/features/editor/components/SimpleMultiSelect';

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

  const collectionTagFilters = useMemo(() => {
    if (!siteData || !selectedCollection) {
      return [];
    }

    const collectionItems = getCollectionContent(siteData, selectedCollection.id);
    return getAppliedTagsForCollection(siteData, selectedCollection.id, collectionItems);
  }, [siteData, selectedCollection]);

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
        <Label htmlFor="collection-select">Data source</Label>
        <Select
          value={layoutConfig?.collectionId || ''}
          onValueChange={(value) => handleConfigChange({ collectionId: value, filterTags: undefined })}
        >
          <SelectTrigger id="collection-select" className="w-full">
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
          <Label htmlFor="display-type-select">Display type</Label>
          <Select
            value={layoutConfig?.displayType || defaultDisplayType}
            onValueChange={(value) => handleConfigChange({ displayType: value })}
          >
            <SelectTrigger id="display-type-select" className="w-full">
              <SelectValue placeholder="Select display type..." />
            </SelectTrigger>
            <SelectContent>
              {availableDisplayTypes.map((displayType: { value: string; label: string; description?: string }) => (
                <SelectItem key={displayType.value} value={displayType.value}>
                  <div className="flex flex-col">
                    <span>{displayType.label}</span>
                   
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
        <Label htmlFor="sort-by">Sort by</Label>
        <Select
          value={layoutConfig?.sortBy || 'date'}
          onValueChange={(value) => handleConfigChange({ sortBy: value as 'date' | 'title' })}
        >
          <SelectTrigger id="sort-by" className="w-full">
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
        <Label htmlFor="sort-order">Sort order</Label>
        <Select
          value={layoutConfig?.sortOrder || 'desc'}
          onValueChange={(value) => handleConfigChange({ sortOrder: value as 'asc' | 'desc' })}
        >
          <SelectTrigger id="sort-order" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Descending</SelectItem>
            <SelectItem value="asc">Ascending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tag Filters */}
      {selectedCollection && (
        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Tag filter</Label>
            <p className="text-xs text-muted-foreground">
              Limit this view to tags already used by items in the selected collection.
            </p>
          </div>

          {collectionTagFilters.length > 0 ? (
            <div className="space-y-4">
              {collectionTagFilters.map(({ tagGroup, tags }) => {
                const options: SimpleMultiSelectOption[] = tags.map((tag) => ({
                  label: tag.name,
                  value: tag.id,
                }));

                const selectedTagsForGroup = (layoutConfig?.filterTags || []).filter((tagId) =>
                  tags.some((tag) => tag.id === tagId),
                );

                return (
                  <div key={tagGroup.id} className="space-y-2">
                    <Label className="text-sm font-medium">{tagGroup.name}</Label>
                    <SimpleMultiSelect
                      options={options}
                      selected={selectedTagsForGroup}
                      onChange={(selectedTagIds) => {
                        const otherSelectedTagIds = (layoutConfig?.filterTags || []).filter((tagId) =>
                          !tags.some((tag) => tag.id === tagId),
                        );
                        handleConfigChange({ filterTags: [...otherSelectedTagIds, ...selectedTagIds] });
                      }}
                      placeholder={`Select ${tagGroup.name.toLowerCase()}...`}
                      className="w-full"
                    />
                    {tagGroup.description && (
                      <p className="text-xs text-muted-foreground">{tagGroup.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
              No applicable tags are currently assigned to items in this collection.
            </div>
          )}
        </div>
      )}

      {/* Pagination Settings */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="enable-pagination" className="cursor-pointer">Enable pagination</Label>
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
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
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
