// src/features/editor/components/GroupedFrontmatterFields.tsx

import { useMemo } from 'react';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import SchemaDrivenForm from '../../../core/components/SchemaDrivenForm';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/core/components/ui/accordion";
import ImageUploadWidget from './ImageUploadWidget';
import SwitchWidget from './SwitchWidget';

interface Group {
  title: string;
  fields: string[];
}
type StrictUiSchema = UiSchema & { 'ui:groups'?: Group[] };

interface GroupedFrontmatterFormProps {
  siteId: string;
  schema: RJSFSchema;
  uiSchema?: StrictUiSchema;
  formData: Record<string, unknown>;
  onFormChange: (newData: Record<string, unknown>) => void;
}

function createSubSchema(originalSchema: RJSFSchema, fields: string[]): RJSFSchema {
  const subSchema: RJSFSchema = { 
    ...originalSchema, 
    properties: {}, 
    required: originalSchema.required?.filter((field: string) => fields.includes(field)) 
  };
  
  if (!subSchema.properties) subSchema.properties = {};
  for (const field of fields) {
    if (originalSchema.properties && originalSchema.properties[field]) {
      subSchema.properties[field] = originalSchema.properties[field];
    }
  }
  return subSchema;
}

export default function GroupedFrontmatterForm({
  siteId,
  schema,
  uiSchema,
  formData,
  onFormChange,
}: GroupedFrontmatterFormProps) {
  
  const customWidgets = { 
    imageUploader: ImageUploadWidget,
    switch: SwitchWidget
  };
  
  const { groups, ungroupedFields } = useMemo(() => {
    const definedGroups = uiSchema?.['ui:groups'] || [];
    const allSchemaFields = Object.keys(schema.properties || {});
    const fieldsInGroups = new Set(definedGroups.flatMap(g => g.fields));
    const remainingFields = allSchemaFields.filter(f => !fieldsInGroups.has(f));
    return { groups: definedGroups, ungroupedFields: remainingFields };
  }, [schema, uiSchema]);

  // FIX: This handler was unused. The `onFormChange` prop can be passed directly.
  // The type of the `data` parameter is corrected to `object` to match the child component's prop type.
  const handleFormChange = (data: object) => {
    onFormChange(data as Record<string, unknown>);
  };

  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return <p className="text-sm text-muted-foreground">This layout has no configurable fields.</p>;
  }

  return (
    <div className="border-t">
      <Accordion type="multiple" defaultValue={groups.map(g => g.title)} className="w-full">
        {groups.map((group) => {
          if (group.fields.length === 0) return null;
          const subSchema = createSubSchema(schema, group.fields);
          return (
            <AccordionItem value={group.title} key={group.title}>
              <AccordionTrigger>{group.title}</AccordionTrigger>
              <AccordionContent className="pt-4">
                <SchemaDrivenForm
                  schema={subSchema}
                  formData={formData}
                  // FIX: Pass the corrected handler.
                  onFormChange={handleFormChange}
                  widgets={customWidgets}
                  formContext={{ siteId }}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {ungroupedFields.length > 0 && (
        <div className="pt-4 mt-4 border-t">
          <Accordion type='single' collapsible defaultValue="ungrouped-fields">
            <AccordionItem value="ungrouped-fields">
              <AccordionTrigger>
                Other Fields
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <SchemaDrivenForm
                  schema={createSubSchema(schema, ungroupedFields)}
                  formData={formData}
                  // FIX: Pass the corrected handler here as well.
                  onFormChange={handleFormChange}
                  widgets={customWidgets}
                  formContext={{ siteId }}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}