/**
 * In-memory stand-in for the GitHub REST endpoints the publishing provider uses.
 *
 * Tests assert on the requests the provider actually sends (which is the only way to catch a
 * base64 payload committed as literal text) and on the repository state those requests produce:
 * the stub applies `base_tree` + tree entries with GitHub's real semantics, including
 * `sha: null` deletions, so "the obsolete page is gone and the user's README is still there" can
 * be asserted on the resulting tree rather than on the request alone.
 *
 * No network access, ever.
 */

import { vi } from 'vitest';
import { isJsonObject } from '@/core/services/publishing/github/githubApiClient';

export interface RecordedGitHubRequest {
  method: string;
  /** Path with query string, relative to the API base. */
  path: string;
  body: unknown;
}

/** A tree entry as it appeared in the request payload: `sha: null` marks a deletion. */
export interface RecordedTreeEntry {
  path: string;
  mode: string;
  type: string;
  content?: string;
  sha?: string | null;
}

export interface RecordedTreeRequest {
  baseTree: string | null;
  entries: RecordedTreeEntry[];
}

export interface RecordedBlobRequest {
  content: string;
  encoding: unknown;
}

export interface RecordedCommitRequest {
  message: string;
  tree: string;
  parents: string[];
}

export interface GitHubApiStubOptions {
  /** Files already committed on the branch, as path → text content. */
  existingFiles?: Record<string, string>;
  /** The repository has no commits: every branch ref read answers 409. */
  emptyRepository?: boolean;
  /** Branch name pre-created in the stub; defaults to `main`. */
  defaultBranch?: string;
  /** Further branches that already exist at the same commit. */
  extraBranches?: string[];
  /** Repository metadata; `push: false` makes validation fail. */
  pushPermission?: boolean;
  /** Makes PATCH on the branch ref fail, e.g. a non-fast-forward rejection. */
  refUpdateFailure?: { status: number; body: string };
}

type StubTreeItem = { kind: 'text'; content: string } | { kind: 'binary'; blobSHA: string };

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  401: 'Unauthorized',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
};

/** Decodes standard base64 into raw bytes, matching what the blob API is given. */
export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: STATUS_TEXT[status] ?? 'Error',
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

export class GitHubApiStub {
  readonly requests: RecordedGitHubRequest[] = [];
  readonly treeRequests: RecordedTreeRequest[] = [];
  readonly blobRequests: RecordedBlobRequest[] = [];
  readonly commitRequests: RecordedCommitRequest[] = [];

  private readonly blobContentBySHA = new Map<string, string>();
  private readonly treeBySHA = new Map<string, Map<string, StubTreeItem>>();
  private readonly treeByCommitSHA = new Map<string, string>();
  private readonly branches = new Map<string, { commitSHA: string; tree: Map<string, StubTreeItem> }>();
  private readonly options: GitHubApiStubOptions;
  private shaCounter = 0;

  constructor(options: GitHubApiStubOptions = {}) {
    this.options = options;

    if (!options.emptyRepository) {
      let tree = new Map<string, StubTreeItem>(
        Object.entries(options.existingFiles ?? {}).map(([path, content]) => [
          path,
          { kind: 'text', content } satisfies StubTreeItem,
        ]),
      );
      const commitSHA = 'commit-0';
      const treeSHA = this.nextSHA('tree');
      this.treeByCommitSHA.set(commitSHA, treeSHA);
      this.treeBySHA.set(treeSHA, tree);

      for (const branch of [options.defaultBranch ?? 'main', ...(options.extraBranches ?? [])]) {
        // Each extra branch starts at its own copy of the same commit, so moving one cannot
        // silently move another.
        tree = new Map(tree);
        this.branches.set(branch, { commitSHA, tree });
      }
    }
  }

  /** Installs the stub as the global `fetch` for the current test. */
  install(): void {
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      const parsed = new URL(String(url));
      const method = (init.method ?? 'GET').toUpperCase();
      const body = init.body === undefined ? undefined : JSON.parse(String(init.body));
      this.requests.push({ method, path: parsed.pathname + parsed.search, body });
      return this.handle(method, parsed.pathname, body);
    });
  }

  /** Whether the branch's current tree contains `path`. */
  hasFile(path: string, branch = 'main'): boolean {
    return this.branches.get(branch)?.tree.has(path) ?? false;
  }

  /** The commit a branch points at, or `null` when the stub has no such branch. */
  branchCommitSHA(branch = 'main'): string | null {
    return this.branches.get(branch)?.commitSHA ?? null;
  }

  /** The tree SHA the stub associates with a commit, so tests can assert `base_tree` exactly. */
  commitTreeSHA(commitSHA: string): string | null {
    return this.treeByCommitSHA.get(commitSHA) ?? null;
  }

  /** Text content of `path` in the branch's current tree, or `null`. */
  textFile(path: string, branch = 'main'): string | null {
    const item = this.branches.get(branch)?.tree.get(path);
    return item?.kind === 'text' ? item.content : null;
  }

  /** Bytes published at `path`, resolved through the blob the tree references, or `null`. */
  publishedBytes(path: string, branch = 'main'): Uint8Array | null {
    const item = this.branches.get(branch)?.tree.get(path);
    if (item?.kind !== 'binary') {
      return null;
    }
    const base64 = this.blobContentBySHA.get(item.blobSHA);
    return base64 === undefined ? null : decodeBase64(base64);
  }

  private nextSHA(kind: string): string {
    this.shaCounter += 1;
    return `${kind}-${this.shaCounter}`;
  }

  private handle(method: string, path: string, body: unknown) {
    const suffix = path.replace(/^\/repos\/[^/]+\/[^/]+/, '');

    if (method === 'GET' && suffix === '') {
      return response(200, { permissions: { push: this.options.pushPermission ?? true } });
    }
    if (method === 'GET' && suffix.startsWith('/git/ref/heads/')) {
      return this.handleGetBranchRef(suffix.slice('/git/ref/heads/'.length));
    }
    if (method === 'GET' && suffix.startsWith('/git/commits/')) {
      const commitSHA = suffix.slice('/git/commits/'.length);
      const treeSHA = this.treeByCommitSHA.get(commitSHA);
      return treeSHA
        ? response(200, { sha: commitSHA, tree: { sha: treeSHA } })
        : response(404, { message: 'Not Found' });
    }
    if (method === 'GET' && suffix.startsWith('/contents/')) {
      // Conflict detection probes `_site`; nothing has been imported from this repository.
      return response(404, { message: 'Not Found' });
    }
    if (method === 'POST' && suffix === '/git/blobs') {
      return this.handleCreateBlob(body);
    }
    if (method === 'POST' && suffix === '/git/trees') {
      return this.handleCreateTree(body);
    }
    if (method === 'POST' && suffix === '/git/commits') {
      return this.handleCreateCommit(body);
    }
    if (method === 'PATCH' && suffix.startsWith('/git/refs/heads/')) {
      return this.handleUpdateRef(suffix.slice('/git/refs/heads/'.length), body);
    }
    if (method === 'POST' && suffix === '/git/refs') {
      return this.handleCreateRef(body);
    }

    throw new Error(`GitHubApiStub: unhandled request ${method} ${path}`);
  }

  private handleGetBranchRef(branch: string) {
    if (this.options.emptyRepository) {
      return response(409, { message: 'Git Repository is empty.' });
    }
    const existing = this.branches.get(branch);
    if (!existing) {
      return response(404, { message: 'Not Found' });
    }
    return response(200, { object: { sha: existing.commitSHA } });
  }

  private handleCreateBlob(body: unknown) {
    if (!isJsonObject(body) || typeof body.content !== 'string' || body.encoding !== 'base64') {
      return response(422, { message: 'Blob content must be base64 encoded' });
    }
    this.blobRequests.push({ content: body.content, encoding: body.encoding });
    const sha = this.nextSHA('blob');
    this.blobContentBySHA.set(sha, body.content);
    return response(201, { sha });
  }

  private handleCreateTree(body: unknown) {
    if (!isJsonObject(body) || !Array.isArray(body.tree)) {
      return response(422, { message: 'Invalid tree' });
    }
    const baseTree = typeof body.base_tree === 'string' ? body.base_tree : null;

    const entries: RecordedTreeEntry[] = [];
    for (const rawEntry of body.tree) {
      if (
        !isJsonObject(rawEntry) ||
        typeof rawEntry.path !== 'string' ||
        typeof rawEntry.mode !== 'string' ||
        typeof rawEntry.type !== 'string'
      ) {
        return response(422, { message: 'Invalid tree entry' });
      }
      if (rawEntry.sha === null) {
        entries.push({ path: rawEntry.path, mode: rawEntry.mode, type: rawEntry.type, sha: null });
      } else if (typeof rawEntry.sha === 'string') {
        entries.push({ path: rawEntry.path, mode: rawEntry.mode, type: rawEntry.type, sha: rawEntry.sha });
      } else if (typeof rawEntry.content === 'string') {
        entries.push({ path: rawEntry.path, mode: rawEntry.mode, type: rawEntry.type, content: rawEntry.content });
      } else {
        return response(422, { message: 'Invalid tree entry' });
      }
    }

    const nextTree = new Map<string, StubTreeItem>();
    if (baseTree !== null) {
      const base = this.treeBySHA.get(baseTree);
      if (!base) {
        return response(422, { message: `Not a valid tree: ${baseTree}` });
      }
      for (const [path, item] of base) {
        nextTree.set(path, item);
      }
    }

    for (const entry of entries) {
      if (entry.sha === null) {
        nextTree.delete(entry.path);
      } else if (typeof entry.sha === 'string') {
        nextTree.set(entry.path, { kind: 'binary', blobSHA: entry.sha });
      } else if (typeof entry.content === 'string') {
        nextTree.set(entry.path, { kind: 'text', content: entry.content });
      }
    }

    this.treeRequests.push({ baseTree, entries });
    const sha = this.nextSHA('tree');
    this.treeBySHA.set(sha, nextTree);
    return response(201, { sha });
  }

  private handleCreateCommit(body: unknown) {
    if (!isJsonObject(body) || typeof body.tree !== 'string' || typeof body.message !== 'string') {
      return response(422, { message: 'Invalid commit' });
    }
    const parents = Array.isArray(body.parents)
      ? body.parents.filter((parent): parent is string => typeof parent === 'string')
      : [];
    this.commitRequests.push({ message: body.message, tree: body.tree, parents });
    const sha = this.nextSHA('commit');
    this.treeByCommitSHA.set(sha, body.tree);
    return response(201, { sha });
  }

  private handleUpdateRef(branch: string, body: unknown) {
    if (this.options.refUpdateFailure) {
      const failure = this.options.refUpdateFailure;
      if (failure.status === 404) {
        // A 404 here means the branch is genuinely gone, so the stub drops it too.
        this.branches.delete(branch);
      }
      return response(failure.status, failure.body);
    }
    if (!this.branches.has(branch)) {
      return response(404, { message: 'Not Found' });
    }
    if (!isJsonObject(body) || typeof body.sha !== 'string') {
      return response(422, { message: 'Invalid ref update' });
    }
    this.moveBranch(branch, body.sha);
    return response(200, { object: { sha: body.sha } });
  }

  private handleCreateRef(body: unknown) {
    if (!isJsonObject(body) || typeof body.sha !== 'string' || typeof body.ref !== 'string') {
      return response(422, { message: 'Invalid ref' });
    }
    const branch = body.ref.replace(/^refs\/heads\//, '');
    if (this.branches.has(branch)) {
      return response(422, { message: 'Reference already exists' });
    }
    this.moveBranch(branch, body.sha);
    return response(201, { ref: body.ref, object: { sha: body.sha } });
  }

  private moveBranch(branch: string, commitSHA: string): void {
    const treeSHA = this.treeByCommitSHA.get(commitSHA);
    if (!treeSHA) {
      throw new Error(`GitHubApiStub: unknown commit ${commitSHA}`);
    }
    this.branches.set(branch, { commitSHA, tree: new Map(this.treeBySHA.get(treeSHA)) });
  }
}
