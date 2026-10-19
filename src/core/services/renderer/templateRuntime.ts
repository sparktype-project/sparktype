import Handlebars from 'handlebars';

/**
 * Themes are imported by users and therefore untrusted. Every template invocation goes through
 * this module so prototype property and method access stays off, whatever the call site passes.
 * Partials, @partial-block and inline partials inherit these options from the invoking call.
 */
const UNTRUSTED_THEME_OPTIONS = {
  allowProtoPropertiesByDefault: false,
  allowProtoMethodsByDefault: false,
} as const;

type TemplateSource = string | HandlebarsTemplateDelegate;

export function renderTemplate(
  template: TemplateSource,
  context: unknown,
  options: Handlebars.RuntimeOptions = {},
): string {
  const compiled = typeof template === 'function' ? template : Handlebars.compile(template);
  return compiled(context, { ...options, ...UNTRUSTED_THEME_OPTIONS });
}
