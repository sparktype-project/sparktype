// src/core/services/publishing/checks/prePublishChecks.ts

import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { flattenStructure } from '@/core/services/fileTree.service';
import { findHomepageFile, isPublishedFile } from '@/core/services/builder/publication';
import { collectImageRefs, findContentFileImageRefs } from '@/core/services/builder/imageRefs';
import { generateExportUrl } from '@/core/services/urlUtils.service';
import { findBodyImages, findBodyLinks, resolveInternalHref } from './contentScan';

export type FindingSeverity = 'blocking' | 'warning';

export interface PrePublishFinding {
  /** Stable for a given problem, so a re-run can be compared with an earlier report. */
  id: string;
  severity: FindingSeverity;
  message: string;
  /** Content file the finding is about; `null` for a site-wide problem. */
  path: string | null;
  /** In-app route where the problem can be fixed. */
  fixHref: string;
}

export interface PrePublishInput {
  /** The live site, drafts included. */
  site: LocalSiteData;
  /** The public snapshot the build is generated from. */
  snapshot: LocalSiteData;
  /** Paths of the original images that have bytes in storage. */
  storedImagePaths: ReadonlySet<string>;
}

// Transform parameters in the filename mark a derivative, which is regenerated on export and
// never bundled as an original.
const DERIVATIVE_FILENAME = /_w(auto|\d+)_h(auto|\d+)_c-[^_]+_g-[^_]+/;

interface PageEntry {
  file: ParsedMarkdownFile;
  /** Public URL of the page (`''` for the homepage). */
  url: string;
  /** File the build writes for the page. */
  outputPath: string;
}

function editHref(siteId: string, file: ParsedMarkdownFile): string {
  return `/sites/${siteId}/edit/content/${file.path.replace(/^content\//, '').replace(/\.md$/, '')}`;
}

/** Every page and collection item the build emits for `data`, with its URL and output file. */
function listPages(data: LocalSiteData): PageEntry[] {
  const filesByPath = new Map((data.contentFiles ?? []).map((file) => [file.path, file]));
  const nodes = [...flattenStructure(data.manifest.structure), ...(data.manifest.collectionItems ?? [])];
  const pages: PageEntry[] = [];

  for (const node of nodes) {
    const file = filesByPath.get(node.path);
    if (!file) continue;
    pages.push({
      file,
      url: generateExportUrl(node, data.manifest, undefined, data),
      outputPath: generateExportUrl(node, data.manifest, undefined, data, undefined, true),
    });
  }
  return pages;
}

function checkHomepage({ site }: PrePublishInput): PrePublishFinding[] {
  const homepage = findHomepageFile(site);
  if (!homepage) {
    return [{
      id: 'homepage-missing',
      severity: 'blocking',
      message: 'The site has no homepage. Create a page and mark it as the homepage.',
      path: null,
      fixHref: `/sites/${site.siteId}/edit`,
    }];
  }
  if (!isPublishedFile(homepage)) {
    return [{
      id: `homepage-unpublished:${homepage.path}`,
      severity: 'blocking',
      message: `The homepage "${homepage.frontmatter.title}" is unpublished. Publish it, or choose another homepage.`,
      path: homepage.path,
      fixHref: editHref(site.siteId, homepage),
    }];
  }
  return [];
}

function checkImages({ site, snapshot, storedImagePaths }: PrePublishInput): PrePublishFinding[] {
  const findings: PrePublishFinding[] = [];

  for (const { file } of listPages(snapshot)) {
    const fixHref = editHref(site.siteId, file);

    for (const ref of findContentFileImageRefs(file)) {
      const filename = ref.src.split('/').pop() ?? '';
      if (ref.serviceId !== 'local' || DERIVATIVE_FILENAME.test(filename) || storedImagePaths.has(ref.src)) continue;
      findings.push({
        id: `missing-image:${file.path}:${ref.src}`,
        severity: 'blocking',
        message: `"${file.frontmatter.title}" uses the image ${ref.src}, but its file is missing from storage. Re-upload or remove it.`,
        path: file.path,
        fixHref,
      });
    }

    const missingAlt = (key: string, src: string) => ({
      id: `missing-alt:${file.path}:${key}`,
      severity: 'warning' as const,
      message: `An image on "${file.frontmatter.title}" has no alt text (${src}).`,
      path: file.path,
      fixHref,
    });
    collectImageRefs(file.frontmatter).forEach((ref) => {
      if (!ref.alt?.trim()) findings.push(missingAlt(`frontmatter:${ref.src}`, ref.src));
    });
    findBodyImages(file.content).forEach((image, index) => {
      if (!image.alt.trim()) findings.push(missingAlt(`body:${index}:${image.src}`, image.src));
    });
  }
  return findings;
}

function checkLinks({ site, snapshot }: PrePublishInput): PrePublishFinding[] {
  const publishedUrls = new Set(listPages(snapshot).map((page) => page.url));
  const draftUrls = new Set(
    listPages(site).filter((page) => !isPublishedFile(page.file)).map((page) => page.url),
  );
  const findings: PrePublishFinding[] = [];

  for (const page of listPages(snapshot)) {
    for (const href of findBodyLinks(page.file.content)) {
      const target = resolveInternalHref(href, page.url);
      if (target === null || publishedUrls.has(target)) continue;
      const isDraft = draftUrls.has(target);
      findings.push({
        id: `${isDraft ? 'draft-link' : 'broken-link'}:${page.file.path}:${href}`,
        severity: 'warning',
        message: isDraft
          ? `"${page.file.frontmatter.title}" links to ${href}, which is an unpublished draft.`
          : `"${page.file.frontmatter.title}" links to ${href}, which does not match any page.`,
        path: page.file.path,
        fixHref: editHref(site.siteId, page.file),
      });
    }
  }
  return findings;
}

function checkMetadata({ site, snapshot }: PrePublishInput): PrePublishFinding[] {
  const findings: PrePublishFinding[] = [];
  const blank = (value: unknown) => typeof value !== 'string' || value.trim() === '';

  for (const { file } of listPages(snapshot)) {
    const fixHref = editHref(site.siteId, file);
    if (blank(file.frontmatter.title)) {
      findings.push({
        id: `empty-title:${file.path}`,
        severity: 'warning',
        message: `The page ${file.path} has no title.`,
        path: file.path,
        fixHref,
      });
    }
    if (blank(file.frontmatter.description)) {
      findings.push({
        id: `empty-description:${file.path}`,
        severity: 'warning',
        message: `"${file.frontmatter.title}" has no description, so search results will show a guess.`,
        path: file.path,
        fixHref,
      });
    }
  }
  return findings;
}

function checkOutputPaths({ site, snapshot }: PrePublishInput): PrePublishFinding[] {
  const byOutput = new Map<string, PageEntry[]>();
  for (const page of listPages(snapshot)) {
    byOutput.set(page.outputPath, [...(byOutput.get(page.outputPath) ?? []), page]);
  }

  const findings: PrePublishFinding[] = [];
  for (const [outputPath, pages] of byOutput) {
    if (pages.length < 2) continue;
    for (const { file } of pages) {
      const others = pages.filter((page) => page.file !== file).map((page) => page.file.path).join(', ');
      findings.push({
        id: `duplicate-output:${outputPath}:${file.path}`,
        severity: 'warning',
        message: `"${file.frontmatter.title}" and ${others} would both write ${outputPath}; only one will survive.`,
        path: file.path,
        fixHref: editHref(site.siteId, file),
      });
    }
  }
  return findings;
}

/**
 * Inspects what a publish would send. It reads the full site and its public snapshot and
 * never changes either; `storedImagePaths` is passed in so the module stays free of storage.
 * Blocking findings are the ones that would publish a broken site (no usable homepage, images
 * the bundle cannot contain); everything else is a warning the author may override.
 */
export function checkSiteForPublishing(input: PrePublishInput): PrePublishFinding[] {
  return [
    ...checkHomepage(input),
    ...checkImages(input),
    ...checkLinks(input),
    ...checkMetadata(input),
    ...checkOutputPaths(input),
  ];
}
