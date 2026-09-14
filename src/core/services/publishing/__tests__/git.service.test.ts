import type { LocalSiteData } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { GitHubApiStub } from '@/test/support/githubApiStub';
import { gitSyncService } from '../gitSync.service';

vi.mock('@/core/services/siteBuilder.service', () => ({
  buildSiteBundle: vi.fn(async () => ({
    'index.html': '<html>Home</html>',
    '_site/manifest.json': '{"title":"Basic Site"}',
  })),
}));

import { GitHubProvider } from '../git.service';

const CONFIG = { accessToken: 'token', owner: 'o', repo: 'r', branch: 'main' };

describe('GitHubProvider', () => {
  test('deploys the generated bundle and records a synced state', async () => {
    const stub = new GitHubApiStub();
    stub.install();
    const site = createSiteFixture('basicSite') as LocalSiteData;

    const result = await new GitHubProvider().deploy(site, CONFIG);

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://github.com/o/r');
    expect(stub.textFile('index.html')).toBe('<html>Home</html>');
    expect(stub.textFile('_site/manifest.json')).toBe('{"title":"Basic Site"}');

    const syncState = await gitSyncService.getSyncState(site.siteId);
    expect(syncState?.syncStatus).toBe('synced');
    expect(syncState?.lastKnownCommitSHA).toBe(result.details?.commit);
  });

  test('deploys into an empty repository', async () => {
    const stub = new GitHubApiStub({ emptyRepository: true });
    stub.install();

    const result = await new GitHubProvider().deploy(createSiteFixture('basicSite') as LocalSiteData, CONFIG);

    expect(result.success).toBe(true);
    expect(stub.requests.filter((request) => request.method === 'POST' && request.path.endsWith('/git/refs'))).toHaveLength(1);
  });

  test('reports a concurrent branch update with GitHub’s error and does not claim success', async () => {
    const stub = new GitHubApiStub({
      refUpdateFailure: { status: 422, body: '{"message":"Update is not a fast forward"}' },
    });
    stub.install();
    const site = createSiteFixture('basicSite', { siteId: 'concurrent-deploy-site' }) as LocalSiteData;

    const result = await new GitHubProvider().deploy(site, CONFIG);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Update is not a fast forward');
    expect(result.message).not.toContain('creating new branch');
    expect(await gitSyncService.getSyncState(site.siteId)).toBeNull();
  });

  test('rejects a token without push access', async () => {
    const stub = new GitHubApiStub({ pushPermission: false });
    stub.install();

    const validation = await new GitHubProvider().validateConfig(CONFIG);

    expect(validation).toEqual({
      valid: false,
      errors: ['No push access to repository. Make sure your token has write permissions.'],
    });
  });

  test('reports configuration fields that are not strings', async () => {
    const validation = await new GitHubProvider().validateConfig({ accessToken: 123, owner: 'o', repo: 'r' });

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toMatch(/strings/);
  });
});
