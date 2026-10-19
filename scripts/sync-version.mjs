// package.json is the single source of truth for the app version. This copies it into
// tauri.conf.json, Cargo.toml and Cargo.lock. `--check` only reports drift (used in CI).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

// Each target reads the current version and returns the file text with `version` applied.
const targets = [
  {
    file: 'src-tauri/tauri.conf.json',
    current: (text) => JSON.parse(text).version,
    apply: (text, version) => text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`),
  },
  {
    file: 'src-tauri/Cargo.toml',
    // Only the first `version =` after [package]; dependency versions are inline tables.
    current: (text) => /\[package\][^[]*?^version\s*=\s*"([^"]*)"/m.exec(text)?.[1],
    apply: (text, version) => text.replace(/(\[package\][^[]*?^version\s*=\s*")[^"]*(")/m, `$1${version}$2`),
  },
  {
    file: 'src-tauri/Cargo.lock',
    optional: true,
    current: (text) => /^name = "app"\nversion = "([^"]*)"/m.exec(text)?.[1],
    apply: (text, version) => text.replace(/(^name = "app"\nversion = ")[^"]*(")/m, `$1${version}$2`),
  },
];

export function syncVersion({ root, check = false }) {
  const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  if (!SEMVER.test(version ?? '')) {
    throw new Error(`package.json version "${version}" is not valid semver`);
  }

  const mismatches = [];
  for (const target of targets) {
    const full = path.join(root, target.file);
    if (!existsSync(full)) {
      if (target.optional) continue;
      throw new Error(`${target.file} not found`);
    }
    const text = readFileSync(full, 'utf8');
    const current = target.current(text);
    if (current === version) continue;
    mismatches.push({ file: target.file, found: current, expected: version });
    if (!check) {
      writeFileSync(full, target.apply(text, version));
    }
  }
  return { version, mismatches: check ? mismatches : [] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const check = process.argv.includes('--check');
  const { version, mismatches } = syncVersion({ root, check });
  if (check && mismatches.length > 0) {
    for (const m of mismatches) {
      console.error(`${m.file}: version ${m.found ?? 'missing'}, expected ${m.expected}`);
    }
    console.error('\nRun `npm run version:sync` to fix.');
    process.exit(1);
  }
  console.log(check ? `Versions in sync at ${version}` : `Synced versions to ${version}`);
}
