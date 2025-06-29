// src/core/services/themes/helpers/render_layout.helper.ts

import Handlebars from 'handlebars';
import type { SparktypeHelper } from './types';

export const renderLayoutHelper: SparktypeHelper = () => ({
  /**
   * An async Handlebars helper that renders a specified layout/partial
   * and waits for any async helpers within it to resolve.
   * This is the key to solving nested `[object Promise]` issues.
   *
   * @example
   * {{{render_layout 'pageLayout' this}}}
   *
   * @param {...unknown[]} args - The arguments passed from the template. Expected:
   *   - args[0]: The name of the partial to render (string).
   *   - args[1]: The data context to pass to the partial (object).
   *   - The last argument is the Handlebars options object, which is ignored here.
   * @returns {Promise<Handlebars.SafeString>} The fully rendered and resolved HTML.
   */
  render_layout: async function(...args: unknown[]): Promise<Handlebars.SafeString> {
    // The template arguments are all but the last one (which is the options object).
    const templateArgs = args.slice(0, -1); 
    
    const layoutName = templateArgs[0];
    const context = templateArgs[1];

    // Type guards for safety and clear error logging.
    if (typeof layoutName !== 'string' || !Handlebars.partials[layoutName]) {
      console.warn(`[render_layout] Layout partial "${String(layoutName)}" not found or invalid.`);
      return new Handlebars.SafeString('');
    }

    if (typeof context !== 'object' || context === null) {
        console.warn(`[render_layout] Invalid context object provided for layout "${layoutName}".`);
        return new Handlebars.SafeString('');
    }

    const template = Handlebars.compile(Handlebars.partials[layoutName]);
    
    // The key is to `await` the execution of the template here.
    // This pauses the helper until all nested async helpers have resolved.
    const renderedHtml = await template(context);
    
    return new Handlebars.SafeString(renderedHtml);
  }
});