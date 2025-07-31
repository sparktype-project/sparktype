// src/core/services/renderer/helpers/asyncResolver.ts

/**
 * Utility to resolve async helpers in Handlebars templates.
 * This function recursively processes rendered HTML to find and resolve any Promise objects
 * that may have been returned by async helpers.
 */

import Handlebars from 'handlebars';

/**
 * Resolves all promises in a Handlebars template by repeatedly rendering
 * until no more promises are found.
 */
export async function resolveAsyncTemplate(
  templateSource: string,
  context: any,
  maxIterations: number = 10
): Promise<string> {
  let currentHtml = '';
  let iteration = 0;
  
  // Compile the template once
  const template = Handlebars.compile(templateSource);
  
  // Keep rendering until no more promises are found or max iterations reached
  while (iteration < maxIterations) {
    iteration++;
    
    // Render the template
    const rendered = await template(context);
    currentHtml = typeof rendered === 'string' ? rendered : String(rendered);
    
    // Check if the rendered HTML contains any promise-like strings
    if (!currentHtml.includes('[object Promise]')) {
      // No more promises, we're done
      break;
    }
    
    // If we still have promises after max iterations, log a warning
    if (iteration >= maxIterations) {
      console.warn(`[asyncResolver] Max iterations (${maxIterations}) reached while resolving async helpers. Some promises may not have resolved.`);
      break;
    }
  }
  
  return currentHtml;
}

/**
 * Alternative approach: Pre-resolve all async helpers in the context
 * before passing to Handlebars.
 */
export async function resolveAsyncContext(context: any): Promise<any> {
  if (!context || typeof context !== 'object') {
    return context;
  }
  
  const resolved: any = Array.isArray(context) ? [] : {};
  
  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Promise) {
      resolved[key] = await value;
    } else if (value && typeof value === 'object') {
      resolved[key] = await resolveAsyncContext(value);
    } else {
      resolved[key] = value;
    }
  }
  
  return resolved;
}