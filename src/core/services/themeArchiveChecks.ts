import { SECURITY_CONFIG } from '@/config/editorConfig';
import { isAllowedFileType, isBlockedFileType, validateFilePath } from './themeValidation.service';
import type { ZipListing } from './zipCentralDirectory';

const { MAX_FILE_COUNT, MAX_FILE_SIZE, MAX_TOTAL_SIZE, MAX_DECOMPRESSION_RATIO } = SECURITY_CONFIG.THEME_IMPORT_LIMITS;
const MAX_REPORTED = 10;

function isArchiveMetadata(path: string): boolean {
  return path.startsWith('__MACOSX/') || path.endsWith('.DS_Store');
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

/**
 * Hard failures found from the archive's central directory alone, before any file is
 * decompressed: entry count, declared sizes, zip-slip and unsafe names, disallowed types.
 * Returns every reason (capped) so the import dialog can show them all.
 */
export function checkThemeArchive(listing: ZipListing): string[] {
  if (listing.entryCount > MAX_FILE_COUNT) {
    const count = Number.isFinite(listing.entryCount) ? listing.entryCount : 'too many';
    return [`Too many files in theme package: ${count}. Maximum allowed: ${MAX_FILE_COUNT}`];
  }

  const errors = new Set<string>();
  let declaredTotal = 0;

  for (const entry of listing.entries) {
    if (isArchiveMetadata(entry.name)) continue;
    const isDirectory = entry.name.endsWith('/');
    const path = isDirectory ? entry.name.slice(0, -1) : entry.name;

    validateFilePath(path).errors.forEach(error => errors.add(error));
    if (isDirectory) continue;

    if (isBlockedFileType(path)) errors.add(`Blocked file type: ${path}`);
    else if (!isAllowedFileType(path)) errors.add(`File type not allowed: ${path}`);

    if (entry.uncompressedSize > MAX_FILE_SIZE) {
      errors.add(`File too large: "${path}" (${megabytes(entry.uncompressedSize)}). Maximum allowed: ${megabytes(MAX_FILE_SIZE)}`);
    }
    if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > MAX_DECOMPRESSION_RATIO) {
      errors.add(`Suspicious compression ratio in "${path}". This may indicate a zip bomb.`);
    }
    declaredTotal += entry.uncompressedSize;
  }

  if (declaredTotal > MAX_TOTAL_SIZE) {
    errors.add(`Total theme size too large: ${megabytes(declaredTotal)}. Maximum allowed: ${megabytes(MAX_TOTAL_SIZE)}`);
  }

  const reasons = [...errors];
  if (reasons.length <= MAX_REPORTED) return reasons;
  return [...reasons.slice(0, MAX_REPORTED), `...and ${reasons.length - MAX_REPORTED} more problems`];
}
