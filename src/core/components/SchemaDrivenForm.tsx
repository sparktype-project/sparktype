

import Form from '@rjsf/shadcn';
import validator from '@rjsf/validator-ajv8';
import type {
  RJSFSchema,
  UiSchema,
  FieldTemplateProps,
  ObjectFieldTemplateProps,
  RegistryWidgetsType,
  FormContextType
} from '@rjsf/utils';
import { Label } from '@/core/components/ui/label';
import { editorWidgets } from '@/features/editor/components/widgets';


// --- Props Definition ---
interface SchemaDrivenFormProps<T = unknown> {
  schema: RJSFSchema;
  uiSchema?: UiSchema;
  formData: object;
  onFormChange: (data: object) => void;
  liveValidate?: boolean;
  widgets?: RegistryWidgetsType<T>;
  formContext?: FormContextType & T; // <-- Use the official type and our generic
}



// --- Custom Field Template (for better layout and labels) ---
function CustomFieldTemplate(props: FieldTemplateProps) {
  const { id, classNames, label, help, required, errors, children, schema } = props;

  if (props.hidden) {
    return <div className="hidden">{children}</div>;
  }

  const isCheckbox = schema.type === 'boolean' && (props.uiSchema?.['ui:widget'] === 'checkbox' || props.uiSchema?.['ui:widget'] === undefined);

  if (isCheckbox) {
    return <div className={classNames}>{children}</div>
  }

  return (
    <div className={classNames}>
      {label && (
        <Label htmlFor={id} className="block mb-2">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}



      {children}

      {errors}

      {help}
    </div>
  );
}

// --- Custom Object Field Template (for overall form layout) ---
function CustomObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  return (
    <div>
      <div className="">
        {props.properties.map(element => (
          <div key={element.name} className="mb-4">
            {element.content}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Custom Submit Button Template (to hide it) ---
function HideSubmitButton() {
  return null;
}

/**
 * A reusable component that dynamically generates a form from a given JSON Schema.
 * It uses react-jsonschema-form with a shadcn/ui theme for a consistent look and feel.
 */
export default function SchemaDrivenForm<T>({
  schema,
  uiSchema,
  formData,
  onFormChange,
  liveValidate = false,
  widgets,
  formContext
}: SchemaDrivenFormProps<T>) {

  const safeFormData = formData || {};

  // Always include essential widgets from our registry, with user widgets taking precedence
  const mergedWidgets = {
    ...editorWidgets,
    ...widgets,
  };

  return (
    <Form
      schema={schema}
      uiSchema={uiSchema}
      formData={safeFormData}
      validator={validator}
      onChange={(e) => onFormChange(e.formData)}
      liveValidate={liveValidate}
      showErrorList={false}
      widgets={mergedWidgets}
      formContext={formContext}

      templates={{
        FieldTemplate: CustomFieldTemplate,
        ObjectFieldTemplate: CustomObjectFieldTemplate,
        ButtonTemplates: {
          SubmitButton: HideSubmitButton,
        }
      }}
    />
  );
}