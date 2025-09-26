// src/core/services/__tests__/remoteImport.service.test.ts

import { processSiteZip } from '../remoteImport.service';
import * as mediaManifest from '../images/mediaManifest.service';
import JSZip from 'jszip';

// Mock dependencies
jest.mock('../images/mediaManifest.service');

describe('Remote Import Service', () => {
  const mockImportMediaManifest = mediaManifest.importMediaManifest as jest.MockedFunction<typeof mediaManifest.importMediaManifest>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockZip = async () => {
    const zip = new JSZip();
    const siteFolder = zip.folder('_site');

    if (!siteFolder) throw new Error('Failed to create mock zip');

    // Add manifest
    siteFolder.file('manifest.json', JSON.stringify({
      siteId: 'test-site',
      title: 'Test Site',
      description: 'Test description',
      generatorVersion: '1.0.0',
      theme: { name: 'default', config: {} },
      structure: [],
      dataFiles: ['data/media.json'],
    }));

    // Add content
    const contentFolder = siteFolder.folder('content');
    contentFolder?.file('post.md', '---\ntitle: Test Post\n---\nContent');

    // Add media.json
    const dataFolder = siteFolder.folder('data');
    dataFolder?.file('media.json', JSON.stringify({
      version: 1,
      imageService: 'local',
      images: {
        'assets/originals/photo.jpg': {
          referencedIn: ['content/post.md'],
          metadata: {
            sizeBytes: 245760,
            width: 1920,
            height: 1080,
            alt: 'Test photo',
          },
        },
      },
    }));

    // Add image files
    const assetsFolder = siteFolder.folder('assets');
    const originalsFolder = assetsFolder?.folder('originals');
    originalsFolder?.file('photo.jpg', new Uint8Array([1, 2, 3, 4]));

    return await zip.generateAsync({ type: 'arraybuffer' });
  };

  test('processes site zip with media.json successfully', async () => {
    const zipData = await createMockZip();

    mockImportMediaManifest.mockResolvedValue({
      success: true,
      imagesImported: 1,
      referencesProcessed: 1,
      errors: [],
      warnings: [],
      finalImageService: 'local',
    });

    const result = await processSiteZip(zipData);

    expect(result.siteId).toBe('test-site');
    expect(result.manifest.dataFiles).toEqual(['data/media.json']);
    expect(result.contentFiles).toHaveLength(1);
    expect(result.imageAssetsToSave).toHaveProperty('assets/originals/photo.jpg');

    // Should call importMediaManifest
    expect(mockImportMediaManifest).toHaveBeenCalledWith(
      {
        version: 1,
        imageService: 'local',
        images: {
          'assets/originals/photo.jpg': {
            referencedIn: ['content/post.md'],
            metadata: {
              sizeBytes: 245760,
              width: 1920,
              height: 1080,
              alt: 'Test photo',
            },
          },
        },
      },
      'test-site',
      {
        validateReferences: false,
        preserveExisting: false,
      }
    );
  });

  test('handles media.json import failure gracefully', async () => {
    const zipData = await createMockZip();

    mockImportMediaManifest.mockResolvedValue({
      success: false,
      imagesImported: 0,
      referencesProcessed: 0,
      errors: ['Import failed'],
      warnings: [],
      finalImageService: 'local',
    });

    // Should not throw despite import failure
    const result = await processSiteZip(zipData);

    expect(result.siteId).toBe('test-site');
    expect(result.imageAssetsToSave).toHaveProperty('assets/originals/photo.jpg');
  });

  test('handles missing media.json gracefully', async () => {
    const zip = new JSZip();
    const siteFolder = zip.folder('_site');

    if (!siteFolder) throw new Error('Failed to create mock zip');

    // Add manifest without dataFiles
    siteFolder.file('manifest.json', JSON.stringify({
      siteId: 'test-site',
      title: 'Test Site',
      description: 'Test description',
      generatorVersion: '1.0.0',
      theme: { name: 'default', config: {} },
      structure: [],
    }));

    const zipData = await zip.generateAsync({ type: 'arraybuffer' });

    const result = await processSiteZip(zipData);

    expect(result.siteId).toBe('test-site');
    // Should not call importMediaManifest
    expect(mockImportMediaManifest).not.toHaveBeenCalled();
  });

  test('handles corrupted media.json gracefully', async () => {
    const zip = new JSZip();
    const siteFolder = zip.folder('_site');

    if (!siteFolder) throw new Error('Failed to create mock zip');

    siteFolder.file('manifest.json', JSON.stringify({
      siteId: 'test-site',
      title: 'Test Site',
      description: 'Test description',
      generatorVersion: '1.0.0',
      theme: { name: 'default', config: {} },
      structure: [],
      dataFiles: ['data/media.json'],
    }));

    // Add corrupted media.json
    const dataFolder = siteFolder.folder('data');
    dataFolder?.file('media.json', 'invalid json content');

    const zipData = await zip.generateAsync({ type: 'arraybuffer' });

    // Should not throw despite corrupted JSON
    const result = await processSiteZip(zipData);

    expect(result.siteId).toBe('test-site');
    expect(mockImportMediaManifest).not.toHaveBeenCalled();
  });

  test('handles media.json without manifest reference', async () => {
    const zip = new JSZip();
    const siteFolder = zip.folder('_site');

    if (!siteFolder) throw new Error('Failed to create mock zip');

    // Add manifest without dataFiles reference
    siteFolder.file('manifest.json', JSON.stringify({
      siteId: 'test-site',
      title: 'Test Site',
      description: 'Test description',
      generatorVersion: '1.0.0',
      theme: { name: 'default', config: {} },
      structure: [],
    }));

    // Add media.json anyway
    const dataFolder = siteFolder.folder('data');
    dataFolder?.file('media.json', JSON.stringify({
      version: 1,
      imageService: 'local',
      images: {},
    }));

    const zipData = await zip.generateAsync({ type: 'arraybuffer' });

    const result = await processSiteZip(zipData);

    expect(result.siteId).toBe('test-site');
    // Should not call importMediaManifest because dataFiles doesn't reference it
    expect(mockImportMediaManifest).not.toHaveBeenCalled();
  });

  test('processes empty media manifest correctly', async () => {
    const zip = new JSZip();
    const siteFolder = zip.folder('_site');

    if (!siteFolder) throw new Error('Failed to create mock zip');

    siteFolder.file('manifest.json', JSON.stringify({
      siteId: 'test-site',
      title: 'Test Site',
      description: 'Test description',
      generatorVersion: '1.0.0',
      theme: { name: 'default', config: {} },
      structure: [],
      dataFiles: ['data/media.json'],
    }));

    // Add empty media.json
    const dataFolder = siteFolder.folder('data');
    dataFolder?.file('media.json', JSON.stringify({
      version: 1,
      imageService: 'local',
      images: {},
    }));

    const zipData = await zip.generateAsync({ type: 'arraybuffer' });

    mockImportMediaManifest.mockResolvedValue({
      success: true,
      imagesImported: 0,
      referencesProcessed: 0,
      errors: [],
      warnings: [],
      finalImageService: 'local',
    });

    const result = await processSiteZip(zipData);

    expect(result.siteId).toBe('test-site');
    expect(mockImportMediaManifest).toHaveBeenCalledWith(
      {
        version: 1,
        imageService: 'local',
        images: {},
      },
      'test-site',
      {
        validateReferences: false,
        preserveExisting: false,
      }
    );
  });
});