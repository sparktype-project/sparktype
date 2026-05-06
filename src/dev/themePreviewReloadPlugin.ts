import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';

const THEME_PUBLIC_SEGMENT = `${path.sep}public${path.sep}themes${path.sep}`;

export function isThemePublicAssetPath(filePath: string): boolean {
  return path.resolve(filePath).includes(THEME_PUBLIC_SEGMENT);
}

export function createThemePreviewReloadPlugin(): Plugin {
  return {
    name: 'sparktype-theme-preview-reload',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      let pendingReload: ReturnType<typeof setTimeout> | undefined;

      const queueReload = (filePath: string) => {
        if (!isThemePublicAssetPath(filePath)) {
          return;
        }

        if (pendingReload) {
          clearTimeout(pendingReload);
        }

        pendingReload = setTimeout(() => {
          server.ws.send({ type: 'full-reload' });
        }, 75);
      };

      server.watcher.on('add', queueReload);
      server.watcher.on('change', queueReload);
      server.watcher.on('unlink', queueReload);
    },
  };
}
