// src/core/services/builder/publication.ts

import type {
  LocalSiteData,
  Manifest,
  MediaManifest,
  ParsedMarkdownFile,
  StructureNode,
} from '@/core/types';
import { isScheduledAfter } from './schedule';

/**
 * ============================================================================
 * Publication Selection
 * ============================================================================
 * `frontmatter.published` is the draft signal (absent means published), and `frontmatter.publishAt`
 * holds an item back until its time. Sparktype only pushes built output, so no host rebuilds on a
 * schedule: a scheduled item goes live the next time the author builds after its time. This module turns live site data into the public snapshot a build may expose.
 *
 * The snapshot is derived, never applied: it filters `contentFiles`, `manifest.structure` and
 * `manifest.collectionItems` into new arrays and shares everything else by reference, so the
 * caller's `LocalSiteData`, the store, and persistent storage are untouched. Build consumers
 * receive the snapshot, which is why no renderer, helper or query filters on `published`
 * itself — preview keeps rendering the live data and therefore keeps showing drafts.
 */

/** Raised when a site cannot be built for publication as configured. */
export class PublicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicationError';
  }
}

/**
 * Whether a content file may appear on the published site. Files that are absent (a structure
 * node or collection item with no matching file) count as published: the build has no evidence
 * to exclude them, and the resolvers already skip missing content.
 */
export function isPublishedFile(file: Pick<ParsedMarkdownFile, 'frontmatter'> | undefined): boolean {
  return file?.frontmatter.published !== false;
}

/** Whether a file may appear in a build made at `now`: not a draft, and not scheduled for later. */
function isPublicAt(file: ParsedMarkdownFile | undefined, now: number): boolean {
  return isPublishedFile(file) && !isScheduledAfter(file, now);
}

/**
 * Filters the structure tree. An unpublished page is removed, but its published descendants
 * are kept in its place: they have their own files, slugs and URLs, and removing them would
 * silently unpublish published content.
 */
function filterStructureNodes(
  nodes: StructureNode[],
  fileByPath: Map<string, ParsedMarkdownFile>,
  now: number,
): StructureNode[] {
  const kept: StructureNode[] = [];

  for (const node of nodes) {
    const children = node.children ? filterStructureNodes(node.children, fileByPath, now) : undefined;

    if (!isPublicAt(fileByPath.get(node.path), now)) {
      if (children) kept.push(...children);
      continue;
    }

    kept.push(children ? { ...node, children } : { ...node });
  }

  return kept;
}

/** The content file that serves as the site homepage, by frontmatter flag first, then position. */
export function findHomepageFile(siteData: LocalSiteData): ParsedMarkdownFile | undefined {
  const files = siteData.contentFiles ?? [];
  const flagged = files.find((file) => file.frontmatter.homepage === true);
  if (flagged) return flagged;

  const firstPath = siteData.manifest.structure[0]?.path;
  return firstPath ? files.find((file) => file.path === firstPath) : undefined;
}

/**
 * Restricts a media manifest to what the published site may expose.
 *
 * The manifest is built from the site's persistent image registry, which records references
 * per content file regardless of publication state. In a build the caller passes the public
 * snapshot, so any reference naming a file outside it is a reference to unpublished content and
 * is dropped; an image left without references is dropped with it, because nothing the bundle
 * contains points at it.
 *
 * Site-wide assets are not content files and are always kept. The registry marks them two ways:
 * `manifest` for images discovered by scanning the manifest itself, and `manifest.logo` /
 * `manifest.favicon` (see `SiteAssetsUploader`) for assets uploaded through the editor, whose
 * only reference is that field. Pruning either would drop the logo from the export's media index,
 * and the import paths that key off that index would then never copy an asset `manifest.logo`
 * still points at.
 */
export function pruneUnpublishedMediaReferences(
  mediaManifest: MediaManifest,
  siteData: LocalSiteData,
): MediaManifest {
  if (!siteData.contentFiles) return mediaManifest;

  const publishedPaths = new Set(siteData.contentFiles.map((file) => file.path));
  const images: MediaManifest['images'] = {};

  for (const [imagePath, entry] of Object.entries(mediaManifest.images)) {
    const referencedIn = entry.referencedIn.filter(
      (reference) =>
        reference === 'manifest' || reference.startsWith('manifest.') || publishedPaths.has(reference),
    );
    if (referencedIn.length === 0) continue;
    images[imagePath] = { ...entry, referencedIn };
  }

  return { ...mediaManifest, images };
}

/**
 * Builds the derived snapshot every public output is generated from. Throws rather than
 * publishing a site whose homepage is a draft, because the export would otherwise emit the
 * draft to `index.html` with no signal that anything was withheld. A scheduled homepage fails the
 * same way. `now` is injected (epoch ms) so the cut-off is deterministic.
 */
export function createPublicSiteSnapshot(siteData: LocalSiteData, now: number = Date.now()): LocalSiteData {
  const homepage = findHomepageFile(siteData);
  if (homepage && isPublishedFile(homepage) && isScheduledAfter(homepage, now)) {
    throw new PublicationError(
      `Cannot build site "${siteData.siteId}": the homepage "${homepage.path}" is scheduled for ` +
        `${String(homepage.frontmatter.publishAt)}, which is still in the future. ` +
        'Clear its schedule, or choose a different homepage, before building the site.',
    );
  }
  if (homepage && !isPublishedFile(homepage)) {
    throw new PublicationError(
      `Cannot build site "${siteData.siteId}": the homepage "${homepage.path}" is marked "published: false". ` +
        'Publish the homepage, or choose a different homepage, before building the site.',
    );
  }

  const fileByPath = new Map((siteData.contentFiles ?? []).map((file) => [file.path, file]));

  const manifest: Manifest = {
    ...siteData.manifest,
    structure: filterStructureNodes(siteData.manifest.structure, fileByPath, now),
  };
  if (siteData.manifest.collectionItems) {
    manifest.collectionItems = siteData.manifest.collectionItems.filter((item) =>
      isPublicAt(fileByPath.get(item.path), now),
    );
  }

  const contentFiles = siteData.contentFiles?.filter((file) => isPublicAt(file, now));

  return {
    ...siteData,
    manifest,
    ...(contentFiles ? { contentFiles } : {}),
  };
}
