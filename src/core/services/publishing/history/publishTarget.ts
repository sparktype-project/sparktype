// src/core/services/publishing/history/publishTarget.ts

import type { Manifest } from '@/core/types';

type PublishingConfig = NonNullable<Manifest['publishingConfig']>;

/**
 * The destination a history entry is filed under. GitHub uses the same `owner/repo#branch` key
 * as the generated-path tracker; a Netlify publish that created its site passes the new id.
 */
export function describePublishTarget(
  config: PublishingConfig | undefined,
  netlifySiteId?: string,
): { provider: 'zip' | 'netlify' | 'github'; target: string } {
  const provider = config?.provider ?? 'zip';
  switch (provider) {
    case 'github':
      return { provider, target: `${config?.github?.owner}/${config?.github?.repo}#${config?.github?.branch || 'main'}` };
    case 'netlify':
      return { provider, target: `netlify:${netlifySiteId ?? config?.netlify?.siteId ?? 'new site'}` };
    default:
      return { provider, target: 'download' };
  }
}
