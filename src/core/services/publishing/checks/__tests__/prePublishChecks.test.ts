import { describe, expect, test } from 'vitest';
import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { createPublicSiteSnapshot } from '@/core/services/builder/publication';
import { checkSiteForPublishing, type PrePublishFinding } from '../prePublishChecks';

/** Fixtures carry no descriptions, so every page gets one unless a test wants it empty. */
function withDescriptions(site: LocalSiteData): LocalSiteData {
  for (const file of site.contentFiles ?? []) {
    file.frontmatter.description ??= `About ${file.frontmatter.title}`;
  }
  return site;
}

function file(site: LocalSiteData, path: string): ParsedMarkdownFile {
  const found = site.contentFiles!.find((f) => f.path === path);
  if (!found) throw new Error(`fixture has no ${path}`);
  return found;
}

function check(site: LocalSiteData, storedImagePaths: string[] = []): PrePublishFinding[] {
  return checkSiteForPublishing({
    site,
    snapshot: createPublicSiteSnapshot(site),
    storedImagePaths: new Set(storedImagePaths),
  });
}

function ids(findings: PrePublishFinding[], prefix: string): PrePublishFinding[] {
  return findings.filter((f) => f.id.startsWith(prefix));
}

describe('checkSiteForPublishing', () => {
  test('a clean site has no findings', () => {
    expect(check(withDescriptions(createSiteFixture('nestedPagesSite')))).toEqual([]);
  });

  describe('homepage', () => {
    test('blocks when the site has no homepage', () => {
      const site = withDescriptions(createSiteFixture('basicSite'));
      site.manifest.structure = [];
      site.contentFiles = [];
      const [finding] = ids(check(site), 'homepage');
      expect(finding).toMatchObject({ severity: 'blocking', path: null });
      expect(finding.fixHref).toBe(`/sites/${site.siteId}/edit`);
    });

    test('blocks when the homepage is unpublished, pointing at the page', () => {
      const site = withDescriptions(createSiteFixture('basicSite'));
      file(site, 'content/home.md').frontmatter.published = false;
      // The snapshot builder refuses a draft homepage, so the engine is handed one built from
      // a copy that treats it as published.
      const copy = structuredClone(site);
      file(copy, 'content/home.md').frontmatter.published = true;
      const findings = checkSiteForPublishing({
        site,
        snapshot: createPublicSiteSnapshot(copy),
        storedImagePaths: new Set(),
      });
      const [finding] = ids(findings, 'homepage');
      expect(finding).toMatchObject({
        severity: 'blocking',
        path: 'content/home.md',
        fixHref: `/sites/${site.siteId}/edit/content/home`,
      });
    });
  });

  describe('images with no stored bytes', () => {
    test('blocks on a frontmatter image whose bytes are missing, on a nested page', () => {
      const site = withDescriptions(createSiteFixture('nestedPagesSite'));
      file(site, 'content/about/team.md').frontmatter.hero = {
        serviceId: 'local',
        src: 'assets/originals/team.jpg',
        alt: 'The team',
      };
      const [finding] = ids(check(site), 'missing-image');
      expect(finding).toMatchObject({
        severity: 'blocking',
        path: 'content/about/team.md',
        fixHref: `/sites/${site.siteId}/edit/content/about/team`,
      });
      expect(finding.message).toContain('assets/originals/team.jpg');
    });

    test('blocks on a body image whose bytes are missing', () => {
      const site = withDescriptions(createSiteFixture('basicSite'));
      file(site, 'content/home.md').content = '![Hero](assets/originals/hero.jpg)';
      expect(ids(check(site), 'missing-image')).toHaveLength(1);
    });

    test('passes once the bytes are stored', () => {
      const site = withDescriptions(createSiteFixture('imageHeavySite'));
      expect(ids(check(site, ['assets/originals/hero.jpg']), 'missing-image')).toEqual([]);
    });

    test('ignores images referenced only by drafts, and non-local services', () => {
      const site = withDescriptions(createSiteFixture('nestedPagesSite'));
      const team = file(site, 'content/about/team.md');
      team.frontmatter.published = false;
      team.content = '![Team](assets/originals/draft.jpg)';
      file(site, 'content/about.md').frontmatter.cover = {
        serviceId: 'cloudinary',
        src: 'sample',
        alt: 'Remote',
      };
      expect(ids(check(site), 'missing-image')).toEqual([]);
    });

    test('reports a missing collection-item image', () => {
      const site = withDescriptions(createSiteFixture('collectionSite'));
      file(site, 'content/posts/launch-day.md').content = '![Launch](assets/originals/launch.png)';
      const [finding] = ids(check(site), 'missing-image');
      expect(finding.path).toBe('content/posts/launch-day.md');
    });
  });

  describe('internal links', () => {
    test('warns about a link to a draft page', () => {
      const site = withDescriptions(createSiteFixture('nestedPagesSite'));
      file(site, 'content/about/team.md').frontmatter.published = false;
      file(site, 'content/home.md').content = 'Meet [the team](/about/team).';
      const [finding] = ids(check(site), 'draft-link');
      expect(finding).toMatchObject({ severity: 'warning', path: 'content/home.md' });
      expect(finding.message).toContain('/about/team');
    });

    test('warns about a link to a page that does not exist', () => {
      const site = withDescriptions(createSiteFixture('nestedPagesSite'));
      file(site, 'content/home.md').content = 'See [pricing](/pricing) and <a href="/nope/">nope</a>.';
      expect(ids(check(site), 'broken-link')).toHaveLength(2);
    });

    test('resolves relative links from nested pages and collection items', () => {
      const site = withDescriptions(createSiteFixture('collectionSite'));
      file(site, 'content/posts/launch-day.md').content =
        '[home](../../) [posts](/posts) [self](/posts/launch-day#top) [bad](../missing)';
      const links = [...ids(check(site), 'broken-link'), ...ids(check(site), 'draft-link')];
      expect(links).toHaveLength(1);
      expect(links[0].message).toContain('../missing');
    });

    test('ignores external, anchor, mail and file links', () => {
      const site = withDescriptions(createSiteFixture('basicSite'));
      file(site, 'content/home.md').content =
        '[a](https://example.com) [b](#top) [c](mailto:a@b.co) [d](/files/menu.pdf) [e](//cdn.example/x) [f](tel:123)';
      expect(check(site)).toEqual([]);
    });

    test('ignores links written in drafts', () => {
      const site = withDescriptions(createSiteFixture('nestedPagesSite'));
      const team = file(site, 'content/about/team.md');
      team.frontmatter.published = false;
      team.content = '[gone](/gone)';
      expect(check(site)).toEqual([]);
    });
  });

  describe('alt text', () => {
    test('warns for markdown and html body images without alt text', () => {
      const site = withDescriptions(createSiteFixture('basicSite'));
      file(site, 'content/home.md').content =
        '![](assets/originals/a.jpg)\n\n<img src="assets/originals/b.jpg">\n\n![ok](assets/originals/c.jpg)';
      const findings = ids(check(site, ['assets/originals/a.jpg', 'assets/originals/b.jpg', 'assets/originals/c.jpg']), 'missing-alt');
      expect(findings).toHaveLength(2);
      expect(findings.every((f) => f.severity === 'warning' && f.path === 'content/home.md')).toBe(true);
    });

    test('warns for a frontmatter image with blank alt text', () => {
      const site = withDescriptions(createSiteFixture('imageHeavySite'));
      file(site, 'content/home.md').content = 'No body image';
      (file(site, 'content/home.md').frontmatter.featured_image as { alt: string }).alt = '  ';
      expect(ids(check(site, ['assets/originals/hero.jpg']), 'missing-alt')).toHaveLength(1);
    });
  });

  describe('title and description', () => {
    test('warns about a blank title and a blank description, per page', () => {
      const site = withDescriptions(createSiteFixture('nestedPagesSite'));
      file(site, 'content/about.md').frontmatter.title = ' ';
      file(site, 'content/about/team.md').frontmatter.description = '';
      expect(ids(check(site), 'empty-title').map((f) => f.path)).toEqual(['content/about.md']);
      expect(ids(check(site), 'empty-description').map((f) => f.path)).toEqual(['content/about/team.md']);
    });

    test('checks collection items too', () => {
      const site = withDescriptions(createSiteFixture('collectionSite'));
      file(site, 'content/posts/launch-day.md').frontmatter.description = undefined;
      expect(ids(check(site), 'empty-description').map((f) => f.path)).toEqual(['content/posts/launch-day.md']);
    });
  });

  describe('duplicate output paths', () => {
    test('warns on every page that writes the same file', () => {
      const site = withDescriptions(createSiteFixture('nestedPagesSite'));
      // A top-level "about/team" slug collides with the nested team page's output.
      site.manifest.structure.push({ type: 'page', path: 'content/team.md', slug: 'about/team', title: 'Team 2' });
      site.contentFiles!.push({
        path: 'content/team.md',
        slug: 'about/team',
        frontmatter: { title: 'Team 2', layout: 'page', description: 'Dup' },
        content: '',
      });
      const findings = ids(check(site), 'duplicate-output');
      expect(findings.map((f) => f.path).sort()).toEqual(['content/about/team.md', 'content/team.md']);
      expect(findings[0].message).toContain('about/team/index.html');
    });

    test('a collection item colliding with a page is reported', () => {
      const site = withDescriptions(createSiteFixture('collectionSite'));
      site.manifest.structure.push({ type: 'page', path: 'content/x.md', slug: 'posts/launch-day', title: 'X' });
      site.contentFiles!.push({
        path: 'content/x.md',
        slug: 'posts/launch-day',
        frontmatter: { title: 'X', layout: 'page', description: 'x' },
        content: '',
      });
      expect(ids(check(site), 'duplicate-output')).toHaveLength(2);
    });
  });
});
