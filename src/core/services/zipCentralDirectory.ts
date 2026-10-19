export interface ZipEntryRecord {
  /** Name exactly as stored in the archive, before any library normalisation. */
  name: string;
  compressedSize: number;
  uncompressedSize: number;
}

export interface ZipListing {
  entryCount: number;
  entries: ZipEntryRecord[];
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_MIN_LENGTH = 22;
const MAX_COMMENT_LENGTH = 0xffff;
const ZIP64_COUNT = 0xffff;

/**
 * Lists a ZIP's central directory without decompressing anything. JSZip resolves ".." segments
 * in entry names, so zip-slip checks must read the raw names here. Returns null when the
 * archive has no readable central directory (JSZip then reports the real error).
 */
export function listZipEntries(buffer: ArrayBuffer, maxEntries: number): ZipListing | null {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) return null;

  const entryCount = view.getUint16(eocd + 10, true);
  if (entryCount === ZIP64_COUNT) return { entryCount: Number.POSITIVE_INFINITY, entries: [] };

  const decoder = new TextDecoder();
  const entries: ZipEntryRecord[] = [];
  let offset = view.getUint32(eocd + 16, true);

  for (let i = 0; i < Math.min(entryCount, maxEntries + 1); i++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) return null;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (offset + 46 + nameLength > view.byteLength) return null;

    entries.push({
      name: decoder.decode(new Uint8Array(buffer, offset + 46, nameLength)),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return { entryCount, entries };
}

function findEndOfCentralDirectory(view: DataView): number {
  const last = view.byteLength - EOCD_MIN_LENGTH;
  const first = Math.max(0, last - MAX_COMMENT_LENGTH);
  for (let i = last; i >= first; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i;
  }
  return -1;
}
