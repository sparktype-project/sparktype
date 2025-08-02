// src/features/editor/components/forms/CoreSchemaForm.tsx
'use client';

import type { MarkdownFrontmatter } from '@/core/types';
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import { BASE_SCHEMA } from '@/config/editorConfig';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { ImageUploadWidget, SwitchWidget } from '../widgets';

interface CoreSchemaFormProps {
  siteId: string;
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

/**
 * Renders a form for the universal, core frontmatter fields (date, published, etc.)
 * that apply to all content types.
 */
export default function CoreSchemaForm({
  siteId,
  frontmatter,
  onFrontmatterChange,
}: CoreSchemaFormProps) {
  
  // Use the base schema without modification - date field is always visible
  const schema: RJSFSchema = { ...BASE_SCHEMA.schema };
  const uiSchema: UiSchema = { ...BASE_SCHEMA.uiSchema };
    const customWidgets = { 
      imageUploader: ImageUploadWidget,
      switch: SwitchWidget
    };

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