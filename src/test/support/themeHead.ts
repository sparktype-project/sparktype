import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';

/**
 * Renders a bundled theme's real `partials/head.hbs` against a hand-built head context, the same
 * way `base.hbs` does (`{{> head headContext}}`), so tests can assert on the emitted tags.
 */
export function renderThemeHead(
  theme: string,
  headContext: Record<string, unknown>,
  options: { isExport?: boolean; relativeAssetPath?: string } = {},
): string {
  const hbs = Handlebars.create();
  hbs.registerPartial('head', readFileSync(join(process.cwd(), 'public/themes', theme, 'partials/head.hbs'), 'utf8'));
  hbs.registerHelper('image', () => new hbs.SafeString('/stub-image.png'));
  const template = hbs.compile('{{> head headContext}}');
  return template({
    headContext: { themeStylesheets: [], pageTitle: 'Page', manifest: { title: 'Site', description: 'Site description', theme: { name: theme } }, ...headContext },
    options: { isExport: options.isExport ?? true, relativeAssetPath: options.relativeAssetPath ?? '' },
  });
}

export const BUNDLED_THEMES = ['sparksite', 'sparkdocs'] as const;
