import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { SiteSecrets } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';
import { readPublishHistory, recordPublishEntry, type PublishHistoryEntry } from '../../history/publishHistory.service';
import { gitSyncService } from '../../gitSync.service';

const { rollbackGitHubMock, restoreDeployMock, isTauriAppMock } = vi.hoisted(() => ({
  rollbackGitHubMock: vi.fn(),
  restoreDeployMock: vi.fn(),
  isTauriAppMock: vi.fn(),
}));
vi.mock('../githubRollback', () => ({ rollbackGitHub: rollbackGitHubMock }));
vi.mock('../../netlify.tauri.service', () => ({ netlifyTauriService: { restoreDeploy: restoreDeployMock } }));
vi.mock('@/core/utils/platform', () => ({ isTauriApp: isTauriAppMock }));

import { canRollbackTo, rollbackSite } from '../rollbackSite';

function githubSite() {
  const site = createSiteFixture('basicSite', { siteId: 'rb-site' });
  site.manifest.publishingConfig = { provider: 'github', github: { owner: 'o', repo: 'r', branch: 'main' } };
  site.secrets = { publishing: { github: { accessToken: 'gh-token' } } } satisfies SiteSecrets;
  return site;
}
function netlifySite() {
  const site = createSiteFixture('basicSite', { siteId: 'rb-site' });
  site.manifest.publishingConfig = { provider: 'netlify', netlify: { siteId: 'nl-1' } };
  site.secrets = { publishing: { netlify: { apiToken: 'nl-token' } } } satisfies SiteSecrets;
  return site;
}

function entry(id: string, overrides: Partial<PublishHistoryEntry> = {}): PublishHistoryEntry {
  return {
    id,
    kind: 'publish',
    startedAt: '2025-01-01T10:00:00.000Z',
    finishedAt: '2025-01-01T10:00:05.000Z',
    provider: 'github',
    target: 'o/r#main',
    outcome: 'success',
    commitSHA: `sha-${id}`,
    findings: { blocking: 0, warning: 0 },
    log: [],
    ...overrides,
  };
}

describe('canRollbackTo', () => {
  const history = [entry('new'), entry('old')]; // newest first

  test('GitHub: any earlier successful entry with a commit for the configured target', () => {
    const site = githubSite();
    expect(canRollbackTo(site, history[1], history)).toBe(true);
  });

  test('not the entry that is already live', () => {
    expect(canRollbackTo(githubSite(), history[0], history)).toBe(false);
  });

  test('not a failed entry, one without an identifier, or one for another target', () => {
    const site = githubSite();
    const all = [entry('new'), entry('bad', { outcome: 'failed' }), entry('none', { commitSHA: undefined }), entry('elsewhere', { target: 'o/other#main' })];
    for (const candidate of all.slice(1)) expect(canRollbackTo(site, candidate, all)).toBe(false);
  });

  test('Netlify needs a recorded deploy id and the desktop app', () => {
    const site = netlifySite();
    const all = [
      entry('new', { provider: 'netlify', target: 'netlify:nl-1', commitSHA: undefined, deployId: 'd2' }),
      entry('old', { provider: 'netlify', target: 'netlify:nl-1', commitSHA: undefined, deployId: 'd1' }),
      entry('noid', { provider: 'netlify', target: 'netlify:nl-1', commitSHA: undefined }),
    ];
    isTauriAppMock.mockReturnValue(true);
    expect(canRollbackTo(site, all[1], all)).toBe(true);
    expect(canRollbackTo(site, all[2], all)).toBe(false);
    isTauriAppMock.mockReturnValue(false);
    expect(canRollbackTo(site, all[1], all)).toBe(false);
  });

  test('ZIP exports can never be rolled back', () => {
    const site = createSiteFixture('basicSite');
    const zip = [entry('a', { provider: 'zip', target: 'download', commitSHA: undefined }), entry('b', { provider: 'zip', target: 'download', commitSHA: undefined })];
    expect(canRollbackTo(site, zip[1], zip)).toBe(false);
  });

  test('a rollback entry is itself a state that can be restored', () => {
    const all = [entry('live'), entry('rb', { kind: 'rollback', restoredFrom: 'x' })];
    expect(canRollbackTo(githubSite(), all[1], all)).toBe(true);
  });
});

describe('rollbackSite', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    isTauriAppMock.mockReturnValue(true);
    await resetIndexedDbForTests();
  });

  test('GitHub: restores the commit, records a rollback entry and syncs state', async () => {
    const site = githubSite();
    const old = entry('old');
    await recordPublishEntry(site.siteId, old);
    rollbackGitHubMock.mockResolvedValue({ commitSHA: 'sha-restore' });

    const result = await rollbackSite(site, old);

    expect(rollbackGitHubMock).toHaveBeenCalledWith({
      siteId: 'rb-site',
      siteTitle: site.manifest.title,
      config: { accessToken: 'gh-token', owner: 'o', repo: 'r', branch: 'main' },
      branch: 'main',
      commitSHA: 'sha-old',
    });
    expect(result.success).toBe(true);
    const [recorded, previous] = await readPublishHistory(site.siteId);
    expect(recorded).toMatchObject({
      kind: 'rollback',
      outcome: 'success',
      provider: 'github',
      target: 'o/r#main',
      commitSHA: 'sha-restore',
      restoredFrom: 'old',
      url: 'https://github.com/o/r',
    });
    expect(previous).toEqual(old);
    expect((await gitSyncService.getSyncState(site.siteId))?.lastKnownCommitSHA).toBe('sha-restore');
  });

  test('GitHub: a rejected rollback is recorded as a failure and the earlier entry is untouched', async () => {
    const site = githubSite();
    const old = entry('old');
    await recordPublishEntry(site.siteId, old);
    rollbackGitHubMock.mockRejectedValue(new Error('Branch update failed (422 Unprocessable Entity): Update is not a fast forward'));

    const result = await rollbackSite(site, old);

    expect(result).toMatchObject({ success: false });
    expect(result.message).toContain('not a fast forward');
    const [recorded, previous] = await readPublishHistory(site.siteId);
    expect(recorded).toMatchObject({ kind: 'rollback', outcome: 'failed', restoredFrom: 'old' });
    expect(recorded.commitSHA).toBeUndefined();
    expect(previous).toEqual(old);
    expect(await gitSyncService.getSyncState(site.siteId)).toBeNull();
  });

  test('Netlify: restores the recorded deploy through the API and records the result', async () => {
    const site = netlifySite();
    const old = entry('old', { provider: 'netlify', target: 'netlify:nl-1', commitSHA: undefined, deployId: 'deploy-1' });
    await recordPublishEntry(site.siteId, old);
    restoreDeployMock.mockResolvedValue({ success: true, message: 'Previous deploy restored.', deployId: 'deploy-1', url: 'https://d1.netlify.app' });

    const result = await rollbackSite(site, old);

    expect(restoreDeployMock).toHaveBeenCalledWith('nl-token', 'nl-1', 'deploy-1');
    expect(result.success).toBe(true);
    const [recorded] = await readPublishHistory(site.siteId);
    expect(recorded).toMatchObject({ kind: 'rollback', provider: 'netlify', deployId: 'deploy-1', restoredFrom: 'old', url: 'https://d1.netlify.app' });
  });

  test('refuses an entry that cannot be rolled back, without calling any provider or recording', async () => {
    const site = githubSite();
    const result = await rollbackSite(site, entry('x', { commitSHA: undefined }));

    expect(result.success).toBe(false);
    expect(rollbackGitHubMock).not.toHaveBeenCalled();
    expect(await readPublishHistory(site.siteId)).toEqual([]);
  });
});
