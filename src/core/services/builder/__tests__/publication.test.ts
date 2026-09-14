import { describe, expect, test } from 'vitest';
import type { LocalSiteData, ParsedMarkdownFile, StructureNode } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { flattenStructure } from '@/core/services/fileTree.service';
import {
  PublicationError,
  createPublicSiteSnapshot,
  findHomepageFile,
  isPublishedFile,
} from '../publication';

function addDraftPage(site: LocalSiteData, path = 'content/draft.md'): void {
  site.manifest.structure.push({
    type: 'page',
    path,
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    title: 'Secret Draft',
    navOrder: 2,
  });
  site.contentFiles!.push({
    path,
    slug: path.replace(/^content\//, '').replace(/\.md$/, ''),
    frontmatter: { title: 'Secret Draft', layout: 'page', published: false },
    content: 'Draft body',
  });
}

function addDraftItem(site: LocalSiteData, path = 'content/posts/hidden.md'): void {
  site.contentFiles!.push({
    path,
    slug: 'posts/hidden',
    frontmatter: { title: 'Hidden Post', layout: 'post', published: false, date: '2025-02-02' },
    content: 'Hidden body',
  });
  site.manifest.collectionItems = [
    ...(site.manifest.collectionItems ?? []),
    { collectionId: 'posts', slug: 'hidden', path, title: 'Hidden Post', url: '' },
  ];
}

function paths(nodes: StructureNode[]): string[] {
  return flattenStructure(nodes).map((node) => node.path);
}

describe('isPublishedFile', () => {
  function fileWithPublished(published?: boolean): ParsedMarkdownFile {
    return {
      path: 'content/a.md',
      slug: 'a',
      content: '',
      frontmatter: { title: 'A', layout: 'page', ...(published === undefined ? {} : { published }) },
    };
  }

  test('treats a missing file or a missing flag as published', () => {
    expect(isPublishedFile(undefined)).toBe(true);
    expect(isPublishedFile(fileWithPublished())).toBe(true);
    expect(isPublishedFile(fileWithPublished(true))).toBe(true);
    expect(isPublishedFile(fileWithPublished(false))).toBe(false);
  });
});

describe('createPublicSiteSnapshot', () => {
  test('excludes unpublished content files, structure nodes and collection items', () => {
    const site = createSiteFixture('collectionSite');
    addDraftPage(site);
    addDraftItem(site);

    const snapshot = createPublicSiteSnapshot(site);

    expect(snapshot.contentFiles?.map((file) => file.path)).toEqual([
      'content/home.md',
      'content/posts.md',
      'content/posts/launch-day.md',
    ]);
    expect(paths(snapshot.manifest.structure)).toEqual(['content/home.md', 'content/posts.md']);
    expect(snapshot.manifest.collectionItems?.map((item) => item.path)).toEqual([
      'content/posts/launch-day.md',
    ]);
  });

  test('keeps published items alongside drafts', () => {
    const site = createSiteFixture('collectionSite');
    addDraftPage(site);
    addDraftItem(site);
    site.contentFiles!.push({
      path: 'content/posts/second-post.md',
      slug: 'posts/second-post',
      frontmatter: { title: 'Second Post', layout: 'post', date: '2025-01-09' },
      content: 'Second post body',
    });
    site.manifest.collectionItems!.push({
      collectionId: 'posts',
      slug: 'second-post',
      path: 'content/posts/second-post.md',
      title: 'Second Post',
      url: '',
    });

    const snapshot = createPublicSiteSnapshot(site);

    expect(snapshot.contentFiles).toHaveLength(4);
    expect(paths(snapshot.manifest.structure)).toContain('content/posts.md');
    expect(snapshot.manifest.collectionItems?.map((item) => item.title)).toEqual([
      'Launch Day',
      'Second Post',
    ]);
  });

  test('keeps published descendants of an unpublished page', () => {
    const site = createSiteFixture('nestedPagesSite');
    site.contentFiles![1].frontmatter.published = false;

    const snapshot = createPublicSiteSnapshot(site);

    expect(paths(snapshot.manifest.structure)).toEqual(['content/home.md', 'content/about/team.md']);
  });

  test('does not mutate the caller’s site data', () => {
    const site = createSiteFixture('collectionSite');
    addDraftPage(site);
    addDraftItem(site);
    const before = structuredClone(site);

    const snapshot = createPublicSiteSnapshot(site);

    expect(site).toEqual(before);
    expect(snapshot).not.toBe(site);
    expect(snapshot.manifest).not.toBe(site.manifest);
    expect(snapshot.manifest.structure).not.toBe(site.manifest.structure);
    expect(snapshot.contentFiles).not.toBe(site.contentFiles);
    expect(snapshot.manifest.theme).toBe(site.manifest.theme);
  });

  test('leaves a site without collection items without an invented collectionItems array', () => {
    const site = createSiteFixture('basicSite');
    delete site.manifest.collectionItems;

    const snapshot = createPublicSiteSnapshot(site);

    expect('collectionItems' in snapshot.manifest).toBe(false);
  });
});

describe('unpublished homepage', () => {
  test('raises a build error naming the homepage file', () => {
    const site = createSiteFixture('basicSite');
    site.contentFiles![0].frontmatter.published = false;

    expect(() => createPublicSiteSnapshot(site)).toThrow(PublicationError);
    expect(() => createPublicSiteSnapshot(site)).toThrow(/content\/home\.md/);
    expect(() => createPublicSiteSnapshot(site)).toThrow(/published: false/);
  });

  test('detects the homepage by structure position when no file sets the flag', () => {
    const site = createSiteFixture('basicSite');
    delete site.contentFiles![0].frontmatter.homepage;
    site.contentFiles![0].frontmatter.published = false;

    expect(findHomepageFile(site)?.path).toBe('content/home.md');
    expect(() => createPublicSiteSnapshot(site)).toThrow(PublicationError);
  });

  test('allows a site whose homepage is a normal published page', () => {
    const site = createSiteFixture('basicSite');

    expect(() => createPublicSiteSnapshot(site)).not.toThrow();
  });
});
