import { useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import type { Value } from 'platejs';

import { BasicNodesKit } from '@/components/editor/plugins/basic-nodes-kit';

import {
  Plate,
  usePlateEditor,
} from 'platejs/react';
import { EditorKit } from '@/components/editor/editor-kit';

import { Editor, EditorContainer } from '@/components/ui/editor';
import { FloatingToolbar } from '@/components/ui/floating-toolbar';
import { FloatingToolbarButtons } from '@/components/ui/floating-toolbar-buttons';

import { MarkdownKit } from '@/components/editor/plugins/markdown-kit';
import { ExitBreakKit } from '@/components/editor/plugins/exit-break-kit';
import { AutoformatKit } from '@/components/editor/plugins/autoformat-kit';
import { BlockSelectionKit } from '@/components/editor/plugins/block-selection-kit';
import { SlashKit } from '@/components/editor/plugins/slash-kit';
import { DndKit } from '@/components/editor/plugins/dnd-kit';
import { LinkKit } from '@/components/editor/plugins/link-kit';
import { ColumnKit } from '@/components/editor/plugins/column-kit';
import { FloatingToolbarKit } from '@/components/editor/plugins/floating-toolbar-kit';
import { CursorOverlayKit } from '@/components/editor/plugins/cursor-overlay-kit';
import { createSparkTypeMediaKit } from '@/components/editor/plugins/sparktype-media-kit';
import { createCollectionViewKit } from '@/components/editor/plugins/collection-view-kit';

interface PlateEditorProps {
  initialValue?: Value;
  onContentChange?: (content: Value) => void;
  placeholder?: string;
  className?: string;
  siteId?: string;
  collections?: Array<{ id: string; name: string }>;
}

// Export the ref type for external use
export type PlateEditorRef = {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
};

const defaultInitialValue: Value = [
  {
    children: [{ text: '' }],
    type: 'p',
  },
];

export const PlateEditor = forwardRef<PlateEditorRef, PlateEditorProps>(({ 
  initialValue = defaultInitialValue, 
  onContentChange, 
  placeholder = "Start writing...",
  className = "",
  siteId,
  collections = []
}, ref) => {

  // Create SparkType MediaKit with siteId if available, otherwise use empty array
  const sparkTypeMediaKit = useMemo(() => {
    return siteId ? createSparkTypeMediaKit(siteId) : [];
  }, [siteId]);

  // Create CollectionViewKit with collections data
  const collectionViewKit = useMemo(() => {
    return createCollectionViewKit(collections);
  }, [collections]);

  const editor = usePlateEditor({
    plugins: [
      // Basic nodes (paragraphs, headings, etc.)
      ...EditorKit,
      ...BasicNodesKit,
      
      // Core functionality
      ...(siteId ? [] : MarkdownKit), // MarkdownKit is included in sparkTypeMediaKit when siteId is available
      ...ExitBreakKit,
      ...AutoformatKit,
      ...BlockSelectionKit,
      ...SlashKit,
      ...DndKit,
      ...LinkKit,
      ...ColumnKit,
      ...FloatingToolbarKit,
      ...CursorOverlayKit,
      ...sparkTypeMediaKit,
      ...collectionViewKit,
    ],
    value: initialValue,
  });


  // Set up change listener - use the onChange prop from Plate component instead
  const handlePlateChange = useCallback(({ value }: { value: Value }) => {
    if (onContentChange) {
      onContentChange(value);
    }
  }, [onContentChange]);

  // Method to get current content as markdown
  const getMarkdown = useCallback(() => {
    if (editor?.api?.markdown) {
      const serialized = editor.api.markdown.serialize();
      console.log('PlateJS getMarkdown serialized:', serialized);
      return serialized;
    }
    return '';
  }, [editor]);

  // Method to set content from markdown
  const setMarkdown = useCallback((markdown: string) => {
    if (editor?.api?.markdown) {
      const plateValue = editor.api.markdown.deserialize(markdown);
      editor.tf.setValue(plateValue);
    }
  }, [editor]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getMarkdown,
    setMarkdown,
  }), [getMarkdown, setMarkdown]);

  return (
    <div className={className}>
      <Plate editor={editor} onChange={handlePlateChange}>
       
        <EditorContainer>
          <Editor placeholder={placeholder} />
        </EditorContainer>
        <FloatingToolbar>
        <FloatingToolbarButtons />
      </FloatingToolbar>
      </Plate>
    </div>
  );
});