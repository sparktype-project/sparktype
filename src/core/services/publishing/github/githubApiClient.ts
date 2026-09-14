/**
 * GitHub REST client for the publishing provider.
 *
 * This module owns every HTTP call the GitHub provider makes and, crucially, the *error
 * channel*: a non-2xx response becomes a `GitHubApiError` that carries GitHub's status and
 * response body verbatim, so callers can report what GitHub actually said (e.g. a
 * non-fast-forward rejection) instead of inferring a cause from a bare `catch`.
 *
 * It deliberately knows nothing about site files, blobs-as-assets or tree planning; see
 * `githubBlobUploader.ts`, `githubTreePlanner.ts` and `githubDeployment.ts`.
 */

/**
 * Configuration for a GitHub deployment. Defined here rather than on the provider so the API
 * client, uploader, planner and deployment flow share one shape without importing the provider;
 * `git.service.ts` re-exports it for existing consumers.
 */
export interface GitHubConfig {
  accessToken: string;
  owner: string;
  repo: string;
  branch?: string; // defaults to 'main'
  netlifyIntegration?: boolean; // whether to trigger a Netlify build
}

/** A tree entry that inlines its content. GitHub commits `content` verbatim as UTF-8 text. */
export interface InlineTreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  content: string;
}

/** A tree entry that points at a blob created through the blob API. */
export interface BlobTreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string;
}

/**
 * A deletion. GitHub removes a base-tree path when the entry for it carries `sha: null`;
 * there is no separate delete endpoint for trees.
 */
export interface DeletionTreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: null;
}

export type GitHubTreeEntry = InlineTreeEntry | BlobTreeEntry | DeletionTreeEntry;

/**
 * A failed GitHub request. `body` is GitHub's response body as text (normally a JSON error
 * object such as `{"message":"Update is not a fast forward"}`) and is preserved so the user
 * sees the provider's own explanation.
 */
export class GitHubApiError extends Error {
  readonly operation: string;
  readonly status: number;
  readonly statusText: string;
  readonly body: string;

  constructor(operation: string, status: number, statusText: string, body: string) {
    super(`${operation} failed (${status} ${statusText}): ${body}`);
    this.name = 'GitHubApiError';
    this.operation = operation;
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/** Guard for the JSON objects GitHub returns; lets callers narrow instead of casting. */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads a `sha` from a GitHub response object, failing loudly when the API omits it. */
function readSHA(payload: unknown, what: string): string {
  if (!isJsonObject(payload) || typeof payload.sha !== 'string') {
    throw new Error(`GitHub returned no SHA for ${what}`);
  }
  return payload.sha;
}

export class GitHubApiClient {
  private readonly apiBase = 'https://api.github.com';
  private readonly config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  private get repoPath(): string {
    return `/repos/${this.config.owner}/${this.config.repo}`;
  }

  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    return await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        'Authorization': `token ${this.config.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  private async sendJson(operation: string, method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await this.send(method, path, body);
    if (!response.ok) {
      throw new GitHubApiError(operation, response.status, response.statusText, await response.text());
    }
    return await response.json();
  }

  /** Repository metadata, used to check that the token can actually push. */
  async getRepository(): Promise<unknown> {
    return await this.sendJson('Get repository', 'GET', this.repoPath);
  }

  /**
   * The commit a branch points at, or `null` when there is no commit to build on:
   * 404 means the branch does not exist yet, 409 means the repository is empty. Both need a
   * root commit and a branch creation rather than an update.
   */
  async getBranchCommitSHA(branch: string): Promise<string | null> {
    const response = await this.send('GET', `${this.repoPath}/git/ref/heads/${branch}`);
    if (response.status === 404 || response.status === 409) {
      return null;
    }
    if (!response.ok) {
      throw new GitHubApiError('Get branch', response.status, response.statusText, await response.text());
    }
    const ref = await response.json();
    // `git/ref/heads/{branch}` returns `{ object: { sha } }`.
    if (!isJsonObject(ref) || !isJsonObject(ref.object) || typeof ref.object.sha !== 'string') {
      throw new Error(`GitHub returned no commit SHA for branch ${branch}`);
    }
    return ref.object.sha;
  }

  /**
   * The tree of a commit. The tree API's `base_tree` takes a *tree* SHA, so the commit SHA read
   * from the ref must be resolved through this call before it can be used as a base.
   */
  async getCommitTreeSHA(commitSHA: string): Promise<string> {
    const commit = await this.sendJson('Get commit', 'GET', `${this.repoPath}/git/commits/${commitSHA}`);
    if (!isJsonObject(commit) || !isJsonObject(commit.tree)) {
      throw new Error(`GitHub returned no tree for commit ${commitSHA}`);
    }
    return readSHA(commit.tree, `commit ${commitSHA}`);
  }

  /**
   * Creates a blob from base64 content. This is the only place a binary asset may be written:
   * the blob API accepts the `encoding` parameter, whereas tree entries have no `encoding`
   * field and commit their `content` verbatim.
   */
  async createBlob(contentBase64: string): Promise<string> {
    const payload = await this.sendJson('Create blob', 'POST', `${this.repoPath}/git/blobs`, {
      content: contentBase64,
      encoding: 'base64',
    });
    return readSHA(payload, 'blob');
  }

  /** Creates a tree, optionally on top of `baseTreeSHA`. */
  async createTree(entries: GitHubTreeEntry[], baseTreeSHA: string | null): Promise<string> {
    const payload = await this.sendJson('Create tree', 'POST', `${this.repoPath}/git/trees`, {
      tree: entries,
      ...(baseTreeSHA === null ? {} : { base_tree: baseTreeSHA }),
    });
    return readSHA(payload, 'tree');
  }

  /** Creates a commit; `parentSHA` is the previous commit on the branch, if any. */
  async createCommit(message: string, treeSHA: string, parentSHA: string | null): Promise<string> {
    const payload = await this.sendJson('Create commit', 'POST', `${this.repoPath}/git/commits`, {
      message,
      tree: treeSHA,
      ...(parentSHA === null ? {} : { parents: [parentSHA] }),
    });
    return readSHA(payload, 'commit');
  }

  /**
   * Fast-forwards an existing branch with a non-forcing PATCH: GitHub rejects the update when
   * the branch has moved since it was read, and `GitHubApiError` carries that rejection.
   */
  async updateBranchRef(branch: string, commitSHA: string): Promise<void> {
    await this.sendJson('Branch update', 'PATCH', `${this.repoPath}/git/refs/heads/${branch}`, {
      sha: commitSHA,
    });
  }

  /** Creates a branch ref; used only when the branch (or the whole repository) has no commits. */
  async createBranchRef(branch: string, commitSHA: string): Promise<void> {
    await this.sendJson('Branch creation', 'POST', `${this.repoPath}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: commitSHA,
    });
  }
}
