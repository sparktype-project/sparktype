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
  { items, command },
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
      <div className="max-h-80 overflow-y-auto">
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

function buildSuggestionRenderer() {
  let component: ReactRenderer<SlashMenuRef, SlashMenuProps> | null = null;

  const updatePosition = (props: Parameters<NonNullable<ReturnType<NonNullable<SuggestionOptions<SlashCommandItem>['render']>>['onStart']>>[0]) => {
    const rect = props.clientRect?.();

    if (!component || !rect) {
      return;
    }

    component.element.style.position = 'fixed';
    component.element.style.left = `${rect.left}px`;
    component.element.style.top = `${rect.bottom + 8}px`;
    component.element.style.zIndex = '60';
  };

  return {
    onStart: (props: Parameters<NonNullable<ReturnType<NonNullable<SuggestionOptions<SlashCommandItem>['render']>>['onStart']>>[0]) => {
      component = new ReactRenderer(SlashMenu, {
        editor: props.editor,
        props: {
          items: props.items,
          command: props.command,
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
