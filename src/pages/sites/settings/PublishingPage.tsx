import { useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
// Card components imported but may be used conditionally
import { Separator } from '@/core/components/ui/separator';
// Switch component not currently used
import { toast } from 'sonner';
import { Download, Globe, Github } from 'lucide-react';
import { isTauriApp } from '@/core/utils/platform';
import DeployHistory from './publishing/DeployHistory';
import { GitHubFields, NetlifyFields } from './publishing/ProviderFields';
import {
  DEFAULT_PROXY_URL,
  buildPublishingConfig,
  buildPublishingSecrets,
  defaultGitHubConfig,
  defaultNetlifyConfig,
  type GitHubConfigUI,
  type NetlifyConfigUI,
  type PublishingProvider,
} from './publishing/providerConfig';

export default function PublishingSettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  // Focused selectors: this page previously destructured the bare store, which subscribed it
  // to every store update. `site` is the only reactive read; the rest are stable actions.
  const site = useAppStore(useCallback((state: AppStore) => state.getSiteById(siteId ?? ''), [siteId]));
  const updateManifest = useAppStore((state: AppStore) => state.updateManifest);
  const updateSiteSecrets = useAppStore((state: AppStore) => state.updateSiteSecrets);
  const loadSite = useAppStore((state: AppStore) => state.loadSite);
  const [isLoading, setIsLoading] = useState(false);

  // Publishing configuration state
  const [provider, setProvider] = useState<PublishingProvider>('zip');
  const [netlifyConfig, setNetlifyConfig] = useState<NetlifyConfigUI>(defaultNetlifyConfig);
  const [githubConfig, setGithubConfig] = useState<GitHubConfigUI>(defaultGitHubConfig);

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
      hasGitHubToken: !!site?.secrets?.publishing?.github?.accessToken,
      publishingConfig: site?.manifest.publishingConfig
    });

    if (site?.manifest.publishingConfig) {
      const config = site.manifest.publishingConfig;
      setProvider(config.provider);

      // Load Netlify configuration
      const netlifyApiToken = site.secrets?.publishing?.netlify?.apiToken || '';
      const netlifyProxySettings = site.secrets?.publishing?.netlify?.proxySettings;

      if (config.netlify) {
        setNetlifyConfig({
          siteId: config.netlify?.siteId || '',
          siteName: config.netlify?.siteName || '',
          apiToken: netlifyApiToken,
          useAppProxy: netlifyProxySettings?.useAppProxy ?? isTauriApp(),
          customProxyUrl: netlifyProxySettings?.customProxyUrl || DEFAULT_PROXY_URL
        });
      } else if (netlifyApiToken || netlifyProxySettings) {
        setNetlifyConfig(prev => ({
          ...prev,
          apiToken: netlifyApiToken,
          useAppProxy: netlifyProxySettings?.useAppProxy ?? isTauriApp(),
          customProxyUrl: netlifyProxySettings?.customProxyUrl || prev.customProxyUrl
        }));
      }

      // Load GitHub configuration
      const githubAccessToken = site.secrets?.publishing?.github?.accessToken || '';
      if (config.github) {
        setGithubConfig({
          owner: config.github.owner || '',
          repo: config.github.repo || '',
          branch: config.github.branch || 'main',
          accessToken: githubAccessToken
        });
      } else if (githubAccessToken) {
        setGithubConfig(prev => ({
          ...prev,
          accessToken: githubAccessToken
        }));
      }
    }
    // If no publishing config but we have secrets, load the tokens
    else {
      const netlifySecrets = site?.secrets?.publishing?.netlify;
      if (netlifySecrets?.apiToken || netlifySecrets?.proxySettings) {
        setNetlifyConfig(prev => ({
          ...prev,
          apiToken: netlifySecrets?.apiToken || '',
          useAppProxy: netlifySecrets?.proxySettings?.useAppProxy ?? isTauriApp(),
          customProxyUrl: netlifySecrets?.proxySettings?.customProxyUrl || prev.customProxyUrl
        }));
      }
      if (site?.secrets?.publishing?.github?.accessToken) {
        setGithubConfig(prev => ({
          ...prev,
          accessToken: site.secrets?.publishing?.github?.accessToken || ''
        }));
      }
    }
  }, [site]);

  const handleSaveSettings = async () => {
    if (!site || !siteId) return;

    setIsLoading(true);
    try {
      // Save public config to manifest
      await updateManifest(siteId, {
        ...site.manifest,
        publishingConfig: buildPublishingConfig(provider, netlifyConfig, githubConfig),
      });

      // Save secrets separately based on provider
      const secrets = buildPublishingSecrets(site, provider, netlifyConfig, githubConfig);
      if (secrets) await updateSiteSecrets(siteId, secrets);

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

  const pageTitle = `Publishing - ${site?.manifest?.title || 'Loading...'}`;

  if (isLoading || !site) {
    return (
      <>
        <title>{pageTitle}</title>
        <div className="p-6">Loading publishing settings...</div>
      </>
    );
  }

  return (
    <>
      <title>{pageTitle}</title>

      <div className="space-y-6 max-w-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Publishing</h1>
          <p className="text-muted-foreground">
            Configure how you want to publish your site
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-select">Publishing provider</Label>
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
                <SelectItem value="github">
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    Deploy to GitHub
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

          </div>

          {provider === 'netlify' && (
            <>
              <NetlifyFields config={netlifyConfig} onChange={setNetlifyConfig} />
            </>
          )}

          {provider === 'github' && (
            <>
              <GitHubFields config={githubConfig} onChange={setGithubConfig} />
            </>
          )}

          <div className=" pt-4">
            <Button onClick={handleSaveSettings} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save settings'}
            </Button>
          </div>


        </div>

        <Separator />
        <DeployHistory site={site} />
      </div>
    </>
  );
}