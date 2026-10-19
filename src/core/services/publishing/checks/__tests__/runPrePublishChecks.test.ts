import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createSiteFixture } from '@/test/support/siteFixtures';

const listImageAssetPaths = vi.fn<(siteId: string) => Promise<string[]>>();
vi.mock('@/core/services/localFileSystem.service', () => ({
  listImageAssetPaths: (siteId: string) => listImageAssetPaths(siteId),
}));

import { runPrePublishChecks } from '../runPrePublishChecks';

describe('runPrePublishChecks', () => {
  beforeEach(() => listImageAssetPaths.mockReset());

  test('reads stored image paths for the site and reports a missing image', async () => {
    listImageAssetPaths.mockResolvedValue([]);
    const site = createSiteFixture('imageHeavySite');
    site.contentFiles![0].frontmatter.description = 'Home';
    const findings = await runPrePublishChecks(site);
    expect(listImageAssetPaths).toHaveBeenCalledWith(site.siteId);
    expect(findings.filter((f) => f.id.startsWith('missing-image')).length).toBeGreaterThan(0);
  });

  test('still reports the rest of the site when the homepage is a draft, without mutating it', async () => {
    listImageAssetPaths.mockResolvedValue([]);
    const site = createSiteFixture('basicSite');
    site.contentFiles![0].frontmatter.published = false;
    site.contentFiles![0].frontmatter.description = 'x';
    site.manifest.baseUrl = 'https://example.org';
    const findings = await runPrePublishChecks(site);
    expect(findings.map((f) => f.id)).toEqual(['homepage-unpublished:content/home.md']);
    expect(site.contentFiles![0].frontmatter.published).toBe(false);
  });
});
