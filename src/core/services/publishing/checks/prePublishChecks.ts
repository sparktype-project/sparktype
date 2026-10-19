// src/core/services/publishing/checks/prePublishChecks.ts

import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';
import { findHomepageFile, isPublishedFile } from '@/core/services/builder/publication';
import { isInvalidPublishAt, isScheduledAfter } from '@/core/services/builder/schedule';
import { collectImageRefs, findContentFileImageRefs } from '@/core/services/builder/imageRefs';
import { listPages, type PageEntry } from '@/core/services/builder/pageList';
import { getSiteOrigin } from '@/core/services/siteOrigin.service';
import { validateCanonicalUrl } from '@/core/services/seo/pageSeo';
import { getRedirectFromValues, isReservedOutput, planRedirects, redirectOutputPath, normalizeRedirectPath } from '@/core/services/seo/redirects';
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
  /** Epoch milliseconds the build would be made at; decides which scheduled items are still held back. */
  now: number;
  /** Paths of the original images that have bytes in storage. */
  storedImagePaths: ReadonlySet<string>;
}

// Transform parameters in the filename mark a derivative, which is regenerated on export and
// never bundled as an original.
const DERIVATIVE_FILENAME = /_w(auto|\d+)_h(auto|\d+)_c-[^_]+_g-[^_]+/;

function editHref(siteId: string, file: ParsedMarkdownFile): string {
  return `/sites/${siteId}/edit/content/${file.path.replace(/^content\//, '').replace(/\.md$/, '')}`;
}

function checkHomepage({ site, now }: PrePublishInput): PrePublishFinding[] {
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
  if (isScheduledAfter(homepage, now)) {
    return [{
      id: `homepage-scheduled:${homepage.path}`,
      severity: 'blocking',
      message: `The homepage "${homepage.frontmatter.title}" is scheduled for ${String(homepage.frontmatter.publishAt)}, so the site cannot be built until then. Clear the schedule, or choose another homepage.`,
      path: homepage.path,
      fixHref: editHref(site.siteId, homepage),
    }];
  }
  return [];
}

function checkSiteOrigin({ site }: PrePublishInput): PrePublishFinding[] {
  if (getSiteOrigin(site.manifest)) return [];
  return [{
    id: 'site-origin-missing',
    severity: 'warning',
    message:
      'The site has no valid web address, so canonical links, Open Graph URLs and images, sitemap.xml and the RSS feed ' +
      'are skipped. Set one in Site details.',
    path: null,
    fixHref: `/sites/${site.siteId}/settings`,
  }];
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
  const heldBack = new Map(
    listPages(site).filter((page) => !publishedUrls.has(page.url)).map((page) => [page.url, page.file]),
  );
  const findings: PrePublishFinding[] = [];

  for (const page of listPages(snapshot)) {
    for (const href of findBodyLinks(page.file.content)) {
      const target = resolveInternalHref(href, page.url);
      if (target === null || publishedUrls.has(target)) continue;
      const targetFile = heldBack.get(target);
      const kind = !targetFile ? 'broken-link' : isPublishedFile(targetFile) ? 'scheduled-link' : 'draft-link';
      const problem = {
        'broken-link': 'does not match any page',
        'scheduled-link': 'is scheduled for later and will not be published yet',
        'draft-link': 'is an unpublished draft',
      }[kind];
      findings.push({
        id: `${kind}:${page.file.path}:${href}`,
        severity: 'warning',
        message: `"${page.file.frontmatter.title}" links to ${href}, which ${problem}.`,
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
    if (validateCanonicalUrl(file.frontmatter.canonical) !== null) {
      findings.push({
        id: `invalid-canonical:${file.path}`,
        severity: 'warning',
        message: `"${file.frontmatter.title}" has a canonical URL that is not a full http(s) address, so it is ignored.`,
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

function checkRedirects({ site, snapshot }: PrePublishInput): PrePublishFinding[] {
  const findings: PrePublishFinding[] = [];
  const published = listPages(snapshot);
  const publishedPaths = new Set(published.map((page) => page.file.path));
  const byPath = new Map(published.map((page) => [page.file.path, page]));

  for (const { file } of listPages(site)) {
    const values = getRedirectFromValues(file.frontmatter);
    if (values.length === 0 || publishedPaths.has(file.path)) continue;
    findings.push({
      id: `redirect-unpublished-target:${file.path}`,
      severity: 'warning',
      message: `"${file.frontmatter.title}" is unpublished, so its ${values.length === 1 ? 'redirect' : 'redirects'} (${values.join(', ')}) will not be created.`,
      path: file.path,
      fixHref: editHref(site.siteId, file),
    });
  }

  const plan = planRedirects(published.map((page) => ({ path: page.file.path, frontmatter: page.file.frontmatter, url: page.url, outputPath: page.outputPath })));
  for (const { sourcePath, value, reason } of plan.skipped) {
    const page = byPath.get(sourcePath);
    if (!page) continue;
    const title = page.file.frontmatter.title;
    const base = { path: sourcePath, fixHref: editHref(site.siteId, page.file) };
    const id = `${sourcePath}:${value}`;

    if (reason === 'invalid') {
      findings.push({ ...base, id: `redirect-invalid:${id}`, severity: 'warning', message: `"${title}" has a redirect from "${value}", which is not a valid path, so it is ignored.` });
    } else if (reason === 'self') {
      findings.push({ ...base, id: `redirect-loop:${id}`, severity: 'warning', message: `"${title}" redirects from ${value}, which is its own address, so the redirect would loop and is ignored.` });
    } else if (reason === 'duplicate') {
      findings.push({ ...base, id: `redirect-duplicate:${id}`, severity: 'warning', message: `More than one page redirects from ${value}; only the first is kept.` });
    } else {
      const from = normalizeRedirectPath(value) ?? value;
      const shadowed = published.find((other) => other.outputPath === redirectOutputPath(from));
      const what = shadowed ? `the page "${shadowed.file.frontmatter.title}"` : `the generated file ${redirectOutputPath(from)}`;
      findings.push({
        ...base,
        id: `redirect-shadows-page:${id}`,
        severity: 'blocking',
        message: `"${title}" redirects from ${value}, which is ${isReservedOutput(redirectOutputPath(from)) ? 'used by' : 'the address of'} ${what}. Remove or change the redirect.`,
      });
    }
  }
  return findings;
}

function checkSchedules({ site }: PrePublishInput): PrePublishFinding[] {
  return (site.contentFiles ?? [])
    .filter((file) => isInvalidPublishAt(file.frontmatter.publishAt))
    .map((file) => ({
      id: `invalid-publish-at:${file.path}`,
      severity: 'warning' as const,
      message: `"${file.frontmatter.title}" has a schedule "${String(file.frontmatter.publishAt)}" that is not a valid date and time, so it is ignored and the page will publish immediately.`,
      path: file.path,
      fixHref: editHref(site.siteId, file),
    }));
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
    ...checkSiteOrigin(input),
    ...checkImages(input),
    ...checkLinks(input),
    ...checkMetadata(input),
    ...checkSchedules(input),
    ...checkOutputPaths(input),
    ...checkRedirects(input),
  ];
}
