// src/pages/sites/settings/ImageSettingsPage.tsx

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// Types
import { type Manifest } from '@/core/types';
import { type SiteSecrets } from '@/core/services/siteSecrets.service';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { toast } from 'sonner';

type ImageServiceId = 'local' | 'cloudinary';

export default function ImageSettingsPage() {
  const { siteId = '' } = useParams<{ siteId: string }>();

  // Selectors for Zustand store
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore((state: AppStore) => state.updateManifest);
  const updateSiteSecretsAction = useAppStore((state: AppStore) => state.updateSiteSecrets);

  // Local state for the form
  const [selectedService, setSelectedService] = useState<ImageServiceId>('local');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Effect to populate the form's local state from the global store on mount.
  useEffect(() => {
    if (site?.manifest) {
      setIsLoading(true);
      const { imageService, cloudinary } = site.manifest.settings || {};
      setSelectedService(imageService || 'local');
      setCloudinaryCloudName(cloudinary?.cloudName || '');
      setCloudinaryUploadPreset(site.secrets?.cloudinary?.uploadPreset || '');
      setHasChanges(false);
      setIsLoading(false);
    }
  }, [site]); // Re-run if the site object in the store changes.

  const handleServiceChange = (value: string) => {
    setSelectedService(value as ImageServiceId);
    setHasChanges(true);
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!site?.manifest) {
      toast.error("Site data not available. Cannot save settings.");
      return;
    }
    setIsLoading(true);

    const newManifest: Manifest = {
      ...site.manifest,
      settings: {
        ...site.manifest.settings,
        imageService: selectedService,
        cloudinary: {
          cloudName: cloudinaryCloudName.trim(),
        },
      },
    };

    const newSecrets: SiteSecrets = {
      ...site.secrets, // Preserve other potential secrets
      cloudinary: {
        uploadPreset: cloudinaryUploadPreset.trim(),
      }
    };

    try {
      // These actions persist data and update the global state.
      // Toasts for success are now handled inside the actions for consistency.
      await updateManifestAction(siteId, newManifest);
      await updateSiteSecretsAction(siteId, newSecrets);
      setHasChanges(false);
    } catch (error) {
      console.error("An error occurred during save:", error);
      // Let the action's own toast handle the error message.
    } finally {
      setIsLoading(false);
    }
  };

  const pageTitle = `Image Settings - ${site?.manifest?.title || 'Loading...'}`;

  if (isLoading || !site) {
    return (
      <>
        <title>{pageTitle}</title>
        <div className="p-6">Loading image settings...</div>
      </>
    );
  }

  return (
    <>
      <title>{pageTitle}</title>
      <div className="space-y-6 max-w-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Media</h1>
          <p className="text-muted-foreground">Configure how images are stored and processed for your site.</p>
        </div>

        <div className="border-t pt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="service-select">Image storage</Label>
            <Select value={selectedService} onValueChange={handleServiceChange}>
              <SelectTrigger id="service-select" className="mt-1">
                <SelectValue placeholder="Select a service..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Store in site (default)</SelectItem>
                <SelectItem value="cloudinary">Upload to Cloudinary</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">"Store in site" is best for portability. "Cloudinary" is best for performance.</p>
          </div>

          {selectedService === 'cloudinary' && (
            <div className="p-4 border rounded-lg bg-card space-y-4">
              <h3 className="font-semibold text-card-foreground">Cloudinary Settings</h3>
              <div className="space-y-2">
                <Label htmlFor="cloud-name">Cloudinary Cloud Name (Public)</Label>
                <Input
                  id="cloud-name"
                  value={cloudinaryCloudName}
                  onChange={(e) => handleInputChange(setCloudinaryCloudName, e.target.value)}
                  placeholder="e.g., your-cloud-name"
                />
                <p className="text-xs text-muted-foreground">This is public and stored in your site's manifest.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-preset">Cloudinary upload preset (secret)</Label>
                <Input
                  id="upload-preset"
                  type="password"
                  value={cloudinaryUploadPreset}
                  onChange={(e) => handleInputChange(setCloudinaryUploadPreset, e.target.value)}
                  placeholder="e.g., ml_default"
                />
                <p className="text-xs text-muted-foreground">This is a secret and is stored securely in your browser, not in your public site files.</p>
              </div>
            </div>
          )}
        </div>

        <div className=" pt-4">
          <Button onClick={handleSave} disabled={isLoading || !hasChanges} size="lg">
            {isLoading ? 'Saving...' : 'Save settings'}
          </Button>
        </div>
      </div>
    </>
  );
}