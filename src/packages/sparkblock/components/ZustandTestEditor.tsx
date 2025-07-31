// Test editor with just Zustand store to isolate crash
import React, { useState } from 'react';

export interface ZustandTestEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Test editor without Zustand for now - let's see if that's the crash cause
 */
export function ZustandTestEditor({
  initialContent = '',
  onContentChange
}: ZustandTestEditorProps) {
  const [content, setContent] = useState(initialContent);

  const handleChange = (newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
  };

  return (
    <div style={{ border: '2px solid orange', padding: '20px' }}>
      <h3>Store Access Test Editor</h3>
      <div style={{ marginBottom: '10px' }}>
        <strong>Status:</strong> Testing without direct store access
      </div>
      <div style={{ marginBottom: '10px', fontSize: '12px' }}>
        No direct Zustand access - should be safe
      </div>
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: '100%',
          height: '150px',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
        placeholder="Testing without store access..."
      />
    </div>
  );
}