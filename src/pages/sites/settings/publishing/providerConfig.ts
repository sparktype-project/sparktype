// src/pages/sites/settings/publishing/providerConfig.ts

import type { LocalSiteData, Manifest, SiteSecrets } from '@/core/types';
import { isTauriApp } from '@/core/utils/platform';

export type PublishingProvider = 'zip' | 'netlify' | 'github';

export const DEFAULT_PROXY_URL = 'https://sparktype-proxy.netlify.app/.netlify/functions/netlify-deploy';

export interface NetlifyConfigUI {
  apiToken: string;
  siteId?: string;
  siteName?: string;
  useAppProxy: boolean;
  customProxyUrl: string;
}

export interface GitHubConfigUI {
  accessToken: string;
  owner: string;
  repo: string;
  branch?: string;
}

export function defaultNetlifyConfig(): NetlifyConfigUI {
  return {
    apiToken: '',
    siteId: '',
    siteName: '',
    useAppProxy: isTauriApp(), // Default to app proxy in Tauri mode
    customProxyUrl: DEFAULT_PROXY_URL,
  };
}

export function defaultGitHubConfig(): GitHubConfigUI {
  return { accessToken: '', owner: '', repo: '', branch: 'main' };
}

/** The public half of the settings, as stored in the manifest. Secrets never go in here. */
export function buildPublishingConfig(
  provider: PublishingProvider,
  netlify: NetlifyConfigUI,
  github: GitHubConfigUI,
): NonNullable<Manifest['publishingConfig']> {
  const publicNetlify = { siteId: netlify.siteId, siteName: netlify.siteName };
  const publicGithub = { owner: github.owner, repo: github.repo, branch: github.branch };
  return {
    provider,
    ...(provider === 'netlify' && { netlify: publicNetlify }),
    ...(provider === 'github' && { github: publicGithub }),
  };
}

/**
 * The secrets for the chosen provider merged into the site's existing ones, or `null` when there
 * is nothing to write (the same conditions the settings page has always used).
 */
export function buildPublishingSecrets(
  site: Pick<LocalSiteData, 'secrets'>,
  provider: PublishingProvider,
  netlify: NetlifyConfigUI,
  github: GitHubConfigUI,
): SiteSecrets | null {
  const { apiToken, useAppProxy, customProxyUrl } = netlify;
  const { accessToken } = github;

  const hasNetlify = provider === 'netlify' && (apiToken || useAppProxy !== undefined);
  const hasGitHub = provider === 'github' && accessToken;
  if (!hasNetlify && !hasGitHub) return null;

  return {
    ...site.secrets,
    publishing: {
      ...site.secrets?.publishing,
      ...(provider === 'netlify' && (apiToken || useAppProxy !== undefined || customProxyUrl) && {
        netlify: {
          ...site.secrets?.publishing?.netlify,
          ...(apiToken && { apiToken }),
          proxySettings: { useAppProxy, customProxyUrl },
        },
      }),
      ...(provider === 'github' && accessToken && {
        github: { ...site.secrets?.publishing?.github, accessToken },
      }),
    },
  };
}
