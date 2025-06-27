// src/lib/pathUtils.ts

/**
 * Calculates the relative path from one file to another.
 * This is essential for creating portable HTML that works on any server
 * or directly from the local file system.
 *
 * @example
 * // from 'index.html' to 'about.html' -> './about.html'
 * getRelativePath('index.html', 'about.html');
 *
 * @example
 * // from 'posts/post1.html' to 'index.html' -> '../index.html'
 * getRelativePath('posts/post1.html', 'index.html');
 *
 * @example
 * // from 'posts/post1.html' to 'tags/tech.html' -> '../tags/tech.html'
 * getRelativePath('posts/post1.html', 'tags/tech.html');
 *
 * @param {string} fromPath - The path of the file containing the link.
 * @param {string} toPath - The path of the file being linked to.
 * @returns {string} The calculated relative path.
 */
export function getRelativePath(fromPath: string, toPath: string): string {
  if (fromPath === toPath) {
    return toPath.split('/').pop() || '';
  }

  const fromParts = fromPath.split('/').slice(0, -1); // Path without filename
  const toParts = toPath.split('/');

  // Find the common path segment
  let commonLength = 0;
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }

  const upLevels = fromParts.length - commonLength;
  const upPath = '../'.repeat(upLevels) || './';

  const downPath = toParts.slice(commonLength).join('/');

  return upPath + downPath;
}