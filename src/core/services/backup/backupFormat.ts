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
/** Folder holding generated derivatives. Archived by older builds only; never imported. */
export const DERIVATIVES_FOLDER = 'assets/derivatives/';

export const THEMES_FOLDER = 'themes/';
export const LAYOUTS_FOLDER = 'layouts/';

/** Only Markdown entries are content. Everything else in the archive is data. */
export const CONTENT_EXTENSION = '.md';

/**
 * Strips the `_site/` root from an archive entry name, yielding a site-relative
 * path (`_site/content/home.md` becomes `content/home.md`).
 */
export function toSitePath(archiveEntryName: string): string {
  const prefix = `${SIGNUM_FOLDER}/`;
  return archiveEntryName.startsWith(prefix) ? archiveEntryName.slice(prefix.length) : archiveEntryName;
}

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
