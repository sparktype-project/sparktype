/**
 * Storage for the set of paths Sparktype last generated into a repository.
 *
 * The list lives in the `githubDeployState` metadata store (IndexedDB via `siteStorage`), keyed
 * by site id, alongside the repository and branch it was written to. It is written only after a
 * deployment succeeds, so a failed deployment never makes the next one believe paths were
 * published that were not.
 *
 * Compatibility with pre-existing repositories: no record means *no history*, and
 * `readTrackedPaths` returns `null` for it. That is the conservative answer — the deployment
 * records the paths it published but deletes nothing (see `githubTreePlanner.ts`). The same
 * applies after the repository or branch changes, because a path list from another repository
 * says nothing about this one and must never license deleting its files.
 */

import { readMetadata, writeMetadata } from '@/core/services/storage/siteStorage.service';

const DEPLOY_STATE_STORE = 'githubDeployState';

interface GitHubDeployState {
  /** `owner/repo#branch` the paths were generated into. */
  target: string;
  generatedPaths: string[];
}

/**
 * The paths generated into `target` by the previous deployment, or `null` when this site has no
 * usable history for that repository and branch.
 */
export async function readTrackedPaths(siteId: string, target: string): Promise<string[] | null> {
  const state = await readMetadata<GitHubDeployState>(DEPLOY_STATE_STORE, siteId);
  if (!state || state.target !== target || !Array.isArray(state.generatedPaths)) {
    return null;
  }

  return state.generatedPaths.filter((path): path is string => typeof path === 'string');
}

/** Records the paths a successful deployment generated, replacing any previous record. */
export async function writeTrackedPaths(
  siteId: string,
  target: string,
  generatedPaths: string[],
): Promise<void> {
  const state: GitHubDeployState = { target, generatedPaths };
  await writeMetadata(DEPLOY_STATE_STORE, siteId, state);
}
