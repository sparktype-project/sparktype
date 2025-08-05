// src/features/editor/components/Editor.tsx
import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { BlockNoteSchema, filterSuggestionItems } from '@blocknote/core';
import type { Block } from '@blocknote/core';
import { 
  useCreateBlockNote, 
  SuggestionMenuController
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import '../styles/sparktype-blocks.css';
import { Label } from '@/core/components/ui/label';
import { SparktypeSchemaService } from '../services/sparktypeSchema.service';
import { SparktypeBlockProvider } from '../contexts/SparktypeBlockContext';
import { getCustomSlashMenuItems } from '../services/sparktypeMenuItems.service';
import type { LocalSiteData, ParsedMarkdownFile } from '@/core/types';

interface BlocknoteEditorProps {
  initialContent: Block[];
  onContentChange: () => void; // Only needs to signal a change, not pass content
  siteData?: LocalSiteData | null;
  currentPage?: ParsedMarkdownFile | null;
  siteId?: string;
  filePath?: string;
}

// The ref will now expose a function to get the editor's block data.
export interface BlocknoteEditorRef {
  getBlocks: () => Block[];
}

// Custom hook to manage schema loading
function useEditorSchema(siteData?: LocalSiteData | null) {
  const [schema, setSchema] = useState<BlockNoteSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSchema = async () => {
      try {
        setIsLoading(true);
        const dynamicSchema = await SparktypeSchemaService.getSchema(siteData || undefined);
        setSchema(dynamicSchema);
        console.log('BlockNote schema loaded with Sparktype blocks');
        console.log('Schema block specs:', Object.keys(dynamicSchema.blockSpecs));
      } catch (error) {
        console.error('Failed to load BlockNote schema:', error);
        // Fallback to default schema
        const fallbackSchema = BlockNoteSchema.create();
        setSchema(fallbackSchema);
      } finally {
        setIsLoading(false);
      }
    };

    loadSchema();
  }, [siteData]);

  return { schema, isLoading };
}

const BlocknoteEditor = forwardRef<BlocknoteEditorRef, BlocknoteEditorProps>(
  ({ initialContent, onContentChange, siteData, currentPage, siteId, filePath }, ref) => {
    // Debug re-renders
    console.log('🔄 BlocknoteEditor render triggered:', {
      initialContentLength: initialContent.length,
      siteDataId: siteData?.siteId,
      siteId,
      filePath,
      timestamp: Date.now()
    });
    
    const { schema, isLoading } = useEditorSchema(siteData);

    // Create editor with the loaded schema and initial content
    // Use a stable reference for initial content to prevent recreation
    const [stableInitialContent] = useState(() => initialContent);
    
    const editor = useCreateBlockNote({
      schema: schema || BlockNoteSchema.create(),
      initialContent: stableInitialContent.length > 0 ? stableInitialContent : undefined,
    }, [schema]); // Only recreate when schema changes
    
    // Handle content updates when switching files (but not on every save)
    useEffect(() => {
      if (editor && filePath && initialContent.length > 0 && initialContent !== stableInitialContent) {
        console.log('File changed, updating editor content:', filePath);
        try {
          editor.replaceBlocks(editor.document, initialContent);
          console.log('Successfully updated editor content for new file');
        } catch (error) {
          console.error('Failed to update editor content:', error);
        }
      }
    }, [filePath]); // Only trigger when filePath changes

    // Expose a function for the parent component to get the current content.
    useImperativeHandle(ref, () => ({
      getBlocks: () => {
        return editor.document;
      },
    }));

    // Log the editor's schema when it's created or updated
    useEffect(() => {
      if (editor && schema) {
        console.log('Editor created/updated. Editor schema blocks:', Object.keys(editor.schema.blockSpecs));
        console.log('Loaded schema blocks:', Object.keys(schema.blockSpecs));
        console.log('Schema objects match:', editor.schema === schema);
      }
    }, [editor, schema]);

    // Show loading state while schema is being loaded
    if (isLoading) {
      return (
        <div className="space-y-2 h-full flex flex-col">
          <Label htmlFor="content-body" className="text-[10px] font-medium uppercase text-gray-400 shrink-0">
            Content
          </Label>
          <div className="flex-grow min-h-0 overflow-y-auto border p-2 flex items-center justify-center">
            <div className="text-gray-500">Loading editor with Sparktype blocks...</div>
          </div>
        </div>
      );
    }

    const editorContent = (
      <div className="space-y-2 h-full flex flex-col">
        <Label htmlFor="content-body" className="text-[10px] font-medium uppercase text-gray-400 shrink-0">
          Content
        </Label>
        <div className="flex-grow min-h-0 overflow-y-auto border p-2">
          <BlockNoteView
            editor={editor}
            theme="light" // Or use a theme provider to make it dynamic
            onChange={onContentChange}
            slashMenu={false}
          >
            <SuggestionMenuController
              triggerCharacter={"/"}
              getItems={async (query) => {
                const customItems = await getCustomSlashMenuItems(editor, siteData);
                return filterSuggestionItems(customItems, query);
              }}
            />
          </BlockNoteView>
        </div>
      </div>
    );

    // Wrap with Sparktype context if site data is available
    if (siteData && siteId && filePath) {
      return (
        <SparktypeBlockProvider
          siteData={siteData}
          currentPage={currentPage || null}
          siteId={siteId}
          filePath={filePath}
        >
          {editorContent}
        </SparktypeBlockProvider>
      );
    }

    return editorContent;
  }
);

BlocknoteEditor.displayName = 'BlocknoteEditor';
export default BlocknoteEditor;