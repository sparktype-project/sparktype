import { act, fireEvent, render, screen } from '@testing-library/react';
import { useMemo, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { generateContentHash } from '@/core/libraries/utils';
import { AUTOSAVE_DELAY } from '@/config/editorConfig';
import { EditorContext, type EditorContextType, type SaveState } from '@/features/editor/contexts/EditorContext';
import { useFilePersistence } from '../useFilePersistence';

const navigate = vi.fn();
const addOrUpdateContentFile = vi.fn();
const updateContentFileOnly = vi.fn();
const deleteContentFileAndState = vi.fn();
const getSiteById = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@/core/state/useAppStore', () => {
  const useAppStore = vi.fn();
  Object.assign(useAppStore, {
    getState: () => ({
      addOrUpdateContentFile,
      updateContentFileOnly,
      deleteContentFileAndState,
      getSiteById,
    }),
  });

  return { useAppStore };
});

vi.mock('../useUnloadPrompt', () => ({
  useUnloadPrompt: vi.fn(),
}));

function EditorHarness({
  children,
  initialSaveState = 'pending',
}: {
  children: ReactNode;
  initialSaveState?: SaveState;
}) {
  const [saveState, setSaveState] = useState<SaveState>(initialSaveState);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true);
  const [hasUnsavedChangesSinceManualSave, setHasUnsavedChangesSinceManualSave] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [contentHash, setContentHash] = useState('');
  const [lastSavedHash, setLastSavedHash] = useState('');

  const value = useMemo<EditorContextType>(() => ({
    saveState,
    setSaveState,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    hasUnsavedChangesSinceManualSave,
    setHasUnsavedChangesSinceManualSave,
    triggerSave: vi.fn(async () => {}),
    registerSaveAction: vi.fn(),
    lastSaveTime,
    setLastSaveTime,
    contentHash,
    setContentHash,
    lastSavedHash,
    setLastSavedHash,
    activeProviderUploadCount: 0,
    beginProviderUpload: vi.fn(),
    endProviderUpload: vi.fn(),
  }), [
    contentHash,
    hasUnsavedChanges,
    hasUnsavedChangesSinceManualSave,
    lastSaveTime,
    lastSavedHash,
    saveState,
  ]);

  return (
    <EditorContext.Provider value={value}>
      {children}
      <output data-testid="save-state">{saveState}</output>
      <output data-testid="content-hash">{contentHash}</output>
      <output data-testid="saved-hash">{lastSavedHash}</output>
    </EditorContext.Provider>
  );
}

function PersistenceHarness({
  frontmatter,
  filePath,
  initialSavedContent,
  getEditorContent,
}: {
  frontmatter: {
    title: string;
    layout: string;
    date: string;
  };
  filePath: string;
  initialSavedContent: string;
  getEditorContent: () => string;
}) {
  useFilePersistence({
    siteId: 'site-1',
    filePath,
    isNewFileMode: false,
    frontmatter,
    slug: 'home',
    initialSavedContent,
    getEditorContent,
  });

  return null;
}

function DirtyStateHarness({
  frontmatter,
  filePath,
  initialSavedContent,
}: {
  frontmatter: {
    title: string;
    layout: string;
    date: string;
  };
  filePath: string;
  initialSavedContent: string;
}) {
  const [editorContent, setEditorContent] = useState(initialSavedContent);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasUnsavedChangesSinceManualSave, setHasUnsavedChangesSinceManualSave] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [contentHash, setContentHash] = useState('');
  const [lastSavedHash, setLastSavedHash] = useState('');

  const value = useMemo<EditorContextType>(() => ({
    saveState,
    setSaveState,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    hasUnsavedChangesSinceManualSave,
    setHasUnsavedChangesSinceManualSave,
    triggerSave: vi.fn(async () => {}),
    registerSaveAction: vi.fn(),
    lastSaveTime,
    setLastSaveTime,
    contentHash,
    setContentHash,
    lastSavedHash,
    setLastSavedHash,
    activeProviderUploadCount: 0,
    beginProviderUpload: vi.fn(),
    endProviderUpload: vi.fn(),
  }), [
    contentHash,
    hasUnsavedChanges,
    hasUnsavedChangesSinceManualSave,
    lastSaveTime,
    lastSavedHash,
    saveState,
  ]);

  return (
    <EditorContext.Provider value={value}>
      <PersistenceHarness
        frontmatter={frontmatter}
        filePath={filePath}
        initialSavedContent={initialSavedContent}
        getEditorContent={() => editorContent}
      />
      <button
        type="button"
        onClick={() => {
          setEditorContent('Updated body\n');
          setHasUnsavedChanges(true);
          setHasUnsavedChangesSinceManualSave(true);
        }}
      >
        Change body
      </button>
      <output data-testid="dirty-save-state">{saveState}</output>
      <output data-testid="dirty-content-hash">{contentHash}</output>
      <output data-testid="dirty-saved-hash">{lastSavedHash}</output>
    </EditorContext.Provider>
  );
}

describe('useFilePersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigate.mockReset();
    addOrUpdateContentFile.mockReset();
    updateContentFileOnly.mockReset();
    deleteContentFileAndState.mockReset();
    getSiteById.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('seeds an existing file as saved and cancels any inherited autosave cycle', async () => {
    const initialSavedContent = 'Welcome home\n';
    const frontmatter = {
      title: 'Home',
      layout: 'page',
      date: '2026-05-07',
    };
    const expectedHash = generateContentHash(frontmatter, initialSavedContent);

    render(
      <EditorHarness initialSaveState="pending">
        <PersistenceHarness
          frontmatter={frontmatter}
          filePath="content/home.md"
          initialSavedContent={initialSavedContent}
          getEditorContent={() => initialSavedContent}
        />
      </EditorHarness>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('save-state')).toHaveTextContent('saved');
    expect(screen.getByTestId('content-hash')).toHaveTextContent(expectedHash);
    expect(screen.getByTestId('saved-hash')).toHaveTextContent(expectedHash);

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY + 50);
    });

    expect(updateContentFileOnly).not.toHaveBeenCalled();
  });

  test('marks body content as pending when editor text changes', async () => {
    const initialSavedContent = 'Welcome home\n';
    const frontmatter = {
      title: 'Home',
      layout: 'page',
      date: '2026-05-07',
    };
    const expectedHash = generateContentHash(frontmatter, 'Updated body\n');

    render(
      <DirtyStateHarness
        frontmatter={frontmatter}
        filePath="content/home.md"
        initialSavedContent={initialSavedContent}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Change body' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('dirty-save-state')).toHaveTextContent('pending');
    expect(screen.getByTestId('dirty-content-hash')).toHaveTextContent(expectedHash);
    expect(screen.getByTestId('dirty-saved-hash')).not.toHaveTextContent(expectedHash);
  });
});
