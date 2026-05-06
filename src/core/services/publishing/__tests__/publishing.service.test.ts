import type { SiteSecrets } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';

const {
  exportSiteToZipMock,
  isTauriAppMock,
  downloadSiteZipMock,
  netlifyDeployMock,
  githubDeployMock,
} = vi.hoisted(() => ({
  exportSiteToZipMock: vi.fn(),
  isTauriAppMock: vi.fn(),
  downloadSiteZipMock: vi.fn(),
  netlifyDeployMock: vi.fn(),
  githubDeployMock: vi.fn(),
}));

vi.mock('../download.service', () => ({
  exportSiteToZip: exportSiteToZipMock,
}));

vi.mock('../netlify.service', () => ({
  NetlifyProvider: class {
    deploy = netlifyDeployMock;
  },
}));

vi.mock('../git.service', () => ({
  GitHubProvider: class {
    deploy = githubDeployMock;
  },
}));

vi.mock('@/core/services/tauri/fileDownload.service', () => ({
  tauriFileDownloadService: {
    downloadSiteZip: downloadSiteZipMock,
  },
}));

vi.mock('@/core/utils/platform', () => ({
  isTauriApp: isTauriAppMock,
}));

import { publishSite } from '../publishing.service';

describe('publishing orchestration', () => {
  const objectUrlSpy = vi.spyOn(URL, 'createObjectURL');

  beforeEach(() => {
    vi.clearAllMocks();
    exportSiteToZipMock.mockResolvedValue(new Blob(['zip']));
    objectUrlSpy.mockReturnValue('blob:zip-url');
    isTauriAppMock.mockReturnValue(false);
  });

  test('defaults to zip export on the web', async () => {
    const site = createSiteFixture('basicSite');

    const result = await publishSite(site);

    expect(exportSiteToZipMock).toHaveBeenCalledWith(site);
    expect(result).toEqual({
      success: true,
      message: 'Site bundle generated successfully!',
      downloadUrl: 'blob:zip-url',
      filename: 'basic-site.zip',
    });
  });

  test('uses the tauri download service for zip export in desktop mode', async () => {
    const site = createSiteFixture('basicSite');
    isTauriAppMock.mockReturnValue(true);
    downloadSiteZipMock.mockResolvedValue('/Users/test/Downloads/basic-site.zip');

    const result = await publishSite(site);

    expect(downloadSiteZipMock).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'Site exported successfully to: /Users/test/Downloads/basic-site.zip',
      filename: 'basic-site.zip',
    });
  });

  test('rejects netlify publishing when the token is missing', async () => {
    const site = createSiteFixture('basicSite');
    site.manifest.publishingConfig = { provider: 'netlify', netlify: { siteId: 'abc' } };

    const result = await publishSite(site);

    expect(result).toEqual({
      success: false,
      message: 'Netlify API token not found. Please configure publishing settings.',
    });
  });

  test('rejects github publishing when repository settings are incomplete', async () => {
    const site = createSiteFixture('basicSite');
    site.manifest.publishingConfig = { provider: 'github', github: { owner: '', repo: '' } };
    site.secrets = { publishing: { github: { accessToken: 'token' } } } satisfies SiteSecrets;

    const result = await publishSite(site);

    expect(result).toEqual({
      success: false,
      message: 'GitHub repository not configured. Please set owner and repo in publishing settings.',
    });
  });

  test('hands provider config to Netlify and GitHub providers and surfaces provider failures', async () => {
    const netlifySite = createSiteFixture('basicSite');
    netlifySite.manifest.publishingConfig = { provider: 'netlify', netlify: { siteId: 'site-1', siteName: 'Netlify Site' } };
    netlifySite.secrets = { publishing: { netlify: { apiToken: 'netlify-token' } } } satisfies SiteSecrets;
    netlifyDeployMock.mockResolvedValueOnce({
      success: true,
      message: 'Netlify deployed',
      url: 'https://example.netlify.app',
    });

    await expect(publishSite(netlifySite)).resolves.toEqual({
      success: true,
      message: 'Netlify deployed',
      url: 'https://example.netlify.app',
    });

    expect(netlifyDeployMock).toHaveBeenCalledWith(
      netlifySite,
      expect.objectContaining({
        apiToken: 'netlify-token',
        siteId: 'site-1',
        siteName: 'Netlify Site',
      })
    );

    const githubSite = createSiteFixture('basicSite');
    githubSite.manifest.publishingConfig = {
      provider: 'github',
      github: { owner: 'openai', repo: 'sparktype', branch: 'gh-pages' },
    };
    githubSite.secrets = { publishing: { github: { accessToken: 'github-token' } } } satisfies SiteSecrets;
    githubDeployMock.mockRejectedValueOnce(new Error('Boom'));

    await expect(publishSite(githubSite)).resolves.toEqual({
      success: false,
      message: 'GitHub deployment failed: Boom',
    });
  });
});
