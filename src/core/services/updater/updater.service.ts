// src/core/services/updater/updater.service.ts

import { isTauriApp } from '@/core/utils/platform';

export interface DownloadProgress {
  downloaded: number;
  /** Total size in bytes, or `null` when the server did not report one. */
  total: number | null;
}

export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  /** Release notes as written in the release body (plain text or Markdown). */
  notes: string | null;
  date: string | null;
  /** Downloads and installs the update. The app keeps running; call `restartApp` afterwards. */
  install: (onProgress: (progress: DownloadProgress) => void) => Promise<void>;
}

/** Desktop only, and only in builds that carry a real updater public key. */
export function isUpdaterEnabled(): boolean {
  return typeof __UPDATER_ENABLED__ !== 'undefined' && __UPDATER_ENABLED__ === true && isTauriApp();
}

/** Resolves to the pending update, or `null` when the app is up to date. Rejects if the check fails. */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isUpdaterEnabled()) return null;
  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check();
  if (!update) return null;

  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body?.trim() || null,
    date: update.date ?? null,
    install: async (onProgress) => {
      let downloaded = 0;
      let total: number | null = null;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? null;
          onProgress({ downloaded, total });
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          onProgress({ downloaded, total });
        }
      });
    },
  };
}

export async function restartApp(): Promise<void> {
  if (!isUpdaterEnabled()) return;
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
