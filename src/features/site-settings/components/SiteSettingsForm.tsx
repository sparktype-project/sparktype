// src/features/site-settings/components/SiteSettingsForm.tsx
'use client';

import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import type { ImageRef } from '@/core/types';
import SiteAssetUploader from './SiteAssetsUploader';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import type { RJSFSchema } from '@rjsf/utils';

interface SiteSettingsFormProps {
  siteId: string;
  formData: {
    title: string;
    description: string;
    author: string;
    baseUrl: string;
    logo: ImageRef | undefined;
    favicon: ImageRef | undefined;
  };
  themeDataSchema?: RJSFSchema;
  themeData?: Record<string, unknown>;
  onFormChange: (newData: SiteSettingsFormProps['formData']) => void;
  onThemeDataChange?: (newData: Record<string, unknown>) => void;
}

export default function SiteSettingsForm({ 
  siteId, 
  formData, 
  onFormChange, 
  themeDataSchema, 
  themeData, 
  onThemeDataChange 
}: SiteSettingsFormProps) {
  
  // FIX: Typed the 'value' parameter to 'unknown' for better type safety.
  const handleChange = (field: keyof typeof formData, value: unknown) => {
    onFormChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Site Identity</h2>
        <SiteAssetUploader 
          siteId={siteId}
          label="Site Logo"
          value={formData.logo}
          onChange={(newRef) => handleChange('logo', newRef)}
          onRemove={() => handleChange('logo', undefined)}
        />
        <SiteAssetUploader
          siteId={siteId}
          label="Favicon"
          value={formData.favicon}
          onChange={(newRef) => handleChange('favicon', newRef)}
          onRemove={() => handleChange('favicon', undefined)}
        />
      </div>

      <div className="border-t pt-6 space-y-4">
        <h2 className="text-lg font-semibold">Core Details</h2>
        <div className="space-y-2">
            <Label htmlFor="title">Site Title</Label>
            <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="My Awesome Site"
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="description">Site Description</Label>
            <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="A short, catchy description."
                rows={3}
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="author">Author (Optional)</Label>
            <Input
                id="author"
                value={formData.author}
                onChange={(e) => handleChange('author', e.target.value)}
                placeholder="Your Name or Organization"
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
                id="baseUrl"
                type="url"
                value={formData.baseUrl}
                onChange={(e) => handleChange('baseUrl', e.target.value)}
                placeholder="https://www.my-awesome-site.com"
            />
        </div>
      </div>

      {themeDataSchema && onThemeDataChange && (
        <div className="border-t pt-6 space-y-4">
          <h2 className="text-lg font-semibold">Theme Content</h2>
          <p className="text-sm text-muted-foreground">
            Configure additional content fields defined by your theme.
          </p>
          <SchemaDrivenForm
            schema={themeDataSchema}
            formData={themeData || {}}
            onFormChange={(data: object) => onThemeDataChange(data as Record<string, unknown>)}
            liveValidate={false}
          />
        </div>
      )}
    </div>
  );
}