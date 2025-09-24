import type { WidgetProps } from '@rjsf/utils';
import { Switch } from '@/core/components/ui/switch';
import { Label } from '@/core/components/ui/label';

export default function SwitchWidget(props: WidgetProps) {
  const { id, value, onChange, label, schema, field_text } = props;
  
  return (
    <div className="flex justify-between items-center space-x-2">
      
      <Label htmlFor={id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {field_text || schema.title}
      </Label>
      <Switch
        id={id}
        checked={Boolean(value)}
        onCheckedChange={(checked) => onChange(checked)}
      />
    </div>
  );
}