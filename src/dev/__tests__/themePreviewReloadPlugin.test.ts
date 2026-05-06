import type { ViteDevServer } from 'vite';
import { createThemePreviewReloadPlugin, isThemePublicAssetPath } from '../themePreviewReloadPlugin';

describe('themePreviewReloadPlugin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('matches files inside public/themes', () => {
    expect(isThemePublicAssetPath('/Users/mattkevan/Sites/sparktype/public/themes/sparksite/base.hbs')).toBe(true);
    expect(isThemePublicAssetPath('/Users/mattkevan/Sites/sparktype/src/App.tsx')).toBe(false);
  });

  test('requests a full reload when a theme asset changes', () => {
    const listeners: Record<string, (filePath: string) => void> = {};
    const send = vi.fn();
    const plugin = createThemePreviewReloadPlugin();
    const configureServer = typeof plugin.configureServer === 'function'
      ? plugin.configureServer
      : plugin.configureServer?.handler;
    const registerWatcher = ((event: string, handler: (filePath: string) => void) => {
      listeners[event] = handler;
      return {} as never;
    }) as unknown as ViteDevServer['watcher']['on'];
    const server = {
      watcher: {
        on: registerWatcher,
      },
      ws: { send } as unknown as ViteDevServer['ws'],
    } as unknown as ViteDevServer;

    configureServer?.call({} as never, server);

    listeners.change('/Users/mattkevan/Sites/sparktype/public/themes/sparksite/partials/footer.hbs');
    expect(send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(75);

    expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
  });

  test('ignores non-theme changes', () => {
    const listeners: Record<string, (filePath: string) => void> = {};
    const send = vi.fn();
    const plugin = createThemePreviewReloadPlugin();
    const configureServer = typeof plugin.configureServer === 'function'
      ? plugin.configureServer
      : plugin.configureServer?.handler;
    const registerWatcher = ((event: string, handler: (filePath: string) => void) => {
      listeners[event] = handler;
      return {} as never;
    }) as unknown as ViteDevServer['watcher']['on'];
    const server = {
      watcher: {
        on: registerWatcher,
      },
      ws: { send } as unknown as ViteDevServer['ws'],
    } as unknown as ViteDevServer;

    configureServer?.call({} as never, server);

    listeners.change('/Users/mattkevan/Sites/sparktype/src/App.tsx');
    vi.advanceTimersByTime(75);

    expect(send).not.toHaveBeenCalled();
  });
});
