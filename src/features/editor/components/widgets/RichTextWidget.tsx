// src/features/editor/components/widgets/RichTextWidget.tsx

import { useRef, useEffect } from 'react';
import type { WidgetProps } from '@rjsf/utils';
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

export default function RichTextWidget(props: WidgetProps) {
  const { id, label, value, onChange, options, schema } = props;
  const editorRef = useRef<MDXEditorMethods>(null);
  
  // Get options from uiSchema
  const uiOptions = options.uiOptions || {};
  const placeholder = uiOptions.placeholder || schema.description || 'Start writing...';
  const rows = uiOptions.rows || 10;

  // Handle content changes
  const handleContentChange = (markdown: string) => {
    onChange(markdown);
  };

  // Set initial content when editor is ready
  useEffect(() => {
    if (editorRef.current && typeof value === 'string') {
      // Only set if the content is different to avoid cursor jumping
      const currentContent = editorRef.current.getMarkdown();
      if (currentContent !== value) {
        editorRef.current.setMarkdown(value || '');
      }
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      
      <div 
        className="border rounded-md overflow-hidden"
        style={{ minHeight: `${Math.max(rows * 1.5, 10)}rem` }}
      >
        <MDXEditor
          ref={editorRef}
          markdown={value || ''}
          onChange={handleContentChange}
          placeholder={placeholder}
          plugins={[
            // Core editing plugins
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            
            // Link support
            linkPlugin(),
            linkDialogPlugin(),
            
            // Rich content
            imagePlugin({
              imageUploadHandler: async () => {
                // For now, return a placeholder
                // This could be enhanced to integrate with the image service
                return '/placeholder-image.jpg';
              }
            }),
            tablePlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: 'text' }),
            
            // Toolbar
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
        />
      </div>
      
      {schema.description && (
        <p className="text-sm text-muted-foreground">{schema.description}</p>
      )}
    </div>
  );
}