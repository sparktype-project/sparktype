import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { syncVersion } from './sync-version.mjs';

function makeRoot({ pkg = '1.2.3', conf = '0.1.0', cargo = '0.1.0', lock = '0.1.0' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'sync-version-'));
  mkdirSync(path.join(root, 'src-tauri'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'x', version: pkg }, null, 2) + '\n');
  writeFileSync(
    path.join(root, 'src-tauri/tauri.conf.json'),
    JSON.stringify({ productName: 'X', version: conf }, null, 2) + '\n',
  );
  writeFileSync(
    path.join(root, 'src-tauri/Cargo.toml'),
    `[package]\nname = "app"\nversion = "${cargo}"\n\n[dependencies]\nlog = { version = "0.4" }\n`,
  );
  writeFileSync(
    path.join(root, 'src-tauri/Cargo.lock'),
    `[[package]]\nname = "log"\nversion = "0.4.1"\n\n[[package]]\nname = "app"\nversion = "${lock}"\n`,
  );
  return root;
}

const read = (root, f) => readFileSync(path.join(root, f), 'utf8');

describe('syncVersion', () => {
  it('rewrites tauri.conf.json, Cargo.toml and Cargo.lock to the package.json version', () => {
    const root = makeRoot();
    const result = syncVersion({ root });
    expect(result.mismatches).toEqual([]);
    expect(JSON.parse(read(root, 'src-tauri/tauri.conf.json')).version).toBe('1.2.3');
    expect(read(root, 'src-tauri/Cargo.toml')).toContain('[package]\nname = "app"\nversion = "1.2.3"');
    expect(read(root, 'src-tauri/Cargo.toml')).toContain('log = { version = "0.4" }');
    const lock = read(root, 'src-tauri/Cargo.lock');
    expect(lock).toContain('name = "app"\nversion = "1.2.3"');
    expect(lock).toContain('name = "log"\nversion = "0.4.1"');
  });

  it('--check reports mismatches and leaves files untouched', () => {
    const root = makeRoot({ conf: '0.0.9', cargo: '0.0.8' });
    const before = read(root, 'src-tauri/Cargo.toml');
    const result = syncVersion({ root, check: true });
    expect(result.mismatches.map((m) => m.file)).toEqual(['src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']);
    expect(read(root, 'src-tauri/Cargo.toml')).toBe(before);
  });

  it('--check passes when everything matches', () => {
    const root = makeRoot({ conf: '1.2.3', cargo: '1.2.3', lock: '1.2.3' });
    expect(syncVersion({ root, check: true }).mismatches).toEqual([]);
  });

  it('rejects a non-semver package.json version', () => {
    const root = makeRoot({ pkg: 'latest' });
    expect(() => syncVersion({ root })).toThrow(/semver/);
  });
});
