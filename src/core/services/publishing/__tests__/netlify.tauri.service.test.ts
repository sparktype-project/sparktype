import { beforeEach, describe, expect, test, vi } from 'vitest';

const { tauriFetchMock } = vi.hoisted(() => ({ tauriFetchMock: vi.fn() }));
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: tauriFetchMock }));
vi.mock('@/core/utils/platform', () => ({ isTauriApp: () => true }));

import { netlifyTauriService } from '../netlify.tauri.service';

describe('NetlifyTauriService.restoreDeploy', () => {
  beforeEach(() => tauriFetchMock.mockReset());

  test('POSTs to the restore endpoint with the token and no body', async () => {
    tauriFetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'deploy-1', deploy_ssl_url: 'https://d1--x.netlify.app' }), { status: 201 }));

    const result = await netlifyTauriService.restoreDeploy('tok', 'site-9', 'deploy-1');

    expect(tauriFetchMock).toHaveBeenCalledWith(
      'https://api.netlify.com/api/v1/sites/site-9/deploys/deploy-1/restore',
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    );
    expect(result).toMatchObject({ success: true, deployId: 'deploy-1', details: { deployId: 'deploy-1', siteId: 'site-9' } });
  });

  test('reports Netlify’s error', async () => {
    tauriFetchMock.mockResolvedValue(new Response('{"message":"Not found"}', { status: 404 }));

    const result = await netlifyTauriService.restoreDeploy('tok', 'site-9', 'gone');

    expect(result).toEqual({ success: false, message: 'Restore failed (404): {"message":"Not found"}' });
  });
});
