// src/pages/sites/settings/publishing/ProviderFields.tsx

import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Separator } from '@/core/components/ui/separator';
import { isTauriApp } from '@/core/utils/platform';
import type { GitHubConfigUI, NetlifyConfigUI } from './providerConfig';

interface FieldsProps<T> {
  config: T;
  onChange: (next: T) => void;
}

export function NetlifyFields({ config, onChange }: FieldsProps<NetlifyConfigUI>) {
  return (
    <>
      <Separator />
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Netlify Configuration</h3>

        <div className="space-y-2">
          <Label htmlFor="netlify-token">API Token</Label>
          <Input
            id="netlify-token"
            type="password"
            value={config.apiToken}
            onChange={(e) => onChange({ ...config, apiToken: e.target.value })}
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
            value={config.siteName}
            onChange={(e) => onChange({ ...config, siteName: e.target.value })}
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
            value={config.siteId}
            onChange={(e) => onChange({ ...config, siteId: e.target.value })}
            placeholder="existing-site-id"
          />
          <p className="text-xs text-muted-foreground">
            Use this to update an existing Netlify site
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-md font-semibold">Proxy Settings</h4>
          <p className="text-sm text-muted-foreground">
            Configure how Sparktype connects to Netlify API
          </p>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                id="use-app-proxy"
                type="radio"
                name="proxy-type"
                checked={config.useAppProxy}
                onChange={() => onChange({ ...config, useAppProxy: true })}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="use-app-proxy" className="text-sm font-normal">
                Use Sparktype app {isTauriApp() ? '(Recommended)' : '(Desktop app only)'}
              </Label>
            </div>
            {isTauriApp() && config.useAppProxy && (
              <p className="text-xs text-muted-foreground ml-6">
                Direct connection through the desktop app - no external proxy needed
              </p>
            )}
            {!isTauriApp() && config.useAppProxy && (
              <p className="text-xs text-orange-600 ml-6">
                ⚠️ App proxy is only available in the desktop version of Sparktype
              </p>
            )}

            <div className="flex items-center space-x-2">
              <input
                id="use-custom-proxy"
                type="radio"
                name="proxy-type"
                checked={!config.useAppProxy}
                onChange={() => onChange({ ...config, useAppProxy: false })}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="use-custom-proxy" className="text-sm font-normal">
                Use custom proxy URL {!isTauriApp() ? '(Required)' : '(Advanced)'}
              </Label>
            </div>

            {!config.useAppProxy && (
              <div className="ml-6 space-y-2">
                <Input
                  value={config.customProxyUrl}
                  onChange={(e) => onChange({ ...config, customProxyUrl: e.target.value })}
                  placeholder="https://your-proxy.example.com/netlify-proxy"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  External proxy function to bypass browser CORS restrictions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function GitHubFields({ config, onChange }: FieldsProps<GitHubConfigUI>) {
  return (
    <>
      <Separator />
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">GitHub configuration</h3>

        <div className="space-y-2">
          <Label htmlFor="github-token">Personal access token</Label>
          <Input
            id="github-token"
            type="password"
            value={config.accessToken}
            onChange={(e) => onChange({ ...config, accessToken: e.target.value })}
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
              value={config.owner}
              onChange={(e) => onChange({ ...config, owner: e.target.value })}
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
              value={config.repo}
              onChange={(e) => onChange({ ...config, repo: e.target.value })}
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
            value={config.branch}
            onChange={(e) => onChange({ ...config, branch: e.target.value })}
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
  );
}
