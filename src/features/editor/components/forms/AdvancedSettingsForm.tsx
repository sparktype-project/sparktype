// src/features/editor/components/forms/AdvancedSettingsForm.tsx
'use client';

import { Label } from '@/core/components/ui/label';
import { Input } from '@/core/components/ui/input';

/**
 * Defines the props for the AdvancedSettingsForm component.
 */
interface AdvancedSettingsFormProps {
  /**
   * The current URL slug for the page.
   */
  slug: string;

  /**
   * A callback function that is triggered when the user types in the slug input field.
   */
  onSlugChange: (newSlug: string) => void;

  /**
   * A flag indicating if the editor is in "new file mode".
   * The slug can only be edited when this is true.
   */
  isNewFileMode: boolean;
}

/**
 * A form component for editing advanced page properties, primarily the URL slug.
 * It enforces the rule that the slug is only editable before the page is first saved.
 *
 * @param {AdvancedSettingsFormProps} props The props for the component.
 * @returns {React.ReactElement} The rendered component.
 */
export default function AdvancedSettingsForm({
  slug,
  onSlugChange,
  isNewFileMode,
}: AdvancedSettingsFormProps) {
  return (
    <div className="space-y-2">
      {/* 
        The Label is associated with the Input via the `htmlFor` attribute,
        which improves accessibility.
      */}
      <Label htmlFor="slug-input">URL Slug</Label>
      <Input
        id="slug-input"
        value={slug}
        onChange={(e) => onSlugChange(e.target.value)}
        // The input is disabled if the page is NOT in new file mode.
        // This prevents users from changing the URL of an existing page.
        disabled={!isNewFileMode}
        placeholder="e.g., a-great-blog-post"
        // This accessibility attribute links the input to its description.
        aria-describedby="slug-description"
      />
      {/* 
        Helper text that dynamically changes to explain the input's state to the user.
        This is a key part of good user experience.
      */}
      <p id="slug-description" className="text-xs text-muted-foreground">
        {isNewFileMode
          ? 'The URL-friendly version of the title. Auto-generated, but can be edited here before the first save.'
          : 'The URL for this page cannot be changed after it has been saved.'}
      </p>
    </div>
  );
}