// src/features/editor/components/AutosaveIndicator.tsx
'use client';

import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AutosaveIndicatorProps {
  state: AutosaveState;
  className?: string;
}

export default function AutosaveIndicator({ 
  state, 
  className = "" 
}: AutosaveIndicatorProps) {

  if (state === 'idle') {
    return null; // Don't show anything when idle
  }

  const stateConfig = {
    saving: {
      icon: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
      text: 'Saving...',
      textClass: 'text-blue-500',
    },
    saved: {
      icon: <CheckCircle className="h-3 w-3 text-green-500" />,
      text: 'Saved',
      textClass: 'text-green-500',
    },
    error: {
      icon: <AlertCircle className="h-3 w-3 text-red-500" />,
      text: 'Save failed',
      textClass: 'text-red-500',
    },
  };

  const config = stateConfig[state as keyof typeof stateConfig];

  return (
    <div className={`flex items-center gap-1.5 text-xs ${className}`}>
      {config.icon}
      <span className={config.textClass}>
        {config.text}
      </span>
    </div>
  );
}