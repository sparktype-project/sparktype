// src/core/services/publishing/schedule/scheduleStatus.ts

import type { LocalSiteData } from '@/core/types';
import { isPublishedFile } from '@/core/services/builder/publication';
import { parsePublishAt } from '@/core/services/builder/schedule';
import type { PublishHistoryEntry } from '../history/publishHistory.service';

export interface ScheduledItem {
  path: string;
  title: string;
  /** Epoch milliseconds of its `publishAt`. */
  at: number;
}

export interface ScheduleStatus {
  /** Items whose time is still ahead; a build made now leaves them out. Soonest first. */
  heldBack: ScheduledItem[];
  /** Items that became due after the last successful publish, so the live site does not have them yet. Oldest first. */
  due: ScheduledItem[];
}

/**
 * When the live site was last built: the start of the newest successful publish. A build reads
 * the clock when it starts, so an item that came due while a publish was running is not in it.
 * Rollbacks restore an older build and never carry newly due items, so they are ignored.
 */
export function lastSuccessfulPublishAt(history: PublishHistoryEntry[]): number | null {
  const entry = history.find((item) => item.kind === 'publish' && item.outcome === 'success');
  const time = entry ? Date.parse(entry.startedAt) : NaN;
  return Number.isNaN(time) ? null : time;
}

/**
 * Sorts scheduled items into held back and due. Drafts are skipped, since `published: false`
 * wins over a schedule. With no earlier publish there is no live site missing anything, so
 * nothing counts as due.
 */
export function getScheduleStatus(
  site: Pick<LocalSiteData, 'contentFiles'>,
  now: number,
  lastPublishedAt: number | null,
): ScheduleStatus {
  const heldBack: ScheduledItem[] = [];
  const due: ScheduledItem[] = [];

  for (const file of site.contentFiles ?? []) {
    const at = parsePublishAt(file.frontmatter.publishAt);
    if (at === null || !isPublishedFile(file)) continue;
    const item = { path: file.path, title: file.frontmatter.title || file.slug, at };
    if (at > now) heldBack.push(item);
    else if (lastPublishedAt !== null && at > lastPublishedAt) due.push(item);
  }

  return {
    heldBack: heldBack.sort((a, b) => a.at - b.at),
    due: due.sort((a, b) => a.at - b.at),
  };
}
