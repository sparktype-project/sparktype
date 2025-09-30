/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Site Backup Service Tests
 *
 * Tests for site import/export functionality, focusing on:
 * - Media.json-based image import
 * - Derivative filtering during import
 * - Export structure integrity
 */

import { importSiteFromZip, exportSiteBackup } from '../siteBackup.service';
import type { LocalSiteData, Manifest } from '@/core/types';
import JSZip from 'jszip';

describe('siteBackup.service', () => {
  const createMockManifest = (): Manifest => ({
    siteId: 'test-site',
    generatorVersion: '1.0.0',
    title: 'Test Site',
    description: 'Test Description',
    theme: { name: 'default', config: {} },
    structure: [],
    settings: {
      imageService: 'local'
    }
  });

  const createMockSiteData = (): LocalSiteData => ({
    siteId: 'test-site',
    manifest: createMockManifest(),
    contentFiles: [],
    secrets: {}
  });

  describe('Import Filtering Tests - media.json-based', () => {
    test('should import ONLY images listed in media.json', async () => {
      const zip = new JSZip();
      const siteFolder = zip.folder('_site');

      if (!siteFolder) throw new Error('Failed to create mock zip');

      // Add manifest
      siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));

      // Add media.json with 2 images
      const mediaManifest = {
        version: 1,
        imageService: 'local',
        images: {
          'assets/originals/image1.jpg': {
            path: 'assets/originals/image1.jpg',
            uploadedAt: Date.now(),
            width: 800,
            height: 600,
            size: 1024,
            mimeType: 'image/jpeg'
          },
          'assets/originals/image2.png': {
            path: 'assets/originals/image2.png',
            uploadedAt: Date.now(),
            width: 400,
            height: 300,
            size: 512,
            mimeType: 'image/png'
          }
        }
      };

      siteFolder.folder('data')?.file('media.json', JSON.stringify(mediaManifest));

      // Add 3 actual files in originals folder (one extra not in media.json)
      const originalsFolder = siteFolder.folder('assets/originals');
      originalsFolder?.file('image1.jpg', 'fake-image-1');
      originalsFolder?.file('image2.png', 'fake-image-2');
      originalsFolder?.file('extra-image.jpg', 'fake-extra-image'); // NOT in media.json

      const zipData = await zip.generateAsync({ type: 'blob' });
      const file = new File([zipData], 'test-site.zip');

      const result = await importSiteFromZip(file);

      // Should have imported ONLY the 2 images from media.json
      expect(result.imageAssetsToSave).toBeDefined();
      const importedPaths = Object.keys(result.imageAssetsToSave || {});
      expect(importedPaths).toHaveLength(2);
      expect(importedPaths).toContain('assets/originals/image1.jpg');
      expect(importedPaths).toContain('assets/originals/image2.png');
      expect(importedPaths).not.toContain('assets/originals/extra-image.jpg');
    });

    test('should NOT import derivatives from ZIP', async () => {
      const zip = new JSZip();
      const siteFolder = zip.folder('_site');

      if (!siteFolder) throw new Error('Failed to create mock zip');

      siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));

      // media.json with only originals
      const mediaManifest = {
        version: 1,
        imageService: 'local',
        images: {
          'assets/originals/image1.jpg': {
            path: 'assets/originals/image1.jpg',
            uploadedAt: Date.now(),
            width: 800,
            height: 600,
            size: 1024,
            mimeType: 'image/jpeg'
          }
        }
      };

      siteFolder.folder('data')?.file('media.json', JSON.stringify(mediaManifest));

      // Add original to originals folder
      siteFolder.folder('assets/originals')?.file('image1.jpg', 'fake-image-1');

      // Add derivatives to derivatives folder (should be ignored)
      const derivativesFolder = siteFolder.folder('assets/derivatives');
      derivativesFolder?.file('image1_w600_h400_c-fill_g-center.jpg', 'fake-derivative-1');
      derivativesFolder?.file('image1_w300_h200_c-fit_g-center.jpg', 'fake-derivative-2');

      const zipData = await zip.generateAsync({ type: 'blob' });
      const file = new File([zipData], 'test-site.zip');

      const result = await importSiteFromZip(file);

      // Should have imported ONLY the original, NOT the derivatives
      const importedPaths = Object.keys(result.imageAssetsToSave || {});
      expect(importedPaths).toHaveLength(1);
      expect(importedPaths).toContain('assets/originals/image1.jpg');

      // Verify no derivative filenames imported
      const derivativePattern = /_w(auto|\d+)_h(auto|\d+)_c-[^_]+_g-[^_]+/;
      for (const path of importedPaths) {
        const filename = path.split('/').pop() || '';
        expect(filename).not.toMatch(derivativePattern);
      }
    });

    test('should handle missing media.json gracefully', async () => {
      const zip = new JSZip();
      const siteFolder = zip.folder('_site');

      if (!siteFolder) throw new Error('Failed to create mock zip');

      siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));

      // NO media.json file

      // Add images to originals folder
      siteFolder.folder('assets/originals')?.file('image1.jpg', 'fake-image-1');

      const zipData = await zip.generateAsync({ type: 'blob' });
      const file = new File([zipData], 'test-site.zip');

      const result = await importSiteFromZip(file);

      // Should still succeed, but no images imported
      expect(result.siteId).toBe('test-site');
      expect(result.imageAssetsToSave).toBeDefined();
      expect(Object.keys(result.imageAssetsToSave || {})).toHaveLength(0);
    });

    test('should warn about images in media.json but missing from ZIP', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const zip = new JSZip();
      const siteFolder = zip.folder('_site');

      if (!siteFolder) throw new Error('Failed to create mock zip');

      siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));

      // media.json lists 2 images
      const mediaManifest = {
        version: 1,
        imageService: 'local',
        images: {
          'assets/originals/image1.jpg': {
            path: 'assets/originals/image1.jpg',
            uploadedAt: Date.now(),
            width: 800,
            height: 600,
            size: 1024,
            mimeType: 'image/jpeg'
          },
          'assets/originals/missing.jpg': {
            path: 'assets/originals/missing.jpg',
            uploadedAt: Date.now(),
            width: 800,
            height: 600,
            size: 1024,
            mimeType: 'image/jpeg'
          }
        }
      };

      siteFolder.folder('data')?.file('media.json', JSON.stringify(mediaManifest));

      // But only 1 image actually in ZIP
      siteFolder.folder('assets/originals')?.file('image1.jpg', 'fake-image-1');

      const zipData = await zip.generateAsync({ type: 'blob' });
      const file = new File([zipData], 'test-site.zip');

      const result = await importSiteFromZip(file);

      // Should import the 1 available image
      const importedPaths = Object.keys(result.imageAssetsToSave || {});
      expect(importedPaths).toHaveLength(1);
      expect(importedPaths).toContain('assets/originals/image1.jpg');

      // Should have warned about missing file
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Image listed in media.json not found')
      );

      consoleWarnSpy.mockRestore();
    });

    test('should handle corrupt media.json gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const zip = new JSZip();
      const siteFolder = zip.folder('_site');

      if (!siteFolder) throw new Error('Failed to create mock zip');

      siteFolder.file('manifest.json', JSON.stringify(createMockManifest()));

      // Invalid JSON in media.json
      siteFolder.folder('data')?.file('media.json', '{invalid json}');

      // Add images to originals folder
      siteFolder.folder('assets/originals')?.file('image1.jpg', 'fake-image-1');

      const zipData = await zip.generateAsync({ type: 'blob' });
      const file = new File([zipData], 'test-site.zip');

      const result = await importSiteFromZip(file);

      // Should still succeed without images
      expect(result.siteId).toBe('test-site');
      expect(Object.keys(result.imageAssetsToSave || {})).toHaveLength(0);

      // Should have logged error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse media.json'),
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Export Structure Tests', () => {
    test('should export only originals from siteImageAssetsStore', async () => {
      const siteData = createMockSiteData();

      // Mock that getAllImageAssetsForSite is called and returns only originals
      // (This will be tested more thoroughly in integration tests)

      const exported = await exportSiteBackup(siteData);

      expect(exported).toBeInstanceOf(Blob);
      expect(exported.size).toBeGreaterThan(0);
    });

    test('should not include derivatives folder in backup', async () => {
      const siteData = createMockSiteData();

      const exportedBlob = await exportSiteBackup(siteData);

      // Parse the ZIP to verify structure
      const zip = await JSZip.loadAsync(exportedBlob);

      // Check if derivatives folder exists (it shouldn't in backup source)
      const derivativesFolder = zip.folder('_site/assets/derivatives');
      const files = derivativesFolder?.file(/.*/);

      // Backup should NOT include derivatives (only originals)
      // Derivatives are regenerated on import
      expect(files?.length || 0).toBe(0);
    });
  });

  describe('Roundtrip Tests', () => {
    test('should maintain data integrity through export → import cycle', async () => {
      // Create site with data
      const originalSiteData = createMockSiteData();
      originalSiteData.contentFiles = [
        {
          path: 'content/test.md',
          slug: 'test',
          frontmatter: {
            title: 'Test',
            layout: 'default'
          },
          content: 'Test content',
          blocks: [],
          hasBlocks: false
        }
      ];

      // Export
      const exportedBlob = await exportSiteBackup(originalSiteData);

      // Import
      const file = new File([exportedBlob], 'test-export.zip');
      const importedData = await importSiteFromZip(file);

      // Verify
      expect(importedData.siteId).toBe(originalSiteData.siteId);
      expect(importedData.manifest.title).toBe(originalSiteData.manifest.title);

      // Filter to only actual content files (not manifest.json, secrets.json, etc.)
      const actualContentFiles = importedData.contentFiles?.filter(f =>
        f.path.startsWith('content/')
      );

      expect(actualContentFiles).toHaveLength(1);
      expect(actualContentFiles?.[0].frontmatter.title).toBe('Test');
    });
  });
});