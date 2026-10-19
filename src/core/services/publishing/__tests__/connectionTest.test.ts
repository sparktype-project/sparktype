import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GitHubApiStub } from '@/test/support/githubApiStub';

const { netlifyValidateMock } = vi.hoisted(() => ({ netlifyValidateMock: vi.fn() }));
vi.mock('../netlify.service', () => ({
  NetlifyProvider: class {
    validateConfig = netlifyValidateMock;
  },
}));

import { testProviderConnection } from '../connectionTest';

const GITHUB = { accessToken: 'token', owner: 'o', repo: 'r', branch: 'main' };

describe('testProviderConnection', () => {
  beforeEach(() => netlifyValidateMock.mockReset());

  test('GitHub: passes when the token can push and the branch exists', async () => {
    new GitHubApiStub().install();

    expect(await testProviderConnection('github', GITHUB, 's1')).toEqual({
      ok: true,
      errors: [],
      notes: ['Connected to o/r. Branch "main" exists.'],
    });
  });

  test('GitHub: notes that a missing branch will be created', async () => {
    new GitHubApiStub().install();

    const result = await testProviderConnection('github', { ...GITHUB, branch: 'site' }, 's1');

    expect(result.ok).toBe(true);
    expect(result.notes).toEqual(['Connected to o/r. Branch "site" does not exist yet and will be created on the first publish.']);
  });

  test('GitHub: reports validateConfig errors and skips the branch probe', async () => {
    const stub = new GitHubApiStub({ pushPermission: false });
    stub.install();

    const result = await testProviderConnection('github', GITHUB, 's1');

    expect(result).toEqual({
      ok: false,
      errors: ['No push access to repository. Make sure your token has write permissions.'],
      notes: [],
    });
    expect(stub.requests.some((request) => request.path.includes('/git/ref/'))).toBe(false);
  });

  test('GitHub: reports missing fields without calling the network', async () => {
    const stub = new GitHubApiStub();
    stub.install();

    const result = await testProviderConnection('github', { accessToken: '', owner: '', repo: '' }, 's1');

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('owner is required');
    expect(stub.requests).toEqual([]);
  });

  test('Netlify: delegates to the provider’s validation with the site id', async () => {
    netlifyValidateMock.mockResolvedValue({ valid: false, errors: ['Invalid API token'] });

    const result = await testProviderConnection('netlify', { apiToken: 'bad' }, 's1');

    expect(netlifyValidateMock).toHaveBeenCalledWith({ apiToken: 'bad' }, 's1');
    expect(result).toEqual({ ok: false, errors: ['Invalid API token'], notes: [] });
  });

  test('Netlify: a valid token passes', async () => {
    netlifyValidateMock.mockResolvedValue({ valid: true, errors: [] });
    expect((await testProviderConnection('netlify', { apiToken: 'good' }, 's1')).ok).toBe(true);
  });
});
