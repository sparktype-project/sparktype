// src/core/services/theme-engine/helpers/assign.helper.ts
import type { SparktypeHelper } from './types';
import type { HelperOptions } from 'handlebars';

export const assignHelper: SparktypeHelper = () => ({
  /**
   * A Handlebars helper to add a new property to an object's context
   * before rendering a block. This is useful for augmenting data inside a loop.
   *
   * @example
   * {{#assign myItem "newUrl" "https://example.com"}}
   *   <a href="{{this.newUrl}}">{{this.title}}</a>
   * {{/assign}}
   */

  assign: function(this: unknown, ...args: unknown[]): string {
    // The last argument passed by Handlebars is always the options object.
    const options = args.pop() as HelperOptions;

    // We expect 3 arguments from the template: [object, key, value]
    if (args.length !== 3) {
      console.warn('Handlebars "assign" helper called with incorrect number of arguments. Expected 3.');
      // Gracefully fail by rendering the {{else}} block if it exists.
      return options.inverse ? options.inverse(this) : '';
    }

    const [object, key, value] = args;

    // Add type guards to ensure the arguments are used safely.
    if (typeof object !== 'object' || object === null) {
      console.warn(`Handlebars "assign" helper: first argument must be an object, but received type ${typeof object}.`);
      return options.inverse ? options.inverse(this) : '';
    }

    if (typeof key !== 'string' || key === '') {
      console.warn(`Handlebars "assign" helper: second argument must be a non-empty string key, but received type ${typeof key}.`);
      return options.inverse ? options.inverse(this) : '';
    }

    // Create a new context object by spreading the original and adding the new key-value pair.
    const newContext = { ...object, [key]: value };

    // Execute the inner block of the helper, passing the new, augmented context to it.
    // This is what makes the new property available inside the {{#assign}}...{{/assign}} block.
    return options.fn(newContext);
  },
});