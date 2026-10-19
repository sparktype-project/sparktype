import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SECURITY_CONFIG } from '@/config/editorConfig';
import { buildZipFile, MINIMAL_THEME, type ZipEntries } from '@/test/support/zipFixtures';

const { saveCustomThemeBundleMock } = vi.hoisted(() => ({ saveCustomThemeBundleMock: vi.fn() }));
vi.mock('../assetStorage.service', () => ({ saveCustomThemeBundle: saveCustomThemeBundleMock }));

import { importThemeFromZip } from '../themeImport.service';

const limits = SECURITY_CONFIG.THEME_IMPORT_LIMITS;

describe('importThemeFromZip hard failures', () => {
  beforeEach(() => saveCustomThemeBundleMock.mockReset());

  it('imports a well-formed theme', async () => {
    const result = await importThemeFromZip(await buildZipFile(MINIMAL_THEME), 'site-1');
    expect(result.success).toBe(true);
    expect(result.themeName).toBe('fixture-theme');
    expect(saveCustomThemeBundleMock).toHaveBeenCalledTimes(1);
  });

  it('imports a theme wrapped in a single top-level folder', async () => {
    const wrapped = Object.fromEntries(Object.entries(MINIMAL_THEME).map(([k, v]) => [`my-theme/${k}`, v]));
    const result = await importThemeFromZip(await buildZipFile(wrapped), 'site-1');
    expect(result.success).toBe(true);
  });

  it.each([
    ['parent traversal', 'xx/evil.hbs', '../evil.hbs'],
    ['nested traversal', 'a/xx/xx/evil.hbs', 'a/../../evil.hbs'],
    ['absolute path', 'xabs.hbs', '/abs.hbs'],
    ['backslash traversal', 'xx\\xx\\evil.hbs', '..\\..\\evil.hbs'],
  ])('rejects zip-slip: %s', async (_label, placeholder, raw) => {
    const file = await buildZipFile({ ...MINIMAL_THEME, [placeholder]: 'evil' }, { [placeholder]: raw });
    const result = await importThemeFromZip(file, 'site-1');

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toMatch(/traversal|Absolute paths|Backslashes/);
    expect(saveCustomThemeBundleMock).not.toHaveBeenCalled();
  });

  it('rejects zip-slip entries even when they sit outside a wrapping folder', async () => {
    const wrapped = Object.fromEntries(Object.entries(MINIMAL_THEME).map(([k, v]) => [`my-theme/${k}`, v]));
    const file = await buildZipFile({ ...wrapped, 'xx/evil.hbs': 'evil' }, { 'xx/evil.hbs': '../evil.hbs' });
    const result = await importThemeFromZip(file, 'site-1');

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toMatch(/traversal/);
  });

  it('rejects blocked and unlisted file types and reports every reason', async () => {
    const file = await buildZipFile({
      ...MINIMAL_THEME,
      'scripts/run.sh': '#!/bin/sh',
      'server.php': '<?php',
      'logo.exe': 'MZ',
      'data.bin': '00',
    });
    const result = await importThemeFromZip(file, 'site-1');

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Blocked file type: scripts/run.sh',
        'Blocked file type: server.php',
        'Blocked file type: logo.exe',
        'File type not allowed: data.bin',
      ]),
    );
    expect(saveCustomThemeBundleMock).not.toHaveBeenCalled();
  });

  it('rejects an archive with too many files', async () => {
    const many: ZipEntries = { ...MINIMAL_THEME };
    for (let i = 0; i <= limits.MAX_FILE_COUNT; i++) many[`assets/f${i}.txt`] = 'x';
    const result = await importThemeFromZip(await buildZipFile(many), 'site-1');

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toMatch(/Too many files/);
  });

  it('rejects a single oversized file from its declared size', async () => {
    const big = 'a'.repeat(limits.MAX_FILE_SIZE + 1);
    const result = await importThemeFromZip(await buildZipFile({ ...MINIMAL_THEME, 'styles.css': big }), 'site-1');

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toMatch(/File too large: "styles.css"/);
  });

  it('rejects a package whose total size is over the cap', async () => {
    const chunk = () => Array.from({ length: limits.MAX_FILE_SIZE / 1024 }, (_, i) => `${i}-${Math.random()}`).join('');
    const files: ZipEntries = { ...MINIMAL_THEME };
    for (let i = 0; i < Math.ceil(limits.MAX_TOTAL_SIZE / limits.MAX_FILE_SIZE) + 1; i++) {
      files[`assets/part${i}.txt`] = chunk().padEnd(limits.MAX_FILE_SIZE - 10, 'x');
    }
    const result = await importThemeFromZip(await buildZipFile(files), 'site-1');

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toMatch(/Total theme size too large/);
  });

  it('rejects a highly compressible archive as a probable zip bomb', async () => {
    const bomb = 'a'.repeat(limits.MAX_FILE_SIZE - 1);
    const result = await importThemeFromZip(await buildZipFile({ ...MINIMAL_THEME, 'styles.css': bomb }), 'site-1');

    expect(result.success).toBe(false);
    expect(result.errors?.join('\n')).toMatch(/compression ratio/);
  });

  it('rejects an untrusted external script origin in a template', async () => {
    const file = await buildZipFile({
      ...MINIMAL_THEME,
      'base.hbs': '<script src="https://evil.example/x.js"></script>{{{body}}}',
    });
    const result = await importThemeFromZip(file, 'site-1');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('base.hbs: Script domain is not trusted: evil.example');
  });

  it('reports a non-zip upload without throwing', async () => {
    const result = await importThemeFromZip(new File(['not a zip'], 'theme.zip'), 'site-1');
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toMatch(/Failed to load ZIP file/);
  });
});

describe('importThemeFromZip soft issues', () => {
  it('warns without blocking when a file is not referenced in the manifest', async () => {
    const result = await importThemeFromZip(await buildZipFile({ ...MINIMAL_THEME, 'notes.md': '# hi' }), 'site-1');

    expect(result.success).toBe(true);
    expect(result.warnings).toContain('File not referenced in manifest: notes.md');
  });
});
