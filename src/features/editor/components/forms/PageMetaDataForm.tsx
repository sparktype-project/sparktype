// src/features/editor/components/forms/PageMetadataForm.tsx


import { useMemo } from 'react';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import type { MarkdownFrontmatter, LayoutManifest } from '@/core/types';
import { BASE_SCHEMA } from '@/config/editorConfig';

// Reusable components for form rendering
import SchemaDrivenForm from '@/core/components/SchemaDrivenForm';
import { ImageUploadWidget, SwitchWidget } from '@/features/editor/components/widgets';

/**
 * Defines the props for the PageMetadataForm component.
 */
interface PageMetadataFormProps {
  /** The ID of the site, passed down for context to custom widgets like the image uploader. */
  siteId: string;

  /** The complete frontmatter object for the current page being edited. */
  frontmatter: MarkdownFrontmatter;

  /** A callback to update the parent component's frontmatter state. */
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;

  /** The parsed manifest of the currently selected Content Type (Layout). Can be null if none is selected. */
  layoutManifest: LayoutManifest | null;
}

/**
 * A component that renders a combined form for both core and layout-specific metadata.
 * It intelligently merges schemas and UI configurations to present a unified editing
 * experience for any type of content.
 */
export default function PageMetadataForm({
  siteId,
  frontmatter,
  onFrontmatterChange,
  layoutManifest,
}: PageMetadataFormProps) {

  // Define the custom widgets that can be used by the SchemaDrivenForm.
  const customWidgets = {
    imageUploader: ImageUploadWidget,
    switch: SwitchWidget
  };

  /**
   * This is the core logic of the component.
   * `useMemo` is used to efficiently compute the final, merged schema that will be
   * rendered by the form. This calculation only re-runs if the `layoutManifest` changes,
   * preventing unnecessary re-renders.
   */
  const mergedSchemaAndUi = useMemo(() => {
    // 1. Start with a deep copy of the universal BASE_SCHEMA to avoid mutation.
    const finalSchema: RJSFSchema = JSON.parse(JSON.stringify(BASE_SCHEMA.schema));
    const finalUiSchema: UiSchema = JSON.parse(JSON.stringify(BASE_SCHEMA.uiSchema));

    // 2. Remove menuTitle field for collection items (layoutType === 'item')
    // Collection items are not added to menus, so menuTitle is not applicable
    if (layoutManifest?.layoutType === 'item' && finalSchema.properties) {
      delete finalSchema.properties.menuTitle;
    }

    // 3. Get custom schema from the layout manifest.
    // The schema always defines fields for the content entity using this layout:
    // - layoutType 'page': schema defines page fields
    // - layoutType 'item': schema defines collection item fields
    // - layoutType 'list': schema defines list page fields
    const customSchema = layoutManifest?.schema;
    const customUiSchema = layoutManifest?.uiSchema;

    // 4. Merge the custom schema into the final schema.
    if (customSchema?.properties) {
      // Combine properties, with custom fields overwriting core fields if names conflict.
      finalSchema.properties = { ...finalSchema.properties, ...customSchema.properties };
      // Combine required fields, ensuring no duplicates.
      finalSchema.required = [...new Set([...(finalSchema.required || []), ...(customSchema.required || [])])];
    }

    // Merge the custom UI schema.
    if (customUiSchema) {
      Object.assign(finalUiSchema, customUiSchema);
    }

    return { schema: finalSchema, uiSchema: finalUiSchema };
  }, [layoutManifest]);


  // Check if there are any fields to render after merging.
  const hasFields = mergedSchemaAndUi.schema?.properties && Object.keys(mergedSchemaAndUi.schema.properties).length > 0;

  if (!hasFields) {
    return (
      <div className="text-sm text-center text-muted-foreground p-4 border border-dashed rounded-md">
        <p>This content type has no additional metadata options.</p>
      </div>
    );
  }

  return (
    <SchemaDrivenForm
      schema={mergedSchemaAndUi.schema}
      uiSchema={mergedSchemaAndUi.uiSchema}
      formData={frontmatter}
      // Pass the frontmatter update callback directly to the form.
      onFormChange={(data) => onFrontmatterChange(data as Partial<MarkdownFrontmatter>)}
      // Register custom widgets.
      widgets={customWidgets}
      // Provide the siteId in the form's context so custom widgets can access it.
      formContext={{ siteId }}
    />
  );
}