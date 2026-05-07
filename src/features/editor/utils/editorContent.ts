export function normalizeEditorContentForLoad(rawContent: string): string {
  const normalized = rawContent.replace(/\r\n/g, '\n');

  if (!normalized) {
    return '';
  }

  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
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
