// src/components/publishing/MarkdownEditor.tsx

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Label } from '@/core/components/ui/label';

interface MarkdownEditorProps {
  initialValue: string;
  // onContentChange is now used primarily by the parent to trigger its own state updates
  onContentChange: (markdown: string) => void;
}

// The ref now needs to expose a method to get the current content
export interface MarkdownEditorRef {
  getMarkdown: () => string;
}

const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  ({ initialValue, onContentChange }, ref) => {
    // We'll manage the textarea's value with local state
    const [content, setContent] = useState(initialValue);

    // If the initialValue prop changes from the parent (e.g., loading a new file),
    // we update the local state.
    useEffect(() => {
      setContent(initialValue);
    }, [initialValue]);

    // Expose a function for the parent component to get the current content
    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        return content;
      },
    }));

    // This handler updates both local state and informs the parent of a change
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = event.target.value;
      setContent(newContent);
      onContentChange(newContent); // Let the parent know things have changed
    };

    return (
      <div className="space-y-2 h-full">
      <Label htmlFor="content-body" className="text-[10px] font-medium uppercase text-gray-400">
            Content
          </Label>
      <textarea
        id="content-body"
        value={content}
        onChange={handleChange}
        placeholder="Start writing your Markdown here..."
        className="w-full h-full bg-background 
                   text-base font-mono leading-relaxed resize-none 
                   focus:ring-2 focus:ring-ring focus:outline-none"
      />
      </div>
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
export default MarkdownEditor;