import JSZip from 'jszip';
import { stringifyToMarkdown } from '@/core/libraries/markdownParser';

const { importMediaManifestMock } = vi.hoisted(() => ({
  importMediaManifestMock: vi.fn(),
}));

vi.mock('../images/mediaManifest.service', () => ({
  importMediaManifest: importMediaManifestMock,
}));

import { parseGitHubUrl, processSiteZip } from '../remoteImport.service';

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
});
