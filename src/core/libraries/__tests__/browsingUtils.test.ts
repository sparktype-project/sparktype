/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports */
import { parseSiteIdentifier, REMOTE_SITE_ID_MARKER } from '../browsingUtils';

describe('browsingUtils', () => {
  describe('parseSiteIdentifier', () => {
    test('handles local site ID string', () => {
      const result = parseSiteIdentifier('my-blog-abc123');
      
      expect(result).not.toBeNull();
      expect(result!.rawParam).toBe('my-blog-abc123');
      expect(result!.cleanedIdOrUrl).toBe('my-blog-abc123');
      expect(result!.isRemote).toBe(false);
      expect(result!.remoteBaseUrl).toBeNull();
      expect(result!.effectiveSiteId).toBe('my-blog-abc123');
    });

    test('handles site ID array (takes first element)', () => {
      const result = parseSiteIdentifier(['site-id-1', 'site-id-2']);
      
      expect(result).not.toBeNull();
      expect(result!.rawParam).toBe('site-id-1');
      expect(result!.cleanedIdOrUrl).toBe('site-id-1');
      expect(result!.isRemote).toBe(false);
      expect(result!.effectiveSiteId).toBe('site-id-1');
    });

    test('handles empty array', () => {
      const result = parseSiteIdentifier([]);
      
      expect(result).toBeNull();
    });

    test('handles undefined parameter', () => {
      const result = parseSiteIdentifier(undefined);
      
      expect(result).toBeNull();
    });

    test('handles empty string', () => {
      const result = parseSiteIdentifier('');
      
      expect(result).toBeNull();
    });

    test('handles quoted site ID', () => {
      const result = parseSiteIdentifier('"my-blog-abc123"');
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog-abc123');
      expect(result!.isRemote).toBe(false);
    });

    test('handles URL encoded site ID', () => {
      const encoded = encodeURIComponent('my-blog-abc123');
      const result = parseSiteIdentifier(encoded);
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog-abc123');
      expect(result!.isRemote).toBe(false);
    });

    test('handles double URL encoded quoted site ID', () => {
      // Simulate double encoding that might happen in some routing scenarios
      const doubleEncoded = encodeURIComponent(encodeURIComponent('"my-blog-abc123"'));
      const result = parseSiteIdentifier(doubleEncoded);
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog-abc123');
      expect(result!.isRemote).toBe(false);
    });

    test('handles malformed URL encoding gracefully', () => {
      const malformed = 'my-blog%ZZ'; // Invalid URL encoding
      const result = parseSiteIdentifier(malformed);
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog%ZZ'); // Should use as-is
      expect(result!.isRemote).toBe(false);
    });

    test('handles remote site URL', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}https://example.com`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.rawParam).toBe(remoteId);
      expect(result!.cleanedIdOrUrl).toBe(remoteId);
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
      expect(result!.effectiveSiteId).toBe(remoteId);
    });

    test('handles remote site URL with port', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}https://example.com:8080`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com:8080');
    });

    test('handles remote site URL with path (extracts origin)', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}https://example.com/some/path`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
    });

    test('handles HTTP (non-HTTPS) remote URL', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}http://localhost:3000`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('http://localhost:3000');
    });

    test('handles invalid remote URL', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}not-a-valid-url`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBeNull(); // Should be null due to invalid URL
      expect(result!.effectiveSiteId).toBe(remoteId);
    });

    test('handles quoted remote site URL', () => {
      const remoteId = `"${REMOTE_SITE_ID_MARKER}https://example.com"`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe(`${REMOTE_SITE_ID_MARKER}https://example.com`);
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
    });

    test('handles URL encoded remote site URL', () => {
      const remoteUrl = `${REMOTE_SITE_ID_MARKER}https://example.com/path?param=value`;
      const encoded = encodeURIComponent(remoteUrl);
      const result = parseSiteIdentifier(encoded);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
    });

    test('handles complex encoding scenario with quotes and remote URL', () => {
      const remoteUrl = `${REMOTE_SITE_ID_MARKER}https://example.com`;
      const quotedAndEncoded = encodeURIComponent(`"${remoteUrl}"`);
      const result = parseSiteIdentifier(quotedAndEncoded);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      expect(result!.remoteBaseUrl).toBe('https://example.com');
    });

    test('handles edge case with only quotes', () => {
      const result = parseSiteIdentifier('""');
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('');
      expect(result!.isRemote).toBe(false);
    });

    test('handles site ID that starts with remote marker but is not remote', () => {
      // Edge case where someone might have a site ID that coincidentally starts with the marker
      const confusingId = `${REMOTE_SITE_ID_MARKER}local-site-id`;
      const result = parseSiteIdentifier(confusingId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true); // Would be treated as remote
      expect(result!.remoteBaseUrl).toBeNull(); // But URL parsing would fail
    });

    test('preserves special characters in local site IDs', () => {
      const result = parseSiteIdentifier('my-blog_test.site-123');
      
      expect(result).not.toBeNull();
      expect(result!.cleanedIdOrUrl).toBe('my-blog_test.site-123');
      expect(result!.isRemote).toBe(false);
    });

    test('handles deeply nested encoding', () => {
      const original = 'my-blog-123';
      const deeplyEncoded = encodeURIComponent(encodeURIComponent(encodeURIComponent(original)));
      const result = parseSiteIdentifier(deeplyEncoded);
      
      // The function only does one level of decoding, so deeply encoded strings won't be fully decoded
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(false);
      // The exact result depends on how the decoding handles this case
    });

    test('handles international domain names', () => {
      const remoteId = `${REMOTE_SITE_ID_MARKER}https://例え.テスト`;
      const result = parseSiteIdentifier(remoteId);
      
      expect(result).not.toBeNull();
      expect(result!.isRemote).toBe(true);
      // URL constructor should handle IDN correctly
      expect(result!.remoteBaseUrl).toContain('例え.テスト');
    });
  });

  describe('REMOTE_SITE_ID_MARKER', () => {
    test('has expected value', () => {
      expect(REMOTE_SITE_ID_MARKER).toBe('remote@');
    });
  });
});