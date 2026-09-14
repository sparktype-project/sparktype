/**
 * The GitHub deployment flow: resolve the branch tip, plan the tree, upload blobs for large
 * assets, create the tree and commit, then move the branch.
 *
 * The flow is kept separate from the provider (`git.service.ts`) so it can be exercised against
 * mocked HTTP with an explicit file map, which is the only way to assert the request payloads
 * that determine whether published bytes are correct.
 */

import type { GitHubConfig, GitHubTreeEntry } from './githubApiClient';
import { GitHubApiClient } from './githubApiClient';
import { encodeBase64, uploadAssetBlob } from './githubBlobUploader';
import { planDeployment } from './githubTreePlanner';

export interface DeployGeneratedFilesOptions {
  siteId: string;
  siteTitle: string;
  config: GitHubConfig;
  branch: string;
  files: Map<string, string | Uint8Array>;
}

export interface GitHubDeploymentResult {
  commitSHA: string;
  /** Whether the branch had to be created (empty repository or missing branch). */
  branchCreated: boolean;
}

/**
 * Seeds an empty repository with a README through the Contents API. GitHub's Git Data API needs
 * an existing commit to build on, so the first deployment cannot create a tree without one.
 */
async function seedEmptyRepository(
  client: GitHubApiClient,
  siteTitle: string,
  branch: string,
  fileCount: number,
): Promise<string> {
  const timestamp = new Date().toLocaleString();
  const readme = `# ${siteTitle}

This site was deployed using Sparktype.

Generated on: ${timestamp}
Files: ${fileCount}
`;

  return await client.createFile(
    'README.md',
    encodeBase64(new TextEncoder().encode(readme)),
    `Initial deploy: ${siteTitle} (${timestamp})`,
    branch,
  );
}

export async function deployGeneratedFiles(
  options: DeployGeneratedFilesOptions,
): Promise<GitHubDeploymentResult> {
  const { siteTitle, config, branch, files } = options;
  const client = new GitHubApiClient(config);

  // 1. Resolve the branch tip. `null` covers both an empty repository and a missing branch:
  //    neither has a commit to build on.
  const baseCommitSHA = await client.getBranchCommitSHA(branch);
  const parentSHA = baseCommitSHA ?? (await seedEmptyRepository(client, siteTitle, branch, files.size));

  // 2. Materialise the plan: inline content, upload large assets as blobs first.
  const plan = planDeployment({ files });
  const entries: GitHubTreeEntry[] = [];
  for (const entry of plan.entries) {
    switch (entry.kind) {
      case 'text':
      case 'inline-base64':
        entries.push({ path: entry.path, mode: '100644', type: 'blob', content: entry.content });
        break;
      case 'blob':
        entries.push({
          path: entry.path,
          mode: '100644',
          type: 'blob',
          sha: await uploadAssetBlob(client, entry.path, entry.content),
        });
        break;
    }
  }

  const treeSHA = await client.createTree(entries, parentSHA);

  const timestamp = new Date().toLocaleString();
  const message =
    baseCommitSHA === null
      ? `Add site files: ${siteTitle} (${timestamp})`
      : `Update ${siteTitle} - ${files.size} files (${timestamp})`;
  const commitSHA = await client.createCommit(message, treeSHA, parentSHA);

  await client.updateBranchRef(branch, commitSHA);

  return { commitSHA, branchCreated: baseCommitSHA === null };
}
