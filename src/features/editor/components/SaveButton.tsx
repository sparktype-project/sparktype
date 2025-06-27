// src/features/editor/components/SaveButton.tsx
'use client';

import { useEditor } from '@/features/editor/contexts/useEditor';
import { Button } from '@/core/components/ui/button';
import { Save, Check, Loader2 } from 'lucide-react';

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
    idle: {
      icon: <Save className="h-4 w-4" />,
      text: 'Save',
    },
    saving: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: 'Saving...',
    },
    saved: {
      icon: <Check className="h-4 w-4" />,
      text: 'Saved',
    },
  };

  // Determine the current display state and if the button should be disabled
  let currentDisplayState: 'idle' | 'saving' | 'saved';
  let isDisabled = false;

  if (saveState === 'saving') {
    currentDisplayState = 'saving';
    isDisabled = true;
  } else if (hasUnsavedChanges) {
    currentDisplayState = 'idle';
    isDisabled = false;
  } else {
    // This covers both 'saved' and 'no_changes' states.
    // In both cases, the content is considered saved and there's nothing to do.
    currentDisplayState = 'saved';
    isDisabled = true;
  }

  const current = buttonStates[currentDisplayState];

  return (
    <Button variant='ghost' onClick={triggerSave} disabled={isDisabled}>
      {current.icon}
      <span className='hidden md:block'>{current.text}</span>
    </Button>
  );
}