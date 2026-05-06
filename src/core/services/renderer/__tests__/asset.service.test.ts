import { generateStyleOverrides } from '../asset.service';

describe('generateStyleOverrides', () => {
  test('preserves CSS custom property keys from theme config', () => {
    const css = generateStyleOverrides({
      '--font-body': '"Gentium Book Plus", Georgia, serif',
      '--color-primary': '#ff3366',
    });

    expect(css).toContain('--font-body: "Gentium Book Plus", Georgia, serif;');
    expect(css).toContain('--color-primary: #ff3366;');
    expect(css).not.toContain('----font-body');
    expect(css).not.toContain('----color-primary');
  });

  test('adds a custom property prefix for legacy plain keys', () => {
    const css = generateStyleOverrides({
      accent_color: '#0d6efd',
    });

    expect(css).toContain('--accent-color: #0d6efd;');
  });
});
