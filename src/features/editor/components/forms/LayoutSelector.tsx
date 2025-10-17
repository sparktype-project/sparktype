// src/features/editor/components/forms/LayoutSelector.tsx

import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Label } from "@/core/components/ui/label";
import { useAppStore } from '@/core/state/useAppStore';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import type { LayoutManifest } from '@/core/types';

interface LayoutSelectorProps {
  siteId: string;
  selectedLayoutId: string;
  onChange: (newLayoutId: string) => void;
  filterByType?: 'page' | 'list' | 'item';
}

/**
 * A UI component for selecting a Layout for the current page.
 * It fetches all available layouts (both 'single' and 'collection' types)
 * and groups them in the dropdown for a better user experience.
 */
export default function LayoutSelector({ siteId, selectedLayoutId, onChange, filterByType }: LayoutSelectorProps) {
  const [availableLayouts, setAvailableLayouts] = useState<LayoutManifest[]>([]);
  const [loading, setLoading] = useState(true);

  const getSiteById = useAppStore(state => state.getSiteById);
  const siteData = getSiteById(siteId);

  // Load all available layouts when the component mounts or siteData changes.
  useEffect(() => {
    if (!siteData) return;

    const loadLayouts = async () => {
      try {
        setLoading(true);
        // Fetches all layouts, regardless of type.
        const layouts = await getAvailableLayouts(siteData);
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

  // Filter layouts by layoutType if specified
  const filteredLayouts = useMemo(() => {
    if (!filterByType) return availableLayouts;

    return availableLayouts.filter(layout => {
      return layout.layoutType === filterByType;
    });
  }, [availableLayouts, filterByType]);

  // Group layouts for display in the Select component.
  const groupedLayouts = useMemo(() => {
    const groups: Record<string, LayoutManifest[]> = {};
    filteredLayouts.forEach(layout => {
      const groupName = (layout as any).group ||
        (layout.layoutType === 'list' ? 'List Layouts' :
         layout.layoutType === 'item' ? 'Item Layouts' :
         'Page Layouts');
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(layout);
    });
    return groups;
  }, [filteredLayouts]);

  const selectedLayout = availableLayouts.find(layout => layout.id === selectedLayoutId);

  if (loading) {
    return <div className="text-xs text-muted-foreground">Loading layouts...</div>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="layout-select">Layout</Label>
      <Select
        value={selectedLayoutId || ''}
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
                  {layout.name}
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
    </div>
  );
}