export function compactHtml(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}
