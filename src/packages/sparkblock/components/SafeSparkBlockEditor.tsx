// Safe SparkBlock Editor - controlled component for markdown editing
import React, { useState, useEffect, useCallback } from 'react';
import type {
  SparkBlock,
  SparkBlockAdapter,
} from '../types';

export interface SafeSparkBlockEditorProps {
  adapter: SparkBlockAdapter<string> | null;
  value: string; // Current markdown content
  onChange: (markdown: string) => void; // Called when content changes
  readonly?: boolean;
}

/**
 * A controlled SparkBlock editor that works as a visual interface to markdown content.
 * Takes markdown as value prop and calls onChange when content changes.
 */
export function SafeSparkBlockEditor({
  adapter,
  value,
  onChange,
  readonly = false,
}: SafeSparkBlockEditorProps) {
  const [blocks, setBlocks] = useState<SparkBlock[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [parseError, setParseError] = useState<Error | null>(null);

  // Parse markdown into blocks when value changes
  useEffect(() => {
    const parseMarkdown = async () => {
      if (!adapter || !value) {
        setBlocks([]);
        return;
      }

      try {
        setParseError(null);
        const parsedBlocks = await adapter.parse(value);
        setBlocks(parsedBlocks);
      } catch (error) {
        console.error('Failed to parse markdown:', error);
        setParseError(error as Error);
        setBlocks([]);
      }
    };

    parseMarkdown();
  }, [adapter, value]);

  // Convert blocks back to markdown and call onChange
  const updateMarkdown = useCallback(async (newBlocks: SparkBlock[]) => {
    if (!adapter) return;

    try {
      const markdown = await adapter.serialize(newBlocks);
      onChange(markdown);
    } catch (error) {
      console.error('Failed to serialize blocks:', error);
    }
  }, [adapter, onChange]);

  // Handle creating a new block
  const handleCreateBlock = useCallback((type: string = 'core:paragraph') => {
    if (readonly) return;
    
    const newBlock: SparkBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content: type === 'core:image' ? { src: '', alt: '' } : { text: '' },
    };
    
    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    updateMarkdown(newBlocks);
  }, [blocks, readonly, updateMarkdown]);

  // Handle updating block content
  const handleUpdateBlock = useCallback((blockId: string, content: Record<string, unknown>) => {
    if (readonly) return;
    
    const newBlocks = blocks.map(block => 
      block.id === blockId ? { ...block, content } : block
    );
    setBlocks(newBlocks);
    updateMarkdown(newBlocks);
  }, [blocks, readonly, updateMarkdown]);

  // Handle deleting a block
  const handleDeleteBlock = useCallback((blockId: string) => {
    if (readonly) return;
    
    const newBlocks = blocks.filter(block => block.id !== blockId);
    setBlocks(newBlocks);
    updateMarkdown(newBlocks);
    
    // Clear selection if deleted block was selected
    setSelectedBlockIds(prev => prev.filter(id => id !== blockId));
  }, [blocks, readonly, updateMarkdown]);

  // Handle block selection
  const handleSelectBlock = useCallback((blockId: string) => {
    setSelectedBlockIds([blockId]);
  }, []);
  if (parseError) {
    return (
      <div style={{ border: '2px solid red', padding: '20px', borderRadius: '8px' }}>
        <h3>SparkBlock Parse Error</h3>
        <p>Failed to parse markdown: {parseError.message}</p>
        <details style={{ marginTop: '10px' }}>
          <summary>Raw Content</summary>
          <pre style={{ fontSize: '12px', overflow: 'auto' }}>{value}</pre>
        </details>
      </div>
    );
  }

  if (!adapter) {
    return (
      <div style={{ border: '2px solid gray', padding: '20px', borderRadius: '8px' }}>
        <h3>SparkBlock Unavailable</h3>
        <p>No adapter available for block editing</p>
      </div>
    );
  }

  return (
    <div style={{ border: '2px solid green', padding: '20px', borderRadius: '8px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>SparkBlock Editor</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          {!readonly && (
            <>
              <button 
                onClick={() => handleCreateBlock('core:paragraph')}
                style={{ padding: '5px 10px', backgroundColor: '#007acc', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                + Paragraph
              </button>
              <button 
                onClick={() => handleCreateBlock('core:heading_1')}
                style={{ padding: '5px 10px', backgroundColor: '#007acc', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                + Heading
              </button>
              <button 
                onClick={() => handleCreateBlock('core:quote')}
                style={{ padding: '5px 10px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                + Quote
              </button>
              <button 
                onClick={() => handleCreateBlock('core:image')}
                style={{ padding: '5px 10px', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                + Image
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
        Blocks: {blocks.length} | Selected: {selectedBlockIds.length} | Adapter: {adapter ? 'Available' : 'Missing'}
      </div>

      <div style={{ minHeight: '200px', border: '1px solid #ddd', borderRadius: '4px', padding: '15px' }}>
        {blocks.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
            <p>No blocks yet. Click "Add Paragraph" to start writing.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {blocks.map((block) => (
              <SafeBlockRenderer
                key={block.id}
                block={block}
                isSelected={selectedBlockIds.includes(block.id)}
                readonly={readonly}
                onUpdate={(content) => handleUpdateBlock(block.id, content)}
                onDelete={() => handleDeleteBlock(block.id)}
                onSelect={() => handleSelectBlock(block.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple block renderer without complex features
interface SafeBlockRendererProps {
  block: SparkBlock;
  isSelected: boolean;
  readonly: boolean;
  onUpdate: (content: Record<string, unknown>) => void;
  onDelete: () => void;
  onSelect: () => void;
}

function SafeBlockRenderer({
  block,
  isSelected,
  readonly,
  onUpdate,
  onDelete,
  onSelect,
}: SafeBlockRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState((block.content.text as string) || '');
  const [localImageSrc, setLocalImageSrc] = useState((block.content.src as string) || '');
  const [localImageAlt, setLocalImageAlt] = useState((block.content.alt as string) || '');

  const handleSave = useCallback(() => {
    if (block.type === 'core:image') {
      onUpdate({ ...block.content, src: localImageSrc, alt: localImageAlt });
    } else {
      onUpdate({ ...block.content, text: localContent });
    }
    setIsEditing(false);
  }, [localContent, localImageSrc, localImageAlt, block.content, block.type, onUpdate]);

  const handleCancel = useCallback(() => {
    setLocalContent((block.content.text as string) || '');
    setLocalImageSrc((block.content.src as string) || '');
    setLocalImageAlt((block.content.alt as string) || '');
    setIsEditing(false);
  }, [block.content.text, block.content.src, block.content.alt]);

  const blockStyle: React.CSSProperties = {
    border: isSelected ? '2px solid #007acc' : '1px solid #ddd',
    borderRadius: '4px',
    padding: '10px',
    backgroundColor: isSelected ? '#f0f8ff' : 'white',
    cursor: readonly ? 'default' : 'pointer',
  };

  const getBlockTypeLabel = (type: string) => {
    switch (type) {
      case 'core:paragraph': return 'P';
      case 'core:heading_1': return 'H1';
      case 'core:heading_2': return 'H2';
      case 'core:heading_3': return 'H3';
      case 'core:quote': return 'Q';
      case 'core:code': return 'C';
      case 'core:unordered_list': return 'UL';
      case 'core:ordered_list': return 'OL';
      case 'core:image': return 'IMG';
      case 'core:divider': return 'HR';
      case 'core:container': return 'BOX';
      default: return type.split(':')[1]?.charAt(0).toUpperCase() || 'B';
    }
  };

  return (
    <div style={blockStyle} onClick={onSelect}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
        <span style={{ 
          fontSize: '10px', 
          backgroundColor: '#f0f0f0', 
          padding: '2px 6px', 
          borderRadius: '2px',
          color: '#666'
        }}>
          {getBlockTypeLabel(block.type)}
        </span>
        {!readonly && (
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(!isEditing);
              }}
              style={{ fontSize: '10px', padding: '2px 6px', border: '1px solid #ddd', borderRadius: '2px' }}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{ fontSize: '10px', padding: '2px 6px', border: '1px solid #ddd', borderRadius: '2px', color: 'red' }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div>
          {block.type === 'core:image' ? (
            <>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '3px' }}>Image URL:</label>
                <input
                  type="text"
                  value={localImageSrc || ''}
                  onChange={(e) => setLocalImageSrc(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px',
                    border: '1px solid #ddd',
                    borderRadius: '2px'
                  }}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '3px' }}>Alt Text:</label>
                <input
                  type="text"
                  value={localImageAlt || ''}
                  onChange={(e) => setLocalImageAlt(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px',
                    border: '1px solid #ddd',
                    borderRadius: '2px'
                  }}
                  placeholder="Description of the image"
                />
              </div>
            </>
          ) : (
            <textarea
              value={localContent || ''}
              onChange={(e) => setLocalContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '5px',
                border: '1px solid #ddd',
                borderRadius: '2px',
                resize: 'vertical'
              }}
              placeholder={`Enter ${block.type.replace('core:', '')} content...`}
            />
          )}
          <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
            <button
              onClick={handleSave}
              style={{ fontSize: '12px', padding: '3px 8px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '2px' }}
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              style={{ fontSize: '12px', padding: '3px 8px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '2px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ minHeight: '20px' }}>
          {block.type === 'core:heading_1' && (
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
              {(block.content.text as string) || 'Untitled Heading 1'}
            </h1>
          )}
          {block.type === 'core:heading_2' && (
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              {(block.content.text as string) || 'Untitled Heading 2'}
            </h2>
          )}
          {block.type === 'core:heading_3' && (
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              {(block.content.text as string) || 'Untitled Heading 3'}
            </h3>
          )}
          {block.type === 'core:paragraph' && (
            <p style={{ margin: 0, lineHeight: '1.5' }}>
              {(block.content.text as string) || 'Empty paragraph'}
            </p>
          )}
          {block.type === 'core:quote' && (
            <blockquote style={{ margin: 0, paddingLeft: '15px', borderLeft: '3px solid #ddd', fontStyle: 'italic' }}>
              {(block.content.text as string) || 'Empty quote'}
            </blockquote>
          )}
          {block.type === 'core:code' && (
            <pre style={{ margin: 0, padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '14px', fontFamily: 'monospace' }}>
              <code>{(block.content.code as string) || 'Empty code block'}</code>
            </pre>
          )}
          {block.type === 'core:image' && (
            <div style={{ margin: 0, padding: '10px', border: '1px dashed #ccc', borderRadius: '4px', textAlign: 'center' }}>
              {block.content.src ? (
                <img 
                  src={block.content.src as string} 
                  alt={block.content.alt as string || 'Image'} 
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              ) : (
                <div style={{ color: '#666', fontStyle: 'italic' }}>
                  Image: {(block.content.alt as string) || 'No source specified'}
                </div>
              )}
            </div>
          )}
          {!['core:heading_1', 'core:heading_2', 'core:heading_3', 'core:paragraph', 'core:quote', 'core:code', 'core:image'].includes(block.type) && (
            <div style={{ fontStyle: 'italic', color: '#666' }}>
              {(block.content.text as string) || `Empty ${block.type.replace('core:', '')} block`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}