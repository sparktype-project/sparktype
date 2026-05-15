import { describe, expect, test } from 'vitest';
import type { Manifest, ParsedMarkdownFile } from '@/core/types';
import { filterContentBySelectedTags, getAppliedTagsForCollection } from '../tags.service';

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
    tagGroups: [
      {
        id: 'topic',
        name: 'Topic',
        applicableCollections: ['blog'],
      },
      {
        id: 'audience',
        name: 'Audience',
        applicableCollections: ['blog'],
      },
      {
        id: 'unused',
        name: 'Unused',
        applicableCollections: ['blog'],
      },
    ],
    tags: [
      { id: 'topic-news', name: 'News', groupId: 'topic' },
      { id: 'topic-guides', name: 'Guides', groupId: 'topic' },
      { id: 'audience-dev', name: 'Developers', groupId: 'audience' },
      { id: 'audience-design', name: 'Designers', groupId: 'audience' },
      { id: 'unused-tag', name: 'Unused tag', groupId: 'unused' },
    ],
  };
}

function createContentFiles(): ParsedMarkdownFile[] {
  return [
    {
      path: 'content/blog/post-one.md',
      slug: 'blog/post-one',
      frontmatter: {
        title: 'Post one',
        layout: 'blog-post',
        tags: {
          topic: ['topic-news'],
          audience: ['audience-dev'],
        },
      },
      content: 'Post one body',
    },
    {
      path: 'content/blog/post-two.md',
      slug: 'blog/post-two',
      frontmatter: {
        title: 'Post two',
        layout: 'blog-post',
        tags: {
          topic: ['topic-guides'],
          audience: ['audience-dev'],
        },
      },
      content: 'Post two body',
    },
    {
      path: 'content/blog/post-three.md',
      slug: 'blog/post-three',
      frontmatter: {
        title: 'Post three',
        layout: 'blog-post',
        tags: {
          topic: ['topic-news'],
          audience: ['audience-design'],
        },
      },
      content: 'Post three body',
    },
  ];
}

describe('tags.service collection helpers', () => {
  test('returns only tag groups and tags used by the selected collection', () => {
    const manifest = createManifest();
    const contentFiles = createContentFiles();

    const result = getAppliedTagsForCollection(
      { manifest, contentFiles },
      'blog',
      contentFiles,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.tagGroup.id).toBe('topic');
    expect(result[0]?.tags.map((tag) => tag.id).sort()).toEqual(['topic-guides', 'topic-news']);
    expect(result[1]?.tagGroup.id).toBe('audience');
    expect(result[1]?.tags.map((tag) => tag.id).sort()).toEqual(['audience-design', 'audience-dev']);
  });

  test('filters content with OR semantics inside a group and AND semantics across groups', () => {
    const manifest = createManifest();
    const contentFiles = createContentFiles();

    const result = filterContentBySelectedTags(manifest, contentFiles, [
      'topic-news',
      'topic-guides',
      'audience-dev',
    ]);

    expect(result.map((file) => file.slug)).toEqual([
      'blog/post-one',
      'blog/post-two',
    ]);
  });
});
