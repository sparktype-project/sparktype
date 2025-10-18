// src/features/editor/components/widgets/PartialSelectorWidget.tsx

import { useEffect, useState, useMemo } from 'react';
import type { WidgetProps } from '@rjsf/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/components/ui/select";
import { Label } from '@/core/components/ui/label';
import type { LocalSiteData } from '@/core/types';

interface SelectOption {
  label: string;
  value: string;
  description?: string;
}

interface PartialSelectorWidgetProps extends WidgetProps {
  formContext?: {
    siteId?: string;
    site?: LocalSiteData;
  };
}

export default function PartialSelectorWidget(props: PartialSelectorWidgetProps) {
  const { id, label, value, onChange, options, required, formContext } = props;
  const { uiSchema } = options;
  const site = formContext?.site;

  // Get the asset type and path from uiSchema
  const assetType = uiSchema?.['ui:assetType'] as 'theme' | 'layout' || 'theme';
  const assetPath = uiSchema?.['ui:assetPath'] as string || site?.manifest?.theme?.name;
  const subDirectory = uiSchema?.['ui:subDirectory'] as string || 'partials';

  const [partials, setPartials] = useState<SelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPartials = async () => {
      if (!site || !assetPath) {
        setPartials([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // For now, we'll provide a static list of common partials
        // In a full implementation, this would scan the actual directory
        const commonPartials: SelectOption[] = [];

        if (assetType === 'theme') {
          // Common theme partials
          commonPartials.push(
            { label: 'Header', value: 'header.hbs', description: 'Site header with navigation' },
            { label: 'Footer', value: 'footer.hbs', description: 'Site footer' },
            { label: 'Sidebar', value: 'sidebar.hbs', description: 'Sidebar content' },
            { label: 'Head', value: 'head.hbs', description: 'HTML head section' }
          );
        } else if (assetType === 'layout') {
          // Common layout partials
          commonPartials.push(
            { label: 'Post Card', value: 'post-card.hbs', description: 'Blog post preview card' },
            { label: 'Project Card', value: 'project-card.hbs', description: 'Portfolio project card' },
            { label: 'Item List', value: 'item-list.hbs', description: 'Generic item listing' }
          );
        }

        setPartials(commonPartials);
      } catch (error) {
        console.error('Failed to fetch partials:', error);
        setPartials([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPartials();
  }, [site, assetType, assetPath, subDirectory]);

  const placeholder = useMemo(() => {
    if (isLoading) return 'Loading partials...';
    return 'Select a partial template...';
  }, [isLoading]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>
      
      <Select value={value || ''} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {partials.map(partial => (
            <SelectItem key={partial.value} value={partial.value}>
              <div className="flex flex-col">
                <span>{partial.label}</span>
                {partial.description && (
                  <span className="text-xs text-muted-foreground">{partial.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {!isLoading && partials.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No partials found in {assetType}/{assetPath}/{subDirectory}
        </p>
      )}
    </div>
  );
}