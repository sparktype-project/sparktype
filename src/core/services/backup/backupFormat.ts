// src/core/services/backup/backupFormat.ts

/**
 * Backup archive format.
 *
 * A Sparktype backup is a ZIP archive with a single `_site` root folder (kept as
 * {@link SIGNUM_FOLDER} for backwards compatibility with archives produced by
 * earlier releases). Everything a site needs to be restored lives under it:
 *
 * ```
 * _site/manifest.json                    the site manifest, verbatim
 * _site/secrets.json                     sensitive data (publishing credentials)
 * _site/content/<path>.md                Markdown source, path preserved
 * _site/data/<path>.json                 site data files (categories, collections, ...)
 * _site/data/media.json                  the media index (image metadata + references)
 * _site/assets/originals/<path>          original uploads, path preserved
 * _site/themes/<themeName>/<path>        custom themes only (core themes are shipped)
 * _site/layouts/<layoutId>/<path>        custom layouts referenced by content
 * ```
 *
 * Images are keyed in the archive by their site-relative storage path, so
 * `assets/originals/photos/hero.jpg` is stored at
 * `_site/assets/originals/photos/hero.jpg` and restored under that same key.
 * Derivatives are never archived: they are regenerated on demand.
 *
 * ## Contract
 *
 * Export preserves, and import restores: Markdown content, the manifest, the
 * secrets, every original image (bytes and path), the media metadata index, site
 * data files, and custom themes and layouts. Core themes and layouts ship with
 * the app and are never duplicated into an archive.
 *
 * - **Content is Markdown under `content/`, nothing else.** Readers scope
 *   themselves to the `_site/content/` prefix and to `.md` entries; JSZip's
 *   `folder().files` map is archive-global and must never be iterated as if it
 *   were folder-scoped.
 * - **`data/media.json` is the media index and is authoritative when present.**
 *   Export regenerates it from the image registry, including originals no page
 *   references (a backup keeps everything, unlike a publish bundle), so every
 *   archived original has an entry. Import restores exactly the originals the
 *   index lists and reports any mismatch in either direction.
 * - **Legacy archives carry originals but no index.** They are still restored,
 *   explicitly: every entry under `_site/assets/originals/` is keyed by its own
 *   archive path (`assets/originals/<path>`).
 * - **A damaged archive is rejected, never half-restored.** An unreadable ZIP, a
 *   missing/invalid manifest, or unparseable `secrets.json` or `media.json` all
 *   fail the import before any storage is touched.
 * - **Importing over an existing `siteId` replaces it.** The caller clears the
 *   previous site's blobs, derivatives, image registry and data files before
 *   writing the imported data, so no stale original survives.
 */

/** Root folder of a backup archive. Do not change: existing archives depend on it. */
export const SIGNUM_FOLDER = '_site';

export const MANIFEST_FILE = 'manifest.json';
export const SECRETS_FILE = 'secrets.json';

/** Folder holding Markdown source, relative to {@link SIGNUM_FOLDER}. */
export const CONTENT_FOLDER = 'content/';
/** Folder holding site data files, relative to {@link SIGNUM_FOLDER}. */
export const DATA_FOLDER = 'data/';
/** Media index: the image metadata/reference manifest restoring images reads. */
export const MEDIA_INDEX_FILE = 'media.json';
/** Media index path as stored in the archive manifest's `dataFiles` list. */
export const MEDIA_INDEX_PATH = `${DATA_FOLDER}${MEDIA_INDEX_FILE}`;

/** Folder holding original uploads, relative to {@link SIGNUM_FOLDER}. */
export const ORIGINALS_FOLDER = 'assets/originals/';
export const THEMES_FOLDER = 'themes/';
export const LAYOUTS_FOLDER = 'layouts/';

/** Only Markdown entries are content. Everything else in the archive is data. */
const CONTENT_EXTENSION = '.md';

/**
 * True for a site-relative path that cannot escape the folder it is written to.
 * The storage layer rejects the same shapes, so a `false` answer means the entry
 * must not be written or read at all.
 */
export function isSafeRelativePath(relativePath: string): boolean {
  if (typeof relativePath !== 'string' || relativePath.length === 0) return false;
  if (relativePath.startsWith('/') || relativePath.includes('\\')) return false;
  return relativePath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/**
 * True for a site-relative path that may be treated as content: Markdown, inside
 * `content/`, and unable to escape it. Archives and in-memory sites have both
 * carried non-content entries (manifests, `.DS_Store`) as "content files"; this
 * predicate is the single place that decides what counts.
 */
export function isSupportedContentEntry(sitePath: string): boolean {
  return sitePath.startsWith(CONTENT_FOLDER)
    && sitePath.toLowerCase().endsWith(CONTENT_EXTENSION)
    && isSafeRelativePath(sitePath.slice(CONTENT_FOLDER.length));
}

/**
 * The slug for a content path, mirroring `saveContentFile`/`moveContentFiles`:
 * `content/about/team.md` becomes `about/team`.
 */
export function contentSlug(sitePath: string): string {
  const relativePath = sitePath.startsWith(CONTENT_FOLDER) ? sitePath.slice(CONTENT_FOLDER.length) : sitePath;
  return relativePath.replace(/\.md$/i, '');
}

/**
 * Maps an in-memory content path to its entry inside `_site/content/`
 * (`content/about/team.md` becomes `about/team.md`), or `null` when the entry is
 * not content at all. The content store has historically been polluted by
 * malformed imports (archive entries such as `manifest.json` were stored as
 * content files), so this is also the export boundary that keeps non-content
 * entries out of the archive.
 */
export function toContentArchivePath(contentPath: string): string | null {
  if (!isSupportedContentEntry(contentPath)) return null;
  return contentPath.slice(CONTENT_FOLDER.length);
}

/**
 * Maps a data file path to its entry inside `_site/data/`
 * (`data/categories.json` becomes `categories.json`), or `null` when it is not a
 * safe path under `data/`.
 */
export function toDataArchivePath(dataFilePath: string): string | null {
  if (typeof dataFilePath !== 'string' || !dataFilePath.startsWith(DATA_FOLDER)) return null;
  const relativePath = dataFilePath.slice(DATA_FOLDER.length);
  return isSafeRelativePath(relativePath) ? relativePath : null;
}

/**
 * Maps a stored original's site path to its entry inside `_site/assets/originals/`
 * (`assets/originals/photos/hero.jpg` becomes `photos/hero.jpg`), preserving
 * nesting so files that share a basename cannot collide.
 */
export function toOriginalArchivePath(imagePath: string): string | null {
  if (typeof imagePath !== 'string' || !imagePath.startsWith(ORIGINALS_FOLDER)) return null;
  const relativePath = imagePath.slice(ORIGINALS_FOLDER.length);
  return isSafeRelativePath(relativePath) ? relativePath : null;
}

/** Inverse of {@link toOriginalArchivePath}: the storage key for an archived original. */
export function toOriginalStoragePath(relativePath: string): string {
  return `${ORIGINALS_FOLDER}${relativePath}`;
}

