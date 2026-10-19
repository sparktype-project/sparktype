// src/features/editor/components/widgets/ScheduleWidget.tsx

import type { WidgetProps } from '@rjsf/utils';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { isInvalidPublishAt } from '@/core/services/builder/schedule';
import { fromLocalInputValue, toLocalInputValue } from '@/core/services/scheduleFormat';

/** Edits `publishAt` in local time and stores it as ISO with the local offset. */
export default function ScheduleWidget({ id, value, onChange, disabled, readonly }: WidgetProps) {
  const invalid = isInvalidPublishAt(value);
  const hasValue = value !== undefined && value !== null && value !== '';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="datetime-local"
          aria-label="Schedule"
          aria-invalid={invalid}
          aria-describedby={`${id}-help`}
          value={toLocalInputValue(value)}
          disabled={disabled || readonly}
          onChange={(event) => onChange(fromLocalInputValue(event.target.value))}
        />
        {hasValue && (
          <Button type="button" variant="outline" size="sm" disabled={disabled || readonly} onClick={() => onChange(undefined)}>
            Clear schedule
          </Button>
        )}
      </div>
      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          The stored schedule &ldquo;{String(value)}&rdquo; is not a valid date and time, so it is ignored and this page publishes
          immediately. Pick a new time or clear it.
        </p>
      )}
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        Goes live the next time you publish after this time.
      </p>
    </div>
  );
}
