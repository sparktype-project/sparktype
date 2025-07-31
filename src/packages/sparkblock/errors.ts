// src/packages/sparkblock/errors.ts

import type { ValidationResult } from './types';

export class SparkBlockError extends Error {
  code?: string;
  blockId?: string;
  
  constructor(
    message: string,
    code?: string,
    blockId?: string
  ) {
    super(message);
    this.name = 'SparkBlockError';
    this.code = code;
    this.blockId = blockId;
  }
}

export class SparkBlockValidationError extends SparkBlockError {
  validation: ValidationResult;
  
  constructor(
    message: string,
    validation: ValidationResult,
    blockId?: string
  ) {
    super(message, 'VALIDATION_ERROR', blockId);
    this.name = 'SparkBlockValidationError';
    this.validation = validation;
  }
}

export class SparkBlockAdapterError extends SparkBlockError {
  originalError?: Error;
  
  constructor(message: string, originalError?: Error) {
    super(message, 'ADAPTER_ERROR');
    this.name = 'SparkBlockAdapterError';
    this.originalError = originalError;
  }
}