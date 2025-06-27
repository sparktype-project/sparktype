// src/features/editor/components/forms/CollectionLayoutSchemaForm.tsx
'use client';

// Imports are identical to PageLayoutSchemaForm
import type { MarkdownFrontmatter, LayoutManifest } from '@/core/types';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import ImageUploadWidget from '../ImageUploadWidget';

interface CollectionLayoutSchemaFormProps {
  siteId: string;
  layoutManifest: LayoutManifest | null;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

/**
 * Renders a form for the custom fields defined in a "collection" layout's main 'schema'.
 * This applies to the collection page itself, not its items.
 */
export default function CollectionLayoutSchemaForm({
  siteId,
  layoutManifest,
  frontmatter,
  onFrontmatterChange,
}: CollectionLayoutSchemaFormProps) {
  
  const customWidgets = { imageUploader: ImageUploadWidget };

  if (!layoutManifest?.schema) {
    return <p className="text-sm text-muted-foreground p-2">This layout has no custom collection page options.</p>;
  }

  return (
    <SchemaDrivenForm 
      schema={layoutManifest.schema}
      uiSchema={layoutManifest.uiSchema ?? undefined}
      formData={frontmatter}
      onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)}
      widgets={customWidgets}
      formContext={{ siteId }}
    />
  );
}