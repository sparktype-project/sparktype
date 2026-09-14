import { isTauriApp, isWebApp } from '../platform';

describe('platform detection', () => {
  afterEach(() => {
    delete window.__TAURI__;
    delete window.__TAURI_IPC__;
    delete window.tauri;
  });

  test('reports a plain browser as web', () => {
    expect(isTauriApp()).toBe(false);
    expect(isWebApp()).toBe(true);
  });

  test('reports an explicitly-false Tauri global as web', () => {
    // Web builds define `__TAURI__: false` to strip Tauri code; that must not
    // be mistaken for a running desktop app.
    window.__TAURI__ = false;

    expect(isTauriApp()).toBe(false);
    expect(isWebApp()).toBe(true);
  });

  test('reports a Tauri API global as desktop', () => {
    window.__TAURI__ = { core: { invoke: () => undefined } };

    expect(isTauriApp()).toBe(true);
    expect(isWebApp()).toBe(false);
  });

  test('reports the Tauri IPC bridge global as desktop', () => {
    window.__TAURI_IPC__ = () => undefined;

    expect(isTauriApp()).toBe(true);
  });
});
