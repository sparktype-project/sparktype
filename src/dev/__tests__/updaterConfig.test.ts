import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isUpdaterConfigured, UPDATER_PUBKEY_PLACEHOLDER } from '../updaterConfig';

function conf(contents: string): string {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'updater-conf-')), 'tauri.conf.json');
  writeFileSync(file, contents);
  return file;
}

describe('isUpdaterConfigured', () => {
  it('is false while the pubkey is the placeholder', () => {
    const file = conf(JSON.stringify({ plugins: { updater: { pubkey: UPDATER_PUBKEY_PLACEHOLDER } } }));
    expect(isUpdaterConfigured(file)).toBe(false);
  });

  it('is true for a real key', () => {
    const file = conf(JSON.stringify({ plugins: { updater: { pubkey: 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWdu' } } }));
    expect(isUpdaterConfigured(file)).toBe(true);
  });

  it('is false when the key, the plugin config or the file is missing or malformed', () => {
    expect(isUpdaterConfigured(conf(JSON.stringify({ plugins: { updater: { pubkey: '  ' } } })))).toBe(false);
    expect(isUpdaterConfigured(conf('{}'))).toBe(false);
    expect(isUpdaterConfigured(conf('not json'))).toBe(false);
    expect(isUpdaterConfigured('/nonexistent/tauri.conf.json')).toBe(false);
  });
});
