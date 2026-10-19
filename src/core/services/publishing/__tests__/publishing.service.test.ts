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
import type { PublishProgressEvent } from '../types';
import { readPublishHistory } from '../history/publishHistory.service';
import { resetIndexedDbForTests } from '@/test/support/storage';

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
      }),
      { onProgress: expect.any(Function) }
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

  describe('progress', () => {
    function collect() {
      const events: PublishProgressEvent[] = [];
      return { events, onProgress: (event: PublishProgressEvent) => events.push(event) };
    }

    test('reports build, upload and finalise for a zip export', async () => {
      const { events, onProgress } = collect();

      await publishSite(createSiteFixture('basicSite'), { onProgress });

      expect(events).toEqual([
        { step: 'build', status: 'started' },
        { step: 'build', status: 'completed' },
        { step: 'upload', status: 'started' },
        { step: 'upload', status: 'completed' },
        { step: 'finalise', status: 'started' },
        { step: 'finalise', status: 'completed' },
      ]);
    });

    test('marks the running step failed when the zip build throws', async () => {
      exportSiteToZipMock.mockRejectedValueOnce(new Error('no memory'));
      const { events, onProgress } = collect();

      const result = await publishSite(createSiteFixture('basicSite'), { onProgress });

      expect(result.success).toBe(false);
      expect(events).toEqual([
        { step: 'build', status: 'started' },
        { step: 'build', status: 'failed', message: 'Failed to generate ZIP: no memory' },
      ]);
    });

    test('forwards provider events and fails the step a provider failure leaves running', async () => {
      const site = createSiteFixture('basicSite');
      site.manifest.publishingConfig = { provider: 'netlify', netlify: { siteId: 'site-1' } };
      site.secrets = { publishing: { netlify: { apiToken: 't' } } } satisfies SiteSecrets;
      netlifyDeployMock.mockImplementationOnce(async (_site, _config, options) => {
        options.onProgress({ step: 'build', status: 'started' });
        options.onProgress({ step: 'build', status: 'completed' });
        options.onProgress({ step: 'upload', status: 'started' });
        return { success: false, message: 'Proxy error (502)' };
      });
      const { events, onProgress } = collect();

      await publishSite(site, { onProgress });

      expect(events.at(-1)).toEqual({ step: 'upload', status: 'failed', message: 'Proxy error (502)' });
    });

    test('a throwing listener does not fail the publish', async () => {
      const result = await publishSite(createSiteFixture('basicSite'), {
        onProgress: () => {
          throw new Error('ui bug');
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('history', () => {
    beforeEach(async () => {
      await resetIndexedDbForTests();
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2025-03-01T12:00:00.000Z'));
    });
    afterEach(() => vi.useRealTimers());

    test('records a zip export with its step log and finding counts', async () => {
      const site = createSiteFixture('basicSite');

      await publishSite(site, { findings: { blocking: 0, warning: 2 } });

      const [entry] = await readPublishHistory(site.siteId);
      expect(entry).toMatchObject({
        kind: 'publish',
        provider: 'zip',
        target: 'download',
        outcome: 'success',
        startedAt: '2025-03-01T12:00:00.000Z',
        findings: { blocking: 0, warning: 2 },
      });
      expect(entry.log.map((line) => `${line.step}:${line.status}`)).toEqual([
        'build:started', 'build:completed', 'upload:started', 'upload:completed', 'finalise:started', 'finalise:completed',
      ]);
    });

    test('records the GitHub commit SHA, target and file count', async () => {
      const site = createSiteFixture('basicSite');
      site.manifest.publishingConfig = { provider: 'github', github: { owner: 'openai', repo: 'sparktype', branch: 'gh-pages' } };
      site.secrets = { publishing: { github: { accessToken: 't' } } } satisfies SiteSecrets;
      githubDeployMock.mockResolvedValueOnce({
        success: true,
        message: 'ok',
        url: 'https://github.com/openai/sparktype',
        details: { commit: 'c0ffee', filesUploaded: 12 },
      });

      const result = await publishSite(site);

      expect(result).toMatchObject({ commitSHA: 'c0ffee', fileCount: 12 });
      const [entry] = await readPublishHistory(site.siteId);
      expect(entry).toMatchObject({
        provider: 'github',
        target: 'openai/sparktype#gh-pages',
        commitSHA: 'c0ffee',
        fileCount: 12,
        url: 'https://github.com/openai/sparktype',
      });
    });

    test('records the Netlify deploy id and the site it went to', async () => {
      const site = createSiteFixture('basicSite');
      site.manifest.publishingConfig = { provider: 'netlify', netlify: { siteId: 'site-1' } };
      site.secrets = { publishing: { netlify: { apiToken: 't' } } } satisfies SiteSecrets;
      netlifyDeployMock.mockResolvedValueOnce({
        success: true,
        message: 'ok',
        url: 'https://x.netlify.app',
        details: { deployId: 'deploy-9', siteId: 'site-77', filesUploaded: 3 },
      });

      await publishSite(site);

      const [entry] = await readPublishHistory(site.siteId);
      expect(entry).toMatchObject({ provider: 'netlify', target: 'netlify:site-77', deployId: 'deploy-9', fileCount: 3 });
    });

    test('records a failed publish with its error and no success fields', async () => {
      const site = createSiteFixture('basicSite');
      site.manifest.publishingConfig = { provider: 'github', github: { owner: 'o', repo: 'r' } };
      site.secrets = { publishing: { github: { accessToken: 't' } } } satisfies SiteSecrets;
      githubDeployMock.mockRejectedValueOnce(new Error('Boom'));

      await publishSite(site);

      const [entry] = await readPublishHistory(site.siteId);
      expect(entry).toMatchObject({ outcome: 'failed', error: 'GitHub deployment failed: Boom', target: 'o/r#main' });
      expect(entry.commitSHA).toBeUndefined();
    });
  });
});
