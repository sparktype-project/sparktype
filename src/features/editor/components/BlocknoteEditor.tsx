// src/features/editor/components/BlocknoteEditor.tsx
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { 
  MDXEditor, 
  type MDXEditorMethods, 
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  Separator,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { Label } from '@/core/components/ui/label';

interface BlocknoteEditorProps {
  initialContent: string; // Changed from Block[] to string for markdown
  onContentChange: () => void; // Only needs to signal a change, not pass content
}

// The ref will now expose a function to get the editor's markdown data.
export interface BlocknoteEditorRef {
  getBlocks: () => string; // Changed to return markdown string
}

const BlocknoteEditor = forwardRef<BlocknoteEditorRef, BlocknoteEditorProps>(
  ({ initialContent, onContentChange }, ref) => {
    const editorRef = useRef<MDXEditorMethods>(null);

    // Expose a function for the parent component to get the current content.
    useImperativeHandle(ref, () => ({
      getBlocks: () => {
        return editorRef.current?.getMarkdown() || '';
      },
    }));

    return (
      <div className="space-y-2 h-full flex flex-col">
        <Label htmlFor="content-body" className="text-[10px] font-medium uppercase text-gray-400 shrink-0">
          Content
        </Label>
        <div className="flex-grow min-h-0 overflow-hidden border">
          <MDXEditor
            ref={editorRef}
            markdown={initialContent || ''}
            onChange={onContentChange}
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              linkPlugin(),
              linkDialogPlugin(),
              imagePlugin({
                imageUploadHandler: async () => {
                  // Placeholder - you can implement actual image upload later
                  return 'https://via.placeholder.com/300x200';
                },
              }),
              tablePlugin(),
              codeBlockPlugin({ defaultCodeBlockLanguage: 'js' }),
              toolbarPlugin({
                toolbarContents: () => (
                  <>
                    <UndoRedo />
                    <Separator />
                    <BoldItalicUnderlineToggles />
                    <Separator />
                    <BlockTypeSelect />
                    <Separator />
                    <CreateLink />
                    <InsertImage />
                    <Separator />
                    <ListsToggle />
                    <Separator />
                    <InsertTable />
                    <InsertThematicBreak />
                  </>
                )
              })
            ]}
            className="h-full"
          />
        </div>
      </div>
    );
  }
);

BlocknoteEditor.displayName = 'BlocknoteEditor';
export default BlocknoteEditor;