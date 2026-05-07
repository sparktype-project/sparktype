import { describe, expect, test } from 'vitest';
import { normalizeEditorContentForLoad } from '../editorContent';

describe('normalizeEditorContentForLoad', () => {
  test('adds the trailing newline Plate serializes for non-empty markdown', () => {
    expect(normalizeEditorContentForLoad('Start writing your content here.')).toBe('Start writing your content here.\n');
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
});
