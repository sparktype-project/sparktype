// src/features/editor/components/forms/ContentTypeSelector.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Label } from "@/core/components/ui/label";
import { useAppStore } from '@/core/state/useAppStore';
import { getAllAvailableLayoutOptions } from '@/core/services/config/configHelpers.service';
import type { LayoutInfo } from '@/core/types';

interface ContentTypeSelectorProps {
  siteId: string;
  selectedType: string;
  onChange: (newTypeId: string) => void;
}

export default function ContentTypeSelector({ siteId, selectedType, onChange }: ContentTypeSelectorProps) {
  const [availableLayouts, setAvailableLayouts] = useState<LayoutInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  // Load available layouts including collection type layouts
  useEffect(() => {
    if (!siteData) return;
    
    const loadLayouts = async () => {
      try {
        setLoading(true);
        const layouts = await getAllAvailableLayoutOptions(siteData);
        setAvailableLayouts(layouts);
      } catch (error) {
        console.error('Failed to load layouts:', error);
        setAvailableLayouts([]);
      } finally {
        setLoading(false);
      }
    };

    loadLayouts();
  }, [siteData]);

  // Group layouts by type
  const groupedLayouts = useMemo(() => {
    const groups: Record<string, LayoutInfo[]> = {};
    
    availableLayouts.forEach(layout => {
      if (layout.type === 'collection') {
        // Group collection layouts by collection type
        const collectionTypeId = (layout as any).collectionTypeId || 'collection';
        const groupName = `${collectionTypeId.charAt(0).toUpperCase() + collectionTypeId.slice(1)} Layouts`;
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(layout);
      } else {
        // Regular page layouts
        if (!groups['Page Layouts']) groups['Page Layouts'] = [];
        groups['Page Layouts'].push(layout);
      }
    });
    
    return groups;
  }, [availableLayouts]);

  const selectedLayout = availableLayouts.find(layout => layout.id === selectedType);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Layout</Label>
        <div className="text-xs text-muted-foreground">Loading layouts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="layout-select">Layout</Label>
      <Select
        value={selectedType || ''}
        onValueChange={onChange}
      >
        <SelectTrigger id="layout-select" className="w-full">
          <SelectValue placeholder="Select a layout..." />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedLayouts).map(([groupName, layouts]) => (
            <SelectGroup key={groupName}>
              <SelectLabel>{groupName}</SelectLabel>
              {layouts.map((layout) => (
                <SelectItem key={layout.id} value={layout.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{layout.name}</span>
                    {layout.type === 'collection' && (
                      <span className="text-xs text-muted-foreground ml-2">
                        Collection
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {selectedLayout?.description && (
        <p className="text-xs text-muted-foreground pt-1">
          {selectedLayout.description}
        </p>
      )}
      {selectedLayout?.type === 'collection' && (
        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border">
          💡 This is a collection layout. You'll need to configure which collection to display.
        </div>
      )}
    </div>
  );
}