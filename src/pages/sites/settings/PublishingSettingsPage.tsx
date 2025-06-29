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
import { exportSiteBackup } from '@/core/services/siteBackup.service';
import { NetlifyProvider } from '@/core/services/publishing/NetlifyProvider';
import { slugify } from '@/core/libraries/utils';

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
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Publishing configuration state
  const [provider, setProvider] = useState<PublishingProvider>('zip');
  const [netlifyConfig, setNetlifyConfig] = useState<NetlifyConfigUI>({
    apiToken: '',
    siteId: '',
    siteName: ''
  });

  const site = siteId ? getSiteById(siteId) : null;

  useEffect(() => {
    if (site?.manifest.publishingConfig) {
      const config = site.manifest.publishingConfig;
      setProvider(config.provider);
      if (config.netlify) {
        setNetlifyConfig({
          siteId: config.netlify?.siteId || '',
          siteName: config.netlify?.siteName || '',
          apiToken: site.secrets?.publishing?.netlify?.apiToken || ''
        });
      }
    }
    // If no config but we have secrets, still load the API token
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

  const handlePublish = async () => {
    if (!site || !siteId) return;

    setIsPublishing(true);
    try {
      await loadSite(siteId);
      const siteToPublish = getSiteById(siteId);
      if (!siteToPublish) throw new Error("Could not load site data for publishing.");

      if (provider === 'zip') {
        // Export as ZIP
        const blob = await exportSiteBackup(siteToPublish);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${slugify(siteToPublish.manifest.title || 'signum-site')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast.success('Site exported as ZIP!');
      } else if (provider === 'netlify') {
        // Deploy to Netlify - get API token from secrets store
        const apiToken = site.secrets?.publishing?.netlify?.apiToken || netlifyConfig.apiToken;
        if (!apiToken) {
          throw new Error('Netlify API token not found. Please save your settings first.');
        }

        const netlifyConfigWithToken = {
          ...netlifyConfig,
          apiToken
        };

        const netlifyProvider = new NetlifyProvider();
        const result = await netlifyProvider.deploy(siteToPublish, netlifyConfigWithToken as unknown as Record<string, unknown>);
        
        if (result.success) {
          toast.success(result.message + (result.url ? ` Site URL: ${result.url}` : ''));
        } else {
          throw new Error(result.message);
        }
      }
    } catch (error) {
      console.error('Publishing failed:', error);
      toast.error(`Publishing failed: ${(error as Error).message}`);
    } finally {
      setIsPublishing(false);
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
            <Button onClick={handleSaveSettings} disabled={isLoading} variant="outline">
              {isLoading ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button 
              onClick={handlePublish} 
              disabled={isPublishing || (provider === 'netlify' && !site?.secrets?.publishing?.netlify?.apiToken && !netlifyConfig.apiToken)}
            >
              {isPublishing ? 'Publishing...' : provider === 'zip' ? 'Export ZIP' : 'Deploy to Netlify'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}