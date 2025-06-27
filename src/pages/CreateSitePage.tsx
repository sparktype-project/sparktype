// src/pages/CreateSitePage.tsx

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // Use react-router-dom's hook for navigation

// State Management
import { useAppStore } from '@/core/state/useAppStore';

// Services and Config
import { generateSiteId } from '@/core/libraries/utils';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { GENERATOR_VERSION, CORE_THEMES } from '@/config/editorConfig';

// Types (using type-only imports)
import { type LocalSiteData, type Manifest, type ThemeInfo } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { toast } from 'sonner';

export default function CreateSitePage() {
  const navigate = useNavigate(); // Hook for programmatic navigation
  const addSite = useAppStore((state) => state.addSite);

  // All state and logic is ported directly from the original component
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const availableThemes = useMemo(() => CORE_THEMES, []);
  const [selectedTheme, setSelectedTheme] = useState<ThemeInfo | null>(availableThemes[0] || null);

  const handleSubmit = async () => {
    if (!siteTitle.trim() || !selectedTheme) {
      toast.error('Site title and a theme are required.');
      return;
    }
    setIsLoading(true);
    try {
      const newSiteId = generateSiteId(siteTitle);
      const { initialConfig } = await getMergedThemeDataForForm(selectedTheme.path, {});
      
      const newManifest: Manifest = {
        siteId: newSiteId,
        generatorVersion: GENERATOR_VERSION,
        title: siteTitle.trim(),
        description: siteDescription.trim(),
        theme: {
          name: selectedTheme.path,
          config: initialConfig,
        },
        structure: [],
      };
      
      const newSiteData: LocalSiteData = {
        siteId: newSiteId,
        manifest: newManifest,
        contentFiles: [],
        themeFiles: [],
        layoutFiles: [],
      };
      
      await addSite(newSiteData);
      toast.success(`Site "${siteTitle}" created successfully!`);
      
      // Navigate to the new site's editor page
      navigate(`/sites/${newSiteId}/edit`);

    } catch (error) {
      console.error("Error during site creation:", error);
      toast.error(`Failed to create site: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* React 19 native head management */}
      <title>Create New Site - Signum</title>

      <div className="container mx-auto p-4 max-w-2xl">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Create a New Site</h1>
            {/* Use navigate(-1) to go back, which is robust */}
            <Button onClick={() => navigate(-1)} variant="outline">Cancel</Button>
          </div>

          <div className="space-y-4 p-6 border rounded-lg">
            <h2 className="text-lg font-semibold">Site Details</h2>
            <div>
              <Label htmlFor="site-title">Site Title</Label>
              <Input
                id="site-title"
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                placeholder="My Awesome Project"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="site-description">Site Description (Optional)</Label>
              <Textarea
                id="site-description"
                value={siteDescription}
                onChange={(e) => setSiteDescription(e.target.value)}
                placeholder="A short and catchy description of your new site."
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="theme-select">Theme</Label>
              <Select 
                value={selectedTheme?.path || ''} 
                onValueChange={(themePath) => {
                  const theme = availableThemes.find(t => t.path === themePath);
                  if (theme) setSelectedTheme(theme);
                }} 
              >
                <SelectTrigger id="theme-select" className="mt-1">
                  <SelectValue placeholder="Select a theme..." />
                </SelectTrigger>
                <SelectContent>
                  {availableThemes.map(theme => (
                    <SelectItem key={theme.path} value={theme.path}>
                      {theme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Choose the overall design for your site. You can change this later.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isLoading || !siteTitle.trim() || !selectedTheme} size="lg">
              {isLoading ? 'Creating...' : 'Create Site'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}