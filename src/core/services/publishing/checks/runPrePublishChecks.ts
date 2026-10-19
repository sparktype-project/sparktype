// src/core/services/publishing/checks/runPrePublishChecks.ts

import type { LocalSiteData } from '@/core/types';
import { createPublicSiteSnapshot, findHomepageFile, PublicationError } from '@/core/services/builder/publication';
import { listImageAssetPaths } from '@/core/services/localFileSystem.service';
import { checkSiteForPublishing, type PrePublishFinding } from './prePublishChecks';

/**
 * The snapshot builder refuses a draft homepage. The report still has to cover the rest of the
 * site, so on that refusal the snapshot is built from a throwaway copy that treats the homepage
 * as published; the homepage check reads the real site and reports the draft.
 */
function snapshotForReport(site: LocalSiteData): LocalSiteData {
  try {
    return createPublicSiteSnapshot(site);
  } catch (error) {
    if (!(error instanceof PublicationError)) throw error;
    const homepage = findHomepageFile(site);
    return createPublicSiteSnapshot({
      ...site,
      contentFiles: site.contentFiles?.map((file) =>
        file === homepage ? { ...file, frontmatter: { ...file.frontmatter, published: true } } : file,
      ),
    });
  }
}

/** Runs every pre-publish check against the site as it is stored right now. */
export async function runPrePublishChecks(site: LocalSiteData): Promise<PrePublishFinding[]> {
  const storedImagePaths = new Set(await listImageAssetPaths(site.siteId));
  return checkSiteForPublishing({ site, snapshot: snapshotForReport(site), storedImagePaths });
}
