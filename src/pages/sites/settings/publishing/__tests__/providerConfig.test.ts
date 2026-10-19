import { describe, expect, test } from 'vitest';
import { buildPublishingConfig, buildPublishingSecrets, defaultGitHubConfig, defaultNetlifyConfig } from '../providerConfig';

describe('buildPublishingConfig', () => {
  test('keeps secrets and proxy settings out of the manifest', () => {
    const netlify = { ...defaultNetlifyConfig(), apiToken: 'secret', siteId: 'nl-1', siteName: 'blog' };
    const github = { ...defaultGitHubConfig(), accessToken: 'ghp', owner: 'o', repo: 'r' };

    expect(buildPublishingConfig('netlify', netlify, github)).toEqual({ provider: 'netlify', netlify: { siteId: 'nl-1', siteName: 'blog' } });
    expect(buildPublishingConfig('github', netlify, github)).toEqual({ provider: 'github', github: { owner: 'o', repo: 'r', branch: 'main' } });
    expect(buildPublishingConfig('zip', netlify, github)).toEqual({ provider: 'zip' });
  });
});

describe('buildPublishingSecrets', () => {
  test('merges the chosen provider’s secrets into the existing ones', () => {
    const site = { secrets: { publishing: { netlify: { apiToken: 'old' } } } };
    const github = { ...defaultGitHubConfig(), accessToken: 'ghp' };

    expect(buildPublishingSecrets(site, 'github', defaultNetlifyConfig(), github)).toEqual({
      publishing: { netlify: { apiToken: 'old' }, github: { accessToken: 'ghp' } },
    });
  });

  test('writes Netlify proxy settings with the token', () => {
    const netlify = { ...defaultNetlifyConfig(), apiToken: 'tok', useAppProxy: false, customProxyUrl: 'https://p.example' };
    expect(buildPublishingSecrets({}, 'netlify', netlify, defaultGitHubConfig())).toEqual({
      publishing: { netlify: { apiToken: 'tok', proxySettings: { useAppProxy: false, customProxyUrl: 'https://p.example' } } },
    });
  });

  test('has nothing to write for ZIP or a GitHub config without a token', () => {
    expect(buildPublishingSecrets({}, 'zip', defaultNetlifyConfig(), defaultGitHubConfig())).toBeNull();
    expect(buildPublishingSecrets({}, 'github', defaultNetlifyConfig(), defaultGitHubConfig())).toBeNull();
  });
});
