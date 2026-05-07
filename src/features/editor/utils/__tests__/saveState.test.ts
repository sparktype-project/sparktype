import { describe, expect, test } from 'vitest';
import { shouldSeedSavedHashes } from '../saveState';

describe('shouldSeedSavedHashes', () => {
  test('seeds hashes once for an existing file with persisted content', () => {
    expect(
      shouldSeedSavedHashes({
        filePath: 'content/home.md',
        isNewFileMode: false,
        initialSavedContent: 'Hello world\n',
        previouslySeededFilePath: null,
      })
    ).toBe(true);
  });

  test('does not reseed hashes for the same file once initialized', () => {
    expect(
      shouldSeedSavedHashes({
        filePath: 'content/home.md',
        isNewFileMode: false,
        initialSavedContent: 'Hello world\n',
        previouslySeededFilePath: 'content/home.md',
      })
    ).toBe(false);
  });

  test('does not seed hashes for new files', () => {
    expect(
      shouldSeedSavedHashes({
        filePath: 'content/_new.md',
        isNewFileMode: true,
        initialSavedContent: '',
        previouslySeededFilePath: null,
      })
    ).toBe(false);
  });

  test('does not seed hashes without persisted content', () => {
    expect(
      shouldSeedSavedHashes({
        filePath: 'content/home.md',
        isNewFileMode: false,
        initialSavedContent: undefined,
        previouslySeededFilePath: null,
      })
    ).toBe(false);
  });
});
