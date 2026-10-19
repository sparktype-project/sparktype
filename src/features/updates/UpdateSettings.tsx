// src/features/updates/UpdateSettings.tsx

import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { isUpdaterEnabled } from '@/core/services/updater/updater.service';
import { isTauriApp } from '@/core/utils/platform';
import { useAppUpdater } from './useAppUpdater';

const formatMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Desktop-only "Check for updates" panel. Renders nothing in the web app. */
export default function UpdateSettings() {
  const { state, check, install, restart } = useAppUpdater();
  if (!isTauriApp()) return null;

  const enabled = isUpdaterEnabled();
  const busy = state.phase === 'checking' || state.phase === 'downloading';

  return (
    <section id="app-updates" aria-label="App updates" className="mt-12 border-t pt-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">App updates</h2>
          {!enabled && (
            <p className="mt-1 text-muted-foreground">
              Updates are not set up in this build, so Sparktype cannot check for new versions.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" disabled={!enabled || busy} onClick={() => void check()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {state.phase === 'checking' ? 'Checking…' : 'Check for updates'}
        </Button>
      </div>

      <div role="status" aria-live="polite" className="mt-3">
        {state.phase === 'up-to-date' && <p className="text-muted-foreground">Sparktype is up to date.</p>}

        {state.phase === 'error' && (
          <p className="text-destructive">Could not update: {state.message}</p>
        )}

        {(state.phase === 'available' || state.phase === 'downloading' || state.phase === 'ready') && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="font-medium">
              Version {state.update.version} is available
              <span className="font-normal text-muted-foreground"> (you have {state.update.currentVersion})</span>
            </p>
            {state.update.notes && (
              <pre aria-label="Release notes" className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-3 font-sans text-xs">
                {state.update.notes}
              </pre>
            )}

            {state.phase === 'available' && (
              <Button size="sm" onClick={() => void install(state.update)}>
                <Download className="mr-2 h-4 w-4" />
                Download and install
              </Button>
            )}

            {state.phase === 'downloading' && (
              <div>
                <progress
                  aria-label="Download progress"
                  className="w-full"
                  max={state.progress.total ?? undefined}
                  value={state.progress.total ? state.progress.downloaded : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  {state.progress.total
                    ? `${formatMegabytes(state.progress.downloaded)} of ${formatMegabytes(state.progress.total)}`
                    : `${formatMegabytes(state.progress.downloaded)} downloaded`}
                </p>
              </div>
            )}

            {state.phase === 'ready' && (
              <div className="flex flex-wrap items-center gap-3">
                <p>The update is installed. Restart Sparktype to start using it.</p>
                <Button size="sm" onClick={() => void restart()}>
                  Restart now
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
