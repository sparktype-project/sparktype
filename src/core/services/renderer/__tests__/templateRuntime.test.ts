import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import { afterEach, describe, expect, it } from 'vitest';
import { renderTemplate } from '../templateRuntime';

class Secretive {
  visible = 'ok';
  get hidden() {
    return 'LEAK-getter';
  }
  method() {
    return 'LEAK-method';
  }
}

const registered: string[] = [];
function partial(name: string, source: string) {
  Handlebars.registerPartial(name, source);
  registered.push(name);
}

afterEach(() => {
  registered.splice(0).forEach((name) => Handlebars.unregisterPartial(name));
});

describe('renderTemplate', () => {
  it('renders own properties normally', () => {
    expect(renderTemplate('{{title}} {{#each tags}}[{{this}}]{{/each}}', { title: 'Hi', tags: ['a', 'b'] })).toBe('Hi [a][b]');
  });

  it('blocks inherited properties and methods', () => {
    const out = renderTemplate('{{visible}}|{{hidden}}|{{method}}|{{constructor}}|{{__proto__}}', new Secretive());
    expect(out).toBe('ok||||');
  });

  it('blocks constructor access through lookup', () => {
    const out = renderTemplate(
      '{{lookup this "constructor"}}|{{lookup (lookup this "constructor") "name"}}|{{lookup this "__proto__"}}',
      { a: 1 },
    );
    expect(out).toBe('||');
  });

  it('blocks prototype access through with/each', () => {
    const out = renderTemplate('{{#with __proto__}}LEAK{{/with}}{{#each constructor}}LEAK{{/each}}', new Secretive());
    expect(out).not.toContain('LEAK');
  });

  it('ignores caller attempts to re-enable prototype access', () => {
    const out = renderTemplate('{{hidden}}{{method}}', new Secretive(), {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true,
    });
    expect(out).toBe('');
  });

  it('keeps the restrictions inside registered partials', () => {
    partial('evil', '{{hidden}}{{method}}{{constructor}}{{lookup this "constructor"}}');
    expect(renderTemplate('{{> evil}}', new Secretive())).toBe('');
  });

  it('keeps the restrictions inside @partial-block content', () => {
    partial('wrap', '<div>{{> @partial-block}}</div>');
    const out = renderTemplate('{{#> wrap}}{{hidden}}{{method}}{{constructor}}{{/wrap}}', new Secretive());
    expect(out).toBe('<div></div>');
  });

  it('keeps the restrictions inside inline partials and dynamic partial names', () => {
    partial('target', '{{hidden}}{{constructor}}');
    const out = renderTemplate(
      '{{#*inline "x"}}{{method}}{{constructor}}{{/inline}}{{> x}}{{> (lookup . "pick")}}',
      Object.assign(new Secretive(), { pick: 'target' }),
    );
    expect(out).toBe('');
  });

  it('cannot reach a partial through a prototype-supplied name', () => {
    partial('target', 'LEAK');
    expect(() => renderTemplate('{{> (lookup . "constructor")}}', { a: 1 })).toThrow(/partial/i);
  });

  it('applies to compiled partial functions used by helpers', () => {
    const compiled = Handlebars.compile('{{hidden}}{{method}}{{visible}}');
    expect(renderTemplate(compiled, new Secretive())).toBe('ok');
  });
});

describe('runtime options are centralised', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(full);
      return /\.tsx?$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
    });
  }

  it('sets allowProto* options only in templateRuntime.ts', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src'))
      .filter((file) => !file.endsWith('templateRuntime.ts'))
      .filter((file) => /allowProto(Properties|Methods)ByDefault/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('never calls a compiled template directly outside templateRuntime.ts', () => {
    const rendererDir = join(process.cwd(), 'src/core/services/renderer');
    const offenders = sourceFiles(rendererDir)
      .filter((file) => !file.endsWith('templateRuntime.ts'))
      .filter((file) => /Handlebars\.compile\(/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('bundled themes', () => {
  function templates(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return templates(full);
      return full.endsWith('.hbs') ? [full] : [];
    });
  }

  it.each(['sparksite', 'sparkdocs'])('%s compiles and never relies on prototype access', (theme) => {
    const files = templates(join(process.cwd(), 'public/themes', theme));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(() => Handlebars.precompile(source), file).not.toThrow();
      expect(source, file).not.toMatch(/constructor|__proto__|prototype|__(define|lookup)(Getter|Setter)__/);
    }
  });
});
