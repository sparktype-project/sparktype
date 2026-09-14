/**
 * Backup round-trip integration tests.
 *
 * These run the real export and import paths against real (fake-indexeddb)
 * storage: a site is exported, storage is cleared, the archive is imported and
 * persisted, and the reloaded site is compared with the original — content,
 * manifest, secrets, original image bytes, data files, custom themes and custom
 * layouts.
 *
 * The archive contract is documented in `src/core/services/backup/backupFormat.ts`.
 */

import JSZip from 'jszip';
import { exportSiteBackup, importSiteFromZip, type ImportedSiteData } from '../siteBackup.service';
import {
  deleteSite,
  getAllDataFiles,
  getAllImageAssetsForSite,
  getManifestById,
  getSiteContentFiles,
  getSiteLayoutFiles,
  getSiteThemeFiles,
  saveAllImageAssetsForSite,
  saveDataFile,
  saveSite,
} from '../localFileSystem.service';
import type { LocalSiteData, ParsedMarkdownFile, RawFile } from '@/core/types';
import type * as StorageModule from '@/core/services/storage/siteStorage.service';
import { resetInMemoryBlobStore } from '@/test/support/blobStorageStub';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';

// Image bytes need a Blob-preserving blob namespace; see the stub for why.
vi.mock('@/core/services/storage/siteStorage.service', async (importOriginal) => {
  const { stubBlobBackend } = await import('@/test/support/blobStorageStub');
  return stubBlobBackend(() => importOriginal<typeof StorageModule>());
});

/** Empties every store the tests use, as if the app had been reinstalled. */
async function clearAllStorage(): Promise<void> {
  resetInMemoryBlobStore();
  await resetIndexedDbForTests();
}

const SITE_ID = 'round-trip-site';

/**
 * Original images as they sit in storage, including two sharing a basename. The
 * bytes are binary rather than UTF-8 text, so a round trip can only pass if the
 * payload survives byte for byte.
 */
const HERO_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const NESTED_HERO_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
const LOGO_BYTES = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x3e, 0xff, 0xfe, 0x00]);

const ORIGINAL_IMAGES: Record<string, Blob> = {
  'assets/originals/hero.jpg': new Blob([HERO_BYTES], { type: 'image/jpeg' }),
  'assets/originals/photos/hero.jpg': new Blob([NESTED_HERO_BYTES], { type: 'image/jpeg' }),
  'assets/originals/logo.svg': new Blob([LOGO_BYTES], { type: 'image/svg+xml' }),
};

const CUSTOM_LAYOUT_FILES: RawFile[] = [
  { path: 'layouts/editorial-post/layout.json', content: '{"files":["index.hbs"]}' },
  { path: 'layouts/editorial-post/index.hbs', content: '<article>{{{content}}}</article>' },
];

function buildRepresentativeSite(siteId = SITE_ID): LocalSiteData {
  const site = createSiteFixture('nestedPagesSite', { siteId });
  site.manifest.theme = { name: 'editorial', config: { accent: '#0f766e' } };
  site.themeFiles = [
    { path: 'themes/editorial/theme.json', content: '{"layouts":["page","editorial-post"]}' },
    { path: 'themes/editorial/base.hbs', content: '<html><body>{{{body}}}</body></html>' },
  ];
  site.layoutFiles = CUSTOM_LAYOUT_FILES;
  site.contentFiles = (site.contentFiles ?? []).map((file) =>
    file.path === 'content/about.md' ? { ...file, frontmatter: { ...file.frontmatter, layout: 'editorial-post' } } : file
  );
  site.dataFiles = { 'data/categories.json': '["news","essays"]' };
  site.secrets = { publishing: { github: { accessToken: 'token-1' } } };
  return site;
}

function contentEntries(zip: JSZip): string[] {
  return Object.entries(zip.files)
    .filter(([name, entry]) => !entry.dir && name.startsWith('_site/content/'))
    .map(([name]) => name.slice('_site/content/'.length))
    .sort();
}

function originalEntries(zip: JSZip): string[] {
  return Object.entries(zip.files)
    .filter(([name, entry]) => !entry.dir && name.startsWith('_site/assets/originals/'))
    .map(([name]) => name.slice('_site/'.length))
    .sort();
}

async function persistImportedSite(imported: ImportedSiteData): Promise<void> {
  const { imageAssetsToSave, ...siteData } = imported;
  await saveSite(siteData);
  await saveAllImageAssetsForSite(imported.siteId, imageAssetsToSave ?? {});
}

async function exportZip(site: LocalSiteData): Promise<JSZip> {
  return JSZip.loadAsync(await exportSiteBackup(site));
}

describe('site backup round trip', () => {
  beforeEach(async () => {
    await clearAllStorage();
  });

  test('exports the archive entries restoration depends on', async () => {
    const site = buildRepresentativeSite();
    await saveAllImageAssetsForSite(site.siteId, ORIGINAL_IMAGES);
    // A data file that only ever lives in storage, not in the in-memory site.
    await saveDataFile(site.siteId, 'data/tags.json', '["release"]');

    const zip = await exportZip(site);

    // Content: exactly the site's Markdown, under _site/content/.
    expect(contentEntries(zip)).toEqual(['about.md', 'about/team.md', 'home.md']);

    // Originals keep their storage path, so same-basename files survive.
    expect(originalEntries(zip)).toEqual([
      'assets/originals/hero.jpg',
      'assets/originals/logo.svg',
      'assets/originals/photos/hero.jpg',
    ]);

    // Derivatives are never archived.
    expect(Object.keys(zip.files).filter((name) => name.includes('/derivatives/'))).toEqual([]);

    // Data files: the site's own plus the regenerated media index.
    const mediaIndex = zip.file('_site/data/media.json');
    expect(mediaIndex).not.toBeNull();
    expect(Object.keys(JSON.parse(await mediaIndex!.async('string')).images).sort()).toEqual([
      'assets/originals/hero.jpg',
      'assets/originals/logo.svg',
      'assets/originals/photos/hero.jpg',
    ]);
    expect(await zip.file('_site/data/categories.json')!.async('string')).toBe('["news","essays"]');
    expect(await zip.file('_site/data/tags.json')!.async('string')).toBe('["release"]');

    // Custom theme and layout only; core themes are shipped with the app.
    expect(Object.keys(zip.files).filter((name) => name.startsWith('_site/themes/'))).toEqual([
      '_site/themes/',
      '_site/themes/editorial/',
      '_site/themes/editorial/theme.json',
      '_site/themes/editorial/base.hbs',
    ]);
    expect(Object.keys(zip.files).filter((name) => name.startsWith('_site/layouts/'))).toEqual([
      '_site/layouts/',
      '_site/layouts/editorial-post/',
      '_site/layouts/editorial-post/layout.json',
      '_site/layouts/editorial-post/index.hbs',
    ]);
  });

  test('does not archive editor droppings stored alongside originals', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const site = buildRepresentativeSite();
    await saveAllImageAssetsForSite(site.siteId, {
      ...ORIGINAL_IMAGES,
      'assets/originals/.DS_Store': new Blob(['junk']),
      'assets/originals/Thumbs.db': new Blob(['junk']),
    });

    const zip = await exportZip(site);

    expect(originalEntries(zip)).toEqual([
      'assets/originals/hero.jpg',
      'assets/originals/logo.svg',
      'assets/originals/photos/hero.jpg',
    ]);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping stored image')
    );
  });

  test('does not archive core themes', async () => {
    const site = createSiteFixture('basicSite', { siteId: 'core-theme-site' });
    site.manifest.theme = { name: 'sparksite', config: {} };
    site.themeFiles = [{ path: 'themes/sparksite/base.hbs', content: '<html></html>' }];

    const zip = await exportZip(site);

    expect(Object.keys(zip.files).filter((name) => name.startsWith('_site/themes/'))).toEqual([]);
  });

  test('restores content, metadata, images and data files into fresh storage', async () => {
    const site = buildRepresentativeSite();
    await saveAllImageAssetsForSite(site.siteId, ORIGINAL_IMAGES);

    const exported = await exportSiteBackup(site);
    await clearAllStorage();

    const imported = await importSiteFromZip(new File([exported], 'backup.zip'));
    await persistImportedSite(imported);

    const reloadedManifest = await getManifestById(site.siteId);
    expect(reloadedManifest).toEqual(site.manifest);

    const reloadedContent = await getSiteContentFiles(site.siteId);
    expect(reloadedContent.map((file: ParsedMarkdownFile) => file.path)).toEqual(
      site.contentFiles?.map((file) => file.path)
    );
    expect(reloadedContent.map((file) => file.slug)).toEqual(site.contentFiles?.map((file) => file.slug));
    expect(reloadedContent).toEqual(site.contentFiles);

    expect(await getSiteThemeFiles(site.siteId)).toEqual(site.themeFiles);
    expect(await getSiteLayoutFiles(site.siteId)).toEqual(CUSTOM_LAYOUT_FILES);

    const reloadedImages = await getAllImageAssetsForSite(site.siteId);
    expect(Object.keys(reloadedImages).sort()).toEqual(Object.keys(ORIGINAL_IMAGES).sort());
    expect(new Uint8Array(await reloadedImages['assets/originals/hero.jpg'].arrayBuffer())).toEqual(HERO_BYTES);
    expect(new Uint8Array(await reloadedImages['assets/originals/photos/hero.jpg'].arrayBuffer())).toEqual(
      NESTED_HERO_BYTES
    );
    expect(new Uint8Array(await reloadedImages['assets/originals/logo.svg'].arrayBuffer())).toEqual(LOGO_BYTES);

    const reloadedDataFiles = await getAllDataFiles(site.siteId);
    expect(reloadedDataFiles['data/categories.json']).toBe('["news","essays"]');
    expect(Object.keys(JSON.parse(reloadedDataFiles['data/media.json']).images).sort()).toEqual([
      'assets/originals/hero.jpg',
      'assets/originals/logo.svg',
      'assets/originals/photos/hero.jpg',
    ]);

    // Secrets travel in the archive and are restored with the site.
    expect(imported.secrets).toEqual(site.secrets);
  });

  test('replacing a site clears its previous blobs, registry and data files', async () => {
    // Export the incoming site first, then add the data the site being replaced
    // carries, so stale data sits in storage but not in the archive under test.
    const incoming = buildRepresentativeSite();
    await saveAllImageAssetsForSite(SITE_ID, ORIGINAL_IMAGES);
    const exported = await exportSiteBackup(incoming);
    const imported = await importSiteFromZip(new File([exported], 'backup.zip'));

    const previous = createSiteFixture('basicSite', { siteId: SITE_ID });
    await saveSite(previous);
    await saveAllImageAssetsForSite(SITE_ID, {
      'assets/originals/stale.jpg': new Blob(['stale-bytes']),
    });
    await saveDataFile(SITE_ID, 'data/old.json', '["old"]');

    // What an overwrite import does before writing the imported site.
    await deleteSite(SITE_ID);
    await persistImportedSite(imported);

    expect((await getManifestById(SITE_ID))?.title).toBe('Nested Pages Site');
    expect(Object.keys(await getAllImageAssetsForSite(SITE_ID)).sort()).toEqual(
      Object.keys(ORIGINAL_IMAGES).sort()
    );
    expect(await getAllDataFiles(SITE_ID)).toEqual({
      'data/categories.json': '["news","essays"]',
      'data/media.json': expect.any(String),
    });
  });
});
