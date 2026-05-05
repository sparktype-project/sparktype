import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { useAppStore, type AppStore } from '@/core/state/useAppStore';
import type { Manifest, SiteSecrets } from '@/core/types';
import { getConfiguredImageServiceId, getImageServiceById, getRegisteredImageServices } from '@/core/services/images/images.service';
import { toast } from 'sonner';

function getInitialPublicConfig(site: NonNullable<ReturnType<AppStore['getSiteById']>>, providerId: string): Record<string, string> {
  const config = site.manifest.settings?.imageProviders?.[providerId];
  if (config) {
    return Object.fromEntries(
      Object.entries(config).map(([key, value]) => [key, typeof value === 'string' ? value : ''])
    );
  }

  if (providerId === 'cloudinary') {
    return {
      cloudName: site.manifest.settings?.cloudinary?.cloudName || '',
    };
  }

  return {};
}

function getInitialSecretConfig(site: NonNullable<ReturnType<AppStore['getSiteById']>>, providerId: string): Record<string, string> {
  const genericConfig = site.secrets?.imageProviders?.[providerId];
  if (genericConfig) {
    return Object.fromEntries(
      Object.entries(genericConfig).map(([key, value]) => [key, typeof value === 'string' ? value : ''])
    );
  }

  if (providerId === 'cloudinary') {
    return {
      uploadPreset: site.secrets?.cloudinary?.uploadPreset || '',
    };
  }

  return {};
}

export default function ImageSettingsPage() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId), [siteId]));
  const updateManifestAction = useAppStore((state: AppStore) => state.updateManifest);
  const updateSiteSecretsAction = useAppStore((state: AppStore) => state.updateSiteSecrets);

  const services = useMemo(() => getRegisteredImageServices(), []);
  const [selectedServiceId, setSelectedServiceId] = useState('local');
  const [publicConfig, setPublicConfig] = useState<Record<string, string>>({});
  const [secretConfig, setSecretConfig] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ valid: boolean; text: string }>({
    valid: true,
    text: 'Provider configuration looks valid.',
  });

  const selectedService = getImageServiceById(selectedServiceId) || services[0];

  useEffect(() => {
    if (!site?.manifest) {
      return;
    }

    setIsLoading(true);
    const configuredServiceId = getConfiguredImageServiceId(site.manifest);
    setSelectedServiceId(configuredServiceId);
    setPublicConfig(getInitialPublicConfig(site, configuredServiceId));
    setSecretConfig(getInitialSecretConfig(site, configuredServiceId));
    setHasChanges(false);
    setIsLoading(false);
  }, [site]);

  useEffect(() => {
    if (!site?.manifest || !selectedService?.validateConfig) {
      setValidationMessage({ valid: true, text: 'Provider configuration looks valid.' });
      return;
    }

    const validationCandidate = selectedService.validateConfig({
      manifest: {
        ...site.manifest,
        settings: {
          ...site.manifest.settings,
          imageService: selectedServiceId,
          imageProvider: { id: selectedServiceId },
          imageProviders: {
            ...(site.manifest.settings?.imageProviders || {}),
            [selectedServiceId]: publicConfig,
          },
        },
      } as Manifest,
      secrets: {
        ...site.secrets,
        imageProviders: {
          ...(site.secrets?.imageProviders || {}),
          [selectedServiceId]: secretConfig,
        },
      } as SiteSecrets,
      site,
    });

    Promise.resolve(validationCandidate).then((result) => {
      if (!result.valid) {
        setValidationMessage({ valid: false, text: result.errors.join(' ') });
        return;
      }

      const warningText = result.warnings?.join(' ');
      setValidationMessage({
        valid: true,
        text: warningText || 'Provider configuration looks valid.',
      });
    });
  }, [publicConfig, secretConfig, selectedService, selectedServiceId, site]);

  const handleServiceChange = (value: string) => {
    if (!site) {
      return;
    }

    setSelectedServiceId(value);
    setPublicConfig(getInitialPublicConfig(site, value));
    setSecretConfig(getInitialSecretConfig(site, value));
    setHasChanges(true);
  };

  const handleConfigChange = (
    setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    key: string,
    value: string
  ) => {
    setter((current) => ({ ...current, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!site?.manifest || !selectedService) {
      toast.error('Site data not available. Cannot save settings.');
      return;
    }

    setIsSaving(true);

    const newManifest: Manifest = {
      ...site.manifest,
      settings: {
        ...site.manifest.settings,
        imageService: selectedServiceId,
        imageProvider: {
          id: selectedServiceId,
        },
        imageProviders: {
          ...(site.manifest.settings?.imageProviders || {}),
          [selectedServiceId]: publicConfig,
        },
        cloudinary: selectedServiceId === 'cloudinary'
          ? {
              cloudName: publicConfig.cloudName?.trim() || '',
            }
          : site.manifest.settings?.cloudinary,
      },
    };

    const newSecrets: SiteSecrets = {
      ...site.secrets,
      imageProviders: {
        ...(site.secrets?.imageProviders || {}),
        [selectedServiceId]: secretConfig,
      },
      cloudinary: selectedServiceId === 'cloudinary'
        ? {
            uploadPreset: secretConfig.uploadPreset?.trim() || '',
          }
        : site.secrets?.cloudinary,
    };

    try {
      await updateManifestAction(siteId, newManifest);
      await updateSiteSecretsAction(siteId, newSecrets);
      setHasChanges(false);
      toast.success('Image provider settings saved.');
    } catch (error) {
      console.error('An error occurred during save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const pageTitle = `Image Settings - ${site?.manifest?.title || 'Loading...'}`;

  if (isLoading || !site || !selectedService) {
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
          <p className="text-muted-foreground">Configure how images are stored, transformed, and restored for this site.</p>
        </div>

        <div className="border-t pt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="service-select">Image provider</Label>
            <Select value={selectedServiceId} onValueChange={handleServiceChange}>
              <SelectTrigger id="service-select" className="mt-1">
                <SelectValue placeholder="Select a provider..." />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Local storage maximizes portability. Remote providers reduce browser storage pressure and can handle transforms externally.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-card-foreground">{selectedService.name}</h3>
              <p className="text-xs text-muted-foreground">
                Export mode: {selectedService.capabilities?.exportMode || 'bundle'}. Import mode: {selectedService.capabilities?.importMode || 'full'}.
              </p>
            </div>

            {selectedService.configFields?.public.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`public-${field.key}`}>{field.label}</Label>
                <Input
                  id={`public-${field.key}`}
                  value={publicConfig[field.key] || ''}
                  onChange={(event) => handleConfigChange(setPublicConfig, field.key, event.target.value)}
                  placeholder={field.placeholder}
                  type={field.type || 'text'}
                />
                {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
              </div>
            ))}

            {selectedService.configFields?.secret.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`secret-${field.key}`}>{field.label}</Label>
                <Input
                  id={`secret-${field.key}`}
                  value={secretConfig[field.key] || ''}
                  onChange={(event) => handleConfigChange(setSecretConfig, field.key, event.target.value)}
                  placeholder={field.placeholder}
                  type={field.type || 'password'}
                />
                {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
              </div>
            ))}

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {validationMessage.valid === false ? (
                <p className="text-destructive">{validationMessage.text}</p>
              ) : (
                <p className="text-muted-foreground">{validationMessage.text}</p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="lg">
            {isSaving ? 'Saving...' : 'Save settings'}
          </Button>
        </div>
      </div>
    </>
  );
}
