import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createSiteFixture } from '@/test/support/siteFixtures';
import type { PrePublishFinding } from '@/core/services/publishing/checks/prePublishChecks';
import type { PublishProgressCallback } from '@/core/services/publishing/types';

const { runChecksMock, publishSiteMock, storeState } = vi.hoisted(() => ({
  runChecksMock: vi.fn(),
  publishSiteMock: vi.fn(),
  storeState: {} as Record<string, unknown>,
}));

vi.mock('@/core/services/publishing/checks/runPrePublishChecks', () => ({
  runPrePublishChecks: runChecksMock,
}));
vi.mock('@/core/services/publishing/publishing.service', () => ({
  publishSite: publishSiteMock,
}));
vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
    { getState: () => storeState },
  ),
}));

import PublishDialog from '../PublishDialog';

const blocking: PrePublishFinding = {
  id: 'homepage-unpublished:content/home.md',
  severity: 'blocking',
  message: 'The homepage "Home" is unpublished.',
  path: 'content/home.md',
  fixHref: '/sites/s1/edit/content/home',
};
const warning: PrePublishFinding = {
  id: 'empty-description:content/about.md',
  severity: 'warning',
  message: '"About" has no description.',
  path: 'content/about.md',
  fixHref: '/sites/s1/edit/content/about',
};

function renderDialog(onOpenChange = vi.fn()) {
  render(
    <MemoryRouter>
      <PublishDialog siteId="s1" open onOpenChange={onOpenChange} />
    </MemoryRouter>,
  );
  return onOpenChange;
}

describe('PublishDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const site = createSiteFixture('basicSite', { siteId: 's1' });
    storeState.loadSite = vi.fn(async () => {});
    storeState.getSiteById = () => site;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  test('runs the checks and lists findings by severity with links to the page', async () => {
    runChecksMock.mockResolvedValue([warning, blocking]);
    renderDialog();

    const blockingGroup = await screen.findByRole('region', { name: /Must fix before publishing/ });
    expect(within(blockingGroup).getByText(blocking.message)).toBeInTheDocument();
    expect(within(blockingGroup).getByRole('link', { name: /Fix/ })).toHaveAttribute('href', '/sites/s1/edit/content/home');

    const warningGroup = screen.getByRole('region', { name: /Worth a look/ });
    expect(within(warningGroup).getByText(warning.message)).toBeInTheDocument();
  });

  test('blocking findings disable publishing and never reach the publish service', async () => {
    runChecksMock.mockResolvedValue([blocking, warning]);
    renderDialog();

    const publish = await screen.findByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    await userEvent.click(publish);
    expect(publishSiteMock).not.toHaveBeenCalled();
  });

  test('warnings alone offer Publish anyway, then show steps and the result', async () => {
    runChecksMock.mockResolvedValue([warning]);
    const netlifySite = createSiteFixture('basicSite', { siteId: 's1' });
    netlifySite.manifest.publishingConfig = { provider: 'netlify' };
    storeState.getSiteById = () => netlifySite;
    let finish: (value: unknown) => void = () => {};
    publishSiteMock.mockImplementation(
      (_site: unknown, options: { onProgress: PublishProgressCallback }) => {
        options.onProgress({ step: 'build', status: 'started' });
        options.onProgress({ step: 'build', status: 'completed' });
        options.onProgress({ step: 'upload', status: 'started' });
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    );
    renderDialog();

    await userEvent.click(await screen.findByRole('button', { name: 'Publish anyway' }));

    const steps = await screen.findByRole('list', { name: 'Publishing steps' });
    await waitFor(() => {
      expect(within(steps).getByText('Build site').closest('li')).toHaveAttribute('data-state', 'done');
      expect(within(steps).getByText('Upload to Netlify').closest('li')).toHaveAttribute('data-state', 'active');
    });
    expect(within(steps).getByText('Finalise').closest('li')).toHaveAttribute('data-state', 'pending');

    finish({ success: true, message: 'Deployed.', url: 'https://example.netlify.app' });

    expect(await screen.findByText('Deployed.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://example.netlify.app' })).toHaveAttribute('href', 'https://example.netlify.app');
    expect(publishSiteMock).toHaveBeenCalledTimes(1);
    expect(publishSiteMock).toHaveBeenCalledWith(netlifySite, expect.objectContaining({ findings: { blocking: 0, warning: 1 } }));
  });

  test('a clean report offers a plain Publish', async () => {
    runChecksMock.mockResolvedValue([]);
    publishSiteMock.mockResolvedValue({ success: true, message: 'Site bundle generated successfully!', downloadUrl: 'blob:z', filename: 'a.zip' });
    renderDialog();

    expect(await screen.findByText('No problems found.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Site bundle generated successfully!')).toBeInTheDocument();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  test('shows the failure and marks the failed step', async () => {
    runChecksMock.mockResolvedValue([]);
    publishSiteMock.mockImplementation(async (_site: unknown, options: { onProgress: PublishProgressCallback }) => {
      options.onProgress({ step: 'build', status: 'started' });
      options.onProgress({ step: 'build', status: 'failed', message: 'out of memory' });
      return { success: false, message: 'Failed to generate ZIP: out of memory' };
    });
    renderDialog();

    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Failed to generate ZIP: out of memory')).toBeInTheDocument();
    expect(screen.getByText('Build site').closest('li')).toHaveAttribute('data-state', 'failed');
  });

  test('reports when the checks themselves cannot run, and lets the user retry', async () => {
    runChecksMock.mockRejectedValueOnce(new Error('storage offline')).mockResolvedValueOnce([]);
    renderDialog();

    expect(await screen.findByText(/storage offline/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Run checks again' }));
    expect(await screen.findByText('No problems found.')).toBeInTheDocument();
  });

  test('following a finding link closes the dialog', async () => {
    runChecksMock.mockResolvedValue([blocking]);
    const onOpenChange = renderDialog();

    await userEvent.click(await screen.findByRole('link', { name: /Fix/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
