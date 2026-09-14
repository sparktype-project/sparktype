/**
 * The GitHub deployment flow: resolve the branch tip, plan the tree, upload binary assets,
 * create the tree and commit, then move the branch.
 *
 * The flow is kept separate from the provider (`git.service.ts`) so it can be exercised against
 * mocked HTTP with an explicit file map, which is the only way to assert the request payloads
 * that determine whether published bytes are correct.
 */

import type { GitHubConfig, GitHubTreeEntry } from './githubApiClient';
import { GitHubApiClient, GitHubApiError } from './githubApiClient';
import { uploadAssetBlob } from './githubBlobUploader';
import { planDeployment } from './githubTreePlanner';
import { readTrackedPaths, writeTrackedPaths } from './githubPathTracker';

export interface DeployGeneratedFilesOptions {
  siteId: string;
  siteTitle: string;
  config: GitHubConfig;
  branch: string;
  files: Map<string, string | Uint8Array>;
}

export interface GitHubDeploymentResult {
  commitSHA: string;
  /** Paths published by this deployment, recorded for the next one. */
  generatedPaths: string[];
  /** Obsolete generated paths this deployment deleted. */
  deletedPaths: string[];
  /** Whether the branch had to be created (empty repository or missing branch). */
  branchCreated: boolean;
}

export async function deployGeneratedFiles(
  options: DeployGeneratedFilesOptions,
): Promise<GitHubDeploymentResult> {
  const { siteId, siteTitle, config, branch, files } = options;
  const client = new GitHubApiClient(config);
  let branchCreated = false;

  // 1. Resolve the branch tip. `null` covers both an empty repository and a missing branch:
  //    neither has a commit to build on, so both need a root commit and a branch creation.
  const baseCommitSHA = await client.getBranchCommitSHA(branch);

  // 2. `base_tree` takes a tree SHA, not a commit SHA. The ref gives us the commit, so its tree
  //    has to be read separately; the commit SHA is still the new commit's parent below. The
  //    listing then tells us which tracked paths may be deleted, since the tree API errors on a
  //    deletion for a file that is not there.
  const baseTreeSHA = baseCommitSHA === null ? null : await client.getCommitTreeSHA(baseCommitSHA);
  const baseTreePaths = baseTreeSHA === null ? null : await client.listTreePaths(baseTreeSHA);

  // 3. Paths recorded by a previous deployment into this exact repository and branch. `null`
  //    means there is no history, which disables deletions for this deployment.
  const target = `${config.owner}/${config.repo}#${branch}`;
  const previousPaths = await readTrackedPaths(siteId, target);
  const plan = planDeployment({ files, previousPaths, baseTreePaths });

  // 4. Materialise the plan: inline text, upload binary assets as blobs, delete with `sha: null`.
  const entries: GitHubTreeEntry[] = [];
  for (const entry of plan.entries) {
    switch (entry.kind) {
      case 'text':
        entries.push({ path: entry.path, mode: '100644', type: 'blob', content: entry.content });
        break;
      case 'binary':
        entries.push({
          path: entry.path,
          mode: '100644',
          type: 'blob',
          sha: await uploadAssetBlob(client, entry.path, entry.content),
        });
        break;
      case 'delete':
        entries.push({ path: entry.path, mode: '100644', type: 'blob', sha: null });
        break;
    }
  }

  const treeSHA = await client.createTree(entries, baseTreeSHA);

  const timestamp = new Date().toLocaleString();
  const message =
    baseCommitSHA === null
      ? `Initial deploy: ${siteTitle} (${timestamp})`
      : `Update ${siteTitle} - ${files.size} files (${timestamp})`;
  const commitSHA = await client.createCommit(message, treeSHA, baseCommitSHA);

  // 5. Move the branch. The update is non-forcing, so a branch that advanced since step 1 is
  //    rejected by GitHub and that rejection propagates with its original body — a concurrent
  //    update must be reported, never overwritten. Only a 404 (the branch disappeared between
  //    the read and the update) falls back to creating it, which is the sole case the ref really
  //    is missing.
  if (baseCommitSHA === null) {
    await client.createBranchRef(branch, commitSHA);
    branchCreated = true;
  } else {
    try {
      await client.updateBranchRef(branch, commitSHA);
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        await client.createBranchRef(branch, commitSHA);
        branchCreated = true;
      } else {
        throw error;
      }
    }
  }

  await writeTrackedPaths(siteId, target, plan.generatedPaths);

  return {
    commitSHA,
    generatedPaths: plan.generatedPaths,
    deletedPaths: plan.deletedPaths,
    branchCreated,
  };
}
