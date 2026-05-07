export function normalizeEditorContentForLoad(rawContent: string): string {
  const normalized = rawContent.replace(/\r\n/g, '\n');

  if (!normalized) {
    return '';
  }

  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}
