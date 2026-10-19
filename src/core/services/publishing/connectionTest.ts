// src/core/services/publishing/connectionTest.ts

import { GitHubApiClient } from './github/githubApiClient';
import { GitHubProvider } from './git.service';
import { NetlifyProvider } from './netlify.service';

export interface ConnectionTestResult {
  ok: boolean;
  errors: string[];
  /** Things worth telling the author that are not problems. */
  notes: string[];
}

/**
 * Checks a provider's credentials before the first publish. Each provider's own
 * `validateConfig` does the field checks and its live API call (Netlify: list sites with the
 * token; GitHub: read the repository and require push access). For GitHub the test goes one
 * step further and probes the target branch, so a typo is caught here instead of creating a
 * stray branch on the first publish.
 */
export async function testProviderConnection(
  provider: 'netlify' | 'github',
  config: Record<string, unknown>,
  siteId: string,
): Promise<ConnectionTestResult> {
  if (provider === 'netlify') {
    const validation = await new NetlifyProvider().validateConfig(config, siteId);
    return { ok: validation.valid, errors: validation.errors, notes: [] };
  }

  const validation = await new GitHubProvider().validateConfig(config);
  if (!validation.valid) return { ok: false, errors: validation.errors, notes: [] };

  const { accessToken, owner, repo } = config as { accessToken: string; owner: string; repo: string };
  const branch = typeof config.branch === 'string' && config.branch.trim() ? config.branch : 'main';
  try {
    const head = await new GitHubApiClient({ accessToken, owner, repo, branch }).getBranchCommitSHA(branch);
    return {
      ok: true,
      errors: [],
      notes: [
        head === null
          ? `Connected to ${owner}/${repo}. Branch "${branch}" does not exist yet and will be created on the first publish.`
          : `Connected to ${owner}/${repo}. Branch "${branch}" exists.`,
      ],
    };
  } catch (error) {
    return { ok: false, errors: [`Could not read branch "${branch}": ${(error as Error).message}`], notes: [] };
  }
}
