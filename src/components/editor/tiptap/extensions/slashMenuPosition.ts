// src/components/editor/tiptap/extensions/slashMenuPosition.ts

/**
 * Placement geometry for the slash-command menu.
 *
 * This lives in its own module because `SlashCommands.tsx` exports a component, and React
 * Fast Refresh only works when such a module exports components and nothing else. Keeping the
 * pure geometry separate also makes it testable without mounting TipTap.
 */

import type { Editor, Range } from '@tiptap/core';

const SLASH_MENU_GAP = 8;
const SLASH_MENU_MARGIN = 16;
const SLASH_MENU_FALLBACK_WIDTH = 288;
export const SLASH_MENU_CHROME_HEIGHT = 44;
const SLASH_MENU_MAX_LIST_HEIGHT = 320;

export interface SlashMenuPositionInput {
  anchorRect: Pick<DOMRect, 'bottom' | 'left' | 'top'>;
  menuSize: {
    width: number;
    chromeHeight: number;
    contentHeight: number;
  };
  viewport: {
    width: number;
    height: number;
  };
}

export interface SlashMenuAnchorInput {
  editor: Editor;
  range: Range;
  clientRect?: (() => DOMRect | null) | null;
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getSlashMenuAnchorRect({
  editor,
  range,
  clientRect,
}: SlashMenuAnchorInput): Pick<DOMRect, 'bottom' | 'left' | 'top'> | null {
  try {
    const coords = editor.view.coordsAtPos(range.from);
    if (
      isFiniteCoordinate(coords.left) &&
      isFiniteCoordinate(coords.top) &&
      isFiniteCoordinate(coords.bottom)
    ) {
      return {
        left: coords.left,
        top: coords.top,
        bottom: coords.bottom,
      };
    }
  } catch {
    // Fall back to the suggestion rect if the current position is unavailable.
  }

  const rect = clientRect?.();
  if (
    rect &&
    isFiniteCoordinate(rect.left) &&
    isFiniteCoordinate(rect.top) &&
    isFiniteCoordinate(rect.bottom)
  ) {
    return rect;
  }

  return null;
}

export function getSlashMenuPosition({
  anchorRect,
  menuSize,
  viewport,
}: SlashMenuPositionInput) {
  const menuWidth = menuSize.width || SLASH_MENU_FALLBACK_WIDTH;
  const spaceAbove = anchorRect.top - SLASH_MENU_MARGIN;
  const spaceBelow = viewport.height - anchorRect.bottom - SLASH_MENU_MARGIN;
  const chromeHeight = menuSize.chromeHeight || SLASH_MENU_CHROME_HEIGHT;
  const desiredListHeight = Math.min(
    Math.max(0, menuSize.contentHeight),
    SLASH_MENU_MAX_LIST_HEIGHT,
  );
  const desiredMenuHeight = chromeHeight + desiredListHeight;

  const canFitBelow = spaceBelow >= desiredMenuHeight + SLASH_MENU_GAP;
  const canFitAbove = spaceAbove >= desiredMenuHeight + SLASH_MENU_GAP;
  const shouldPlaceAbove = !canFitBelow && (canFitAbove || spaceAbove > spaceBelow);

  const availableHeight = shouldPlaceAbove ? spaceAbove : spaceBelow;
  const maxListHeight = Math.max(
    0,
    Math.min(
      desiredListHeight,
      availableHeight - SLASH_MENU_GAP - chromeHeight,
    ),
  );
  const effectiveMenuHeight = chromeHeight + maxListHeight;

  const unclampedTop = shouldPlaceAbove
    ? anchorRect.top - effectiveMenuHeight - SLASH_MENU_GAP
    : anchorRect.bottom + SLASH_MENU_GAP;

  const top = Math.min(
    Math.max(unclampedTop, SLASH_MENU_MARGIN),
    Math.max(SLASH_MENU_MARGIN, viewport.height - effectiveMenuHeight - SLASH_MENU_MARGIN),
  );

  const left = Math.min(
    Math.max(anchorRect.left, SLASH_MENU_MARGIN),
    Math.max(SLASH_MENU_MARGIN, viewport.width - menuWidth - SLASH_MENU_MARGIN),
  );

  return {
    left,
    maxHeight: maxListHeight,
    placement: shouldPlaceAbove ? 'top' : 'bottom',
    top,
  } as const;
}
