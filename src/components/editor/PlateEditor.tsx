import { useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';

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

import { createSparkTypeMediaKit } from '@/components/editor/plugins/sparktype-media-kit';
import { createCollectionViewKit } from '@/components/editor/plugins/collection-view-kit';

interface PlateEditorProps {
  onContentChange?: () => void;
  placeholder?: string;
  className?: string;
  siteId?: string;
  collections?: Array<{ id: string; name: string }>;
  ready?: boolean;
}

// Export the ref type for external use
export type PlateEditorRef = {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  initializeWithContent: (markdown: string) => void;
};


export const PlateEditor = forwardRef<PlateEditorRef, PlateEditorProps>(({
  onContentChange,
  placeholder = "Start writing...",
  className = "",
  siteId,
  collections = [],
  ready = false
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

      ...sparkTypeMediaKit,
      ...collectionViewKit,
    ],
    skipInitialization: true, // Don't initialize immediately
  });


  // Set up change listener - simplified since we don't need the value
  const handlePlateChange = useCallback(() => {
    if (onContentChange) {
      onContentChange();
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

  // Method to set content from markdown (deprecated, use initializeWithContent instead)
  const setMarkdown = useCallback((markdown: string) => {
    if (editor?.api?.markdown) {
      const plateValue = editor.api.markdown.deserialize(markdown);
      editor.tf.setValue(plateValue);
    }
  }, [editor]);

  // Method to initialize editor with content using proper PlateJS pattern
  const initializeWithContent = useCallback((markdown: string) => {
    if (editor?.api?.markdown) {
      const plateValue = editor.api.markdown.deserialize(markdown);
      editor.tf.init({
        value: plateValue,
        autoSelect: 'end'
      });
      console.log('PlateJS initialized with content length:', markdown.length);
    }
  }, [editor]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getMarkdown,
    setMarkdown,
    initializeWithContent,
  }), [getMarkdown, setMarkdown, initializeWithContent]);

  // Show loading state until editor is ready
  if (!ready) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          Loading editor...
        </div>
      </div>
    );
  }

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