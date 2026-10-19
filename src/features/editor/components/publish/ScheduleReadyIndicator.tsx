// src/features/editor/components/publish/ScheduleReadyIndicator.tsx

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { useAppStore } from '@/core/state/useAppStore';
import { readPublishHistory } from '@/core/services/publishing/history/publishHistory.service';
import { getScheduleStatus, lastSuccessfulPublishAt } from '@/core/services/publishing/schedule/scheduleStatus';

interface ScheduleReadyIndicatorProps {
  siteId: string;
  onPublish: () => void;
  /** Changes when the publish history may have changed, e.g. when the publish dialog closes. */
  refreshKey?: unknown;
  /** Injected clock (epoch ms) so the indicator is testable. */
  now?: () => number;
}

const RECHECK_MS = 60_000;

/** Tells the author that scheduled items have come due but the live site does not have them yet. */
export default function ScheduleReadyIndicator({ siteId, onPublish, refreshKey, now = Date.now }: ScheduleReadyIndicatorProps) {
  const contentFiles = useAppStore((state) => state.getSiteById(siteId)?.contentFiles);
  const [lastPublishedAt, setLastPublishedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(() => now());

  useEffect(() => {
    let cancelled = false;
    readPublishHistory(siteId)
      .then((history) => !cancelled && setLastPublishedAt(lastSuccessfulPublishAt(history)))
      .catch(() => !cancelled && setLastPublishedAt(null));
    return () => {
      cancelled = true;
    };
  }, [siteId, refreshKey]);

  useEffect(() => {
    const timer = setInterval(() => setClock(now()), RECHECK_MS);
    return () => clearInterval(timer);
  }, [now]);

  const { due } = getScheduleStatus({ contentFiles }, clock, lastPublishedAt);
  if (due.length === 0) return null;

  const label =
    due.length === 1
      ? '1 scheduled item is ready: publish to release it'
      : `${due.length} scheduled items are ready: publish to release them`;

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 gap-1.5 text-xs"
      onClick={onPublish}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <Clock aria-hidden className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
