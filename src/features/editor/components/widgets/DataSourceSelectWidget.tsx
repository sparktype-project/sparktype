// src/features/editor/components/DataSourceSelectWidget.tsx


import { useEffect, useState, useMemo } from 'react';
import { getAvailableLayouts } from '@/core/services/config/configHelpers.service';
import type { WidgetProps } from '@rjsf/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Label } from '@/core/components/ui/label';
import type { LocalSiteData, StructureNode, LayoutManifest } from '@/core/types';

interface SelectOption {
  label: string;
  value: string;
}

interface DataSourceSelectWidgetProps extends WidgetProps {
  formContext?: {
    site?: LocalSiteData;
  };
}

const DataSourceSelectWidget = ({ id, label, options, value, onChange, required, formContext }: DataSourceSelectWidgetProps) => {
  const { uiSchema } = options;
  const site = formContext?.site;

  const dataSource = uiSchema?.['ui:dataSource'] as string;
  const layoutTypeFilter = uiSchema?.['ui:layoutType'] as string | undefined;

  const [items, setItems] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      // Add a more robust guard clause
      if (!site || !site.manifest || !site.contentFiles) {
        setItems([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      let fetchedItems: SelectOption[] = [];

      try {
        switch (dataSource) {
          case 'collections':
            // 1. Find all content files that ARE collection pages.
            const collectionFilePaths = new Set(
              site.contentFiles
                .filter(f => !!f.frontmatter.collection)
                .map(f => f.path)
            );
            // 2. Filter the structure nodes to only include those whose paths are in our set.
            fetchedItems = site.manifest.structure
              .filter((n: StructureNode) => collectionFilePaths.has(n.path))
              .map((c: StructureNode) => ({ label: c.title, value: c.slug }));
            break;

          case 'layouts':
            const allLayouts: LayoutManifest[] = await getAvailableLayouts(site);
            fetchedItems = allLayouts
              .filter(l => !layoutTypeFilter || l.layoutType === layoutTypeFilter)
              .map(l => ({ label: l.name, value: l.id })); // Use id for value
            break;

          default:
            fetchedItems = [];
        }
        setItems(fetchedItems);
      } catch (error) {
        console.error(`Failed to fetch data source "${dataSource}":`, error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [site, dataSource, layoutTypeFilter]);

  const placeholder = useMemo(() => {
    if (isLoading) return `Loading ${dataSource || 'options'}...`;
    if (dataSource) return `Select a ${dataSource.replace(/s$/, '')}...`;
    return 'Select an option...';
  }, [isLoading, dataSource]);

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}{required ? '*' : ''}</Label>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger id={id} className="mt-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DataSourceSelectWidget;