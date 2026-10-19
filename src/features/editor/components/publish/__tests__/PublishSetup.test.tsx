import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSiteFixture } from '@/test/support/siteFixtures';

const { testConnectionMock, updateManifestMock, updateSecretsMock } = vi.hoisted(() => ({
  testConnectionMock: vi.fn(),
  updateManifestMock: vi.fn(),
  updateSecretsMock: vi.fn(),
}));

vi.mock('@/core/services/publishing/connectionTest', () => ({ testProviderConnection: testConnectionMock }));
vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ updateManifest: updateManifestMock, updateSiteSecrets: updateSecretsMock }),
}));

import PublishSetup from '../PublishSetup';

const site = createSiteFixture('basicSite', { siteId: 's1' });

function renderSetup() {
  const onComplete = vi.fn();
  render(<PublishSetup site={site} onComplete={onComplete} />);
  return onComplete;
}

describe('PublishSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testConnectionMock.mockResolvedValue({ ok: true, errors: [], notes: [] });
  });

  test('ZIP needs no credentials: choosing it saves the provider and continues', async () => {
    const onComplete = renderSetup();

    await userEvent.click(screen.getByRole('radio', { name: /Export as ZIP/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(updateManifestMock).toHaveBeenCalledWith('s1', { ...site.manifest, publishingConfig: { provider: 'zip' } });
    expect(updateSecretsMock).not.toHaveBeenCalled();
    expect(testConnectionMock).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  test('GitHub: saves the token to the secrets store, tests the connection, then saves the public config', async () => {
    const onComplete = renderSetup();

    await userEvent.click(screen.getByRole('radio', { name: /GitHub/ }));
    await userEvent.type(screen.getByLabelText('Personal access token'), 'ghp_abc');
    await userEvent.type(screen.getByLabelText('Repository Owner'), 'octo');
    await userEvent.type(screen.getByLabelText('Repository Name'), 'blog');
    await userEvent.click(screen.getByRole('button', { name: 'Test connection and continue' }));

    expect(updateSecretsMock).toHaveBeenCalledWith('s1', { publishing: { github: { accessToken: 'ghp_abc' } } });
    expect(testConnectionMock).toHaveBeenCalledWith(
      'github',
      { accessToken: 'ghp_abc', owner: 'octo', repo: 'blog', branch: 'main' },
      's1',
    );
    expect(updateManifestMock).toHaveBeenCalledWith('s1', {
      ...site.manifest,
      publishingConfig: { provider: 'github', github: { owner: 'octo', repo: 'blog', branch: 'main' } },
    });
    expect(onComplete).toHaveBeenCalled();
    // The token never reaches the manifest.
    expect(JSON.stringify(updateManifestMock.mock.calls)).not.toContain('ghp_abc');
  });

  test('a failed test shows the errors and does not save the provider or continue', async () => {
    testConnectionMock.mockResolvedValue({ ok: false, errors: ['Invalid GitHub access token'], notes: [] });
    const onComplete = renderSetup();

    await userEvent.click(screen.getByRole('radio', { name: /GitHub/ }));
    await userEvent.type(screen.getByLabelText('Personal access token'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: 'Test connection and continue' }));

    expect(await screen.findByText('Invalid GitHub access token')).toBeInTheDocument();
    expect(updateManifestMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  test('Netlify: tests with the entered token and site id', async () => {
    renderSetup();

    await userEvent.click(screen.getByRole('radio', { name: /Netlify/ }));
    await userEvent.type(screen.getByLabelText('API Token'), 'nlt');
    await userEvent.type(screen.getByLabelText('Site ID (Optional)'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Test connection and continue' }));

    expect(testConnectionMock).toHaveBeenCalledWith('netlify', { apiToken: 'nlt', siteId: 'abc', siteName: '' }, 's1');
  });

  test('shows connection notes and waits for Continue', async () => {
    testConnectionMock.mockResolvedValue({ ok: true, errors: [], notes: ['Branch "main" exists.'] });
    const onComplete = renderSetup();

    await userEvent.click(screen.getByRole('radio', { name: /GitHub/ }));
    await userEvent.type(screen.getByLabelText('Personal access token'), 'ghp');
    await userEvent.click(screen.getByRole('button', { name: 'Test connection and continue' }));

    expect(await screen.findByText('Branch "main" exists.')).toBeInTheDocument();
    expect(updateManifestMock).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onComplete).toHaveBeenCalled();
  });

  test('a storage failure is reported instead of swallowed', async () => {
    updateSecretsMock.mockRejectedValue(new Error('disk full'));
    const onComplete = renderSetup();

    await userEvent.click(screen.getByRole('radio', { name: /GitHub/ }));
    await userEvent.type(screen.getByLabelText('Personal access token'), 'ghp');
    await userEvent.click(screen.getByRole('button', { name: 'Test connection and continue' }));

    expect(await screen.findByText(/disk full/)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
