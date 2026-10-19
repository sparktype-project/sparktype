// src/features/editor/components/publish/PublishDialog.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { runPrePublishChecks } from '@/core/services/publishing/checks/runPrePublishChecks';
import type { PrePublishFinding } from '@/core/services/publishing/checks/prePublishChecks';
import { publishSite, type PublishingResult } from '@/core/services/publishing/publishing.service';
import type { LocalSiteData } from '@/core/types';
import { PublishReport } from './PublishReport';
import { PublishSteps } from './PublishSteps';
import { applyProgressEvent, INITIAL_STEP_STATES, type StepStates } from './stepStates';

interface PublishDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase =
  | { name: 'checking' }
  | { name: 'check-failed'; message: string }
  | { name: 'report'; findings: PrePublishFinding[] }
  | { name: 'publishing' }
  | { name: 'done'; result: PublishingResult };

/** Hands a generated ZIP to the browser; the object URL is released once the click is queued. */
function startDownload(result: PublishingResult): void {
  if (!result.downloadUrl || !result.filename) return;
  const link = document.createElement('a');
  link.href = result.downloadUrl;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(result.downloadUrl);
}

export default function PublishDialog({ siteId, open, onOpenChange }: PublishDialogProps) {
  const [phase, setPhase] = useState<Phase>({ name: 'checking' });
  const [steps, setSteps] = useState<StepStates>(INITIAL_STEP_STATES);
  const siteRef = useRef<LocalSiteData | null>(null);
  const provider = useAppStore((state) => state.getSiteById(siteId))?.manifest.publishingConfig?.provider ?? 'zip';

  const runChecks = useCallback(async () => {
    setPhase({ name: 'checking' });
    setSteps(INITIAL_STEP_STATES);
    try {
      // Content is loaded lazily; checking a partially loaded site would report phantom problems.
      await useAppStore.getState().loadSite(siteId);
      const site = useAppStore.getState().getSiteById(siteId);
      if (!site) throw new Error('Site data not found.');
      siteRef.current = site;
      setPhase({ name: 'report', findings: await runPrePublishChecks(site) });
    } catch (error) {
      setPhase({ name: 'check-failed', message: (error as Error).message });
    }
  }, [siteId]);

  useEffect(() => {
    if (open) void runChecks();
  }, [open, runChecks]);

  const publish = async () => {
    const site = siteRef.current;
    if (!site) return;
    setPhase({ name: 'publishing' });
    const result = await publishSite(site, {
      onProgress: (event) => setSteps((current) => applyProgressEvent(current, event)),
    });
    if (result.success) startDownload(result);
    setPhase({ name: 'done', result });
  };

  const busy = phase.name === 'publishing';
  const findings = phase.name === 'report' ? phase.findings : [];
  const hasBlocking = findings.some((f) => f.severity === 'blocking');
  const hasWarnings = findings.some((f) => f.severity === 'warning');

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Publish site</DialogTitle>
          <DialogDescription>
            {phase.name === 'done' ? 'Publishing finished.' : 'Checking the site before it goes out.'}
          </DialogDescription>
        </DialogHeader>

        {phase.name === 'checking' && <p className="text-sm text-muted-foreground">Checking your site…</p>}

        {phase.name === 'check-failed' && (
          <p role="alert" className="text-sm text-destructive">
            The checks could not run: {phase.message}
          </p>
        )}

        {phase.name === 'report' && <PublishReport findings={phase.findings} onNavigate={() => onOpenChange(false)} />}

        {(phase.name === 'publishing' || phase.name === 'done') && <PublishSteps provider={provider} states={steps} />}

        {phase.name === 'done' && (
          <div role={phase.result.success ? 'status' : 'alert'} className="space-y-1 text-sm">
            <p className={phase.result.success ? '' : 'text-destructive'}>{phase.result.message}</p>
            {phase.result.url && (
              <a href={phase.result.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {phase.result.url}
              </a>
            )}
          </div>
        )}

        <DialogFooter>
          {phase.name === 'check-failed' && <Button onClick={() => void runChecks()}>Run checks again</Button>}
          {phase.name === 'report' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={hasBlocking} onClick={() => void publish()}>
                {hasWarnings && !hasBlocking ? 'Publish anyway' : 'Publish'}
              </Button>
            </>
          )}
          {phase.name === 'done' && <Button onClick={() => onOpenChange(false)}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
