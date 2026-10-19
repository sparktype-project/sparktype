// src/components/publishing/PrimaryContentFields.tsx


import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import type { MarkdownFrontmatter } from '@/core/types';

// FIXED: The interface is now much stricter and safer.
// It only defines the properties this component actually cares about.
interface PrimaryFieldsProps {
  frontmatter: {
    title?: string;
  };
  // The callback expects a partial update to the main frontmatter state.
  onFrontmatterChange: (newData: Partial<MarkdownFrontmatter>) => void;
}

export default function PrimaryContentFields({
  frontmatter,
  onFrontmatterChange,
}: PrimaryFieldsProps) {

  const handleChange = (value: string) => {
    onFrontmatterChange({ title: value });
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
          onChange={(e) => handleChange(e.target.value)}
          // These classes create the large, "invisible" input style
          className="text-2xl md:text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent"
        />
      </div>
    </div>
  );
}