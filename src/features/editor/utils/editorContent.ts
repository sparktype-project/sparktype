export function normalizeEditorContentForLoad(rawContent: string): string {
  return rawContent.replace(/\r\n/g, '\n');
}

export function getEditorSessionKey(filePath: string, isNewFileMode: boolean): string {
  return isNewFileMode ? '__new__' : `file:${filePath}`;
}

export function shouldReinitializeEditorSession(
  currentSessionKey: string | null,
  filePath: string,
  isNewFileMode: boolean
): boolean {
  return currentSessionKey !== getEditorSessionKey(filePath, isNewFileMode);
}

/**
 * Whether loading content into the editor would overwrite text the user has
 * already typed in this session. Initialisation runs on a short delay after the
 * editor mounts, so a fast typist (or a test) can get ahead of it.
 */
export function hasUserEditedEditorSession(
  editedSessionKey: string | null,
  filePath: string,
  isNewFileMode: boolean
): boolean {
  return editedSessionKey === getEditorSessionKey(filePath, isNewFileMode);
}
