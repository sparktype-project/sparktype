// src/core/services/publishing/rollback/githubRollback.ts

import { GitHubApiClient, GitHubApiError, type GitHubConfig } from '../github/githubApiClient';
import { readTrackedPaths, writeTrackedPaths } from '../github/githubPathTracker';

export interface GitHubRollbackOptions {
  siteId: string;
  siteTitle: string;
  config: GitHubConfig;
  branch: string;
  /** A commit this site published earlier, whose tree is to be restored. */
  commitSHA: string;
}

/**
 * Restores the tree of an earlier published commit by adding a new commit on top of the branch.
 * History is kept, and the branch is moved with the same non-forcing update a publish uses, so a
 * branch someone else advanced since it was read is rejected with GitHub's own error rather than
 * overwritten.
 */
export async function rollbackGitHub(options: GitHubRollbackOptions): Promise<{ commitSHA: string }> {
  const { siteId, siteTitle, config, branch, commitSHA } = options;
  const client = new GitHubApiClient(config);

  const headSHA = await client.getBranchCommitSHA(branch);
  if (headSHA === null) {
    throw new Error(`Branch "${branch}" does not exist in ${config.owner}/${config.repo}.`);
  }
  if (headSHA === commitSHA) {
    throw new Error('The branch is already at that commit.');
  }

  let targetTreeSHA: string;
  try {
    targetTreeSHA = await client.getCommitTreeSHA(commitSHA);
  } catch (error) {
    if (error instanceof GitHubApiError && (error.status === 404 || error.status === 422)) {
      throw new Error(`Commit ${commitSHA.slice(0, 7)} no longer exists in ${config.owner}/${config.repo}.`);
    }
    throw error;
  }
  const headTreeSHA = await client.getCommitTreeSHA(headSHA);

  const message = `Roll back ${siteTitle} to ${commitSHA.slice(0, 7)}`;
  const newCommitSHA = await client.createCommit(message, targetTreeSHA, headSHA);
  await client.updateBranchRef(branch, newCommitSHA);

  const target = `${config.owner}/${config.repo}#${branch}`;
  try {
    await retrackRestoredPaths(client, siteId, target, headTreeSHA, targetTreeSHA);
  } catch (error) {
    // The branch has already moved, so the rollback happened; a stale record only costs a
    // future deletion, exactly as after a publish.
    console.error(`[GitHubRollback] Failed to update generated paths for ${target}:`, error);
  }

  return { commitSHA: newCommitSHA };
}

/**
 * Files that were in the restored tree but not in the one it replaced were removed by a later
 * publish, which only deletes generated files, so they are generated files again now that they
 * are back. They join the tracked set so the next publish can clear them when they are obsolete.
 * Without an existing record nothing is added (no record means no deletions), and a truncated
 * listing proves nothing about what is missing, so the record is left as it was.
 */
async function retrackRestoredPaths(
  client: GitHubApiClient,
  siteId: string,
  target: string,
  headTreeSHA: string,
  restoredTreeSHA: string,
): Promise<void> {
  const tracked = await readTrackedPaths(siteId, target);
  if (tracked === null) return;

  const [head, restored] = await Promise.all([
    client.listTreePaths(headTreeSHA),
    client.listTreePaths(restoredTreeSHA),
  ]);
  if (head.truncated || restored.truncated) return;

  const brought = [...restored.paths].filter((path) => !head.paths.has(path));
  await writeTrackedPaths(siteId, target, [...new Set([...tracked, ...brought])].sort());
}
