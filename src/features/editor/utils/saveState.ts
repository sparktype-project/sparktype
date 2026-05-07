export function shouldSeedSavedHashes(params: {
  filePath: string;
  isNewFileMode: boolean;
  initialSavedContent?: string;
  previouslySeededFilePath: string | null;
}): boolean {
  const { filePath, isNewFileMode, initialSavedContent, previouslySeededFilePath } = params;

  if (isNewFileMode) {
    return false;
  }

  if (previouslySeededFilePath === filePath) {
    return false;
  }

  return initialSavedContent !== undefined;
}
