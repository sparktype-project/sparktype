import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ReactNodeViewProps } from '@tiptap/react';
import { CollectionViewNode } from '../CollectionView';
import { useAppStore } from '@/core/state/useAppStore';
import { getLayoutManifest } from '@/core/services/config/configHelpers.service';

vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/core/services/config/configHelpers.service', async () => {
  const actual = await vi.importActual<typeof import('@/core/services/config/configHelpers.service')>(
    '@/core/services/config/configHelpers.service',
  );

  return {
    ...actual,
    getLayoutManifest: vi.fn(),
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
      <div data-testid="selected-tag-filters">{selected.join(',')}</div>
      <ul>
        {options.map((option) => (
          <li key={option.value}>{option.label}</li>
        ))}
      </ul>
    </div>
  ),
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockGetLayoutManifest = vi.mocked(getLayoutManifest);
const pointerCaptureProto = Element.prototype as Element & {
  hasPointerCapture?: (pointerId: number) => boolean;
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
  scrollIntoView?: (arg?: boolean | ScrollIntoViewOptions) => void;
};

const site = {
  siteId: 'site-1',
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
        defaultItemLayout: 'news-post',
      },
    ],
    collectionItems: [],
    tagGroups: [
      { id: 'topic', name: 'Topic', applicableCollections: ['posts'] },
      { id: 'series', name: 'Series', applicableCollections: ['posts'] },
      { id: 'region', name: 'Region', applicableCollections: ['news'] },
    ],
    tags: [
      { id: 'topic-news', name: 'News', groupId: 'topic' },
      { id: 'topic-guides', name: 'Guides', groupId: 'topic' },
      { id: 'series-alpha', name: 'Alpha', groupId: 'series' },
      { id: 'region-emea', name: 'EMEA', groupId: 'region' },
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
          series: ['series-alpha'],
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
        layout: 'news-post',
        tags: {
          region: ['region-emea'],
        },
      },
      content: 'Story one body',
    },
  ],
};

function createProps(): ReactNodeViewProps {
  return {
    editor: {} as ReactNodeViewProps['editor'],
    node: {
      attrs: {
        collection: 'posts',
        layout: 'list-view',
        displayType: '',
        maxItems: 10,
        sortBy: 'date',
        sortOrder: 'desc',
        tagFilters: ['topic-news'],
      },
    } as ReactNodeViewProps['node'],
    decorations: [],
    selected: false,
    extension: {
      options: {
        siteId: 'site-1',
      },
    } as ReactNodeViewProps['extension'],
    getPos: vi.fn(),
    updateAttributes: vi.fn(),
    deleteNode: vi.fn(),
    view: {} as ReactNodeViewProps['view'],
    innerDecorations: {} as ReactNodeViewProps['innerDecorations'],
    HTMLAttributes: {},
  };
}

describe('CollectionViewNode', () => {
  beforeEach(() => {
    pointerCaptureProto.hasPointerCapture = vi.fn(() => false);
    pointerCaptureProto.setPointerCapture = vi.fn();
    pointerCaptureProto.releasePointerCapture = vi.fn();
    pointerCaptureProto.scrollIntoView = vi.fn();

    mockUseAppStore.mockImplementation((selector: unknown) => {
      const state = {
        getSiteById: () => site,
      };

      if (typeof selector === 'function') {
        return selector(state);
      }

      return state;
    });

    mockGetLayoutManifest.mockResolvedValue({
      id: 'post',
      name: 'Post',
      layoutType: 'item',
      partials: [
        { path: 'card.hbs', name: 'Card', isDefault: true },
        { path: 'hero.hbs', name: 'Hero' },
      ],
    } as Awaited<ReturnType<typeof getLayoutManifest>>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('shows dropdown-backed layout, display type, and tag filter options from the selected collection content type', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(<CollectionViewNode {...createProps()} />);

    await user.click(screen.getByRole('button', { name: /configure/i }));

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[1]!);

    expect(await screen.findByRole('option', { name: 'List' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Grid' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'List' }));

    const refreshedComboboxes = screen.getAllByRole('combobox');
    await user.click(refreshedComboboxes[2]!);

    expect(await screen.findByRole('option', { name: 'Card' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Hero' })).toBeInTheDocument();

    expect(screen.getByText('News')).toBeInTheDocument();
    expect(screen.getByText('Guides')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('EMEA')).not.toBeInTheDocument();
  });
});
