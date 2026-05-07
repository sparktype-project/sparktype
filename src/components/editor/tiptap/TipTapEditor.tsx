import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import FileHandler from '@tiptap/extension-file-handler';
import { common, createLowlight } from 'lowlight';
import { Columns3, Image as ImageIcon, Library, Link2, Quote, Video } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Input } from '@/core/components/ui/input';
import { useSparkTypeUpload } from '@/hooks/use-sparktype-upload';
import { useEditor as useSparkEditorContext } from '@/features/editor/contexts/useEditor';
import { useAppStore } from '@/core/state/useAppStore';
import { getActiveImageService } from '@/core/services/images/images.service';
import type { ImageRef, VideoRef } from '@/core/types';
import { CollectionView } from './extensions/CollectionView';
import { Column, ColumnGroup } from './extensions/Columns';
import { MediaEmbed } from './extensions/MediaEmbed';
import { SlashCommands, type SlashCommandItem } from './extensions/SlashCommands';
import { SparktypeImage } from './extensions/SparktypeImage';
import { SparktypeVideo } from './extensions/SparktypeVideo';
import { MEDIA_TYPES, NODE_NAMES } from './constants';
import {
  createInsertedImageContent,
  insertProviderImage,
  type ProviderImageInsertService,
  usesProviderImageInsert,
} from './imageInsert';
import { PasteMarkdown } from './paste';
import {
  DEFAULT_COLLECTION_VIEW_ATTRS,
  getEmbedProvider,
  getEmbedSrc,
  isDirectVideoUrl,
  isValidUrl,
} from './helpers';

const lowlight = createLowlight(common);

interface CollectionDefinition {
  id: string;
  name: string;
}

export type PlateEditorRef = {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  initializeWithContent: (markdown: string) => void;
};

interface PlateEditorProps {
  onContentChange?: () => void;
  placeholder?: string;
  className?: string;
  siteId?: string;
  readOnly?: boolean;
  collections?: CollectionDefinition[];
}

type UrlDialogMode = 'image' | 'video' | 'link' | null;

function ToolbarButton({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="h-8"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function UrlDialog({
  mode,
  editor,
  open,
  onOpenChange,
}: {
  mode: UrlDialogMode;
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) {
      setValue('');
    }
  }, [open]);

  const title = mode === 'image' ? 'Insert image by URL' : mode === 'video' ? 'Insert video by URL' : 'Edit link';

  const handleSubmit = useCallback(() => {
    if (!mode) {
      return;
    }
    if (!isValidUrl(value)) {
      return;
    }

    if (mode === 'link') {
      editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
      onOpenChange(false);
      return;
    }

    if (mode === 'image') {
      editor.chain().focus().insertContent({
        type: NODE_NAMES.image,
        attrs: {
          src: value,
          alt: '',
          title: null,
          imageRef: null,
        },
      }).run();
      onOpenChange(false);
      return;
    }

    if (isDirectVideoUrl(value)) {
      editor.chain().focus().insertContent({
        type: NODE_NAMES.video,
        attrs: {
          src: value,
          poster: null,
          isUpload: false,
          videoRef: null,
        },
      }).run();
      onOpenChange(false);
      return;
    }

    editor.chain().focus().insertContent({
      type: NODE_NAMES.mediaEmbed,
      attrs: {
        url: value,
        embedSrc: getEmbedSrc(value),
        provider: getEmbedProvider(value),
      },
    }).run();
    onOpenChange(false);
  }, [editor, mode, onOpenChange, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          type="url"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const TipTapEditor = forwardRef<PlateEditorRef, PlateEditorProps>(
  function TipTapEditor(
    {
      onContentChange,
      placeholder = "Start writing...",
      className = '',
      siteId,
      readOnly = false,
      collections = [],
    },
    ref,
  ) {
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const videoInputRef = useRef<HTMLInputElement | null>(null);
    const liveEditorRef = useRef<Editor | null>(null);
    const [urlDialogMode, setUrlDialogMode] = useState<UrlDialogMode>(null);
    const { beginProviderUpload, endProviderUpload } = useSparkEditorContext();
    const site = useAppStore((state) => (siteId ? state.getSiteById(siteId) : undefined));
    const activeImageService = useMemo(
      () => (site?.manifest ? getActiveImageService(site.manifest) : undefined),
      [site],
    );

    const { uploadFile: uploadImageFile } = useSparkTypeUpload({
      siteId: siteId ?? '',
      mediaType: MEDIA_TYPES.image,
    });
    const { uploadFile: uploadVideoFile } = useSparkTypeUpload({
      siteId: siteId ?? '',
      mediaType: MEDIA_TYPES.video,
    });

    const createCollectionViewContent = useCallback(
      () => ({
        type: NODE_NAMES.collectionView,
        attrs: DEFAULT_COLLECTION_VIEW_ATTRS,
      }),
      [],
    );

    const createThreeColumnContent = useCallback(
      () => ({
        type: NODE_NAMES.columnGroup,
        content: Array.from({ length: 3 }, () => ({
          type: NODE_NAMES.column,
          content: [{ type: 'paragraph' }],
        })),
      }),
      [],
    );

    const handleFileInsert = useCallback(async (files: File[]) => {
      const currentEditor = liveEditorRef.current;
      if (!currentEditor || !siteId || files.length === 0) {
        return;
      }

      for (const file of files) {
        beginProviderUpload();
        try {
          if (file.type.startsWith('image/')) {
            const uploaded = await uploadImageFile(file);
            if (uploaded) {
              currentEditor
                .chain()
                .focus()
                .insertContent({
                  type: NODE_NAMES.image,
                  attrs: {
                    src: uploaded.url,
                    alt: (uploaded.mediaRef as ImageRef).alt || file.name,
                    title: null,
                    imageRef: uploaded.mediaRef as ImageRef,
                  },
                })
                .run();
            }
          } else if (file.type.startsWith('video/')) {
            const uploaded = await uploadVideoFile(file);
            if (uploaded) {
              currentEditor
                .chain()
                .focus()
                .insertContent({
                  type: NODE_NAMES.video,
                  attrs: {
                    src: uploaded.url,
                    poster: (uploaded.mediaRef as VideoRef).poster ?? null,
                    isUpload: true,
                    videoRef: uploaded.mediaRef as VideoRef,
                  },
                })
                .run();
            }
          }
        } finally {
          endProviderUpload();
        }
      }
    }, [beginProviderUpload, endProviderUpload, siteId, uploadImageFile, uploadVideoFile]);

    const handleImageInsertRequest = useCallback(async () => {
      if (usesProviderImageInsert(activeImageService) && siteId && site) {
        await insertProviderImage({
          siteId,
          site,
          service: activeImageService as ProviderImageInsertService,
          beginProviderUpload,
          endProviderUpload,
          insertImage: (attrs) => {
            const currentEditor = liveEditorRef.current;
            if (!currentEditor) {
              return;
            }

            currentEditor.chain().focus().insertContent(createInsertedImageContent(attrs)).run();
          },
        });
        return;
      }

      requestAnimationFrame(() => imageInputRef.current?.click());
    }, [activeImageService, beginProviderUpload, endProviderUpload, site, siteId]);

    const slashItems = useMemo<SlashCommandItem[]>(
      () => [
        {
          title: 'Collection View',
          keywords: ['collection', 'posts', 'listing'],
          icon: <Library className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(createCollectionViewContent())
              .run();
          },
        },
        {
          title: '3 Columns',
          keywords: ['columns', 'layout'],
          icon: <Columns3 className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(createThreeColumnContent())
              .run();
          },
        },
        {
          title: 'Upload Image',
          keywords: ['image', 'photo', 'upload'],
          icon: <ImageIcon className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            void handleImageInsertRequest();
          },
        },
        {
          title: 'Image by URL',
          keywords: ['image', 'photo', 'url'],
          icon: <ImageIcon className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            setUrlDialogMode('image');
          },
        },
        {
          title: 'Upload Video',
          keywords: ['video', 'upload'],
          icon: <Video className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            requestAnimationFrame(() => videoInputRef.current?.click());
          },
        },
        {
          title: 'Video by URL',
          keywords: ['video', 'url', 'embed'],
          icon: <Video className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            setUrlDialogMode('video');
          },
        },
      ],
      [createCollectionViewContent, createThreeColumnContent, handleImageInsertRequest],
    );

    const extensions = useMemo(
      () => [
        StarterKit.configure({
          codeBlock: false,
          link: false,
          underline: false,
        }),
        Markdown,
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableCell,
        TableHeader,
        Placeholder.configure({
          placeholder: placeholder || "Type '/' for commands...",
        }),
        CharacterCount,
        CodeBlockLowlight.configure({
          lowlight,
        }),
        FileHandler.configure({
          allowedMimeTypes: ['image/*', 'video/*'],
          onPaste: (_editor, files) => {
            void handleFileInsert(files);
          },
          onDrop: (_editor, files) => {
            void handleFileInsert(files);
          },
        }),
        PasteMarkdown,
        SlashCommands.configure({
          items: slashItems,
        }),
        SparktypeImage.configure({
          siteId,
        }),
        SparktypeVideo,
        MediaEmbed,
        CollectionView.configure({
          collections,
        }),
        Column,
        ColumnGroup,
      ],
      [collections, handleFileInsert, placeholder, siteId, slashItems],
    );

    const editor = useEditor({
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editable: !readOnly,
      content: '',
      contentType: 'markdown',
      extensions,
      onUpdate: ({ editor: nextEditor }) => {
        onContentChange?.();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('editor-content-changed', {
              detail: { markdown: nextEditor.getMarkdown() },
            }),
          );
        }
      },
    });

    useEffect(() => {
      liveEditorRef.current = editor;
      return () => {
        liveEditorRef.current = null;
      };
    }, [editor]);

    useEffect(() => {
      if (editor) {
        editor.setEditable(!readOnly, false);
      }
    }, [editor, readOnly]);

    const getMarkdown = useCallback(() => editor?.getMarkdown() ?? '', [editor]);

    const setMarkdown = useCallback((markdown: string) => {
      if (!editor) {
        return;
      }

      editor.commands.setContent(markdown, {
        contentType: 'markdown',
        emitUpdate: false,
      });
    }, [editor]);

    const initializeWithContent = useCallback((markdown: string) => {
      if (!editor) {
        return;
      }

      editor.commands.setContent(markdown, {
        contentType: 'markdown',
        emitUpdate: false,
      });
    }, [editor]);

    useImperativeHandle(
      ref,
      () => ({
        getMarkdown,
        setMarkdown,
        initializeWithContent,
      }),
      [getMarkdown, initializeWithContent, setMarkdown],
    );

    if (!editor) {
      return null;
    }

    return (
      <div className={className}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void handleFileInsert(files);
            event.currentTarget.value = '';
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void handleFileInsert(files);
            event.currentTarget.value = '';
          }}
        />

        {readOnly ? null : (
          <BubbleMenu editor={editor} className="rounded-md border bg-background p-1 shadow-sm">
            <div className="flex items-center gap-1">
              <ToolbarButton active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
                P
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                H1
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                H2
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                H3
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
                B
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
                I
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                U
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
                S
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
                {'</>'}
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <Quote className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton active={editor.isActive('link')} onClick={() => setUrlDialogMode('link')}>
                <Link2 className="h-4 w-4" />
              </ToolbarButton>
              {editor.isActive('link') ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().unsetLink().run()}>
                  Remove
                </Button>
              ) : null}
            </div>
          </BubbleMenu>
        )}

        <div className="rounded-lg border bg-background px-4 py-5">
          <EditorContent editor={editor} className="min-h-[420px] outline-none [&_.ProseMirror]:min-h-[420px] [&_.ProseMirror]:outline-none" />
        </div>

        <UrlDialog
          mode={urlDialogMode}
          editor={editor}
          open={urlDialogMode !== null}
          onOpenChange={(open) => {
            if (!open) {
              setUrlDialogMode(null);
            }
          }}
        />
      </div>
    );
  },
);
