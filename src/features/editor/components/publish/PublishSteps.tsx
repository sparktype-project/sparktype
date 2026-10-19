// src/features/editor/components/publish/PublishSteps.tsx

import { Check, Circle, Loader2, X } from 'lucide-react';
import type { PublishStep } from '@/core/services/publishing/types';
import type { StepStates } from './stepStates';

const UPLOAD_LABELS: Record<string, string> = {
  zip: 'Package download',
  netlify: 'Upload to Netlify',
  github: 'Push to GitHub',
};

function labels(provider: string): Record<PublishStep, string> {
  return { build: 'Build site', upload: UPLOAD_LABELS[provider] ?? 'Upload', finalise: 'Finalise' };
}

const ICONS = {
  pending: <Circle aria-hidden className="h-4 w-4 text-muted-foreground" />,
  active: <Loader2 aria-hidden className="h-4 w-4 animate-spin" />,
  done: <Check aria-hidden className="h-4 w-4 text-green-600" />,
  failed: <X aria-hidden className="h-4 w-4 text-destructive" />,
};

export function PublishSteps({ provider, states }: { provider: string; states: StepStates }) {
  const text = labels(provider);
  return (
    <ol aria-label="Publishing steps" className="space-y-2">
      {(Object.keys(text) as PublishStep[]).map((step) => (
        <li key={step} data-state={states[step]} className="flex items-center gap-2 text-sm">
          {ICONS[states[step]]}
          <span>{text[step]}</span>
        </li>
      ))}
    </ol>
  );
}
