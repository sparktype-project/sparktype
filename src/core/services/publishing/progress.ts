// src/core/services/publishing/progress.ts

import type { PublishProgressCallback, PublishStep } from './types';

export interface StepReporter {
  start(step: PublishStep): void;
  complete(step: PublishStep): void;
}

/**
 * Wraps an optional progress callback for a provider. A throwing listener must not abort a
 * publish that is otherwise going to succeed, so callback errors are swallowed.
 */
export function createStepReporter(onProgress?: PublishProgressCallback): StepReporter {
  const emit = (step: PublishStep, status: 'started' | 'completed') => {
    try {
      onProgress?.({ step, status });
    } catch (error) {
      console.error('[Publishing] Progress listener threw:', error);
    }
  };
  return {
    start: (step) => emit(step, 'started'),
    complete: (step) => emit(step, 'completed'),
  };
}

/**
 * Tracks which step is in flight, so whoever sees the final result can mark the step that was
 * running as failed. Providers return failures rather than throwing, and they report only the
 * happy path, so this is the one place a failure becomes an event.
 */
export function trackProgress(onProgress?: PublishProgressCallback) {
  let active: PublishStep | null = null;
  const forward: PublishProgressCallback = (event) => {
    active = event.status === 'started' ? event.step : null;
    try {
      onProgress?.(event);
    } catch (error) {
      console.error('[Publishing] Progress listener threw:', error);
    }
  };
  return {
    forward,
    failActiveStep(message: string) {
      if (active) forward({ step: active, status: 'failed', message });
    },
  };
}
