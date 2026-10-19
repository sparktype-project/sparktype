// src/pages/sites/settings/publishing/DeployHistory.tsx

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';
import { Button } from '@/core/components/ui/button';
import { readPublishHistory, type PublishHistoryEntry } from '@/core/services/publishing/history/publishHistory.service';
import { canRollbackTo, rollbackSite } from '@/core/services/publishing/rollback/rollbackSite';
import type { LocalSiteData } from '@/core/types';

const PROVIDER_LABELS = { zip: 'ZIP export', netlify: 'Netlify', github: 'GitHub' } as const;

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function outcomeLabel(entry: PublishHistoryEntry): string {
  if (entry.outcome === 'failed') return entry.kind === 'rollback' ? 'Rollback failed' : 'Failed';
  return entry.kind === 'rollback' ? 'Rolled back' : 'Published';
}

function EntryRow({ entry, onRollback }: { entry: PublishHistoryEntry; onRollback?: () => void }) {
  const succeeded = entry.outcome === 'success';
  return (
    <li className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={succeeded ? 'font-medium' : 'font-medium text-destructive'}>
          {outcomeLabel(entry)}
        </span>
        <time dateTime={entry.startedAt}>{new Date(entry.startedAt).toLocaleString()}</time>
        <span className="text-muted-foreground">{PROVIDER_LABELS[entry.provider]}</span>
        <span className="text-muted-foreground">{entry.target}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
        {entry.commitSHA && <code title={entry.commitSHA}>{entry.commitSHA.slice(0, 7)}</code>}
        {entry.deployId && <code>{entry.deployId}</code>}
        {entry.fileCount !== undefined && <span>{plural(entry.fileCount, 'file')}</span>}
        {entry.findings.blocking > 0 && <span>{plural(entry.findings.blocking, 'blocking finding')}</span>}
        {entry.findings.warning > 0 && <span>{plural(entry.findings.warning, 'warning')}</span>}
      </div>

      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer" className="block underline underline-offset-2">
          {entry.url}
        </a>
      )}
      {entry.error && <p className="text-destructive">{entry.error}</p>}
      {onRollback && (
        <Button variant="outline" size="sm" onClick={onRollback}>
          Roll back
        </Button>
      )}

      <details>
        <summary className="cursor-pointer text-muted-foreground">Show log</summary>
        <ol className="mt-2 space-y-1 font-mono text-xs">
          {entry.log.map((line, index) => (
            <li key={index}>
              {new Date(line.at).toLocaleTimeString()} {line.step} — {line.status}
              {line.message ? `: ${line.message}` : ''}
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

export default function DeployHistory({ site }: { site: LocalSiteData }) {
  const [entries, setEntries] = useState<PublishHistoryEntry[] | null>(null);
  const [pending, setPending] = useState<PublishHistoryEntry | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await readPublishHistory(site.siteId));
    } catch (error) {
      console.error('[DeployHistory] Failed to read publish history:', error);
      setEntries([]);
    }
  }, [site.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmRollback = async () => {
    if (!pending) return;
    const result = await rollbackSite(site, pending);
    setPending(null);
    (result.success ? toast.success : toast.error)(result.message);
    await load();
  };

  return (
    <section aria-labelledby="deploy-history-heading" className="space-y-3">
      <h2 id="deploy-history-heading" className="text-lg font-semibold">
        Publish history
      </h2>
      {entries === null && <p className="text-sm text-muted-foreground">Loading history…</p>}
      {entries?.length === 0 && <p className="text-sm text-muted-foreground">Nothing published yet.</p>}
      {entries && entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onRollback={canRollbackTo(site, entry, entries) ? () => setPending(entry) : undefined}
            />
          ))}
        </ul>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back this publish?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.provider === 'github'
                ? `A new commit will restore the repository to ${pending.commitSHA?.slice(0, 7)}. History is kept, and anything changed in the repository since then is reverted.`
                : 'Netlify will serve the earlier deploy again. Nothing is uploaded.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRollback()}>Roll back</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
