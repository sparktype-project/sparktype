import { beforeEach, describe, expect, test } from 'vitest';
import { GitHubApiStub } from '@/test/support/githubApiStub';
import { resetIndexedDbForTests } from '@/test/support/storage';
import { deployGeneratedFiles } from '../../github/githubDeployment';
import { readTrackedPaths } from '../../github/githubPathTracker';
import { rollbackGitHub } from '../githubRollback';

const CONFIG = { accessToken: 'token', owner: 'o', repo: 'r', branch: 'main' };
const TARGET = 'o/r#main';
const SITE = 'rollback-site';

async function deploy(files: Record<string, string>) {
  return deployGeneratedFiles({
    siteId: SITE,
    siteTitle: 'Rollback',
    config: CONFIG,
    branch: 'main',
    files: new Map(Object.entries(files)),
  });
}

function rollback(commitSHA: string) {
  return rollbackGitHub({ siteId: SITE, siteTitle: 'Rollback', config: CONFIG, branch: 'main', commitSHA });
}

describe('rollbackGitHub', () => {
  beforeEach(async () => {
    await resetIndexedDbForTests();
  });

  async function twoDeploys(stub: GitHubApiStub) {
    stub.install();
    const first = await deploy({ 'index.html': 'v1', 'old.html': 'old page' });
    const second = await deploy({ 'index.html': 'v2' });
    return { first, second };
  }

  test('adds a new commit on top of the branch that restores the old tree', async () => {
    const stub = new GitHubApiStub({ existingFiles: { 'README.md': 'mine' } });
    const { first, second } = await twoDeploys(stub);
    expect(stub.hasFile('old.html')).toBe(false);
    stub.requests.length = 0;
    stub.commitRequests.length = 0;

    const result = await rollback(first.commitSHA);

    // History is preserved: one new commit whose parent is the current tip and whose tree is the
    // recorded commit's tree, not a rewrite of the branch.
    expect(stub.commitRequests).toEqual([
      {
        message: expect.stringContaining('Roll back Rollback to'),
        tree: stub.commitTreeSHA(first.commitSHA),
        parents: [second.commitSHA],
      },
    ]);
    expect(result.commitSHA).toBe(stub.branchCommitSHA());
    expect(result.commitSHA).not.toBe(first.commitSHA);
    expect(stub.textFile('index.html')).toBe('v1');
    expect(stub.textFile('old.html')).toBe('old page');
    expect(stub.textFile('README.md')).toBe('mine');
  });

  test('moves the branch with a non-forcing update to exactly the new commit', async () => {
    const stub = new GitHubApiStub();
    const { first } = await twoDeploys(stub);
    stub.requests.length = 0;

    const result = await rollback(first.commitSHA);

    const patches = stub.requests.filter((request) => request.method === 'PATCH');
    expect(patches).toEqual([
      { method: 'PATCH', path: '/repos/o/r/git/refs/heads/main', body: { sha: result.commitSHA } },
    ]);
    expect(stub.requests.some((request) => request.method === 'POST' && request.path.endsWith('/git/trees'))).toBe(false);
  });

  test('rejects a branch that advanced while the rollback was running and changes nothing', async () => {
    let advance = () => {};
    const stub = new GitHubApiStub({ beforeRefUpdate: () => advance() });
    const { first } = await twoDeploys(stub);
    const trackedBefore = await readTrackedPaths(SITE, TARGET);
    advance = () => stub.deleteFile('index.html');

    await expect(rollback(first.commitSHA)).rejects.toThrow(/not a fast forward/);

    expect(stub.hasFile('index.html')).toBe(false);
    expect(await readTrackedPaths(SITE, TARGET)).toEqual(trackedBefore);
  });

  test('re-tracks the generated paths the rollback brings back, and keeps tracking the rest', async () => {
    const stub = new GitHubApiStub({ existingFiles: { 'README.md': 'mine' } });
    const { first } = await twoDeploys(stub);
    expect(await readTrackedPaths(SITE, TARGET)).toEqual(['index.html']);

    await rollback(first.commitSHA);

    // old.html returns to the repository, so the next deploy must be able to remove it again;
    // the user's README was never generated and stays untracked.
    expect(await readTrackedPaths(SITE, TARGET)).toEqual(['index.html', 'old.html']);
  });

  test('leaves tracking alone when the site has no deployment history for the target', async () => {
    const stub = new GitHubApiStub();
    stub.install();
    const first = await deploy({ 'index.html': 'v1' });
    await resetIndexedDbForTests();
    await deploy({ 'index.html': 'v2' });
    await resetIndexedDbForTests();

    await rollback(first.commitSHA);

    expect(await readTrackedPaths(SITE, TARGET)).toBeNull();
  });

  test('does not update tracking from a truncated tree listing', async () => {
    const stub = new GitHubApiStub();
    const { first } = await twoDeploys(stub);
    const trackedBefore = await readTrackedPaths(SITE, TARGET);
    stub.truncateTreeListing = true;

    await rollback(first.commitSHA);

    expect(await readTrackedPaths(SITE, TARGET)).toEqual(trackedBefore);
  });

  test('refuses to roll back to the commit the branch is already at', async () => {
    const stub = new GitHubApiStub();
    const { second } = await twoDeploys(stub);
    stub.requests.length = 0;

    await expect(rollback(second.commitSHA)).rejects.toThrow(/already at/);
    expect(stub.requests.some((request) => request.method !== 'GET')).toBe(false);
  });

  test('explains when the recorded commit no longer exists', async () => {
    const stub = new GitHubApiStub();
    await twoDeploys(stub);

    await expect(rollback('deadbeef')).rejects.toThrow(/no longer exists/);
  });
});
