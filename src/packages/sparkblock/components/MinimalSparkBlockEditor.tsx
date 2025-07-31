// Minimal SparkBlock Editor for crash debugging
import React, { useState } from 'react';

export interface MinimalSparkBlockEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Minimal SparkBlock editor for testing - no Zustand, no virtualization, no dnd-kit
 */
export function MinimalSparkBlockEditor({
  initialContent = '',
  onContentChange
}: MinimalSparkBlockEditorProps) {
  const [content, setContent] = useState(initialContent);

  const handleChange = (newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
  };

  return (
    <div style={{ border: '2px solid green', padding: '20px' }}>
      <h3>Minimal SparkBlock Editor</h3>
      <div style={{ marginBottom: '10px' }}>
        <strong>Status:</strong> Running without crash
      </div>
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: '100%',
          height: '200px',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
        placeholder="Start typing..."
      />
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        Character count: {content.length}
      </div>
    </div>
  );
}