import { deployGeneratedFiles } from '../github/githubDeployment';
import { GitHubApiStub, decodeBase64 } from '@/test/support/githubApiStub';

const CONFIG = { accessToken: 'token', owner: 'o', repo: 'r', branch: 'main' };

describe('deployGeneratedFiles', () => {
  test('uploads binary assets as blobs and inlines text verbatim', async () => {
    const stub = new GitHubApiStub();
    stub.install();

    const smallPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const largePng = new Uint8Array(1024 * 1024 + 1).fill(0xab);
    const html = '<html lang="en">café — 你好 🎉</html>';

    const result = await deployGeneratedFiles({
      siteId: 'site-binaries',
      siteTitle: 'Binaries',
      config: CONFIG,
      branch: 'main',
      files: new Map<string, string | Uint8Array>([
        ['index.html', html],
        ['assets/small.png', smallPng],
        ['assets/large.png', largePng],
      ]),
    });

    // Both binaries went to the blob API with explicit base64 encoding; the tree references the
    // returned SHAs instead of carrying content, so the committed bytes are the asset's bytes.
    expect(stub.blobRequests).toHaveLength(2);
    expect(decodeBase64(stub.blobRequests[0].content)).toEqual(smallPng);
    expect(decodeBase64(stub.blobRequests[1].content)).toEqual(largePng);

    const [treeRequest] = stub.treeRequests;
    expect(treeRequest.entries).toEqual([
      { path: 'index.html', mode: '100644', type: 'blob', content: html },
      { path: 'assets/small.png', mode: '100644', type: 'blob', sha: expect.any(String) },
      { path: 'assets/large.png', mode: '100644', type: 'blob', sha: expect.any(String) },
    ]);
    expect(stub.publishedBytes('assets/small.png')).toEqual(smallPng);
    expect(stub.publishedBytes('assets/large.png')).toEqual(largePng);
    expect(stub.textFile('index.html')).toBe(html);
    expect(result.generatedPaths).toEqual(['assets/large.png', 'assets/small.png', 'index.html']);
  });

  test('uses the commit tree SHA as base_tree and the commit SHA as parent', async () => {
    const stub = new GitHubApiStub();
    stub.install();

    await deployGeneratedFiles({
      siteId: 'site-base-tree',
      siteTitle: 'Base tree',
      config: CONFIG,
      branch: 'main',
      files: new Map([['index.html', '<html>home</html>']]),
    });

    const baseCommitTreeSHA = stub.commitTreeSHA('commit-0');
    expect(stub.treeRequests[0].baseTree).toBe(baseCommitTreeSHA);
    expect(stub.treeRequests[0].baseTree).not.toBe('commit-0');
    expect(stub.commitRequests[0].parents).toEqual(['commit-0']);
  });

  test('deploys a first commit into an empty repository without the Contents API', async () => {
    const stub = new GitHubApiStub({ emptyRepository: true });
    stub.install();

    const result = await deployGeneratedFiles({
      siteId: 'site-empty',
      siteTitle: 'Empty',
      config: CONFIG,
      branch: 'main',
      files: new Map([['index.html', '<html>home</html>']]),
    });

    expect(result.branchCreated).toBe(true);
    expect(stub.treeRequests[0].baseTree).toBeNull();
    expect(stub.commitRequests[0].parents).toEqual([]);
    expect(stub.requests.filter((request) => request.method === 'POST' && request.path.endsWith('/git/refs'))).toHaveLength(1);
    expect(stub.hasFile('index.html')).toBe(true);
    // The old bootstrap wrote a README through the Contents API and left it behind forever.
    expect(stub.hasFile('README.md')).toBe(false);
    expect(stub.requests.some((request) => request.path.includes('/contents/'))).toBe(false);
  });

  test('creates a missing branch', async () => {
    const stub = new GitHubApiStub({ missingBranch: true });
    stub.install();

    const result = await deployGeneratedFiles({
      siteId: 'site-missing-branch',
      siteTitle: 'Missing branch',
      config: CONFIG,
      branch: 'gh-pages',
      files: new Map([['index.html', '<html>home</html>']]),
    });

    expect(result.branchCreated).toBe(true);
    expect(stub.requests.filter((request) => request.method === 'POST' && request.path.endsWith('/git/refs'))).toHaveLength(1);
    expect(stub.requests.filter((request) => request.method === 'PATCH')).toHaveLength(0);
  });

  test('deletes renamed, deleted and unpublished page paths on the next deployment', async () => {
    const stub = new GitHubApiStub();
    stub.install();

    const first = await deployGeneratedFiles({
      siteId: 'site-obsolete',
      siteTitle: 'Obsolete',
      config: CONFIG,
      branch: 'main',
      files: new Map([
        ['index.html', 'home'],
        ['about/index.html', 'about'],
        ['team/index.html', 'team'],
        ['draft/index.html', 'draft'],
      ]),
    });
    expect(first.deletedPaths).toEqual([]);

    // `about` is renamed, `team` deleted and `draft` unpublished: all three old paths are gone
    // from the new bundle but present in the base tree, so GitHub would keep them live.
    const second = await deployGeneratedFiles({
      siteId: 'site-obsolete',
      siteTitle: 'Obsolete',
      config: CONFIG,
      branch: 'main',
      files: new Map([
        ['index.html', 'home'],
        ['about-us/index.html', 'about'],
      ]),
    });

    expect(second.deletedPaths).toEqual(['about/index.html', 'draft/index.html', 'team/index.html']);
    expect(stub.treeRequests[1].entries.find((entry) => entry.path === 'team/index.html')).toEqual({
      path: 'team/index.html',
      mode: '100644',
      type: 'blob',
      sha: null,
    });
    expect(stub.hasFile('about/index.html')).toBe(false);
    expect(stub.hasFile('team/index.html')).toBe(false);
    expect(stub.hasFile('draft/index.html')).toBe(false);
    expect(stub.hasFile('about-us/index.html')).toBe(true);
  });

  test('keeps unrelated repository files across deployments', async () => {
    const stub = new GitHubApiStub({
      existingFiles: { 'README.md': '# Hand-written', 'notes/todo.md': '- keep me' },
    });
    stub.install();

    await deployGeneratedFiles({
      siteId: 'site-unrelated',
      siteTitle: 'Unrelated',
      config: CONFIG,
      branch: 'main',
      files: new Map([
        ['index.html', 'home'],
        ['_site/manifest.json', '{}'],
      ]),
    });

    // Second deployment, now with a recorded path history: only generated paths may be deleted.
    await deployGeneratedFiles({
      siteId: 'site-unrelated',
      siteTitle: 'Unrelated',
      config: CONFIG,
      branch: 'main',
      files: new Map([
        ['index.html', 'home'],
        ['_site/manifest.json', '{}'],
      ]),
    });

    expect(stub.treeRequests[1].entries.some((entry) => entry.sha === null)).toBe(false);
    expect(stub.treeRequests[1].entries.map((entry) => entry.path)).not.toContain('README.md');
    expect(stub.textFile('README.md')).toBe('# Hand-written');
    expect(stub.hasFile('notes/todo.md')).toBe(true);
  });

  test('does not mass-delete a repository with no recorded path history', async () => {
    const stub = new GitHubApiStub({
      existingFiles: { 'README.md': '# Mine', 'legacy-page.html': 'output of an older deploy' },
    });
    stub.install();

    await deployGeneratedFiles({
      siteId: 'site-legacy',
      siteTitle: 'Legacy',
      config: CONFIG,
      branch: 'main',
      files: new Map([['index.html', 'home']]),
    });

    expect(stub.treeRequests[0].entries.some((entry) => entry.sha === null)).toBe(false);
    expect(stub.hasFile('legacy-page.html')).toBe(true);
    expect(stub.hasFile('README.md')).toBe(true);
  });

  test('does not apply a path history recorded for another branch', async () => {
    const stub = new GitHubApiStub();
    stub.install();

    await deployGeneratedFiles({
      siteId: 'site-branch-change',
      siteTitle: 'Branch change',
      config: CONFIG,
      branch: 'main',
      files: new Map([
        ['index.html', 'home'],
        ['preview-only/index.html', 'preview'],
      ]),
    });

    const otherBranch = await deployGeneratedFiles({
      siteId: 'site-branch-change',
      siteTitle: 'Branch change',
      config: CONFIG,
      branch: 'gh-pages',
      files: new Map([['index.html', 'home']]),
    });

    expect(otherBranch.deletedPaths).toEqual([]);
    expect(stub.hasFile('preview-only/index.html')).toBe(true);
  });

  test('surfaces a rejected branch update with GitHub’s own error body', async () => {
    const stub = new GitHubApiStub({
      refUpdateFailure: {
        status: 422,
        body: '{"message":"Update is not a fast forward","documentation_url":"https://docs.github.com/rest"}',
      },
    });
    stub.install();

    const deployment = deployGeneratedFiles({
      siteId: 'site-concurrent',
      siteTitle: 'Concurrent',
      config: CONFIG,
      branch: 'main',
      files: new Map([['index.html', 'home']]),
    });

    await expect(deployment).rejects.toThrow(/422 Unprocessable Entity.*Update is not a fast forward/);
    // The branch already exists, so retrying as a creation would hide the real problem.
    expect(stub.requests.filter((request) => request.method === 'POST' && request.path.endsWith('/git/refs'))).toHaveLength(0);
  });

  test('recreates a branch that disappeared between reading and updating it', async () => {
    const stub = new GitHubApiStub({
      refUpdateFailure: { status: 404, body: '{"message":"Not Found"}' },
    });
    stub.install();

    const result = await deployGeneratedFiles({
      siteId: 'site-vanished',
      siteTitle: 'Vanished',
      config: CONFIG,
      branch: 'main',
      files: new Map([['index.html', 'home']]),
    });

    expect(result.branchCreated).toBe(true);
    expect(stub.requests.filter((request) => request.method === 'POST' && request.path.endsWith('/git/refs'))).toHaveLength(1);
  });
});
