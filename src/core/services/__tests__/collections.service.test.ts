import { describe, expect, test } from 'vitest';
import { getCollectionContent } from '../collections.service';
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
