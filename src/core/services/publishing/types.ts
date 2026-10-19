import type { LocalSiteData } from '@/core/types';

export interface PublishingProvider {
  readonly name: string;
  readonly displayName: string;
  
  /**
   * Deploy a site using this provider
   */
  deploy(site: LocalSiteData, config: Record<string, unknown>, options?: DeployOptions): Promise<PublishingResult>;
  
  /**
   * Validate the provider configuration
   */
  validateConfig(config: Record<string, unknown>): Promise<ValidationResult>;
  
  /**
   * Get the configuration schema for this provider
   */
  getConfigSchema(): PublishingConfigSchema;
}

export type PublishStep = 'build' | 'upload' | 'finalise';

export interface PublishProgressEvent {
  step: PublishStep;
  status: 'started' | 'completed' | 'failed';
  /** Failure reason, when the step failed. */
  message?: string;
}

export type PublishProgressCallback = (event: PublishProgressEvent) => void;

export interface DeployOptions {
  /** Providers report `started`/`completed`; the caller reports `failed` from the result. */
  onProgress?: PublishProgressCallback;
}

export interface PublishingResult {
  success: boolean;
  url?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PublishingConfigSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}

export interface PublishingConfig {
  provider: string;
  config: Record<string, unknown>;
}

export type SupportedProvider = 'zip' | 'netlify' | 'github';