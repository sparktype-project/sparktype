// src/features/editor/components/BlocknoteEditor.tsx
import { forwardRef, useImperativeHandle } from 'react';
import type { Block } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { Label } from '@/core/components/ui/label';

interface BlocknoteEditorProps {
  initialContent: Block[];
  onContentChange: () => void; // Only needs to signal a change, not pass content
}

// The ref will now expose a function to get the editor's block data.
export interface BlocknoteEditorRef {
  getBlocks: () => Block[];
}

const BlocknoteEditor = forwardRef<BlocknoteEditorRef, BlocknoteEditorProps>(
  ({ initialContent, onContentChange }, ref) => {
    // Creates a new editor instance.
    const editor = useCreateBlockNote({
        initialContent: initialContent.length > 0 ? initialContent : undefined,
    });

    // Expose a function for the parent component to get the current content.
    useImperativeHandle(ref, () => ({
      getBlocks: () => {
        return editor.document;
      },
    }));

    return (
      <div className="space-y-2 h-full flex flex-col">
        <Label htmlFor="content-body" className="text-[10px] font-medium uppercase text-gray-400 shrink-0">
          Content
        </Label>
        <div className="flex-grow min-h-0 overflow-y-auto border p-2">
            <BlockNoteView
                editor={editor}
                theme="light" // Or use a theme provider to make it dynamic
                onChange={onContentChange}
            />
        </div>
      </div>
    );
  }
);

BlocknoteEditor.displayName = 'BlocknoteEditor';
export default BlocknoteEditor;