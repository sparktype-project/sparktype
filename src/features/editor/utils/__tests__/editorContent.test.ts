import { describe, expect, test } from 'vitest';
import {
  getEditorSessionKey,
  hasUserEditedEditorSession,
  normalizeEditorContentForLoad,
  shouldReinitializeEditorSession,
} from '../editorContent';

describe('normalizeEditorContentForLoad', () => {
  test('keeps non-empty markdown unchanged when it already uses unix line endings', () => {
    expect(normalizeEditorContentForLoad('Start writing your content here.')).toBe('Start writing your content here.');
  });

  test('normalizes Windows line endings without trimming content', () => {
    expect(normalizeEditorContentForLoad('Line one\r\nLine two\r\n')).toBe('Line one\nLine two\n');
  });

  test('preserves already-normalized content', () => {
    expect(normalizeEditorContentForLoad('Start writing your content here.\n')).toBe('Start writing your content here.\n');
  });

  test('keeps empty content empty', () => {
    expect(normalizeEditorContentForLoad('')).toBe('');
  });

  test('uses file identity rather than content snapshots for existing editor sessions', () => {
    expect(getEditorSessionKey('content/home.md', false)).toBe('file:content/home.md');
    expect(shouldReinitializeEditorSession('file:content/home.md', 'content/home.md', false)).toBe(false);
  });

  test('reinitializes when switching to a different file or new-file mode', () => {
    expect(shouldReinitializeEditorSession('file:content/home.md', 'content/about.md', false)).toBe(true);
    expect(shouldReinitializeEditorSession('file:content/home.md', 'content/_new.md', true)).toBe(true);
  });

  test('detects user edits made in the current session so late initialisation does not wipe them', () => {
    expect(hasUserEditedEditorSession('__new__', 'content/blog', true)).toBe(true);
    expect(hasUserEditedEditorSession('file:content/a.md', 'content/a.md', false)).toBe(true);
  });

  test('ignores edits that belong to a different session', () => {
    expect(hasUserEditedEditorSession(null, 'content/blog', true)).toBe(false);
    expect(hasUserEditedEditorSession('__new__', 'content/blog/post.md', false)).toBe(false);
  });
});
