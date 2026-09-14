/**
 * Backup import contract tests.
 *
 * These build archives by hand so the reader is exercised against shapes
 * Sparktype itself does not produce: legacy archives without a media index,
 * unrelated archive entries, and damaged manifests.
 *
 * The archive contract is documented in `src/core/services/backup/backupFormat.ts`.
 */

import JSZip from 'jszip';
import { exportSiteBackup, importSiteFromZip } from '../siteBackup.service';
import {
  getAllDataFiles,
  getAllImageAssetsForSite,
  getManifestById,
  saveAllImageAssetsForSite,
  saveDataFile,
  saveSite,
} from '../localFileSystem.service';
import type { Manifest, ParsedMarkdownFile } from '@/core/types';
import { createSiteFixture } from '@/test/support/siteFixtures';
import { resetIndexedDbForTests } from '@/test/support/storage';

const createMockManifest = (overrides: Partial<Manifest> = {}): Manifest => ({
  siteId: 'test-site',
  generatorVersion: '1.0.0',
  title: 'Test Site',
  description: 'Test Description',
  theme: { name: 'default', config: {} },
  structure: [],
  settings: { imageService: 'local' },
  ...overrides,
});

function mediaEntry(sizeBytes = 1024) {
  return {
    referencedIn: ['content/home.md'],
    metadata: { sizeBytes, mimeType: 'image/jpeg' },
    providerId: 'local',
  };
}

function createArchive(build: (siteFolder: JSZip) => void): JSZip {
  const zip = new JSZip();
  const siteFolder = zip.folder('_site');
  if (!siteFolder) throw new Error('Failed to create mock zip');
  build(siteFolder);
  return zip;
}

async function importArchive(zip: JSZip) {
  const blob = await zip.generateAsync({ type: 'blob' });
  return importSiteFromZip(new File([blob], 'backup.zip'));
}

describe('importSiteFromZip', () => {
  describe('image restoration', () => {
    test('restores only the originals listed in the media index', async () => {
      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));
        siteFolder.folder('data')?.file('media.json', JSON.stringify({
          version: 1,
          providerId: 'local',
          images: {
            'assets/originals/image1.jpg': mediaEntry(),
            'assets/originals/image2.png': mediaEntry(512),
          },
        }));
        siteFolder.folder('assets/originals')?.file('image1.jpg', 'fake-image-1');
        siteFolder.folder('assets/originals')?.file('image2.png', 'fake-image-2');
        siteFolder.folder('assets/originals')?.file('extra-image.jpg', 'fake-extra-image');
      });

      const result = await importArchive(zip);

      expect(Object.keys(result.imageAssetsToSave ?? {})).toEqual([
        'assets/originals/image1.jpg',
        'assets/originals/image2.png',
      ]);
    });

    test('keeps originals that share a basename in different folders', async () => {
      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));
        siteFolder.folder('data')?.file('media.json', JSON.stringify({
          version: 1,
          providerId: 'local',
          images: {
            'assets/originals/hero.jpg': mediaEntry(),
            'assets/originals/posts/hero.jpg': mediaEntry(),
          },
        }));
        siteFolder.folder('assets/originals')?.file('hero.jpg', 'root-hero');
        siteFolder.folder('assets/originals/posts')?.file('hero.jpg', 'post-hero');
      });

      const result = await importArchive(zip);

      expect(await result.imageAssetsToSave?.['assets/originals/hero.jpg'].text()).toBe('root-hero');
      expect(await result.imageAssetsToSave?.['assets/originals/posts/hero.jpg'].text()).toBe('post-hero');
    });

    test('never imports derivatives', async () => {
      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));
        siteFolder.folder('data')?.file('media.json', JSON.stringify({
          version: 1,
          providerId: 'local',
          images: { 'assets/originals/image1.jpg': mediaEntry() },
        }));
        siteFolder.folder('assets/originals')?.file('image1.jpg', 'fake-image-1');
        siteFolder.folder('assets/derivatives')?.file('image1_w600_h400_c-fill_g-center.jpg', 'derivative');
      });

      const result = await importArchive(zip);

      expect(Object.keys(result.imageAssetsToSave ?? {})).toEqual(['assets/originals/image1.jpg']);
    });

    test('reports images the media index lists but the archive does not carry', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));
        siteFolder.folder('data')?.file('media.json', JSON.stringify({
          version: 1,
          providerId: 'local',
          images: {
            'assets/originals/image1.jpg': mediaEntry(),
            'assets/originals/missing.jpg': mediaEntry(),
          },
        }));
        siteFolder.folder('assets/originals')?.file('image1.jpg', 'fake-image-1');
      });

      const result = await importArchive(zip);

      expect(Object.keys(result.imageAssetsToSave ?? {})).toEqual(['assets/originals/image1.jpg']);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image listed in media.json not found')
      );
    });

    test('reports originals the archive carries but the media index does not list', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));
        siteFolder.folder('data')?.file('media.json', JSON.stringify({
          version: 1,
          providerId: 'local',
          images: { 'assets/originals/image1.jpg': mediaEntry() },
        }));
        siteFolder.folder('assets/originals')?.file('image1.jpg', 'fake-image-1');
        siteFolder.folder('assets/originals')?.file('unlisted.jpg', 'unlisted');
      });

      const result = await importArchive(zip);

      expect(Object.keys(result.imageAssetsToSave ?? {})).toEqual(['assets/originals/image1.jpg']);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not listed in media.json')
      );
    });

    test('restores a legacy archive (originals, no media index) by archive path', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));
        siteFolder.folder('assets/originals')?.file('photo.jpg', 'photo-bytes');
        siteFolder.folder('assets/originals/nested')?.file('pic.png', 'pic-bytes');
      });

      const result = await importArchive(zip);

      expect(Object.keys(result.imageAssetsToSave ?? {}).sort()).toEqual([
        'assets/originals/nested/pic.png',
        'assets/originals/photo.jpg',
      ]);
      expect(await result.imageAssetsToSave?.['assets/originals/photo.jpg'].text()).toBe('photo-bytes');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Legacy backup without')
      );
    });
  });

  describe('content scoping', () => {
    test('reads content only from _site/content and only Markdown entries', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));
        siteFolder.folder('content')?.file('home.md', '---\ntitle: Home\nlayout: page\n---\nHome body');
        siteFolder.folder('content/notes')?.file('deep.md', '---\ntitle: Deep\n---\nDeep body');
        siteFolder.folder('content')?.file('draft.txt', 'not markdown');
        siteFolder.folder('content-archive')?.file('old.md', '---\ntitle: Old\n---\nOld body');
        siteFolder.file('.DS_Store', 'junk');
      });
      zip.file('README.md', 'unrelated root entry');
      zip.file('.DS_Store', 'root junk');

      const result = await importArchive(zip);

      expect(result.contentFiles?.map((file) => file.path).sort()).toEqual([
        'content/home.md',
        'content/notes/deep.md',
      ]);
      expect(result.contentFiles?.map((file) => file.slug).sort()).toEqual([
        'home',
        'notes/deep',
      ]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('content/draft.txt')
      );
    });

    test('excludes non-Markdown and escaping paths from exported content', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const site = createSiteFixture('basicSite', { siteId: 'poisoned-content-site' });
      // A malformed import used to store archive entries as content files.
      const poisonedContentFiles: ParsedMarkdownFile[] = [
        { path: 'manifest.json', slug: 'manifest', frontmatter: { title: 'Manifest', layout: 'page' }, content: '{}' },
        { path: 'content/../secrets.json', slug: 'secrets', frontmatter: { title: 'Secrets', layout: 'page' }, content: '{}' },
        { path: 'content/notes.txt', slug: 'notes', frontmatter: { title: 'Notes', layout: 'page' }, content: 'text' },
      ];
      site.contentFiles = [...(site.contentFiles ?? []), ...poisonedContentFiles];

      const exported = await exportSiteBackup(site);
      const zip = await JSZip.loadAsync(exported);

      expect(contentEntries(zip)).toEqual(['home.md']);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping non-content entry')
      );
    });
  });

  describe('archive validation', () => {
    test('rejects an archive with no manifest', async () => {
      const zip = createArchive((siteFolder) => {
        siteFolder.folder('content')?.file('home.md', '---\ntitle: Home\n---\nbody');
      });

      await expect(importArchive(zip)).rejects.toThrow(/manifest\.json/);
    });

    test('rejects a manifest that is not valid JSON', async () => {
      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', '{not json}');
      });

      await expect(importArchive(zip)).rejects.toThrow(/manifest\.json is not valid JSON/);
    });

    test('rejects a manifest without a usable siteId', async () => {
      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify({ title: 'No id', theme: { name: 'starter' } }));
      });

      await expect(importArchive(zip)).rejects.toThrow(/siteId/);
    });

    test('rejects an unreadable archive', async () => {
      const file = new File([new Uint8Array([1, 2, 3, 4])], 'broken.zip');

      await expect(importSiteFromZip(file)).rejects.toThrow(/could not be read/);
    });

    test('treats corrupt secrets.json and corrupt media.json the same way', async () => {
      const corruptSecrets = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));
        siteFolder.file('secrets.json', '{not json}');
      });

      const corruptMediaIndex = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));
        siteFolder.folder('data')?.file('media.json', '{not json}');
      });

      await expect(importArchive(corruptSecrets)).rejects.toThrow(/secrets\.json is not valid JSON/);
      await expect(importArchive(corruptMediaIndex)).rejects.toThrow(/media\.json is not valid JSON/);
    });

    test('rejects a damaged archive before touching an existing site', async () => {
      await resetIndexedDbForTests();
      const site = createSiteFixture('basicSite', { siteId: 'existing-site' });
      await saveSite(site);
      await saveAllImageAssetsForSite(site.siteId, {
        'assets/originals/existing.jpg': new Blob(['existing-bytes']),
      });
      await saveDataFile(site.siteId, 'data/categories.json', '["news"]');

      const zip = createArchive((siteFolder) => {
        siteFolder.file('manifest.json', JSON.stringify(createMockManifest({ title: 'Damaged' })));
        siteFolder.file('secrets.json', '{not json}');
      });

      await expect(importArchive(zip)).rejects.toThrow(/secrets\.json/);

      expect((await getManifestById(site.siteId))?.title).toBe('Basic Site');
      expect(Object.keys(await getAllImageAssetsForSite(site.siteId))).toEqual(['assets/originals/existing.jpg']);
      expect(await getAllDataFiles(site.siteId)).toEqual({ 'data/categories.json': '["news"]' });
    });
  });
});

/** Names of the content files written into an archive, without folder entries. */
function contentEntries(zip: JSZip): string[] {
  return Object.entries(zip.files)
    .filter(([name, entry]) => !entry.dir && name.startsWith('_site/content/'))
    .map(([name]) => name.slice('_site/content/'.length))
    .sort();
}

