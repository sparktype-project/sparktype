import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AvailableUpdate, DownloadProgress } from '@/core/services/updater/updater.service';

const { checkForUpdate, restartApp, enabled, tauri, toastInfo } = vi.hoisted(() => ({
  checkForUpdate: vi.fn(),
  restartApp: vi.fn(),
  enabled: { value: true },
  tauri: { value: true },
  toastInfo: vi.fn(),
}));

vi.mock('@/core/services/updater/updater.service', () => ({
  checkForUpdate,
  restartApp,
  isUpdaterEnabled: () => enabled.value,
}));
vi.mock('@/core/utils/platform', () => ({ isTauriApp: () => tauri.value }));
vi.mock('sonner', () => ({ toast: { info: toastInfo } }));

import UpdateSettings from '../UpdateSettings';
import UpdateLaunchCheck from '../UpdateLaunchCheck';
import { resetUpdateLaunchCheck } from '../launchCheckSession';

function makeUpdate(install: AvailableUpdate['install'] = vi.fn().mockResolvedValue(undefined)): AvailableUpdate {
  return { version: '0.2.0', currentVersion: '0.1.0', notes: 'Faster exports', date: null, install };
}

beforeEach(() => {
  vi.clearAllMocks();
  enabled.value = true;
  tauri.value = true;
  resetUpdateLaunchCheck();
});

describe('UpdateSettings', () => {
  test('renders nothing in the web app', () => {
    tauri.value = false;
    const { container } = render(<UpdateSettings />);
    expect(container).toBeEmptyDOMElement();
  });

  test('is disabled with an explanation while no signing key is configured', () => {
    enabled.value = false;
    render(<UpdateSettings />);
    expect(screen.getByRole('button', { name: /check for updates/i })).toBeDisabled();
    expect(screen.getByText(/not set up in this build/i)).toBeInTheDocument();
  });

  test('reports when the app is up to date', async () => {
    checkForUpdate.mockResolvedValue(null);
    render(<UpdateSettings />);
    await userEvent.click(screen.getByRole('button', { name: /check for updates/i }));
    expect(await screen.findByText(/up to date/i)).toBeInTheDocument();
  });

  test('shows the version and release notes, and installs only after confirmation', async () => {
    const install = vi.fn().mockResolvedValue(undefined);
    checkForUpdate.mockResolvedValue(makeUpdate(install));
    render(<UpdateSettings />);
    await userEvent.click(screen.getByRole('button', { name: /check for updates/i }));

    expect(await screen.findByText(/version 0\.2\.0 is available/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Release notes')).toHaveTextContent('Faster exports');
    expect(install).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /download and install/i }));
    expect(install).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: /restart now/i })).toBeInTheDocument();
  });

  test('shows download progress, then restarts on request', async () => {
    let report!: (progress: DownloadProgress) => void;
    let finish!: () => void;
    const install = vi.fn(
      (onProgress: (p: DownloadProgress) => void) =>
        new Promise<void>((resolve) => {
          report = onProgress;
          finish = resolve;
        }),
    );
    checkForUpdate.mockResolvedValue(makeUpdate(install));
    render(<UpdateSettings />);
    await userEvent.click(screen.getByRole('button', { name: /check for updates/i }));
    await userEvent.click(await screen.findByRole('button', { name: /download and install/i }));

    act(() => report({ downloaded: 1_048_576, total: 4_194_304 }));
    expect(screen.getByRole('progressbar', { name: /download progress/i })).toHaveValue(1_048_576);
    expect(screen.getByText('1.0 MB of 4.0 MB')).toBeInTheDocument();
    expect(restartApp).not.toHaveBeenCalled();

    await act(async () => finish());
    await userEvent.click(screen.getByRole('button', { name: /restart now/i }));
    expect(restartApp).toHaveBeenCalledOnce();
  });

  test('shows a failed check and allows trying again', async () => {
    checkForUpdate.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(null);
    render(<UpdateSettings />);
    await userEvent.click(screen.getByRole('button', { name: /check for updates/i }));
    expect(await screen.findByText(/network down/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /check for updates/i }));
    expect(await screen.findByText(/up to date/i)).toBeInTheDocument();
  });

  test('shows a failed download', async () => {
    checkForUpdate.mockResolvedValue(makeUpdate(vi.fn().mockRejectedValue(new Error('bad signature'))));
    render(<UpdateSettings />);
    await userEvent.click(screen.getByRole('button', { name: /check for updates/i }));
    await userEvent.click(await screen.findByRole('button', { name: /download and install/i }));
    expect(await screen.findByText(/bad signature/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restart now/i })).not.toBeInTheDocument();
  });
});

describe('UpdateLaunchCheck', () => {
  const renderCheck = () =>
    render(
      <MemoryRouter>
        <UpdateLaunchCheck />
      </MemoryRouter>,
    );

  test('notifies about an available update without installing it', async () => {
    const install = vi.fn();
    checkForUpdate.mockResolvedValue(makeUpdate(install));
    renderCheck();
    await waitFor(() => expect(toastInfo).toHaveBeenCalledOnce());
    expect(toastInfo.mock.calls[0][0]).toMatch(/0\.2\.0 is available/);
    expect(install).not.toHaveBeenCalled();
  });

  test('stays quiet when up to date or when the check fails', async () => {
    checkForUpdate.mockResolvedValueOnce(null);
    const first = renderCheck();
    await waitFor(() => expect(checkForUpdate).toHaveBeenCalledOnce());
    first.unmount();

    resetUpdateLaunchCheck();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    renderCheck();
    await waitFor(() => expect(checkForUpdate).toHaveBeenCalledTimes(2));
    expect(toastInfo).not.toHaveBeenCalled();
  });

  test('does not check when the updater is disabled, and checks once per session', async () => {
    enabled.value = false;
    renderCheck();
    expect(checkForUpdate).not.toHaveBeenCalled();

    enabled.value = true;
    checkForUpdate.mockResolvedValue(null);
    const { unmount } = renderCheck();
    unmount();
    renderCheck();
    await waitFor(() => expect(checkForUpdate).toHaveBeenCalledOnce());
  });
});
