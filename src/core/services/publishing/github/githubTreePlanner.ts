/**
 * Plans the tree a deployment submits to GitHub: which files are inlined and which are uploaded
 * as blobs first.
 */

import { encodeBase64 } from './githubBlobUploader';

export interface DeploymentPlanInput {
  files: Map<string, string | Uint8Array>;
}

export type PlannedEntry =
  | { kind: 'text'; path: string; content: string }
  | { kind: 'inline-base64'; path: string; content: string }
  | { kind: 'blob'; path: string; content: Uint8Array };

export interface DeploymentPlan {
  entries: PlannedEntry[];
}

/** GitHub accepts roughly 1MB of inline content in a tree entry. */
const MAX_INLINE_SIZE = 1024 * 1024;

export function planDeployment(input: DeploymentPlanInput): DeploymentPlan {
  const entries: PlannedEntry[] = [];

  for (const [path, content] of input.files) {
    if (typeof content === 'string') {
      entries.push({ kind: 'text', path, content });
      continue;
    }

    if (content.length > MAX_INLINE_SIZE) {
      entries.push({ kind: 'blob', path, content });
      continue;
    }

    entries.push({ kind: 'inline-base64', path, content: encodeBase64(content) });
  }

  return { entries };
}
