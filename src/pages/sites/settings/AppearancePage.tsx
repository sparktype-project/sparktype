// src/pages/sites/settings/ThemeSettingsPage.tsx

import { useEffect, useState, useCallback, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';

// State Management and Services
import { useAppStore } from '@/core/state/useAppStore';
import { getAvailableThemes } from '@/core/services/config/configHelpers.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { importThemeFromZip } from '@/core/services/themeImport.service';

// Types
import { type AppStore } from '@/core/state/useAppStore';
import { type Manifest, type ThemeConfig, type ThemeInfo } from '@/core/types';
import { type RJSFSchema } from '@rjsf/utils';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import { toast } from 'sonner';

export default function ThemeSettingsPage() {
  const { siteId = '' } = useParams<{ siteId: string }>();

  // Selectors for Zustand store
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore((state: AppStore) => state.updateManifest);

  // Local state for the form
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form-specific state
  const [selectedTheme, setSelectedTheme] = useState('');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [availableThemes, setAvailableThemes] = useState<ThemeInfo[]>([]);

  // Effect to initialize the form state from the store
  useEffect(() => {
    const initializeData = async () => {
      if (!site) return;
      setIsLoading(true);
      try {
        const themes = getAvailableThemes(site.manifest);
        setAvailableThemes(themes);

        const currentThemeName = site.manifest.theme.name || 'default';
        const savedConfig = site.manifest.theme.config || {};

        const { schema: themeSchema, initialConfig } = await getMergedThemeDataForForm(
          currentThemeName,
          savedConfig,
          undefined,
          siteId
        );

        setSchema(themeSchema);
        setFormData(initialConfig);
        setSelectedTheme(currentThemeName);
      } catch (error) {
        console.error('Failed to initialize appearance settings:', error);
        toast.error('Failed to load appearance settings');
      } finally {
        setIsLoading(false);
        setHasChanges(false);
      }
    };
    initializeData();
  }, [site]);

  // Handle changes from the dynamically generated form
  const handleFormChange = useCallback((data: object) => {
    setFormData(data as Record<string, unknown>);
    setHasChanges(true);
  }, []);

  // Handle the user selecting a new theme from the dropdown
  const handleThemeChange = useCallback(async (newThemeName: string) => {
    if (newThemeName === selectedTheme || !site) return;
    setIsLoading(true);
    try {
      const { schema: newSchema, initialConfig: newMergedConfig } = await getMergedThemeDataForForm(
        newThemeName,
        site.manifest.theme.config,
        selectedTheme,
        siteId
      );

      setSchema(newSchema);
      setFormData(newMergedConfig);
      setSelectedTheme(newThemeName);
      setHasChanges(true);
    } catch (error) {
      console.error('Failed to load new theme:', error);
      toast.error(`Failed to load theme "${newThemeName}"`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTheme, site]);

  const handleThemeUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !site) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Please upload a .zip theme package.');
      return;
    }

    setIsUploading(true);
    try {
      const result = await importThemeFromZip(file, siteId);
      if (!result.success || !result.themeInfo) {
        const errorMessage = result.errors?.[0] || 'Theme import failed';
        toast.error(errorMessage);
        return;
      }

      const existingThemes = site.manifest.themes || [];
      const alreadyExists = existingThemes.some(theme => theme.path === result.themeInfo!.path);
      const updatedThemes = [
        ...existingThemes.filter(theme => theme.path !== result.themeInfo!.path),
        result.themeInfo,
      ];

      const updatedManifest: Manifest = {
        ...site.manifest,
        themes: updatedThemes,
      };

      await updateManifestAction(siteId, updatedManifest);
      setAvailableThemes(getAvailableThemes(updatedManifest));

      if (selectedTheme === result.themeInfo.path) {
        const { schema: refreshedSchema, initialConfig: refreshedConfig } = await getMergedThemeDataForForm(
          selectedTheme,
          site.manifest.theme.config,
          undefined,
          siteId
        );
        setSchema(refreshedSchema);
        setFormData(refreshedConfig);
      }

      if (result.warnings?.length) {
        toast.warning(result.warnings[0]);
      }

      toast.success(
        alreadyExists
          ? `Theme "${result.themeInfo.name}" updated for this site.`
          : `Theme "${result.themeInfo.name}" imported for this site.`
      );
    } catch (error) {
      console.error('Failed to import theme:', error);
      toast.error('Failed to import theme package');
    } finally {
      setIsUploading(false);
    }
  }, [selectedTheme, site, siteId, updateManifestAction]);


  // Persist the changes back to the store
  const handleSave = async () => {
    if (!site?.manifest) {
      toast.error('Site data not available');
      return;
    }
    setIsSaving(true);
    try {
      const newManifest: Manifest = {
        ...site.manifest,
        theme: {
          ...site.manifest.theme,
          name: selectedTheme,
          config: formData as ThemeConfig['config'],
        },
      };
      await updateManifestAction(siteId, newManifest);
      setHasChanges(false);
      toast.success('Appearance settings saved successfully!');
    } catch (error) {
      console.error('Failed to save appearance settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const pageTitle = `Theme Settings - ${site?.manifest?.title || 'Loading...'}`;

  if (isLoading) {
    return (
      <>
        <title>{pageTitle}</title>
        <div className="space-y-6 max-w-2xl p-6">
          <div>
            <h1 className="text-2xl font-bold">Appearance</h1>
            <p className="text-muted-foreground">Loading appearance settings...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <title>{pageTitle}</title>
      <div className="space-y-6 max-w-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Appearance</h1>
          <p className="text-muted-foreground">Customise the visual style and branding of your site.</p>
        </div>

        <div className="border-t pt-6 space-y-6">
          <div>
            <Label htmlFor="theme-select">Active theme</Label>
            <Select
              value={selectedTheme}
              onValueChange={handleThemeChange}
              disabled={isSaving || isLoading || isUploading}
            >
              <SelectTrigger id="theme-select" className="mt-1">
                <SelectValue placeholder="Select a theme..." />
              </SelectTrigger>
              <SelectContent>
                {availableThemes.map((theme) => (
                  <SelectItem key={theme.path} value={theme.path}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="theme-zip-upload">Upload custom theme (.zip)</Label>
            <input
              id="theme-zip-upload"
              type="file"
              accept=".zip,application/zip"
              onChange={handleThemeUpload}
              disabled={isSaving || isLoading || isUploading}
              className="mt-1 block w-full text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Upload a built and zipped theme package. Custom themes are only available to this site.
            </p>
          </div>

          {schema?.properties && Object.keys(schema.properties).length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Theme customisation</h3>
              <SchemaDrivenForm
                schema={schema}
                formData={formData}
                onFormChange={handleFormChange}
              />
            </div>
          ) : (
            <div className="text-center border-2 border-dashed p-6 rounded-lg">
              <p className="font-semibold">No options</p>
              <p className="text-sm text-muted-foreground">
                The theme "{selectedTheme}" does not provide any customisation options.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges || isLoading || isUploading}
            size="lg"
          >
            {isSaving ? 'Saving...' : 'Save theme'}
          </Button>
        </div>
      </div>
    </>
  );
}
