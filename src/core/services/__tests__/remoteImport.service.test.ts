import JSZip from 'jszip';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';
import type { Manifest } from '@/core/types';

const { importMediaManifestMock, isTauriAppMock } = vi.hoisted(() => ({
  importMediaManifestMock: vi.fn(),
  isTauriAppMock: vi.fn(),
}));

vi.mock('../images/mediaManifest.service', () => ({
  importMediaManifest: importMediaManifestMock,
}));

vi.mock('@/core/utils/platform', () => ({
  isTauriApp: isTauriAppMock,
}));

import { importSiteFromUrl, parseGitHubUrl, processSiteZip } from '../remoteImport.service';

async function createSiteArchive(includeMedia = true): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    '_site/manifest.json',
    JSON.stringify({
      siteId: 'remote-site',
      generatorVersion: '1.0.0',
      title: 'Remote Site',
      description: 'Imported',
      theme: { name: 'starter', config: {} },
      structure: [],
      dataFiles: includeMedia ? ['data/media.json'] : [],
    })
  );
  zip.file('_site/secrets.json', JSON.stringify({}));
  zip.file(
    '_site/content/home.md',
    stringifyToMarkdown({ title: 'Home', layout: 'page', homepage: true }, 'Hello import')
  );
  if (includeMedia) {
    zip.file(
      '_site/data/media.json',
      JSON.stringify({
        version: 1,
        imageService: 'local',
        images: {
          'assets/originals/photo.jpg': {
            path: 'assets/originals/photo.jpg',
            referencedIn: ['content/home.md'],
            metadata: { sizeBytes: 5 },
          },
        },
      })
    );
    zip.file('_site/assets/originals/photo.jpg', 'hello');
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('remoteImport.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriAppMock.mockReturnValue(false);
  });

  test('parses GitHub repository URLs with optional branches', () => {
    expect(parseGitHubUrl('https://github.com/openai/sparktype')).toEqual({
      owner: 'openai',
      repo: 'sparktype',
      branch: undefined,
    });
    expect(parseGitHubUrl('https://github.com/openai/sparktype/tree/feature/tests')).toEqual({
      owner: 'openai',
      repo: 'sparktype',
      branch: 'feature/tests',
    });
    expect(parseGitHubUrl('https://example.com/openai/sparktype')).toBeNull();
  });

  test('imports media.json and only original images listed in the manifest', async () => {
    importMediaManifestMock.mockResolvedValue({
      success: true,
      imagesImported: 1,
      errors: [],
    });

    const result = await processSiteZip(await createSiteArchive(true));

    expect(importMediaManifestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        images: expect.objectContaining({
          'assets/originals/photo.jpg': expect.any(Object),
        }),
      }),
      'remote-site',
      expect.objectContaining({
        preserveExisting: false,
        validateReferences: false,
      })
    );
    expect(result.contentFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'content/home.md', slug: 'home' }),
      ])
    );
    expect(result.imageAssetsToSave).toEqual({
      'assets/originals/photo.jpg': expect.any(Blob),
    });
  });

  test('continues when media manifest import fails', async () => {
    importMediaManifestMock.mockResolvedValue({
      success: false,
      imagesImported: 0,
      errors: ['bad manifest'],
    });

    const result = await processSiteZip(await createSiteArchive(true));

    expect(result.imageAssetsToSave).toEqual({});
  });

  describe('importSiteFromUrl', () => {
    const baseUrl = 'https://example.com/site/';

    function createUrlImportManifest(includeMedia = true): Manifest {
      return {
        siteId: 'remote-site',
        generatorVersion: '1.0.0',
        title: 'Remote Site',
        description: 'Imported from URL',
        theme: { name: 'starter', config: {} },
        structure: [
          {
            type: 'page' as const,
            title: 'Home',
            slug: 'home',
            path: 'content/home.md',
          },
        ],
        collectionItems: [
          {
            collectionId: 'blog',
            slug: 'post-1',
            path: 'content/blog/post-1.md',
            title: 'Post 1',
            url: '/blog/post-1/',
          },
        ],
        dataFiles: includeMedia ? ['data/media.json'] : [],
      };
    }

    function createRemoteFiles(options?: {
      requiresAuth?: boolean;
      includeSecrets?: boolean;
      includeMedia?: boolean;
    }): Record<string, string | Uint8Array> {
      const includeSecrets = options?.includeSecrets ?? true;
      const includeMedia = options?.includeMedia ?? true;
      const manifest = createUrlImportManifest(includeMedia);

      if (options?.requiresAuth) {
        manifest.auth = {
          publicKey: 'pk-1',
          credentialId: 'cred-1',
          requiresAuth: true,
          registeredAt: '2025-01-01T00:00:00.000Z',
        };
      }

      const files: Record<string, string | Uint8Array> = {
        [`${baseUrl}_site/manifest.json`]: JSON.stringify(manifest),
        [`${baseUrl}_site/content/home.md`]: stringifyToMarkdown(
          { title: 'Home', layout: 'page', homepage: true },
          'Hello import'
        ),
        [`${baseUrl}_site/content/blog/post-1.md`]: stringifyToMarkdown(
          { title: 'Post 1', layout: 'blog-post' },
          'Post body'
        ),
        [`${baseUrl}_site/themes/starter/theme.json`]: JSON.stringify({
          name: 'starter',
          version: '1.0.0',
          files: [
            { path: 'theme.json', type: 'manifest' },
            { path: 'base.hbs', type: 'base' },
            { path: 'styles.css', type: 'stylesheet' },
          ],
          layouts: ['page', 'blog-post'],
        }),
        [`${baseUrl}_site/themes/starter/base.hbs`]: '<html>{{{body}}}</html>',
        [`${baseUrl}_site/themes/starter/styles.css`]: 'body { color: black; }',
        [`${baseUrl}_site/themes/starter/layouts/page/layout.json`]: JSON.stringify({
          id: 'page',
          name: 'Page',
          version: '1.0.0',
          layoutType: 'page',
          files: [{ path: 'index.hbs', type: 'template' }],
        }),
        [`${baseUrl}_site/themes/starter/layouts/page/index.hbs`]: '<main>{{{content}}}</main>',
        [`${baseUrl}_site/themes/starter/layouts/blog-post/layout.json`]: JSON.stringify({
          id: 'blog-post',
          name: 'Blog Post',
          version: '1.0.0',
          layoutType: 'item',
          files: [{ path: 'index.hbs', type: 'template' }],
        }),
        [`${baseUrl}_site/themes/starter/layouts/blog-post/index.hbs`]: '<article>{{{content}}}</article>',
      };

      if (includeSecrets) {
        files[`${baseUrl}_site/secrets.json`] = JSON.stringify({ publishing: { token: 'secret' } });
      }

      if (includeMedia) {
        files[`${baseUrl}_site/data/media.json`] = JSON.stringify({
          version: 1,
          imageService: 'local',
          images: {
            'assets/originals/photo.jpg': {
              path: 'assets/originals/photo.jpg',
              referencedIn: ['content/home.md'],
              metadata: { sizeBytes: 5 },
            },
          },
        });
        files[`${baseUrl}_site/assets/originals/photo.jpg`] = new Uint8Array([1, 2, 3]);
      }

      return files;
    }

    function mockRemoteFetch(files: Record<string, string | Uint8Array>) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL) => {
          const requestedUrl = input.toString();
          const url = requestedUrl.startsWith('/.netlify/functions/remote-import?url=')
            ? decodeURIComponent(requestedUrl.split('?url=')[1] || '')
            : requestedUrl;
          const file = files[url];

          if (file === undefined) {
            return new Response('Not found', { status: 404, statusText: 'Not Found' });
          }

          return new Response(file, { status: 200, statusText: 'OK' });
        })
      );
    }

    test('imports a site from URL through the existing ZIP processing path', async () => {
      importMediaManifestMock.mockResolvedValue({
        success: true,
        imagesImported: 1,
        errors: [],
      });
      mockRemoteFetch(createRemoteFiles());

      const result = await importSiteFromUrl(baseUrl);

      expect(result.siteId).toBe('remote-site');
      expect(result.contentFiles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'content/home.md' }),
          expect.objectContaining({ path: 'content/blog/post-1.md' }),
        ])
      );
      expect(result.themeFiles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'themes/starter/theme.json' }),
          expect.objectContaining({ path: 'themes/starter/layouts/page/index.hbs' }),
          expect.objectContaining({ path: 'themes/starter/layouts/blog-post/index.hbs' }),
        ])
      );
      expect(result.secrets).toEqual({ publishing: { token: 'secret' } });
      expect(result.imageAssetsToSave).toEqual({
        'assets/originals/photo.jpg': expect.any(Blob),
      });
      expect(importMediaManifestMock).toHaveBeenCalled();
    });

    test('authenticates protected sites before continuing import', async () => {
      importMediaManifestMock.mockResolvedValue({
        success: true,
        imagesImported: 1,
        errors: [],
      });
      mockRemoteFetch(createRemoteFiles({ requiresAuth: true }));
      const authenticate = vi.fn().mockResolvedValue({ success: true, credentialId: 'cred-1' });

      await importSiteFromUrl(baseUrl, authenticate);

      expect(authenticate).toHaveBeenCalledWith(
        'remote-site',
        expect.objectContaining({ credentialId: 'cred-1', requiresAuth: true })
      );
    });

    test('fails when passkey authentication fails', async () => {
      mockRemoteFetch(createRemoteFiles({ requiresAuth: true }));

      await expect(
        importSiteFromUrl(baseUrl, vi.fn().mockResolvedValue({ success: false, error: 'Denied' }))
      ).rejects.toThrow('Failed to import site from URL: Denied');
    });

    test('fails when _site manifest is missing', async () => {
      mockRemoteFetch({});

      await expect(importSiteFromUrl(baseUrl)).rejects.toThrow(
        'Failed to import site from URL: Failed to fetch _site/manifest.json: 404 Not Found'
      );
    });

    test('fails when a referenced content file is missing', async () => {
      const files = createRemoteFiles();
      delete files[`${baseUrl}_site/content/blog/post-1.md`];
      mockRemoteFetch(files);

      await expect(importSiteFromUrl(baseUrl)).rejects.toThrow(
        'Failed to import site from URL: Failed to fetch required content file "content/blog/post-1.md": 404 Not Found'
      );
    });

    test('fails when a required layout file is missing', async () => {
      const files = createRemoteFiles();
      delete files[`${baseUrl}_site/themes/starter/layouts/blog-post/index.hbs`];
      mockRemoteFetch(files);

      await expect(importSiteFromUrl(baseUrl)).rejects.toThrow(
        'Failed to import site from URL: Failed to fetch layout file "themes/starter/layouts/blog-post/index.hbs": 404 Not Found'
      );
    });

    test('succeeds without optional secrets or media files', async () => {
      importMediaManifestMock.mockResolvedValue({
        success: true,
        imagesImported: 0,
        errors: [],
      });
      mockRemoteFetch(createRemoteFiles({ includeSecrets: false, includeMedia: false }));

      const result = await importSiteFromUrl(baseUrl);

      expect(result.secrets).toEqual({});
      expect(result.imageAssetsToSave).toEqual({});
    });
  });
});
