import { planDeployment } from '../github/githubTreePlanner';

const textFiles = (paths: string[]) => new Map(paths.map((path) => [path, `<html>${path}</html>`]));

/** The paths a base tree would contain, as the deployment flow reads them. */
const baseTree = (...paths: string[]) => new Set(paths);

describe('planDeployment', () => {
  test('inlines text and marks binary assets for the blob API', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const plan = planDeployment({
      files: new Map<string, string | Uint8Array>([
        ['index.html', '<html>home</html>'],
        ['assets/logo.png', bytes],
      ]),
      previousPaths: null,
      baseTreePaths: null,
    });

    expect(plan.entries).toEqual([
      { kind: 'text', path: 'index.html', content: '<html>home</html>' },
      { kind: 'binary', path: 'assets/logo.png', content: bytes },
    ]);
    expect(plan.generatedPaths).toEqual(['assets/logo.png', 'index.html']);
  });

  test('deletes tracked paths the deployment no longer generates', () => {
    const plan = planDeployment({
      files: textFiles(['index.html']),
      previousPaths: ['about/index.html', 'index.html', 'old/index.html'],
      baseTreePaths: baseTree('index.html', 'about/index.html', 'old/index.html', 'README.md'),
    });

    expect(plan.deletedPaths).toEqual(['about/index.html', 'old/index.html']);
    expect(plan.entries.filter((entry) => entry.kind === 'delete')).toEqual([
      { kind: 'delete', path: 'about/index.html' },
      { kind: 'delete', path: 'old/index.html' },
    ]);
    expect(plan.generatedPaths).toEqual(['index.html']);
  });

  test('does not ask to delete a tracked path that is already gone from the base tree', () => {
    // The tree API errors on `sha: null` for a file that does not exist, so a path a collaborator
    // removed remotely must not be deletion-planned, or every later deployment would fail.
    const plan = planDeployment({
      files: textFiles(['index.html']),
      previousPaths: ['removed-by-a-collaborator/index.html'],
      baseTreePaths: baseTree('index.html'),
    });

    expect(plan.deletedPaths).toEqual([]);
    expect(plan.entries.some((entry) => entry.kind === 'delete')).toBe(false);
  });

  test('never deletes a path that is in the base tree but was not generated here', () => {
    const plan = planDeployment({
      files: textFiles(['index.html']),
      previousPaths: ['old/index.html'],
      baseTreePaths: baseTree('index.html', 'old/index.html', 'README.md', 'notes/todo.md'),
    });

    expect(plan.deletedPaths).toEqual(['old/index.html']);
  });

  test('deletes nothing without a recorded path history', () => {
    // A repository that predates path tracking: the deployment replaces what it can, but the
    // paths it did not generate itself are never inferred to be its own.
    const plan = planDeployment({
      files: textFiles(['index.html']),
      previousPaths: null,
      baseTreePaths: baseTree('index.html', 'legacy-page.html', 'README.md'),
    });

    expect(plan.deletedPaths).toEqual([]);
    expect(plan.entries.some((entry) => entry.kind === 'delete')).toBe(false);
  });

  test('deletes nothing when the tree has no base to delete from', () => {
    const plan = planDeployment({
      files: textFiles(['index.html']),
      previousPaths: ['old/index.html'],
      baseTreePaths: null,
    });

    expect(plan.deletedPaths).toEqual([]);
  });
});
