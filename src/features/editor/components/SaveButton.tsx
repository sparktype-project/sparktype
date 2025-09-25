// src/features/editor/components/SaveButton.tsx
'use client';

import { useEditor } from '@/features/editor/contexts/useEditor';
import { Button } from '@/core/components/ui/button';
import { Save, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * A context-aware button that displays the current save state
 * (e.g., Save, Saving..., Saved) and triggers the save action.
 *
 * This component MUST be rendered within a tree wrapped by an `<EditorProvider>`
 * as it relies on the `useEditor` hook for its state and actions.
 */
export default function SaveButton() {
  const { saveState, hasUnsavedChanges, triggerSave } = useEditor();

  // Define the visual states for the button
  const buttonStates = {
    pending: {
      icon: <Save className="h-4 w-4" />,
      text: 'Save',
      variant: 'ghost' as const,
      disabled: false,
    },
    saving: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: 'Saving...',
      variant: 'ghost' as const,
      disabled: true,
    },
    saved: {
      icon: <Check className="h-4 w-4 text-green-500" />,
      text: 'Saved',
      variant: 'ghost' as const,
      disabled: false,
    },
    error: {
      icon: <AlertTriangle className="h-4 w-4" />,
      text: 'Retry',
      variant: 'destructive' as const,
      disabled: false,
    },
  };

  // Use the current save state directly, but show 'pending' if there are unsaved changes
  let currentState = saveState;
  if (hasUnsavedChanges && saveState === 'saved') {
    currentState = 'pending';
  }

  const current = buttonStates[currentState];

  return (
    <Tooltip>
          <TooltipTrigger>
            <Button variant={current.variant} onClick={triggerSave} disabled={current.disabled} size="sm" className='h-8 w-8'>
      {current.icon}
    </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{current.text}</p>
          </TooltipContent>
        </Tooltip>    
    
  );
}