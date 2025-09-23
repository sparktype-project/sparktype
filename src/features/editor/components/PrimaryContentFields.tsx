// src/components/publishing/PrimaryContentFields.tsx
'use client';

import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import type { MarkdownFrontmatter } from '@/core/types';

// FIXED: The interface is now much stricter and safer.
// It only defines the properties this component actually cares about.
interface PrimaryFieldsProps {
  frontmatter: {
    title?: string;
    description?: string;
  };
  // The callback expects a partial update to the main frontmatter state.
  onFrontmatterChange: (newData: Partial<MarkdownFrontmatter>) => void;
  showDescription?: boolean;
}

export default function PrimaryContentFields({
  frontmatter,
  onFrontmatterChange,
}: PrimaryFieldsProps) {

  // FIXED: The handler now only passes back the single field that changed.
  // This makes the component more reusable and decoupled from the parent's state shape.
  const handleChange = (field: 'title' | 'description', value: string) => {
    onFrontmatterChange({
      [field]: value,
    });
  };

  return (
    <div className="space-y-4 shrink-0">
      <div className="space-y-2 mb-6 border-b pb-3">
        <Label htmlFor="content-title" className="text-[10px] font-medium uppercase text-gray-400">
          Title
        </Label>
        <Input
          id="content-title"
          placeholder="Enter a title..."
          value={frontmatter.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          // These classes create the large, "invisible" input style
          className="text-2xl lg:text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent"
        />
      </div>

        <div className="space-y-2 mb-6 border-b pb-3">
          <Label htmlFor="content-description" className="text-[10px] font-medium uppercase text-gray-400">
            Description
          </Label>
          <Textarea
            
            placeholder="Add a short description..."
            value={frontmatter.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            // Style for a clean, borderless textarea
            className="p-0 border-0 shadow-none focus-visible:ring-0 bg-none resize-none text-2xl"
            rows={1}
          />
        </div>
    </div>
  );
}