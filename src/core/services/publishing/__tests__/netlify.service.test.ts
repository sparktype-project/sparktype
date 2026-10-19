import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSiteFixture } from '@/test/support/siteFixtures';

vi.mock('@/core/services/siteBuilder.service', () => ({
  buildSiteBundle: vi.fn(async () => ({ 'index.html': '<html>Home</html>' })),
}));
vi.mock('@/core/services/siteSecrets.service', () => ({
  loadSiteSecretsFromDb: vi.fn(async () => ({})),
}));
vi.mock('@/core/utils/platform', () => ({ isTauriApp: () => false }));

import { NetlifyProvider } from '../netlify.service';

const CONFIG = { apiToken: 'tok', siteId: 'site-1' };

function stubProxy(responses: Record<string, unknown>) {
  const calls: { action: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      calls.push({ action: body.action as string, body });
      return new Response(JSON.stringify(responses[body.action as string]), { status: 200 });
    }),
  );
  return calls;
}

describe('NetlifyProvider', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => vi.unstubAllGlobals());

  test('reports progress and returns the deploy id from the proxy response', async () => {
    stubProxy({
      'get-sites': { success: true },
      'deploy-site': { success: true, deployId: 'deploy-9', siteUrl: 'https://x.netlify.app' },
    });
    const events: string[] = [];

    const result = await new NetlifyProvider().deploy(createSiteFixture('basicSite'), CONFIG, {
      onProgress: (event) => events.push(`${event.step}:${event.status}`),
    });

    expect(result).toMatchObject({ success: true, url: 'https://x.netlify.app', details: { deployId: 'deploy-9', siteId: 'site-1' } });
    expect(events).toEqual([
      'build:started', 'build:completed', 'upload:started', 'upload:completed', 'finalise:started', 'finalise:completed',
    ]);
  });

  test('leaves the upload step running when the proxy fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      const action = (JSON.parse(init.body) as { action: string }).action;
      return action === 'get-sites'
        ? new Response(JSON.stringify({ success: true }), { status: 200 })
        : new Response('bad gateway', { status: 502 });
    }));
    const events: string[] = [];

    const result = await new NetlifyProvider().deploy(createSiteFixture('basicSite'), CONFIG, {
      onProgress: (event) => events.push(`${event.step}:${event.status}`),
    });

    expect(result.success).toBe(false);
    expect(events).toEqual(['build:started', 'build:completed', 'upload:started']);
  });
});
