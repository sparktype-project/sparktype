// src/pages/sites/settings/ThemeSettingsPage.tsx

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// State Management and Services
import { useAppStore } from '@/core/state/useAppStore';
import { getAvailableThemes } from '@/core/services/config/configHelpers.service';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';

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
        
        const { schema: themeSchema, initialConfig } = await getMergedThemeDataForForm(currentThemeName, savedConfig);
        
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
            selectedTheme
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
          <p className="text-muted-foreground">Customize the visual style and branding of your site.</p>
        </div>

        <div className="border-t pt-6 space-y-6">
          <div>
            <Label htmlFor="theme-select">Active Theme</Label>
            <Select 
              value={selectedTheme} 
              onValueChange={handleThemeChange}
              disabled={isSaving || isLoading}
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
          
          {schema?.properties && Object.keys(schema.properties).length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Theme Customization</h3>
              <SchemaDrivenForm 
                schema={schema}
                formData={formData}
                onFormChange={handleFormChange}
              />
            </div>
          ) : (
            <div className="text-center border-2 border-dashed p-6 rounded-lg">
              <p className="font-semibold">No Customization Options</p>
              <p className="text-sm text-muted-foreground">
                The theme "{selectedTheme}" does not provide any customizable appearance settings.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !hasChanges || isLoading} 
            size="lg"
          >
            {isSaving ? 'Saving...' : 'Save Appearance'}
          </Button>
        </div>
      </div>
    </>
  );
}