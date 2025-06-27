// src/features/editor/components/forms/CoreSchemaForm.tsx
'use client';

import type { MarkdownFrontmatter } from '@/core/types';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import { BASE_SCHEMA } from '@/config/editorConfig';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import ImageUploadWidget from '../ImageUploadWidget';

interface CoreSchemaFormProps {
  siteId: string;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
  // We need to know if the page is a collection item to hide fields like 'date'
  isCollectionItem: boolean; 
}

/**
 * Renders a form for the universal, core frontmatter fields (date, status, etc.)
 * that apply to almost all content types.
 */
export default function CoreSchemaForm({
  siteId,
  frontmatter,
  onFrontmatterChange,
  isCollectionItem,
}: CoreSchemaFormProps) {
  
  // Dynamically adjust the schema based on context
  const schema: RJSFSchema = { ...BASE_SCHEMA.schema };
  const uiSchema: UiSchema = { ...BASE_SCHEMA.uiSchema };
    const customWidgets = { imageUploader: ImageUploadWidget };

  // Hide the date field for collection items, as it's often managed differently
  if (isCollectionItem && schema.properties?.date) {
    // A simple way to hide is to modify uiSchema
    uiSchema.date = { ...uiSchema.date, 'ui:widget': 'hidden' };
  }

  return (
    <SchemaDrivenForm 
      schema={schema}
      uiSchema={uiSchema}
      formData={frontmatter}
      widgets={customWidgets}
      onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)}
      formContext={{ siteId }}
    />
  );
}