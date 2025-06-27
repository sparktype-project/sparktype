/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import {
  getCachedDerivative,
  setCachedDerivative,
  getAllCacheKeys,
  clearSiteDerivativeCache,
  clearAllDerivativeCache
} from '../derivativeCache.service';

// Mock localforage
jest.mock('localforage', () => {
  const mockLocalForageInstance = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    keys: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };

  return {
    createInstance: jest.fn(() => mockLocalForageInstance)
  };
});

// Get the mocked instance for test usage
const localforage = require('localforage');
const mockLocalForageInstance = localforage.createInstance();

describe('derivativeCache.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear console mocks
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper function to create mock image blobs
  const createMockBlob = (content: string, type = 'image/jpeg'): Blob => {
    return new Blob([content], { type });
  };

  describe('getCachedDerivative', () => {
    test('retrieves cached derivative blob by key', async () => {
      const key = 'test-site/assets/images/photo_w300.jpg';
      const expectedBlob = createMockBlob('cached-image-data');

      mockLocalForageInstance.getItem.mockResolvedValue(expectedBlob);

      const result = await getCachedDerivative(key);

      expect(result).toBe(expectedBlob);
      expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith(key);
    });

    test('returns null when derivative not found', async () => {
      const key = 'test-site/assets/images/nonexistent_w300.jpg';

      mockLocalForageInstance.getItem.mockResolvedValue(null);

      const result = await getCachedDerivative(key);

      expect(result).toBeNull();
      expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith(key);
    });

    test('handles different key formats', async () => {
      const testKeys = [
        'site-123/assets/images/simple.jpg',
        'my-blog-abc/nested/path/image_w100_h200.png',
        'test/complex_w300_h200_c-fill_g-center.webp'
      ];

      for (const key of testKeys) {
        const mockBlob = createMockBlob(`data-for-${key}`);
        mockLocalForageInstance.getItem.mockResolvedValue(mockBlob);

        const result = await getCachedDerivative(key);

        expect(result).toBe(mockBlob);
        expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith(key);
        
        jest.clearAllMocks();
      }
    });

    test('propagates storage errors', async () => {
      const key = 'test-site/assets/images/error.jpg';
      const storageError = new Error('IndexedDB connection failed');

      mockLocalForageInstance.getItem.mockRejectedValue(storageError);

      await expect(getCachedDerivative(key)).rejects.toThrow('IndexedDB connection failed');
    });

    test('handles empty key', async () => {
      mockLocalForageInstance.getItem.mockResolvedValue(null);

      const result = await getCachedDerivative('');

      expect(result).toBeNull();
      expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith('');
    });
  });

  describe('setCachedDerivative', () => {
    test('stores derivative blob with correct key', async () => {
      const key = 'test-site/assets/images/photo_w300.jpg';
      const blob = createMockBlob('compressed-image-data');

      mockLocalForageInstance.setItem.mockResolvedValue(undefined);

      await setCachedDerivative(key, blob);

      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith(key, blob);
    });

    test('stores different blob types', async () => {
      const testCases = [
        { key: 'site1/image.jpg', blob: createMockBlob('jpeg-data', 'image/jpeg') },
        { key: 'site2/image.png', blob: createMockBlob('png-data', 'image/png') },
        { key: 'site3/image.webp', blob: createMockBlob('webp-data', 'image/webp') }
      ];

      for (const { key, blob } of testCases) {
        mockLocalForageInstance.setItem.mockResolvedValue(undefined);

        await setCachedDerivative(key, blob);

        expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith(key, blob);
        
        jest.clearAllMocks();
      }
    });

    test('handles large blob storage', async () => {
      const key = 'test-site/assets/images/large_w1000.jpg';
      const largeData = 'x'.repeat(1024 * 1024); // 1MB of data
      const largeBlob = createMockBlob(largeData);

      mockLocalForageInstance.setItem.mockResolvedValue(undefined);

      await setCachedDerivative(key, largeBlob);

      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith(key, largeBlob);
    });

    test('propagates storage errors', async () => {
      const key = 'test-site/assets/images/error.jpg';
      const blob = createMockBlob('test-data');
      const storageError = new Error('Storage quota exceeded');

      mockLocalForageInstance.setItem.mockRejectedValue(storageError);

      await expect(setCachedDerivative(key, blob)).rejects.toThrow('Storage quota exceeded');
    });

    test('overwrites existing cached derivative', async () => {
      const key = 'test-site/assets/images/update.jpg';
      const originalBlob = createMockBlob('original-data');
      const updatedBlob = createMockBlob('updated-data');

      // First storage
      mockLocalForageInstance.setItem.mockResolvedValueOnce(undefined);
      await setCachedDerivative(key, originalBlob);

      // Update storage
      mockLocalForageInstance.setItem.mockResolvedValueOnce(undefined);
      await setCachedDerivative(key, updatedBlob);

      expect(mockLocalForageInstance.setItem).toHaveBeenCalledTimes(2);
      expect(mockLocalForageInstance.setItem).toHaveBeenLastCalledWith(key, updatedBlob);
    });
  });

  describe('getAllCacheKeys', () => {
    test('returns all keys for a specific site', async () => {
      const allKeys = [
        'site-123/assets/images/photo1_w300.jpg',
        'site-123/assets/images/photo2_w200.png',
        'site-456/assets/images/other_w100.jpg',
        'site-123/nested/path/image_w500.webp',
        'another-site/test.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys('site-123');

      expect(result).toEqual([
        'site-123/assets/images/photo1_w300.jpg',
        'site-123/assets/images/photo2_w200.png',
        'site-123/nested/path/image_w500.webp'
      ]);
      expect(mockLocalForageInstance.keys).toHaveBeenCalled();
    });

    test('returns empty array when no keys match site', async () => {
      const allKeys = [
        'other-site/image1.jpg',
        'another-site/image2.png'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys('non-existent-site');

      expect(result).toEqual([]);
    });

    test('returns empty array when no keys exist', async () => {
      mockLocalForageInstance.keys.mockResolvedValue([]);

      const result = await getAllCacheKeys('any-site');

      expect(result).toEqual([]);
    });

    test('handles site IDs with special characters', async () => {
      const siteId = 'my-blog-2024';
      const allKeys = [
        'my-blog-2024/assets/images/post_w300.jpg',
        'my-blog-2023/assets/images/old_w300.jpg',
        'my-blog-2024-test/assets/images/test_w300.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys(siteId);

      expect(result).toEqual(['my-blog-2024/assets/images/post_w300.jpg']);
    });

    test('handles site ID that is a prefix of another site ID', async () => {
      const allKeys = [
        'site/image1.jpg',
        'site-extended/image2.jpg',
        'site/sub/image3.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys('site');

      expect(result).toEqual([
        'site/image1.jpg',
        'site/sub/image3.jpg'
      ]);
    });

    test('propagates storage errors', async () => {
      const storageError = new Error('Failed to retrieve keys');
      mockLocalForageInstance.keys.mockRejectedValue(storageError);

      await expect(getAllCacheKeys('test-site')).rejects.toThrow('Failed to retrieve keys');
    });

    test('handles empty site ID', async () => {
      const allKeys = ['site1/image.jpg', 'site2/image.jpg'];
      mockLocalForageInstance.keys.mockResolvedValue(allKeys);

      const result = await getAllCacheKeys('');

      expect(result).toEqual([]);
    });
  });

  describe('clearSiteDerivativeCache', () => {
    test('clears all derivatives for a specific site', async () => {
      const siteId = 'test-site';
      const siteKeys = [
        'test-site/assets/images/photo1_w300.jpg',
        'test-site/assets/images/photo2_w200.png',
        'test-site/nested/image_w100.webp'
      ];

      const allKeys = [
        ...siteKeys,
        'other-site/image.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);

      await clearSiteDerivativeCache(siteId);

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledTimes(3);
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('test-site/assets/images/photo1_w300.jpg');
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('test-site/assets/images/photo2_w200.png');
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('test-site/nested/image_w100.webp');
      
      expect(console.log).toHaveBeenCalledWith('[DerivativeCache] Cleared 3 cached derivatives for site test-site');
    });

    test('handles site with no cached derivatives', async () => {
      const siteId = 'empty-site';
      mockLocalForageInstance.keys.mockResolvedValue([]);

      await clearSiteDerivativeCache(siteId);

      expect(mockLocalForageInstance.removeItem).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[DerivativeCache] Cleared 0 cached derivatives for site empty-site');
    });

    test('continues clearing even if some removals fail', async () => {
      const siteId = 'test-site';
      const siteKeys = [
        'test-site/image1.jpg',
        'test-site/image2.jpg',
        'test-site/image3.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(siteKeys);
      mockLocalForageInstance.removeItem
        .mockResolvedValueOnce(undefined) // First succeeds
        .mockRejectedValueOnce(new Error('Remove failed')) // Second fails
        .mockResolvedValueOnce(undefined); // Third succeeds

      await clearSiteDerivativeCache(siteId);

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledTimes(3);
      // Should still complete despite one failure
    });

    test('logs error when clearing fails', async () => {
      const siteId = 'error-site';
      const keysError = new Error('Failed to get keys');

      mockLocalForageInstance.keys.mockRejectedValue(keysError);

      await clearSiteDerivativeCache(siteId);

      expect(console.error).toHaveBeenCalledWith(
        '[DerivativeCache] Failed to clear cache for site error-site:',
        keysError
      );
    });

    test('handles concurrent clear operations', async () => {
      const siteIds = ['site1', 'site2', 'site3'];
      
      mockLocalForageInstance.keys.mockImplementation(() => 
        Promise.resolve(['site1/image.jpg', 'site2/image.jpg', 'site3/image.jpg'])
      );
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);

      const promises = siteIds.map(siteId => clearSiteDerivativeCache(siteId));
      await Promise.all(promises);

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledTimes(3);
      expect(console.log).toHaveBeenCalledTimes(3);
    });

    test('properly filters site keys with exact match', async () => {
      const siteId = 'site';
      const allKeys = [
        'site/image1.jpg',
        'site-test/image2.jpg', // Should not be included
        'site/sub/image3.jpg',
        'other-site/image4.jpg' // Should not be included
      ];

      mockLocalForageInstance.keys.mockResolvedValue(allKeys);
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);

      await clearSiteDerivativeCache(siteId);

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledTimes(2);
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('site/image1.jpg');
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith('site/sub/image3.jpg');
    });
  });

  describe('clearAllDerivativeCache', () => {
    test('clears entire derivative cache', async () => {
      mockLocalForageInstance.clear.mockResolvedValue(undefined);

      await clearAllDerivativeCache();

      expect(mockLocalForageInstance.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[DerivativeCache] Cleared entire cache for recovery');
    });

    test('logs error when clear all fails', async () => {
      const clearError = new Error('Failed to clear cache');
      mockLocalForageInstance.clear.mockRejectedValue(clearError);

      await clearAllDerivativeCache();

      expect(console.error).toHaveBeenCalledWith(
        '[DerivativeCache] Failed to clear entire cache:',
        clearError
      );
    });

    test('handles multiple concurrent clear all operations', async () => {
      mockLocalForageInstance.clear.mockResolvedValue(undefined);

      const promises = [
        clearAllDerivativeCache(),
        clearAllDerivativeCache(),
        clearAllDerivativeCache()
      ];

      await Promise.all(promises);

      expect(mockLocalForageInstance.clear).toHaveBeenCalledTimes(3);
    });

    test('completes successfully even with concurrent site clears', async () => {
      mockLocalForageInstance.clear.mockResolvedValue(undefined);
      mockLocalForageInstance.keys.mockResolvedValue(['site1/image.jpg']);
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);

      const promises = [
        clearAllDerivativeCache(),
        clearSiteDerivativeCache('site1')
      ];

      await Promise.all(promises);

      expect(mockLocalForageInstance.clear).toHaveBeenCalled();
      expect(mockLocalForageInstance.removeItem).toHaveBeenCalled();
    });
  });

  describe('Integration and Performance', () => {
    test('handles complete derivative lifecycle', async () => {
      const key = 'test-site/assets/images/lifecycle_w300.jpg';
      const originalBlob = createMockBlob('original-derivative');
      const updatedBlob = createMockBlob('updated-derivative');

      // Store initial derivative
      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      await setCachedDerivative(key, originalBlob);

      // Retrieve derivative
      mockLocalForageInstance.getItem.mockResolvedValue(originalBlob);
      const retrieved = await getCachedDerivative(key);
      expect(retrieved).toBe(originalBlob);

      // Update derivative
      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      await setCachedDerivative(key, updatedBlob);

      // Verify in getAllCacheKeys
      mockLocalForageInstance.keys.mockResolvedValue([key]);
      const allKeys = await getAllCacheKeys('test-site');
      expect(allKeys).toContain(key);

      // Clear the site cache
      mockLocalForageInstance.removeItem.mockResolvedValue(undefined);
      await clearSiteDerivativeCache('test-site');

      expect(mockLocalForageInstance.removeItem).toHaveBeenCalledWith(key);
    });

    test('handles high volume of cache operations', async () => {
      const siteId = 'bulk-test-site';
      const operations = 100;
      
      // Generate many cache keys
      const keys = Array.from({ length: operations }, (_, i) => 
        `${siteId}/assets/images/bulk${i}_w300.jpg`
      );

      // Mock bulk storage
      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      const storePromises = keys.map(key => 
        setCachedDerivative(key, createMockBlob(`data-${key}`))
      );

      const start = performance.now();
      await Promise.all(storePromises);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete quickly
      expect(mockLocalForageInstance.setItem).toHaveBeenCalledTimes(operations);
    });

    test('maintains data integrity across operations', async () => {
      const testData = [
        { key: 'site1/image1.jpg', data: 'data1' },
        { key: 'site1/image2.png', data: 'data2' },
        { key: 'site2/image3.webp', data: 'data3' }
      ];

      // Store all data
      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      for (const { key, data } of testData) {
        await setCachedDerivative(key, createMockBlob(data));
      }

      // Verify retrieval
      for (const { key, data } of testData) {
        const expectedBlob = createMockBlob(data);
        mockLocalForageInstance.getItem.mockResolvedValue(expectedBlob);
        
        const result = await getCachedDerivative(key);
        expect(result).toBe(expectedBlob);
      }

      // Verify site filtering
      mockLocalForageInstance.keys.mockResolvedValue(testData.map(d => d.key));
      const site1Keys = await getAllCacheKeys('site1');
      const site2Keys = await getAllCacheKeys('site2');

      expect(site1Keys).toHaveLength(2);
      expect(site2Keys).toHaveLength(1);
      expect(site1Keys).toEqual(expect.arrayContaining(['site1/image1.jpg', 'site1/image2.png']));
      expect(site2Keys).toEqual(['site2/image3.webp']);
    });

    test('handles storage errors gracefully in batch operations', async () => {
      const keys = [
        'test-site/success1.jpg',
        'test-site/error.jpg',
        'test-site/success2.jpg'
      ];

      mockLocalForageInstance.setItem
        .mockResolvedValueOnce(undefined) // First succeeds
        .mockRejectedValueOnce(new Error('Storage error')) // Second fails
        .mockResolvedValueOnce(undefined); // Third succeeds

      const results = await Promise.allSettled(
        keys.map(key => setCachedDerivative(key, createMockBlob('data')))
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Edge Cases', () => {
    test('handles keys with special characters', async () => {
      const specialKeys = [
        'site-123/assets/images/café_w300.jpg',
        'my-blog/images/photo (1)_w200.png',
        'test/assets/ümlaut_w100.webp'
      ];

      mockLocalForageInstance.getItem.mockResolvedValue(createMockBlob('test'));
      
      for (const key of specialKeys) {
        await getCachedDerivative(key);
        expect(mockLocalForageInstance.getItem).toHaveBeenCalledWith(key);
      }
    });

    test('handles very long cache keys', async () => {
      const longKey = 'site/' + 'a'.repeat(1000) + '_w300.jpg';
      const blob = createMockBlob('long-key-data');

      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      mockLocalForageInstance.getItem.mockResolvedValue(blob);

      await setCachedDerivative(longKey, blob);
      const result = await getCachedDerivative(longKey);

      expect(result).toBe(blob);
    });

    test('handles empty blob', async () => {
      const key = 'test-site/empty.jpg';
      const emptyBlob = new Blob([], { type: 'image/jpeg' });

      mockLocalForageInstance.setItem.mockResolvedValue(undefined);
      await setCachedDerivative(key, emptyBlob);

      expect(mockLocalForageInstance.setItem).toHaveBeenCalledWith(key, emptyBlob);
    });

    test('handles site ID with forward slashes', async () => {
      const siteId = 'user/project/site';
      const keys = [
        'user/project/site/image1.jpg',
        'user/project/site-other/image2.jpg',
        'user/project/site/sub/image3.jpg'
      ];

      mockLocalForageInstance.keys.mockResolvedValue(keys);

      const result = await getAllCacheKeys(siteId);

      expect(result).toEqual([
        'user/project/site/image1.jpg',
        'user/project/site/sub/image3.jpg'
      ]);
    });
  });
});