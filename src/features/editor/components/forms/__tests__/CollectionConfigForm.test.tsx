import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import CollectionConfigForm from '../CollectionConfigForm';
import { useAppStore } from '@/core/state/useAppStore';

vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/core/services/config/configHelpers.service', async () => {
  const actual = await vi.importActual<typeof import('@/core/services/config/configHelpers.service')>(
    '@/core/services/config/configHelpers.service',
  );

  return {
    ...actual,
    getLayoutManifest: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('@/features/editor/components/SimpleMultiSelect', () => ({
  SimpleMultiSelect: ({
    options,
    selected,
  }: {
    options: Array<{ label: string; value: string }>;
    selected: string[];
  }) => (
    <div>
      <div data-testid="selected-tags">{selected.join(',')}</div>
      <ul>
        {options.map((option) => (
          <li key={option.value}>{option.label}</li>
        ))}
      </ul>
    </div>
  ),
}));

const mockUseAppStore = vi.mocked(useAppStore);

const site = {
  manifest: {
    siteId: 'site-1',
    generatorVersion: '1.0.0',
    title: 'Fixture Site',
    description: 'Fixture',
    theme: { name: 'starter', config: {} },
    structure: [],
    collections: [
      {
        id: 'posts',
        name: 'Posts',
        contentPath: 'content/posts',
        defaultItemLayout: 'post',
      },
      {
        id: 'news',
        name: 'News',
        contentPath: 'content/news',
        defaultItemLayout: 'post',
      },
    ],
    collectionItems: [],
    tagGroups: [
      { id: 'topic', name: 'Topic', applicableCollections: ['posts'] },
      { id: 'series', name: 'Series', applicableCollections: ['posts'] },
      { id: 'news-topic', name: 'News topic', applicableCollections: ['news'] },
    ],
    tags: [
      { id: 'topic-news', name: 'News', groupId: 'topic' },
      { id: 'topic-guides', name: 'Guides', groupId: 'topic' },
      { id: 'series-alpha', name: 'Alpha', groupId: 'series' },
      { id: 'news-topic-world', name: 'World', groupId: 'news-topic' },
    ],
  },
  contentFiles: [
    {
      path: 'content/posts/post-one.md',
      slug: 'posts/post-one',
      frontmatter: {
        title: 'Post one',
        layout: 'post',
        tags: {
          topic: ['topic-news'],
        },
      },
      content: 'Post one body',
    },
    {
      path: 'content/posts/post-two.md',
      slug: 'posts/post-two',
      frontmatter: {
        title: 'Post two',
        layout: 'post',
        tags: {
          topic: ['topic-guides'],
        },
      },
      content: 'Post two body',
    },
    {
      path: 'content/news/story-one.md',
      slug: 'news/story-one',
      frontmatter: {
        title: 'Story one',
        layout: 'post',
        tags: {
          'news-topic': ['news-topic-world'],
        },
      },
      content: 'Story body',
    },
  ],
};

describe('CollectionConfigForm', () => {
  test('shows only applied tags for the selected collection', () => {
    mockUseAppStore.mockImplementation((selector: unknown) => {
      const state = {
        getSiteById: () => site,
      };

      if (typeof selector === 'function') {
        return selector(state);
      }

      return state;
    });

    render(
      <CollectionConfigForm
        siteId="site-1"
        layoutConfig={{
          collectionId: 'posts',
          layout: 'post',
          filterTags: ['topic-news'],
        }}
        onLayoutConfigChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Topic')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
    expect(screen.getByText('Guides')).toBeInTheDocument();
    expect(screen.queryByText('Series')).not.toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.queryByText('News topic')).not.toBeInTheDocument();
    expect(screen.queryByText('World')).not.toBeInTheDocument();
  });
});
