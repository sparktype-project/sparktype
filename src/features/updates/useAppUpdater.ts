// src/features/updates/useAppUpdater.ts

import { useCallback, useRef, useState } from 'react';
import {
  checkForUpdate,
  restartApp,
  type AvailableUpdate,
  type DownloadProgress,
} from '@/core/services/updater/updater.service';

export type UpdaterState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'up-to-date' }
  | { phase: 'available'; update: AvailableUpdate }
  | { phase: 'downloading'; update: AvailableUpdate; progress: DownloadProgress }
  | { phase: 'ready'; update: AvailableUpdate }
  | { phase: 'error'; message: string };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Drives the manual "Check for updates" flow: check, confirm, download, restart. */
export function useAppUpdater() {
  const [state, setState] = useState<UpdaterState>({ phase: 'idle' });
  // Guards against a second click starting a parallel check or download.
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ phase: 'checking' });
    try {
      const update = await checkForUpdate();
      setState(update ? { phase: 'available', update } : { phase: 'up-to-date' });
    } catch (error) {
      setState({ phase: 'error', message: messageOf(error) });
    } finally {
      busy.current = false;
    }
  }, []);

  const install = useCallback(async (update: AvailableUpdate) => {
    if (busy.current) return;
    busy.current = true;
    setState({ phase: 'downloading', update, progress: { downloaded: 0, total: null } });
    try {
      await update.install((progress) => setState({ phase: 'downloading', update, progress }));
      setState({ phase: 'ready', update });
    } catch (error) {
      setState({ phase: 'error', message: messageOf(error) });
    } finally {
      busy.current = false;
    }
  }, []);

  const restart = useCallback(async () => {
    try {
      await restartApp();
    } catch (error) {
      setState({ phase: 'error', message: messageOf(error) });
    }
  }, []);

  return { state, check, install, restart };
}
