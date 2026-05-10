import { describe, expect, test, vi } from 'vitest';
import { getSlashMenuAnchorRect, getSlashMenuPosition } from '../extensions/SlashCommands';

describe('getSlashMenuAnchorRect', () => {
  test('prefers editor coordinates so the menu stays attached to the slash position', () => {
    const editor = {
      view: {
        coordsAtPos: vi.fn(() => ({
          left: 312,
          top: 240,
          bottom: 264,
        })),
      },
    };

    const anchorRect = getSlashMenuAnchorRect({
      editor: editor as never,
      range: { from: 18, to: 19 },
      clientRect: () =>
        ({
          left: 0,
          top: 0,
          bottom: 0,
        }) as DOMRect,
    });

    expect(editor.view.coordsAtPos).toHaveBeenCalledWith(18);
    expect(anchorRect).toEqual({
      left: 312,
      top: 240,
      bottom: 264,
    });
  });

  test('falls back to the suggestion client rect when editor coordinates are unavailable', () => {
    const anchorRect = getSlashMenuAnchorRect({
      editor: {
        view: {
          coordsAtPos: () => {
            throw new Error('missing position');
          },
        },
      } as never,
      range: { from: 3, to: 4 },
      clientRect: () =>
        ({
          left: 144,
          top: 188,
          bottom: 212,
        }) as DOMRect,
    });

    expect(anchorRect).toEqual({
      left: 144,
      top: 188,
      bottom: 212,
    });
  });
});

describe('getSlashMenuPosition', () => {
  test('places the menu below the trigger when there is enough room', () => {
    const position = getSlashMenuPosition({
      anchorRect: {
        top: 120,
        bottom: 144,
        left: 80,
      },
      menuSize: {
        width: 288,
        chromeHeight: 44,
        contentHeight: 220,
      },
      viewport: {
        width: 1280,
        height: 900,
      },
    });

    expect(position.placement).toBe('bottom');
    expect(position.top).toBe(152);
    expect(position.left).toBe(80);
    expect(position.maxHeight).toBe(220);
  });

  test('flips the menu above the trigger when there is not enough room below', () => {
    const position = getSlashMenuPosition({
      anchorRect: {
        top: 760,
        bottom: 784,
        left: 120,
      },
      menuSize: {
        width: 288,
        chromeHeight: 44,
        contentHeight: 220,
      },
      viewport: {
        width: 1280,
        height: 900,
      },
    });

    expect(position.placement).toBe('top');
    expect(position.top).toBe(488);
    expect(position.left).toBe(120);
    expect(position.maxHeight).toBe(220);
  });

  test('clamps horizontal and vertical position into the viewport', () => {
    const position = getSlashMenuPosition({
      anchorRect: {
        top: 780,
        bottom: 804,
        left: 1180,
      },
      menuSize: {
        width: 320,
        chromeHeight: 44,
        contentHeight: 260,
      },
      viewport: {
        width: 1280,
        height: 900,
      },
    });

    expect(position.left).toBe(944);
    expect(position.top).toBe(468);
    expect(position.placement).toBe('top');
  });

  test('shrinks the scrollable list height when space is constrained', () => {
    const position = getSlashMenuPosition({
      anchorRect: {
        top: 250,
        bottom: 274,
        left: 24,
      },
      menuSize: {
        width: 288,
        chromeHeight: 44,
        contentHeight: 320,
      },
      viewport: {
        width: 600,
        height: 420,
      },
    });

    expect(position.placement).toBe('top');
    expect(position.maxHeight).toBe(182);
    expect(position.left).toBe(24);
    expect(position.top).toBe(16);
  });
});
