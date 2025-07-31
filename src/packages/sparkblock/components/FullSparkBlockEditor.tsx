// Full SparkBlock Editor - comprehensive block editing interface
import React, { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type {
  SparkBlock,
  SparkBlockAdapter,
} from '../types';
import { DefaultBlockRenderers } from './blocks/DefaultBlockRenderers';
import '../styles/sparkblock.css';

export interface FullSparkBlockEditorProps {
  adapter: SparkBlockAdapter<string> | null;
  value: string; // Current markdown content
  onChange: (markdown: string) => void; // Called when content changes
  readonly?: boolean;
}


// Icon mapping for different block types
const BLOCK_ICONS: Record<string, string> = {
  paragraph: '¶',
  heading_1: 'H1',
  heading_2: 'H2', 
  heading_3: 'H3',
  quote: '"',
  code: '</>',
  unordered_list: '•',
  ordered_list: '1.',
  divider: '—',
  image: '🖼️',
  container: '📦',
  collection_view: '📋',
};

/**
 * Full-featured SparkBlock editor with seamless typing experience,
 * block management, drag & drop, and slash commands.
 */
export function FullSparkBlockEditor({
  adapter,
  value,
  onChange,
  readonly = false,
}: FullSparkBlockEditorProps) {
  const [blocks, setBlocks] = useState<SparkBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [parseError, setParseError] = useState<Error | null>(null);
  const [availableBlocks, setAvailableBlocks] = useState<any[]>([]);
  // Simplified state - no complex synchronization needed
  
  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load available blocks from adapter
  useEffect(() => {
    const loadAvailableBlocks = async () => {
      if (!adapter) {
        setAvailableBlocks([]);
        return;
      }

      try {
        const blockDefinitions = await adapter.getAvailableBlocks();
        const blockOptions = blockDefinitions.map(def => ({
          id: def.id.replace('core:', ''),
          fullId: def.id,
          name: def.name,
          description: def.description || '',
          icon: BLOCK_ICONS[def.id.replace('core:', '')] || '■',
          category: def.category || 'Basic',
          keywords: def.keywords || []
        }));
        setAvailableBlocks(blockOptions);
      } catch (error) {
        console.error('Failed to load available blocks:', error);
        setAvailableBlocks([]);
      }
    };

    loadAvailableBlocks();
  }, [adapter]);

  // Parse markdown into blocks when value changes - SIMPLIFIED
  useEffect(() => {
    const parseMarkdown = async () => {
      if (!adapter || !value) {
        setBlocks([]);
        return;
      }

      // Only skip parsing if we're currently editing a block
      if (editingBlockId) {
        return;
      }

      try {
        const parsedBlocks = await adapter.parse(value);
        setBlocks(parsedBlocks);
      } catch (error) {
        console.error('Failed to parse markdown:', error);
        setParseError(error as Error);
        setBlocks([]);
      }
    };

    parseMarkdown();
  }, [adapter, value, editingBlockId]);

  // Update markdown directly - SIMPLIFIED
  const updateMarkdownContent = useCallback((newMarkdown: string) => {
    onChange(newMarkdown);
  }, [onChange]);

  // Use adapter's block type detection instead of regex patterns
  const detectBlockType = useCallback(async (text: string): Promise<SparkBlock | null> => {
    if (!adapter || !text.trim()) return null;
    
    // Use the adapter's built-in detection
    const detection = adapter.detectBlockType(text);
    if (detection) {
      // Create block using the adapter's createBlock method with cleaned text
      const blockType = detection.blockId;
      const initialContent = detection.cleanText ? { text: detection.cleanText } : {};
      
      try {
        const block = await adapter.createBlock(blockType, initialContent);
        return block;
      } catch (error) {
        console.error('Failed to create detected block:', error);
      }
    }
    
    // Fallback: create paragraph block
    try {
      return await adapter.createBlock('core:paragraph', { text });
    } catch (error) {
      console.error('Failed to create fallback paragraph:', error);
      return null;
    }
  }, [adapter]);

  // Handle Enter key - convert current input to block
  const handleEnterKey = useCallback(async (text: string) => {
    if (!text.trim() || !adapter) return;

    const newBlock = await detectBlockType(text);
    if (!newBlock) return;

    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    
    // Serialize and update markdown directly
    try {
      const newMarkdown = await adapter.serialize(newBlocks);
      updateMarkdownContent(newMarkdown);
    } catch (error) {
      console.error('Failed to serialize after adding block:', error);
    }
    
    setCurrentInput('');
    setSelectedBlockId(newBlock.id);
  }, [blocks, detectBlockType, adapter, updateMarkdownContent]);

  // Handle typing and slash commands
  const handleInputChange = useCallback((text: string) => {
    setCurrentInput(text);
    
    if (text.startsWith('/')) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Handle slash command
      if (currentInput.startsWith('/')) {
        // Keep slash menu open, don't create block
        return;
      }
      
      // Convert text to block
      handleEnterKey(currentInput);
    }
    
    if (e.key === 'Escape') {
      setShowSlashMenu(false);
      setCurrentInput('');
    }
  }, [currentInput, handleEnterKey]);

  // Create a new block
  const createBlock = useCallback(async (blockType: string, targetId?: string, position?: 'before' | 'after') => {
    if (!adapter) return;
    
    try {
      // Use the adapter's createBlock method to get proper initial content
      const newBlock = await adapter.createBlock(blockType);
      if (!newBlock) {
        console.error('Failed to create block:', blockType);
        return;
      }

      let newBlocks = [...blocks];
      
      if (targetId && position) {
        const targetIndex = newBlocks.findIndex(block => block.id === targetId);
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        newBlocks.splice(insertIndex, 0, newBlock);
      } else {
        newBlocks.push(newBlock);
      }

      setBlocks(newBlocks);
      
      // Serialize and update markdown directly
      try {
        const newMarkdown = await adapter.serialize(newBlocks);
        updateMarkdownContent(newMarkdown);
      } catch (error) {
        console.error('Failed to serialize after creating block:', error);
      }
      
      setSelectedBlockId(newBlock.id);
      setEditingBlockId(newBlock.id);
      setShowSlashMenu(false);
      setCurrentInput('');
    } catch (error) {
      console.error('Error creating block:', error);
    }
  }, [blocks, adapter, updateMarkdownContent]);

  // Update a single block's content by replacing it in the block array
  const updateBlockInMarkdown = useCallback(async (blockId: string, newMarkdown: string) => {
    if (!adapter) return;
    
    try {
      // Parse the new markdown to get the updated block
      const newBlocks = await adapter.parse(newMarkdown);
      if (newBlocks.length === 0) return;
      
      // Update the block in our current blocks array
      const updatedBlocks = blocks.map(block => 
        block.id === blockId 
          ? { ...newBlocks[0], id: blockId }  // Keep the original ID
          : block
      );
      
      // Update the blocks state
      setBlocks(updatedBlocks);
      
      // Serialize all blocks back to markdown
      const fullMarkdown = await adapter.serialize(updatedBlocks);
      updateMarkdownContent(fullMarkdown);
      
    } catch (error) {
      console.error('Failed to update block in markdown:', error);
    }
  }, [adapter, blocks, updateMarkdownContent]);

  // Delete a block
  const deleteBlock = useCallback(async (blockId: string) => {
    if (!adapter) return;
    
    const newBlocks = blocks.filter(block => block.id !== blockId);
    setBlocks(newBlocks);
    
    // Serialize and update markdown directly
    try {
      const newMarkdown = await adapter.serialize(newBlocks);
      updateMarkdownContent(newMarkdown);
    } catch (error) {
      console.error('Failed to serialize after deleting block:', error);
    }
    
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
    if (editingBlockId === blockId) {
      setEditingBlockId(null);
    }
  }, [blocks, adapter, updateMarkdownContent, selectedBlockId, editingBlockId]);

  // Handle drag end
  const handleDragEnd = useCallback(async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id && adapter) {
      const oldIndex = blocks.findIndex(block => block.id === active.id);
      const newIndex = blocks.findIndex(block => block.id === over.id);
      
      const newBlocks = arrayMove(blocks, oldIndex, newIndex);
      setBlocks(newBlocks);
      
      // Serialize and update markdown directly
      try {
        const newMarkdown = await adapter.serialize(newBlocks);
        updateMarkdownContent(newMarkdown);
      } catch (error) {
        console.error('Failed to serialize after drag:', error);
      }
    }
  }, [blocks, adapter, updateMarkdownContent]);

  // Handle slash command selection
  const handleSlashCommandSelect = useCallback((blockType: string) => {
    createBlock(blockType);
  }, [createBlock]);

  // Handle block click to edit
  const handleBlockClick = useCallback((blockId: string) => {
    if (readonly) return;
    
    if (editingBlockId === blockId) {
      // Already editing, do nothing
      return;
    }
    
    setEditingBlockId(blockId);
    setSelectedBlockId(blockId);
  }, [readonly, editingBlockId]);

  // Handle block blur to stop editing
  const handleBlockBlur = useCallback(() => {
    setEditingBlockId(null);
  }, []);

  if (parseError) {
    return (
      <div className="sparkblock-error">
        <div className="sparkblock-error-content">
          <h3>Parse Error</h3>
          <p>Failed to parse markdown: {parseError.message}</p>
          <details>
            <summary>Raw Content</summary>
            <pre>{value}</pre>
          </details>
        </div>
      </div>
    );
  }

  if (!adapter) {
    return (
      <div className="sparkblock-error">
        <div className="sparkblock-error-content">
          <h3>SparkBlock Unavailable</h3>
          <p>No adapter available for block editing</p>
        </div>
      </div>
    );
  }


  return (
    <div className="sparkblock-editor" ref={editorRef}>
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="sparkblock-canvas">
          <div className="sparkblock-blocks">
            {blocks.length === 0 ? (
              <div className="sparkblock-empty">
                <div className="sparkblock-empty-state">
                  <div className="sparkblock-empty-icon">✏️</div>
                  <div className="sparkblock-empty-text">Start writing your story...</div>
                </div>
              </div>
            ) : (
              <SortableContext 
                items={blocks.map(block => block.id)} 
                strategy={verticalListSortingStrategy}
              >
                {blocks.map((block) => (
                  <SimpleBlockRenderer
                    key={block.id}
                    block={block}
                    isSelected={selectedBlockId === block.id}
                    isEditing={editingBlockId === block.id}
                    readonly={readonly}
                    onClick={() => handleBlockClick(block.id)}
                    onMarkdownUpdate={(newMarkdown) => {
                      // Replace this block's content in the full markdown
                      updateBlockInMarkdown(block.id, newMarkdown);
                    }}
                    onDelete={() => deleteBlock(block.id)}
                    onBlur={handleBlockBlur}
                    onCreateBelow={(blockType) => createBlock(blockType, block.id, 'after')}
                  />
                ))}
              </SortableContext>
            )}

            {/* Main typing area */}
            <div style={{ marginTop: blocks.length > 0 ? '16px' : '0' }}>
              <textarea
                ref={inputRef}
                value={currentInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={readonly}
                placeholder={blocks.length === 0 ? "Start writing, or type '/' for commands..." : "Continue writing..."}
                className="sparkblock-input"
                style={{
                  width: '100%',
                  minHeight: '60px',
                  border: 'none',
                  outline: 'none',
                  resize: 'vertical',
                  fontSize: '16px',
                  lineHeight: '1.5',
                  fontFamily: 'inherit',
                  backgroundColor: 'transparent',
                  padding: '8px 12px',
                }}
              />
            </div>
          </div>
        </div>
      </DndContext>

      {/* Slash command menu */}
      {showSlashMenu && (
        <div className="sparkblock-slash-menu" style={{
          position: 'absolute',
          bottom: '80px',
          left: '20px',
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          minWidth: '300px',
          maxHeight: '300px',
          overflow: 'auto',
          zIndex: 1000
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e0e0e0', fontSize: '12px', fontWeight: '600', color: '#666' }}>
            Block Types
          </div>
          {availableBlocks
            .filter(option => {
              const filter = currentInput.slice(1).toLowerCase();
              return !filter || 
                option.name.toLowerCase().includes(filter) || 
                option.description.toLowerCase().includes(filter) ||
                option.keywords.some((keyword: string) => keyword.toLowerCase().includes(filter));
            })
            .map(option => (
              <button
                key={option.id}
                onClick={() => handleSlashCommandSelect(option.fullId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{option.icon}</span>
                <div>
                  <div style={{ fontWeight: '500', color: '#1a1a1a' }}>{option.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{option.description}</div>
                  {option.category && (
                    <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>{option.category}</div>
                  )}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// Simplified block renderer that doesn't require provider context
interface SimpleBlockRendererProps {
  block: SparkBlock;
  isSelected: boolean;
  isEditing: boolean;
  readonly: boolean;
  onClick: () => void;
  onMarkdownUpdate: (markdown: string) => void;
  onDelete: () => void;
  onBlur: () => void;
  onCreateBelow: (blockType: string) => void;
}

function SimpleBlockRenderer({
  block,
  isSelected,
  isEditing,
  readonly,
  onClick,
  onMarkdownUpdate,
  onDelete,
  onBlur,
  onCreateBelow,
}: SimpleBlockRendererProps) {
  const [showControls, setShowControls] = useState(false);
  const [localContent, setLocalContent] = useState('');
  
  // Convert block content to markdown for editing
  const getEditingContent = useCallback(() => {
    switch (block.type) {
      case 'core:heading_1':
        return `# ${(block.content.text as string) || ''}`;
      case 'core:heading_2':
        return `## ${(block.content.text as string) || ''}`;
      case 'core:heading_3':
        return `### ${(block.content.text as string) || ''}`;
      case 'core:quote':
        return `> ${(block.content.text as string) || ''}`;
      case 'core:unordered_list':
        return `- ${(block.content.text as string) || ''}`;
      case 'core:ordered_list':
        return `1. ${(block.content.text as string) || ''}`;
      case 'core:code':
        const language = (block.content.language as string) || '';
        const code = (block.content.code as string) || '';
        return language ? `\`\`\`${language}\n${code}\n\`\`\`` : `\`\`\`\n${code}\n\`\`\``;
      case 'core:divider':
        return '---';
      default:
        return (block.content.text as string) || '';
    }
  }, [block]);

  useEffect(() => {
    if (isEditing) {
      // Set initial content with markdown syntax when entering edit mode
      const editingContent = getEditingContent();
      setLocalContent(editingContent);
    }
  }, [isEditing, getEditingContent, block.id, block.type]);


  const handleSave = useCallback(() => {
    // Simply pass the raw markdown content to the parent
    // The adapter will handle parsing, normalization, and type detection
    if (onMarkdownUpdate) {
      onMarkdownUpdate(localContent);
    }
    
    onBlur();
  }, [localContent, onMarkdownUpdate, onBlur]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Check if this is a single-line block type
      const isSingleLineBlock = [
        'core:heading_1',
        'core:heading_2', 
        'core:heading_3',
        'core:paragraph',
        'core:unordered_list',
        'core:ordered_list',
        'core:divider'
      ].includes(block.type);

      if (isSingleLineBlock && !e.shiftKey) {
        e.preventDefault();
        handleSave();
        // Create new paragraph block below
        onCreateBelow('paragraph');
        return;
      }

      // For multi-line blocks (quote, code), allow Enter unless Cmd/Ctrl is pressed
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        handleSave();
        return;
      }
    }
    
    if (e.key === 'Escape') {
      e.preventDefault();
      onBlur();
    }
  }, [handleSave, onBlur, block.type, onCreateBelow]);

  // Get the appropriate renderer from DefaultBlockRenderers
  const renderContent = useCallback(() => {
    if (isEditing) {
      return (
        <textarea
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: '100%',
            minHeight: 'auto',
            padding: '0',
            margin: '0',
            border: 'none',
            borderRadius: '0',
            fontSize: block.type === 'core:heading_1' ? '32px' : 
                     block.type === 'core:heading_2' ? '24px' :
                     block.type === 'core:heading_3' ? '20px' : '16px',
            lineHeight: block.type.includes('heading') ? '1.2' : '1.5',
            fontWeight: block.type.includes('heading') ? 'bold' : 'normal',
            fontFamily: block.type === 'core:code' ? 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : 'inherit',
            fontStyle: block.type === 'core:quote' ? 'italic' : 'normal',
            resize: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            overflow: 'hidden',
          }}
          rows={1}
          onInput={(e) => {
            // Auto-resize textarea to fit content (only for multi-line blocks)
            const isSingleLineBlock = [
              'core:heading_1',
              'core:heading_2', 
              'core:heading_3',
              'core:paragraph',
              'core:unordered_list',
              'core:ordered_list',
              'core:divider'
            ].includes(block.type);

            if (!isSingleLineBlock) {
              const textarea = e.target as HTMLTextAreaElement;
              textarea.style.height = 'auto';
              textarea.style.height = textarea.scrollHeight + 'px';
            }
          }}
        />
      );
    }

    // Mock render context for DefaultBlockRenderers
    const mockContext = {
      isEditing: false,
      isSelected,
      isFocused: isSelected,
      isDragging: false,
      nestingLevel: 0,
      readonly,
      theme: undefined,
      onFocus: onClick,
      onChange: onMarkdownUpdate,
      onKeyDown: () => {},
    };

    // Use DefaultBlockRenderers
    const blockTypeKey = block.type.replace('core:', '');
    const RendererComponent = DefaultBlockRenderers[blockTypeKey] || DefaultBlockRenderers.unknown;
    
    return <RendererComponent block={block} context={mockContext} />;
  }, [isEditing, localContent, block, isSelected, readonly, onClick, onMarkdownUpdate, handleSave, handleKeyDown]);

  return (
    <div
      className={`sparkblock-block ${isSelected ? 'sparkblock-block--selected' : ''} ${isEditing ? 'sparkblock-block--editing' : ''}`}
      data-block-type={block.type}
      onClick={onClick}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Block controls */}
      {showControls && !readonly && (
        <div className="sparkblock-block-controls sparkblock-block-controls--visible">
          <button 
            className="sparkblock-control" 
            onClick={(e) => {
              e.stopPropagation();
              onCreateBelow('paragraph');
            }}
            title="Add block below"
          >
            +
          </button>
          <button 
            className="sparkblock-control sparkblock-control--drag" 
            title="Drag to move"
          >
            ⋮⋮
          </button>
          <button 
            className="sparkblock-control" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete block"
            style={{ color: '#d32f2f' }}
          >
            ×
          </button>
        </div>
      )}
      
      <div className="sparkblock-block-content">
        {renderContent()}
      </div>
    </div>
  );
}