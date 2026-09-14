/**
 * Binary asset uploads for GitHub deployments.
 *
 * GitHub's tree API has no `encoding` parameter: a tree entry's `content` is committed verbatim,
 * so a base64 string inlined there would be committed as *literal base64 text* rather than as
 * the asset's bytes. Every binary asset therefore goes through the blob API, whose request body
 * does carry `encoding: "base64"` — regardless of the asset's size.
 */

import type { GitHubApiClient } from './githubApiClient';

// `String.fromCharCode(...bytes)` throws `RangeError: Maximum call stack size exceeded` for
// multi-megabyte arrays, so the byte-to-binary-string conversion is chunked. 32 KiB keeps the
// argument count far below the engine limit while avoiding per-byte string concatenation.
const BASE64_CHUNK_SIZE = 0x8000;

/** Encodes raw bytes as standard base64, as the blob API expects with `encoding: "base64"`. */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

/** Uploads one binary asset and returns the blob SHA a tree entry must reference. */
export async function uploadAssetBlob(
  client: GitHubApiClient,
  path: string,
  content: Uint8Array,
): Promise<string> {
  try {
    return await client.createBlob(encodeBase64(content));
  } catch (error) {
    throw new Error(`Failed to upload asset ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
