import JSZip from 'jszip';

export type ZipEntries = Record<string, string | Uint8Array>;

/**
 * Builds a ZIP and returns it as a File. JSZip normalises ".." segments when adding entries,
 * so hostile names are written as same-length placeholders and patched into the bytes
 * (the name is not covered by the CRC, so the archive stays loadable).
 */
export async function buildZipFile(
  entries: ZipEntries,
  rawNames: Record<string, string> = {},
  fileName = 'theme.zip',
): Promise<File> {
  const zip = new JSZip();
  const patches: Array<[Uint8Array, Uint8Array]> = [];
  const encoder = new TextEncoder();

  for (const [name, content] of Object.entries(entries)) {
    const raw = rawNames[name];
    if (raw === undefined) {
      zip.file(name, content);
      continue;
    }
    if (raw.length !== name.length) throw new Error(`Placeholder "${name}" must match raw name length`);
    zip.file(name, content);
    patches.push([encoder.encode(name), encoder.encode(raw)]);
  }

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  for (const [from, to] of patches) replaceAll(bytes, from, to);
  return new File([bytes], fileName, { type: 'application/zip' });
}

function replaceAll(haystack: Uint8Array, from: Uint8Array, to: Uint8Array) {
  outer: for (let i = 0; i <= haystack.length - from.length; i++) {
    for (let j = 0; j < from.length; j++) if (haystack[i + j] !== from[j]) continue outer;
    haystack.set(to, i);
  }
}

export const MINIMAL_THEME: ZipEntries = {
  'theme.json': JSON.stringify({
    name: 'Fixture theme',
    version: '1.0.0',
    files: [
      { path: 'theme.json', type: 'manifest' },
      { path: 'base.hbs', type: 'base' },
    ],
  }),
  'base.hbs': '<!doctype html><html><body>{{{body}}}</body></html>',
};
