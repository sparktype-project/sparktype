// src/features/editor/components/forms/CollectionCollectionSettingsForm.tsx (FIXED)
'use client';

import { useCallback } from 'react';
import type { MarkdownFrontmatter, CollectionConfig, DisplayOption, DisplayOptionChoice, LayoutManifest } from '@/core/types';

// UI Component Imports
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Input } from '@/core/components/ui/input';

// Strongly-typed props for the helper component.
interface StyleSelectorProps {
  optionKey: keyof CollectionConfig;
  optionConfig: DisplayOption | undefined;
  currentValue: string | undefined;
  // The value from a Select is always a string.
  onChange: (key: keyof CollectionConfig, value: string) => void;
}

/**
 * A reusable helper component to render a single dynamic style selector dropdown.
 */
const StyleSelector = ({ optionKey, optionConfig, currentValue, onChange }: StyleSelectorProps) => {
  if (!optionConfig) {
    return null;
  }
  
  return (
    <div className="space-y-2">
      <Label htmlFor={`style-select-${optionKey}`}>{optionConfig.name}</Label>
      <Select
        value={currentValue || optionConfig.default}
        onValueChange={(value) => onChange(optionKey, value)}
      >
        <SelectTrigger id={`style-select-${optionKey}`}>
          <SelectValue placeholder={optionConfig.description || 'Select a style...'} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(optionConfig.options).map(([key, choice]: [string, DisplayOptionChoice]) => (
            <SelectItem key={key} value={key}>{choice.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {optionConfig.description && (
        <p className="text-xs text-muted-foreground">{optionConfig.description}</p>
      )}
    </div>
  );
};


interface CollectionSettingsFormProps {
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
  layoutManifest: LayoutManifest | null;
}

export default function CollectionSettingsForm({
  frontmatter,
  onFrontmatterChange,
  layoutManifest,
}: CollectionSettingsFormProps) {

  const handleCollectionConfigChange = useCallback((key: keyof CollectionConfig, value: string | number | undefined) => {
    const currentConfig = frontmatter.collection || {};
    let updatedConfig: CollectionConfig;

    if (value === undefined || value === '') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
      const { [key as any]: _, ...rest } = currentConfig;
      updatedConfig = rest;
    } else {
      updatedConfig = { ...currentConfig, [key]: value };
    }

    onFrontmatterChange({
      collection: updatedConfig
    });
  }, [frontmatter.collection, onFrontmatterChange]);
  
  if (!frontmatter.collection) {
    return (
      <div className="text-sm text-center text-muted-foreground p-4 border border-dashed rounded-md">
        <p>This page is not configured as a collection.</p>
      </div>
    );
  }

  const collectionConfig = frontmatter.collection;
  const displayOptions = layoutManifest?.display_options;

  return (
    <div className="space-y-8">
      {/* Section 1: List Settings */}
      <div className="space-y-4">
        <h4 className="font-semibold text-sm text-foreground">List Settings</h4>
        
        <StyleSelector
          optionKey="listingStyle"
          optionConfig={displayOptions?.listingStyle}
          // FIX 2: Use a type assertion to satisfy the prop type.
          currentValue={collectionConfig.listingStyle as string | undefined}
          onChange={handleCollectionConfigChange}
        />
        
        <StyleSelector
          optionKey="teaserStyle"
          optionConfig={displayOptions?.teaserStyle}
          // FIX 3: Use a type assertion here as well.
          currentValue={collectionConfig.teaserStyle as string | undefined}
          onChange={handleCollectionConfigChange}
        />

        <div className="space-y-2 pt-2">
          <Label htmlFor="sort-by">Sort by</Label>
          <Select value={collectionConfig.sort_by || 'date'} onValueChange={(v) => handleCollectionConfigChange('sort_by', v)}>
            <SelectTrigger id="sort-by"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Publication Date</SelectItem>
              <SelectItem value="title">Title (Alphabetical)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="sort-order">Sort order</Label>
          <Select value={collectionConfig.sort_order || 'desc'} onValueChange={(v) => handleCollectionConfigChange('sort_order', v)}>
            <SelectTrigger id="sort-order"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="items-per-page">Items Per Page</Label>
          <Input
            id="items-per-page"
            type="number"
            min="1"
            placeholder="e.g., 10"
            value={collectionConfig.items_per_page || ''}
            onChange={(e) => handleCollectionConfigChange('items_per_page', e.target.value ? parseInt(e.target.value, 10) : undefined)}
          />
          <p className="text-xs text-muted-foreground">Leave blank to show all items on one page.</p>
        </div>
      </div>

      {/* Section 2: Item Settings */}
      <div className="space-y-4 pt-6 border-t">
        <h4 className="font-semibold text-sm text-foreground">Item Settings</h4>
        
        <StyleSelector
          optionKey="itemPageLayout"
          optionConfig={displayOptions?.itemPageLayout}
          // FIX 4: And the final type assertion here.
          currentValue={collectionConfig.itemPageLayout as string | undefined}
          onChange={handleCollectionConfigChange}
        />
      </div>
    </div>
  );
}