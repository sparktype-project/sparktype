// src/core/services/publishing/checks/runPrePublishChecks.ts

import type { LocalSiteData } from '@/core/types';
import { createPublicSiteSnapshot, findHomepageFile, PublicationError } from '@/core/services/builder/publication';
import { listImageAssetPaths } from '@/core/services/localFileSystem.service';
import { readPublishHistory } from '../history/publishHistory.service';
import { lastSuccessfulPublishAt } from '../schedule/scheduleStatus';
import { checkSiteForPublishing, type PrePublishFinding } from './prePublishChecks';

/**
 * The snapshot builder refuses a draft homepage. The report still has to cover the rest of the
 * site, so on that refusal the snapshot is built from a throwaway copy that treats the homepage
 * as published and live; the homepage check reads the real site and reports the draft or schedule.
 */
function snapshotForReport(site: LocalSiteData, now: number): LocalSiteData {
  try {
    return createPublicSiteSnapshot(site, now);
  } catch (error) {
    if (!(error instanceof PublicationError)) throw error;
    const homepage = findHomepageFile(site);
    return createPublicSiteSnapshot({
      ...site,
      contentFiles: site.contentFiles?.map((file) => {
        if (file !== homepage) return file;
        const frontmatter = { ...file.frontmatter, published: true };
        delete frontmatter.publishAt;
        return { ...file, frontmatter };
      }),
    }, now);
  }
}

/** Runs every pre-publish check against the site as it is stored right now. */
export async function runPrePublishChecks(site: LocalSiteData, now: number = Date.now()): Promise<PrePublishFinding[]> {
  const storedImagePaths = new Set(await listImageAssetPaths(site.siteId));
  const lastPublishedAt = lastSuccessfulPublishAt(await readPublishHistory(site.siteId));
  return checkSiteForPublishing({ site, now, lastPublishedAt, snapshot: snapshotForReport(site, now), storedImagePaths });
}
