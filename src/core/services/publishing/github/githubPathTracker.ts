/**
 * Storage for the set of paths Sparktype last generated into a repository.
 *
 * The list lives in the `githubDeployState` metadata store (IndexedDB via `siteStorage`), keyed
 * by site id and then by deployment target (`owner/repo#branch`), because one site can publish to
 * more than one repository or branch and a record for one target says nothing about another's
 * files. It is written only after a deployment succeeds, so a failed deployment never makes the
 * next one believe paths were published that were not.
 *
 * Compatibility with pre-existing repositories: no record means *no history*, and
 * `readTrackedPaths` returns `null` for it. That is the conservative answer — the deployment
 * records the paths it published but deletes nothing (see `githubTreePlanner.ts`). The same
 * applies to a target with no record of its own, so a repository or branch this site has never
 * published to is never treated as if its files were ours.
 */

import { readMetadata, writeMetadata } from '@/core/services/storage/siteStorage.service';
import { isJsonObject } from './githubApiClient';

const DEPLOY_STATE_STORE = 'githubDeployState';

/** Persisted shape: generated paths by `owner/repo#branch`. */
interface GitHubDeployState {
  pathsByTarget: Record<string, string[]>;
}

/** The stored path list for one target, or `null` when there is none to trust. */
function pathsForTarget(state: unknown, target: string): string[] | null {
  if (!isJsonObject(state) || !isJsonObject(state.pathsByTarget)) {
    return null;
  }

  const paths = state.pathsByTarget[target];
  if (!Array.isArray(paths)) {
    return null;
  }

  return paths.filter((path): path is string => typeof path === 'string');
}

/**
 * The paths generated into `target` by the previous deployment, or `null` when this site has no
 * usable history for that repository and branch.
 */
export async function readTrackedPaths(siteId: string, target: string): Promise<string[] | null> {
  return pathsForTarget(await readMetadata<GitHubDeployState>(DEPLOY_STATE_STORE, siteId), target);
}

/** Records the paths a successful deployment generated, keeping every other target's history. */
export async function writeTrackedPaths(
  siteId: string,
  target: string,
  generatedPaths: string[],
): Promise<void> {
  const state = await readMetadata<GitHubDeployState>(DEPLOY_STATE_STORE, siteId);

  const pathsByTarget: Record<string, string[]> = {};
  if (isJsonObject(state) && isJsonObject(state.pathsByTarget)) {
    for (const [key, value] of Object.entries(state.pathsByTarget)) {
      if (Array.isArray(value)) {
        pathsByTarget[key] = value.filter((path): path is string => typeof path === 'string');
      }
    }
  }
  pathsByTarget[target] = generatedPaths;

  await writeMetadata(DEPLOY_STATE_STORE, siteId, { pathsByTarget } satisfies GitHubDeployState);
}
