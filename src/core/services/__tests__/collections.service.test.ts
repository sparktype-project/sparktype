import { describe, expect, test } from 'vitest';
import { getCollectionContent, selectCollectionItems } from '../collections.service';
import type { Manifest, ParsedMarkdownFile } from '@/core/types';

function createManifest(): Manifest {
  return {
    siteId: 'site-1',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'Test',
    theme: { name: 'default', config: {} },
    structure: [],
    collections: [
      {
        id: 'blog',
        name: 'Blog',
        contentPath: 'content/blog',
        defaultItemLayout: 'blog-post',
      },
    ],
    collectionItems: [],
  };
}

describe('getCollectionContent', () => {
  test('excludes the collection landing page and only returns nested items', () => {
    const contentFiles: ParsedMarkdownFile[] = [
      {
        path: 'content/blog.md',
        slug: 'blog',
        frontmatter: { title: 'Blog', layout: 'list-view' },
        content: 'Listing page',
      },
      {
        path: 'content/blog/post-one.md',
        slug: 'blog/post-one',
        frontmatter: { title: 'Post one', layout: 'blog-post' },
        content: 'Post one body',
      },
      {
        path: 'content/blog/post-two.md',
        slug: 'blog/post-two',
        frontmatter: { title: 'Post two', layout: 'blog-post' },
        content: 'Post two body',
      },
    ];

    const result = getCollectionContent(
      {
        manifest: createManifest(),
        contentFiles,
      },
      'blog'
    );

    expect(result.map((file) => file.path)).toEqual([
      'content/blog/post-one.md',
      'content/blog/post-two.md',
    ]);
  });
});

describe('selectCollectionItems', () => {
  function createNotesManifest(): Manifest {
    return {
      siteId: 'site-1',
      generatorVersion: '1.0.0',
      title: 'Test Site',
      description: 'Test',
      theme: { name: 'default', config: {} },
      structure: [],
      collections: [
        {
          id: 'notes',
          name: 'Notes',
          contentPath: 'content/notes',
          defaultItemLayout: 'note',
        },
      ],
      collectionItems: [],
      tags: [{ id: 'tag-tech', name: 'Tech', groupId: 'topics' }],
    };
  }

  const contentFiles: ParsedMarkdownFile[] = [
    {
      path: 'content/notes/older-tech.md',
      slug: 'notes/older-tech',
      frontmatter: { title: 'Older Tech', layout: 'note', date: '2025-01-01', tags: { topics: ['tag-tech'] } },
      content: 'Older Tech body',
    },
    {
      path: 'content/notes/newest.md',
      slug: 'notes/newest',
      frontmatter: { title: 'Newest', layout: 'note', date: '2025-03-01' },
      content: 'Newest body',
    },
    {
      path: 'content/notes/newer-tech.md',
      slug: 'notes/newer-tech',
      frontmatter: { title: 'Newer Tech', layout: 'note', date: '2025-02-01', tags: { topics: ['tag-tech'] } },
      content: 'Newer Tech body',
    },
  ];

  const siteData = { manifest: createNotesManifest(), contentFiles };

  test('applies tag filtering, sorting and the item limit in that order', () => {
    expect(selectCollectionItems(siteData, 'notes').map((file) => file.frontmatter.title)).toEqual([
      'Older Tech',
      'Newest',
      'Newer Tech',
    ]);

    expect(
      selectCollectionItems(siteData, 'notes', { tagFilters: ['tag-tech'] }).map((file) => file.frontmatter.title),
    ).toEqual(['Older Tech', 'Newer Tech']);

    expect(
      selectCollectionItems(siteData, 'notes', { sortBy: 'date', sortOrder: 'desc' }).map((file) => file.frontmatter.title),
    ).toEqual(['Newest', 'Newer Tech', 'Older Tech']);

    // The limit is applied after sorting, so it keeps the newest item, not the first in file order.
    expect(
      selectCollectionItems(siteData, 'notes', { sortBy: 'date', sortOrder: 'desc', maxItems: 1 })
        .map((file) => file.frontmatter.title),
    ).toEqual(['Newest']);

    // A non-positive limit keeps every item.
    expect(selectCollectionItems(siteData, 'notes', { maxItems: 0 })).toHaveLength(3);
  });
});

describe('getCollectionContent isolation', () => {
  function createSite(siteId: string, itemPath: string): { manifest: Manifest; contentFiles: ParsedMarkdownFile[] } {
    return {
      manifest: { ...createManifest(), siteId },
      contentFiles: [
        {
          path: 'content/blog.md',
          slug: 'blog',
          frontmatter: { title: 'Blog', layout: 'list-view' },
          content: 'Listing page',
        },
        {
          path: itemPath,
          slug: itemPath.replace(/^content\//, '').replace(/\.md$/, ''),
          frontmatter: { title: itemPath, layout: 'blog-post' },
          content: `${itemPath} body`,
        },
      ],
    };
  }

  test('two sites with identical collection config and file counts never share content', () => {
    const siteOne = createSite('site-one', 'content/blog/from-site-one.md');
    const siteTwo = createSite('site-two', 'content/blog/from-site-two.md');

    expect(getCollectionContent(siteOne, 'blog').map((file) => file.path)).toEqual([
      'content/blog/from-site-one.md',
    ]);
    expect(getCollectionContent(siteTwo, 'blog').map((file) => file.path)).toEqual([
      'content/blog/from-site-two.md',
    ]);
  });

  test('reflects frontmatter changes made since the previous call', () => {
    const site = createSite('site-one', 'content/blog/post.md');

    expect(getCollectionContent(site, 'blog')[0].frontmatter.published).toBeUndefined();

    // The store replaces files immutably on save, so an edited file is a new object.
    site.contentFiles[1] = {
      ...site.contentFiles[1],
      frontmatter: { ...site.contentFiles[1].frontmatter, published: false },
    };

    expect(getCollectionContent(site, 'blog')[0].frontmatter.published).toBe(false);
  });
});
