import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
} from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import {
  Code2,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Library,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table2,
  Video,
} from 'lucide-react';

type SlashCommandHandler = (props: { editor: Editor; range: Range }) => void;

export interface SlashCommandItem {
  title: string;
  keywords: string[];
  icon: React.ReactNode;
  command: SlashCommandHandler;
}

export interface SlashCommandsOptions {
  items: SlashCommandItem[];
}

type SlashMenuProps = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  listMaxHeight?: number;
};

type SlashMenuRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

const DEFAULT_ITEMS: SlashCommandItem[] = [
  {
    title: 'Text',
    keywords: ['paragraph', 'text'],
    icon: <Pilcrow className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Heading 1',
    keywords: ['h1', 'title', 'heading'],
    icon: <Heading1 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    keywords: ['h2', 'subtitle', 'heading'],
    icon: <Heading2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    keywords: ['h3', 'subheading', 'heading'],
    icon: <Heading3 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Bulleted List',
    keywords: ['list', 'bullet', 'ul'],
    icon: <List className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    keywords: ['list', 'ordered', 'ol', 'numbered'],
    icon: <ListOrdered className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Blockquote',
    keywords: ['quote', 'blockquote'],
    icon: <Quote className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Code Block',
    keywords: ['code', 'snippet', 'pre'],
    icon: <Code2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Divider',
    keywords: ['divider', 'hr', 'rule'],
    icon: <Minus className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Table',
    keywords: ['table', 'grid'],
    icon: <Table2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: 'Collection View',
    keywords: ['collection', 'posts', 'listing'],
    icon: <Library className="h-4 w-4" />,
    command: () => {},
  },
  {
    title: '3 Columns',
    keywords: ['columns', 'layout'],
    icon: <Columns3 className="h-4 w-4" />,
    command: () => {},
  },
  {
    title: 'Upload Image',
    keywords: ['image', 'photo', 'upload'],
    icon: <ImageIcon className="h-4 w-4" />,
    command: () => {},
  },
  {
    title: 'Image by URL',
    keywords: ['image', 'url', 'photo'],
    icon: <ImageIcon className="h-4 w-4" />,
    command: () => {},
  },
  {
    title: 'Upload Video',
    keywords: ['video', 'upload'],
    icon: <Video className="h-4 w-4" />,
    command: () => {},
  },
  {
    title: 'Video by URL',
    keywords: ['video', 'url', 'embed'],
    icon: <Video className="h-4 w-4" />,
    command: () => {},
  },
];

const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(function SlashMenu(
  { items, command, listMaxHeight },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = (index: number) => {
    const item = items[index];

    if (item) {
      command(item);
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((selectedIndex + items.length - 1) % items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((selectedIndex + 1) % items.length);
        return true;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-xl border bg-popover p-2 text-sm text-muted-foreground shadow-xl">
        No results
      </div>
    );
  }

  return (
    <div className="w-72 overflow-hidden rounded-xl border bg-popover p-2 shadow-xl">
      <div className="mb-1 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Insert
      </div>
      <div
        data-slash-menu-list="true"
        className="overflow-y-auto"
        style={listMaxHeight ? { maxHeight: `${listMaxHeight}px` } : undefined}
      >
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
              index === selectedIndex ? 'bg-accent text-accent-foreground' : 'text-foreground'
            }`}
            onMouseDown={(event) => {
              event.preventDefault();
              selectItem(index);
            }}
          >
            <span className="text-muted-foreground">{item.icon}</span>
            <span>{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

const SLASH_MENU_GAP = 8;
const SLASH_MENU_MARGIN = 16;
const SLASH_MENU_FALLBACK_WIDTH = 288;
const SLASH_MENU_CHROME_HEIGHT = 44;
const SLASH_MENU_MAX_LIST_HEIGHT = 320;

interface SlashMenuPositionInput {
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

interface SlashMenuAnchorInput {
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

function buildSuggestionRenderer() {
  let component: ReactRenderer<SlashMenuRef, SlashMenuProps> | null = null;

  const updatePosition = (props: Parameters<NonNullable<ReturnType<NonNullable<SuggestionOptions<SlashCommandItem>['render']>>['onStart']>>[0]) => {
    const rect = getSlashMenuAnchorRect({
      editor: props.editor,
      range: props.range,
      clientRect: props.clientRect,
    });

    if (!component || !rect) {
      return;
    }

    const menuRect = component.element.getBoundingClientRect();
    const listElement = component.element.querySelector<HTMLElement>('[data-slash-menu-list="true"]');
    const chromeHeight = Math.max(
      SLASH_MENU_CHROME_HEIGHT,
      menuRect.height - (listElement?.clientHeight ?? 0),
    );
    const position = getSlashMenuPosition({
      anchorRect: rect,
      menuSize: {
        width: menuRect.width,
        chromeHeight,
        contentHeight: listElement?.scrollHeight ?? Math.max(0, menuRect.height - chromeHeight),
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    });

    component.updateProps({
      items: props.items,
      command: props.command,
      listMaxHeight: position.maxHeight,
    });
    component.element.style.position = 'fixed';
    component.element.style.left = `${position.left}px`;
    component.element.style.top = `${position.top}px`;
    component.element.style.zIndex = '80';
  };

  return {
    onStart: (props: Parameters<NonNullable<ReturnType<NonNullable<SuggestionOptions<SlashCommandItem>['render']>>['onStart']>>[0]) => {
      component = new ReactRenderer(SlashMenu, {
        editor: props.editor,
        props: {
          items: props.items,
          command: props.command,
          listMaxHeight: 320,
        },
      });

      document.body.appendChild(component.element);
      updatePosition(props);
    },

    onUpdate: (props: Parameters<NonNullable<ReturnType<NonNullable<SuggestionOptions<SlashCommandItem>['render']>>['onUpdate']>>[0]) => {
      component?.updateProps({
        items: props.items,
        command: props.command,
      });
      updatePosition(props);
    },

    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === 'Escape') {
        component?.destroy();
        component = null;
        return true;
      }

      return component?.ref?.onKeyDown(props) ?? false;
    },

    onExit: () => {
      component?.destroy();
      component = null;
    },
  };
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    slashCommands: {
      openSlashMenu: () => ReturnType;
    };
  }
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      items: [],
    };
  },

  addCommands() {
    return {
      openSlashMenu:
        () =>
        ({ commands }) =>
          commands.insertContent('/'),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: '/',
        startOfLine: true,
        allowSpaces: true,
        items: ({ query }) => {
          const mergedItems = new Map(
            DEFAULT_ITEMS.map((item) => [item.title, item]),
          );

          for (const item of this.options.items) {
            mergedItems.set(item.title, item);
          }

          const normalizedQuery = query.trim().toLowerCase();

          return Array.from(mergedItems.values()).filter((item) => {
            if (!normalizedQuery) {
              return true;
            }

            return (
              item.title.toLowerCase().includes(normalizedQuery) ||
              item.keywords.some((keyword) =>
                keyword.toLowerCase().includes(normalizedQuery),
              )
            );
          });
        },
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        render: buildSuggestionRenderer,
      }),
    ];
  },
});
