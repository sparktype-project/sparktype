import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createSiteFixture } from '@/test/support/siteFixtures';
import type { PublishHistoryEntry } from '../../history/publishHistory.service';

const listImageAssetPaths = vi.fn<(siteId: string) => Promise<string[]>>();
vi.mock('@/core/services/localFileSystem.service', () => ({
  listImageAssetPaths: (siteId: string) => listImageAssetPaths(siteId),
}));

const readPublishHistory = vi.fn<(siteId: string) => Promise<PublishHistoryEntry[]>>();
vi.mock('../../history/publishHistory.service', () => ({
  readPublishHistory: (siteId: string) => readPublishHistory(siteId),
}));

import { runPrePublishChecks } from '../runPrePublishChecks';

const NOW = Date.parse('2026-06-01T12:00:00Z');

describe('runPrePublishChecks', () => {
  beforeEach(() => {
    listImageAssetPaths.mockReset();
    readPublishHistory.mockReset().mockResolvedValue([]);
  });

  test('reads stored image paths for the site and reports a missing image', async () => {
    listImageAssetPaths.mockResolvedValue([]);
    const site = createSiteFixture('imageHeavySite');
    site.contentFiles![0].frontmatter.description = 'Home';
    const findings = await runPrePublishChecks(site, NOW);
    expect(listImageAssetPaths).toHaveBeenCalledWith(site.siteId);
    expect(findings.filter((f) => f.id.startsWith('missing-image')).length).toBeGreaterThan(0);
  });

  test('still reports the rest of the site when the homepage is a draft, without mutating it', async () => {
    listImageAssetPaths.mockResolvedValue([]);
    const site = createSiteFixture('basicSite');
    site.contentFiles![0].frontmatter.published = false;
    site.contentFiles![0].frontmatter.description = 'x';
    site.manifest.baseUrl = 'https://example.org';
    const findings = await runPrePublishChecks(site, NOW);
    expect(findings.map((f) => f.id)).toEqual(['homepage-unpublished:content/home.md']);
    expect(site.contentFiles![0].frontmatter.published).toBe(false);
  });

  test('reports a scheduled homepage as blocking and still covers the rest of the site', async () => {
    listImageAssetPaths.mockResolvedValue([]);
    const site = createSiteFixture('basicSite');
    site.contentFiles![0].frontmatter.publishAt = '2026-12-25T09:00:00Z';
    site.contentFiles![0].frontmatter.description = 'x';
    site.manifest.baseUrl = 'https://example.org';
    const findings = await runPrePublishChecks(site, NOW);
    expect(findings.map((f) => f.id)).toEqual(['homepage-scheduled:content/home.md', 'schedule-held-back']);
    expect(site.contentFiles![0].frontmatter.publishAt).toBe('2026-12-25T09:00:00Z');
  });

  test('uses the last successful publish from history to find items that became due since', async () => {
    listImageAssetPaths.mockResolvedValue([]);
    readPublishHistory.mockResolvedValue([{
      id: 'a', kind: 'publish', startedAt: '2026-05-20T00:00:00Z', finishedAt: '2026-05-20T00:01:00Z',
      provider: 'zip', target: 'download', outcome: 'success', findings: { blocking: 0, warning: 0 }, log: [],
    }]);
    const site = createSiteFixture('nestedPagesSite');
    site.manifest.baseUrl = 'https://example.org';
    for (const file of site.contentFiles!) file.frontmatter.description = 'x';
    site.contentFiles![1].frontmatter.publishAt = '2026-05-30T00:00:00Z';
    const findings = await runPrePublishChecks(site, NOW);
    expect(readPublishHistory).toHaveBeenCalledWith(site.siteId);
    expect(findings.map((f) => f.id)).toEqual(['schedule-due']);
  });
});
