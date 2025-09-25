// src/pages/sites/settings/SiteSettingsPage.tsx

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// State and Services
import { useAppStore } from '@/core/state/useAppStore';
import { getMergedThemeDataFieldsForForm } from '@/core/services/config/theme.service';
import { HtmlSanitizerService } from '@/core/services/htmlSanitizer.service';

// Types
import { type Manifest, type ImageRef } from '@/core/types';
import { type RJSFSchema } from '@rjsf/utils';

// UI Components
import { Button } from '@/core/components/ui/button';
import SiteSettingsForm from '@/features/site-settings/components/SiteSettingsForm';
import { toast } from 'sonner';

// Define the shape of the form's local state
interface PageFormData {
  title: string;
  description: string;
  author: string;
  baseUrl: string;
  logo: ImageRef | undefined;
  favicon: ImageRef | undefined;
}

export default function SiteSettingsPage() {
  const { siteId = '' } = useParams<{ siteId: string }>();

  const site = useAppStore(useCallback(state => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore(state => state.updateManifest);

  const [formData, setFormData] = useState<PageFormData | null>(null);
  const [themeDataSchema, setThemeDataSchema] = useState<RJSFSchema | null>(null);
  const [themeData, setThemeData] = useState<Record<string, unknown>>({});
  const [themeDataChanged, setThemeDataChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const loadThemeData = useCallback(async () => {
    if (!site?.manifest?.theme?.name) return;
    try {
      const { schema, initialData } = await getMergedThemeDataFieldsForForm(
        site.manifest.theme.name,
        site.manifest.theme.themeData || {}
      );
      setThemeDataSchema(schema);
      setThemeData(initialData);
    } catch (error) {
      console.error('Failed to load theme data schema:', error);
    }
  }, [site?.manifest?.theme?.name, site?.manifest?.theme?.themeData]);

  useEffect(() => {
    if (site?.manifest) {
      setIsLoading(true);
      setFormData({
        title: site.manifest.title,
        description: site.manifest.description,
        author: site.manifest.author || '',
        baseUrl: site.manifest.baseUrl || '',
        logo: site.manifest.logo,
        favicon: site.manifest.favicon,
      });
      setHasChanges(false);
      setThemeDataChanged(false);
      loadThemeData();
      setIsLoading(false);
    }
  }, [site, loadThemeData]);

  const handleThemeDataChange = useCallback((newData: Record<string, unknown>) => {
    const sanitizedData = HtmlSanitizerService.sanitizeThemeData(newData);
    setThemeData(sanitizedData);
    setThemeDataChanged(true);
    setHasChanges(true);
  }, []);
  
  const handleFormChange = useCallback((newData: PageFormData) => {
    setFormData(newData);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!site?.manifest || !formData) {
        toast.error("Form data is not ready. Cannot save.");
        return;
    }
    setIsLoading(true);
    
    const newManifest: Manifest = {
      ...site.manifest,
      title: formData.title.trim(),
      description: formData.description.trim(),
      author: formData.author.trim(),
      baseUrl: formData.baseUrl.trim(),
      logo: formData.logo,
      favicon: formData.favicon,
      theme: {
        ...site.manifest.theme,
        themeData: themeDataChanged ? themeData : site.manifest.theme.themeData
      }
    };

    try {
      await updateManifestAction(siteId, newManifest);
      toast.success('Site settings saved successfully!');
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving site settings:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const pageTitle = `Settings - ${site?.manifest?.title || 'Loading...'}`;

  if (isLoading || !formData) {
    return (
      <>
        <title>{pageTitle}</title>
        <div className="p-6">Loading settings...</div>
      </>
    );
  }

  return (
    <>
      <title>{pageTitle}</title>
      <div className="space-y-6 max-w-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Site details</h1>
          <p className="text-muted-foreground">Manage the core details and identity of your website.</p>
        </div>

        <div className="border-t pt-6">
          <SiteSettingsForm
            siteId={siteId}
            formData={formData}
            onFormChange={handleFormChange}
            themeDataSchema={themeDataSchema || undefined}
            themeData={themeData}
            onThemeDataChange={handleThemeDataChange}
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isLoading || !hasChanges} size="lg">
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </>
  );
}