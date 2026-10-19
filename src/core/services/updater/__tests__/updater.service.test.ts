import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { check, relaunch, tauri } = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
  tauri: { value: true },
}));

vi.mock('@tauri-apps/plugin-updater', () => ({ check }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch }));
vi.mock('@/core/utils/platform', () => ({ isTauriApp: () => tauri.value }));

import { checkForUpdate, isUpdaterEnabled, restartApp } from '../updater.service';

beforeEach(() => {
  vi.clearAllMocks();
  tauri.value = true;
  vi.stubGlobal('__UPDATER_ENABLED__', true);
});
afterEach(() => vi.unstubAllGlobals());

describe('isUpdaterEnabled', () => {
  it('needs both a desktop runtime and a configured key', () => {
    expect(isUpdaterEnabled()).toBe(true);
    vi.stubGlobal('__UPDATER_ENABLED__', false);
    expect(isUpdaterEnabled()).toBe(false);
    vi.stubGlobal('__UPDATER_ENABLED__', true);
    tauri.value = false;
    expect(isUpdaterEnabled()).toBe(false);
  });

  it('is false when the build flag is absent', () => {
    vi.unstubAllGlobals();
    expect(isUpdaterEnabled()).toBe(false);
  });
});

describe('checkForUpdate', () => {
  it('returns null and never loads the plugin when disabled', async () => {
    vi.stubGlobal('__UPDATER_ENABLED__', false);
    expect(await checkForUpdate()).toBeNull();
    expect(check).not.toHaveBeenCalled();
  });

  it('returns null when up to date', async () => {
    check.mockResolvedValue(null);
    expect(await checkForUpdate()).toBeNull();
  });

  it('describes an available update', async () => {
    check.mockResolvedValue({ version: '0.2.0', currentVersion: '0.1.0', body: '  Fixes things  ', date: '2026-01-01', downloadAndInstall: vi.fn() });
    const update = await checkForUpdate();
    expect(update).toMatchObject({ version: '0.2.0', currentVersion: '0.1.0', notes: 'Fixes things', date: '2026-01-01' });
  });

  it('treats an empty body as no notes', async () => {
    check.mockResolvedValue({ version: '0.2.0', currentVersion: '0.1.0', body: '', downloadAndInstall: vi.fn() });
    expect((await checkForUpdate())?.notes).toBeNull();
  });

  it('reports cumulative download progress', async () => {
    const downloadAndInstall = vi.fn(async (cb: (e: unknown) => void) => {
      cb({ event: 'Started', data: { contentLength: 100 } });
      cb({ event: 'Progress', data: { chunkLength: 40 } });
      cb({ event: 'Progress', data: { chunkLength: 60 } });
      cb({ event: 'Finished' });
    });
    check.mockResolvedValue({ version: '0.2.0', currentVersion: '0.1.0', downloadAndInstall });
    const progress = vi.fn();
    await (await checkForUpdate())!.install(progress);
    expect(progress.mock.calls.map(([p]) => p)).toEqual([
      { downloaded: 0, total: 100 },
      { downloaded: 40, total: 100 },
      { downloaded: 100, total: 100 },
    ]);
  });

  it('handles an unknown content length', async () => {
    const downloadAndInstall = vi.fn(async (cb: (e: unknown) => void) => {
      cb({ event: 'Started', data: {} });
      cb({ event: 'Progress', data: { chunkLength: 5 } });
    });
    check.mockResolvedValue({ version: '0.2.0', currentVersion: '0.1.0', downloadAndInstall });
    const progress = vi.fn();
    await (await checkForUpdate())!.install(progress);
    expect(progress).toHaveBeenLastCalledWith({ downloaded: 5, total: null });
  });

  it('propagates check failures', async () => {
    check.mockRejectedValue(new Error('offline'));
    await expect(checkForUpdate()).rejects.toThrow('offline');
  });
});

describe('restartApp', () => {
  it('relaunches through the process plugin', async () => {
    await restartApp();
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it('does nothing when disabled', async () => {
    vi.stubGlobal('__UPDATER_ENABLED__', false);
    await restartApp();
    expect(relaunch).not.toHaveBeenCalled();
  });
});
