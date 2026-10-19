// src/features/editor/components/publish/stepStates.ts

import type { PublishProgressEvent, PublishStep } from '@/core/services/publishing/types';

export type StepState = 'pending' | 'active' | 'done' | 'failed';
export type StepStates = Record<PublishStep, StepState>;

export const INITIAL_STEP_STATES: StepStates = { build: 'pending', upload: 'pending', finalise: 'pending' };

export function applyProgressEvent(states: StepStates, event: PublishProgressEvent): StepStates {
  const next = { started: 'active', completed: 'done', failed: 'failed' } as const;
  return { ...states, [event.step]: next[event.status] };
}
