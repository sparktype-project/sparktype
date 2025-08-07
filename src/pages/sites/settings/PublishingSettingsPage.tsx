import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Separator } from '@/core/components/ui/separator';
import { toast } from 'sonner';
import { Download, Globe, Settings } from 'lucide-react';

type PublishingProvider = 'zip' | 'netlify';

interface NetlifyConfigUI {
  apiToken: string;
  siteId?: string;
  siteName?: string;
}

interface NetlifyConfigPublic {
  siteId?: string;
  siteName?: string;
}

interface PublishingConfig {
  provider: PublishingProvider;
  netlify?: NetlifyConfigPublic;
}

export default function PublishingSettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { getSiteById, updateManifest, updateSiteSecrets, loadSite } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  
  // Publishing configuration state
  const [provider, setProvider] = useState<PublishingProvider>('zip');
  const [netlifyConfig, setNetlifyConfig] = useState<NetlifyConfigUI>({
    apiToken: '',
    siteId: '',
    siteName: ''
  });

  const site = siteId ? getSiteById(siteId) : null;

  // Load site data including secrets when component mounts
  useEffect(() => {
    if (siteId && !site?.secrets) {
      console.log('[PublishingSettings] Loading site data including secrets');
      loadSite(siteId);
    }
  }, [siteId, site?.secrets, loadSite]);

  useEffect(() => {
    console.log('[PublishingSettings] Site data changed:', {
      hasSite: !!site,
      hasSecrets: !!site?.secrets,
      hasPublishingSecrets: !!site?.secrets?.publishing,
      hasNetlifyToken: !!site?.secrets?.publishing?.netlify?.apiToken,
      publishingConfig: site?.manifest.publishingConfig
    });

    if (site?.manifest.publishingConfig) {
      const config = site.manifest.publishingConfig;
      setProvider(config.provider);
      
      // Always load the API token from secrets if available
      const apiToken = site.secrets?.publishing?.netlify?.apiToken || '';
      
      if (config.netlify) {
        setNetlifyConfig({
          siteId: config.netlify?.siteId || '',
          siteName: config.netlify?.siteName || '',
          apiToken
        });
      } else if (apiToken) {
        // If we have an API token but no netlify config yet, still load the token
        setNetlifyConfig(prev => ({
          ...prev,
          apiToken
        }));
      }
    }
    // If no publishing config but we have secrets, load the API token
    else if (site?.secrets?.publishing?.netlify?.apiToken) {
      setNetlifyConfig(prev => ({
        ...prev,
        apiToken: site.secrets?.publishing?.netlify?.apiToken || ''
      }));
    }
  }, [site]);

  const handleSaveSettings = async () => {
    if (!site || !siteId) return;

    setIsLoading(true);
    try {
      // Separate public config from secrets
      const { apiToken, ...publicNetlifyConfig } = netlifyConfig;
      
      const publishingConfig: PublishingConfig = {
        provider,
        ...(provider === 'netlify' && { netlify: publicNetlifyConfig })
      };

      const updatedManifest = {
        ...site.manifest,
        publishingConfig
      };

      // Save public config to manifest
      await updateManifest(siteId, updatedManifest);

      // Save secrets separately if provider is Netlify and we have an API token
      if (provider === 'netlify' && apiToken) {
        const updatedSecrets = {
          ...site.secrets,
          publishing: {
            ...site.secrets?.publishing,
            netlify: {
              ...site.secrets?.publishing?.netlify,
              apiToken
            }
          }
        };
        await updateSiteSecrets(siteId, updatedSecrets);
      }

      toast.success('Publishing settings saved successfully!');
    } catch (error) {
      console.error('Error saving publishing settings:', error);
      toast.error('Failed to save publishing settings');
    } finally {
      setIsLoading(false);
    }
  };


  if (!site) {
    return <div>Site not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Publishing Settings</h1>
        <p className="text-muted-foreground">
          Configure how you want to publish your site
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Publishing Configuration
          </CardTitle>
          <CardDescription>
            Choose your preferred publishing method and configure the settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-select">Publishing Provider</Label>
            <Select value={provider} onValueChange={(value: PublishingProvider) => setProvider(value)}>
              <SelectTrigger id="provider-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zip">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export as ZIP
                  </div>
                </SelectItem>
                <SelectItem value="netlify">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Deploy to Netlify
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select how you want to publish your site
            </p>
          </div>

          {provider === 'netlify' && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Netlify Configuration</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="netlify-token">API Token</Label>
                  <Input
                    id="netlify-token"
                    type="password"
                    value={netlifyConfig.apiToken}
                    onChange={(e) => setNetlifyConfig({ ...netlifyConfig, apiToken: e.target.value })}
                    placeholder="Your Netlify personal access token"
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a personal access token in your Netlify account settings. Stored securely and not exported with your site.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="netlify-site-name">Site Name (Optional)</Label>
                  <Input
                    id="netlify-site-name"
                    value={netlifyConfig.siteName}
                    onChange={(e) => setNetlifyConfig({ ...netlifyConfig, siteName: e.target.value })}
                    placeholder="my-awesome-site"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate a site name
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="netlify-site-id">Site ID (Optional)</Label>
                  <Input
                    id="netlify-site-id"
                    value={netlifyConfig.siteId}
                    onChange={(e) => setNetlifyConfig({ ...netlifyConfig, siteId: e.target.value })}
                    placeholder="existing-site-id"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this to update an existing Netlify site
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSaveSettings} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> After saving your settings, use the "Publish" button in the editor header to publish your site using the configured provider.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}