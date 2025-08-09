import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
// Card components imported but may be used conditionally
import { Separator } from '@/core/components/ui/separator';
// Switch component not currently used
import { toast } from 'sonner';
import { Download, Globe, Github } from 'lucide-react';

type PublishingProvider = 'zip' | 'netlify' | 'github';

interface NetlifyConfigUI {
  apiToken: string;
  siteId?: string;
  siteName?: string;
}

interface NetlifyConfigPublic {
  siteId?: string;
  siteName?: string;
}

interface GitHubConfigUI {
  accessToken: string;
  owner: string;
  repo: string;
  branch?: string;
}

interface GitHubConfigPublic {
  owner: string;
  repo: string;
  branch?: string;
}

interface PublishingConfig {
  provider: PublishingProvider;
  netlify?: NetlifyConfigPublic;
  github?: GitHubConfigPublic;
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
  const [githubConfig, setGithubConfig] = useState<GitHubConfigUI>({
    accessToken: '',
    owner: '',
    repo: '',
    branch: 'main'
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
      hasGitHubToken: !!site?.secrets?.publishing?.github?.accessToken,
      publishingConfig: site?.manifest.publishingConfig
    });

    if (site?.manifest.publishingConfig) {
      const config = site.manifest.publishingConfig;
      setProvider(config.provider);
      
      // Load Netlify configuration
      const netlifyApiToken = site.secrets?.publishing?.netlify?.apiToken || '';
      if (config.netlify) {
        setNetlifyConfig({
          siteId: config.netlify?.siteId || '',
          siteName: config.netlify?.siteName || '',
          apiToken: netlifyApiToken
        });
      } else if (netlifyApiToken) {
        setNetlifyConfig(prev => ({
          ...prev,
          apiToken: netlifyApiToken
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
      if (site?.secrets?.publishing?.netlify?.apiToken) {
        setNetlifyConfig(prev => ({
          ...prev,
          apiToken: site.secrets?.publishing?.netlify?.apiToken || ''
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
      // Separate public config from secrets for both providers
      const { apiToken, ...publicNetlifyConfig } = netlifyConfig;
      const { accessToken, ...publicGithubConfig } = githubConfig;
      
      const publishingConfig: PublishingConfig = {
        provider,
        ...(provider === 'netlify' && { netlify: publicNetlifyConfig }),
        ...(provider === 'github' && { github: publicGithubConfig })
      };

      const updatedManifest = {
        ...site.manifest,
        publishingConfig
      };

      // Save public config to manifest
      await updateManifest(siteId, updatedManifest);

      // Save secrets separately based on provider
      const updatedSecrets = {
        ...site.secrets,
        publishing: {
          ...site.secrets?.publishing,
          ...(provider === 'netlify' && apiToken && {
            netlify: {
              ...site.secrets?.publishing?.netlify,
              apiToken
            }
          }),
          ...(provider === 'github' && accessToken && {
            github: {
              ...site.secrets?.publishing?.github,
              accessToken
            }
          })
        }
      };

      if ((provider === 'netlify' && apiToken) || (provider === 'github' && accessToken)) {
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

   const pageTitle = `Publishing settings - ${site?.manifest?.title || 'Loading...'}`;

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
        <h1 className="text-2xl font-bold">Publishing settings</h1>
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

          {provider === 'github' && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">GitHub configuration</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="github-token">Personal access token</Label>
                  <Input
                    id="github-token"
                    type="password"
                    value={githubConfig.accessToken}
                    onChange={(e) => setGithubConfig({ ...githubConfig, accessToken: e.target.value })}
                    placeholder="ghp_xxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a personal access token at{' '}
                    <a 
                      href="https://github.com/settings/tokens" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      github.com/settings/tokens
                    </a>{' '}
                    with "repo" permissions. Stored securely and not exported with your site.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="github-owner">Repository Owner</Label>
                    <Input
                      id="github-owner"
                      value={githubConfig.owner}
                      onChange={(e) => setGithubConfig({ ...githubConfig, owner: e.target.value })}
                      placeholder="username"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your GitHub username or organization
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="github-repo">Repository Name</Label>
                    <Input
                      id="github-repo"
                      value={githubConfig.repo}
                      onChange={(e) => setGithubConfig({ ...githubConfig, repo: e.target.value })}
                      placeholder="my-website"
                    />
                    <p className="text-xs text-muted-foreground">
                      The repository name to deploy to
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github-branch">Branch (Optional)</Label>
                  <Input
                    id="github-branch"
                    value={githubConfig.branch}
                    onChange={(e) => setGithubConfig({ ...githubConfig, branch: e.target.value })}
                    placeholder="main"
                  />
                  <p className="text-xs text-muted-foreground">
                    Git branch to deploy to (defaults to "main")
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-900 mb-2">📂 Repository Support</h4>
                    <div className="text-sm text-green-800 space-y-2">
                      <p><strong>✅ New Repository:</strong> Will create initial commit and branch</p>
                      <p><strong>✅ Existing Repository:</strong> Will add commits to your existing history</p>
                      <p><strong>✅ New Branch:</strong> Will create the branch if it doesn't exist</p>
                      <p><strong>✅ Existing Branch:</strong> Will add new commits on top of existing ones</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">🚀 Connect to Netlify</h4>
                    <p className="text-sm text-blue-800">
                      After setting up GitHub deployment, connect your repository to Netlify for automatic builds:
                    </p>
                    <ol className="text-sm text-blue-800 mt-2 ml-4 space-y-1">
                      <li>1. Go to Netlify and click "Add new site"</li>
                      <li>2. Choose "Import an existing project"</li>
                      <li>3. Select your GitHub repository</li>
                      <li>4. Netlify will automatically deploy when you publish</li>
                    </ol>
                  </div>
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
              {provider === 'github' && (
                <span className="block mt-2">
                  <strong>GitHub + Netlify:</strong> This approach bypasses size limitations and provides automatic deployments with version control.
                </span>
              )}
            </p>
          </div>
      </div>
    </div>
    </>
  );
}