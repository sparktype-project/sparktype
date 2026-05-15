import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import EditContentPage from '../EditContentPage';
import { useAppStore } from '@/core/state/useAppStore';
import { useUIStore } from '@/core/state/uiStore';
import { usePageIdentifier } from '@/features/editor/hooks/usePageIdentifier';
import { useFileContent } from '@/features/editor/hooks/useFileContent';
import { useFilePersistence } from '@/features/editor/hooks/useFilePersistence';
import { useEditor } from '@/features/editor/contexts/useEditor';

vi.mock('@/core/state/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/core/state/uiStore', () => ({
  useUIStore: vi.fn(),
}));

vi.mock('@/features/editor/hooks/usePageIdentifier', () => ({
  usePageIdentifier: vi.fn(),
}));

vi.mock('@/features/editor/hooks/useFileContent', () => ({
  useFileContent: vi.fn(),
}));

vi.mock('@/features/editor/hooks/useFilePersistence', () => ({
  useFilePersistence: vi.fn(),
}));

vi.mock('@/features/editor/contexts/useEditor', () => ({
  useEditor: vi.fn(),
}));

vi.mock('@/core/components/layout/ThreeColumnLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/editor/components/LeftSidebar', () => ({
  default: () => <div data-testid="left-sidebar" />,
}));

vi.mock('@/features/editor/components/NewPageDialog', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/editor/components/FrontmatterSidebar', () => ({
  default: () => <div data-testid="frontmatter-sidebar" />,
}));

vi.mock('@/features/editor/components/PrimaryContentFields', () => ({
  default: () => <div data-testid="primary-content-fields" />,
}));

vi.mock('@/features/editor/components/SaveButton', () => ({
  default: () => <button type="button">Save</button>,
}));

vi.mock('@/features/editor/components/forms/CollectionConfigForm', () => ({
  default: ({ layoutConfig }: { layoutConfig?: { collectionId?: string } }) => (
    <div data-testid="collection-config-form">{layoutConfig?.collectionId ?? 'none'}</div>
  ),
}));

vi.mock('@/core/components/ui/Loader', () => ({
  default: () => <div data-testid="loader" />,
}));

vi.mock('@/components/editor/tiptap/TipTapEditor', () => ({
  TipTapEditor: forwardRef(function MockTipTapEditor(
    { onContentChange }: { onContentChange: () => void },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      getMarkdown: () => 'Body copy',
      initializeWithContent: () => undefined,
    }));

    return (
      <button data-testid="tiptap-editor" onClick={onContentChange} type="button">
        Editor
      </button>
    );
  }),
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseUIStore = vi.mocked(useUIStore);
const mockUsePageIdentifier = vi.mocked(usePageIdentifier);
const mockUseFileContent = vi.mocked(useFileContent);
const mockUseFilePersistence = vi.mocked(useFilePersistence);
const mockUseEditor = vi.mocked(useEditor);

let currentSite = {
  manifest: {
    title: 'Fixture Site',
    structure: [
      {
        type: 'page',
        title: 'Posts',
        path: 'content/posts.md',
        slug: 'posts',
      },
    ],
    collections: [],
    theme: {
      name: 'starter',
      config: {},
    },
  },
  contentFiles: [
    {
      path: 'content/posts.md',
      content: 'Intro copy',
      slug: 'posts',
      frontmatter: {
        title: 'Posts',
        layout: 'listing',
      },
    },
  ],
  layoutFiles: [],
  themeFiles: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/sites/site-1/edit/content/posts']}>
      <Routes>
        <Route path="/sites/:siteId/edit/content/:slug" element={<EditContentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditContentPage', () => {
  beforeEach(() => {
    mockUseAppStore.mockImplementation((selector: unknown) => {
      const state = {
        getSiteById: () => currentSite,
      };

      if (typeof selector === 'function') {
        return selector(state);
      }

      return state;
    });

    mockUseUIStore.mockImplementation((selector: unknown) => {
      const state = {
        sidebar: {
          leftSidebarContent: null,
          rightSidebarContent: null,
          setLeftAvailable: vi.fn(),
          setRightAvailable: vi.fn(),
          setLeftSidebarContent: vi.fn(),
          setRightSidebarContent: vi.fn(),
        },
      };

      if (typeof selector === 'function') {
        return selector(state);
      }

      return state;
    });

    mockUsePageIdentifier.mockReturnValue({
      isNewFileMode: false,
      filePath: 'content/posts.md',
      collectionContext: {
        isCollectionItem: false,
        contextType: 'page',
        displayName: 'Page',
        isNewFile: false,
      },
    });

    mockUseFileContent.mockReturnValue({
      status: 'ready',
      frontmatter: {
        title: 'Posts',
        description: 'Collection landing page',
        layout: 'listing',
        displayCollection: true,
        layoutConfig: {
          collectionId: 'posts',
          layout: 'post',
        },
      },
      slug: 'posts',
      setSlug: vi.fn(),
      handleFrontmatterChange: vi.fn(),
      onContentModified: vi.fn(),
      applyPendingSlugChange: vi.fn(),
      hasPendingSlugChange: false,
    });

    mockUseFilePersistence.mockReturnValue({
      handleDelete: vi.fn(),
    });

    mockUseEditor.mockReturnValue({
      activeProviderUploadCount: 0,
    } as ReturnType<typeof useEditor>);

    currentSite = {
      manifest: {
        title: 'Fixture Site',
        structure: [
          {
            type: 'page',
            title: 'Posts',
            path: 'content/posts.md',
            slug: 'posts',
          },
        ],
        collections: [],
        theme: {
          name: 'starter',
          config: {},
        },
      },
      contentFiles: [
        {
          path: 'content/posts.md',
          content: 'Intro copy',
          slug: 'posts',
          frontmatter: {
            title: 'Posts',
            layout: 'listing',
          },
        },
      ],
      layoutFiles: [],
      themeFiles: [],
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('shows collection display configuration when the toggle is enabled', async () => {
    renderPage();

    expect(await screen.findByTestId('collection-config-form')).toHaveTextContent('posts');
    expect(screen.queryByTestId('tiptap-editor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  test('keeps the body editor when the toggle is disabled', async () => {
    mockUseFileContent.mockReturnValue({
      status: 'ready',
      frontmatter: {
        title: 'About',
        description: 'Standalone page',
        layout: 'listing',
        displayCollection: false,
      },
      slug: 'about',
      setSlug: vi.fn(),
      handleFrontmatterChange: vi.fn(),
      onContentModified: vi.fn(),
      applyPendingSlugChange: vi.fn(),
      hasPendingSlugChange: false,
    });

    renderPage();

    expect(await screen.findByTestId('tiptap-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('collection-config-form')).not.toBeInTheDocument();
  });

  test('defaults legacy pages without the toggle to the body editor', async () => {
    mockUseFileContent.mockReturnValue({
      status: 'ready',
      frontmatter: {
        title: 'Legacy page',
        description: 'Standalone page',
        layout: 'page',
      },
      slug: 'legacy-page',
      setSlug: vi.fn(),
      handleFrontmatterChange: vi.fn(),
      onContentModified: vi.fn(),
      applyPendingSlugChange: vi.fn(),
      hasPendingSlugChange: false,
    });

    renderPage();
    expect(await screen.findByTestId('tiptap-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('collection-config-form')).not.toBeInTheDocument();
  });
});
