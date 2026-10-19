import { describe, expect, it } from 'vitest';
import { validateHandlebarsTemplate } from '../themeValidation.service';

const check = (html: string) => validateHandlebarsTemplate(html, 'base.hbs');

describe('validateHandlebarsTemplate script sources', () => {
  it.each([
    ['protocol-relative origin', '<script src="//evil.example/x.js"></script>'],
    ['untrusted https origin', '<script src="https://evil.example/x.js"></script>'],
    ['plain http', '<script src="http://cdn.jsdelivr.net/x.js"></script>'],
    ['templated host', '<script src="https://{{host}}/x.js"></script>'],
    ['templated host suffix', '<script src="https://cdn.{{host}}/x.js"></script>'],
    ['untrusted origin before a template', '<script src="https://evil.example/{{file}}.js"></script>'],
    ['javascript url', '<script src="javascript:alert(1)"></script>'],
    ['inline script', '<script>alert(1)</script>'],
  ])('blocks %s', (_label, html) => {
    expect(check(html).valid).toBe(false);
  });

  it.each([
    ['local absolute path', '<script src="/assets/app.js"></script>'],
    ['relative path', '<script src="./app.js"></script>'],
    ['templated local path', '<script src="{{root}}assets/app.js"></script>'],
    ['trusted https origin', '<script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js" defer></script>'],
    ['trusted origin before a template', '<script src="https://cdn.jsdelivr.net/npm/{{pkg}}.js"></script>'],
  ])('allows %s', (_label, html) => {
    expect(check(html).errors).toEqual([]);
  });
});
