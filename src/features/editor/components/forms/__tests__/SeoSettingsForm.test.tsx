import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MarkdownFrontmatter } from '@/core/types';
import { parseMarkdownString, stringifyToMarkdown } from '@/core/libraries/markdownParser';
import SeoSettingsForm from '../SeoSettingsForm';

function Harness({ initial, onChange }: { initial: MarkdownFrontmatter; onChange: (fm: MarkdownFrontmatter) => void }) {
  const [frontmatter, setFrontmatter] = useState(initial);
  return (
    <SeoSettingsForm
      frontmatter={frontmatter}
      onFrontmatterChange={(update) => {
        const next = { ...frontmatter, ...update };
        setFrontmatter(next);
        onChange(next);
      }}
    />
  );
}

const base: MarkdownFrontmatter = { title: 'Page', layout: 'page' };

describe('SeoSettingsForm', () => {
  test('edits the description, noindex and canonical fields', () => {
    const onChange = vi.fn();
    render(<Harness initial={base} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A summary' } });
    fireEvent.click(screen.getByRole('switch', { name: /hide from search engines/i }));
    fireEvent.change(screen.getByLabelText('Canonical URL'), { target: { value: 'https://other.example/x' } });

    expect(onChange).toHaveBeenLastCalledWith({
      ...base,
      description: 'A summary',
      noindex: true,
      canonical: 'https://other.example/x',
    });
  });

  test('clearing noindex and canonical removes the keys instead of storing empty values', () => {
    const onChange = vi.fn();
    render(<Harness initial={{ ...base, noindex: true, canonical: 'https://other.example/x' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('switch', { name: /hide from search engines/i }));
    fireEvent.change(screen.getByLabelText('Canonical URL'), { target: { value: '' } });

    const last = onChange.mock.lastCall![0] as MarkdownFrontmatter;
    expect(last.noindex).toBeUndefined();
    expect(last.canonical).toBeUndefined();
  });

  test('shows a validation error for an invalid canonical URL', () => {
    render(<Harness initial={{ ...base, canonical: 'not-a-url' }} onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/full URL/);
    expect(screen.getByLabelText('Canonical URL')).toHaveAttribute('aria-invalid', 'true');
  });

  test('has no error for a valid canonical URL', () => {
    render(<Harness initial={{ ...base, canonical: 'https://other.example/x' }} onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SeoSettingsForm redirects', () => {
  test('stores one path per line as a list, keeping a typed trailing newline', () => {
    const onChange = vi.fn();
    render(<Harness initial={base} onChange={onChange} />);
    const box = screen.getByLabelText('Redirect from') as HTMLTextAreaElement;

    fireEvent.change(box, { target: { value: '/old\n' } });
    expect(box.value).toBe('/old\n');
    fireEvent.change(box, { target: { value: '/old\n/blog/older' } });

    expect((onChange.mock.lastCall![0] as MarkdownFrontmatter).redirect_from).toEqual(['/old', '/blog/older']);
  });

  test('shows the stored list and clears the key when emptied', () => {
    const onChange = vi.fn();
    render(<Harness initial={{ ...base, redirect_from: ['/a', '/b'] }} onChange={onChange} />);
    const box = screen.getByLabelText('Redirect from') as HTMLTextAreaElement;
    expect(box.value).toBe('/a\n/b');

    fireEvent.change(box, { target: { value: '' } });
    expect((onChange.mock.lastCall![0] as MarkdownFrontmatter).redirect_from).toBeUndefined();
  });

  test('flags a path that cannot be a redirect source', () => {
    render(<Harness initial={{ ...base, redirect_from: ['/ok', 'https://example.org/x'] }} onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('https://example.org/x');
  });

  test('persists as a YAML list', () => {
    const { frontmatter } = parseMarkdownString(stringifyToMarkdown({ ...base, redirect_from: ['/a', '/b/c'] }, 'Body'));
    expect(frontmatter.redirect_from).toEqual(['/a', '/b/c']);
  });
});

describe('SEO frontmatter persistence', () => {
  test('noindex and canonical survive a save and reload; unset fields are not written', () => {
    const saved = stringifyToMarkdown(
      { ...base, noindex: true, canonical: 'https://other.example/x?a=1&b=2', description: 'D' },
      'Body',
    );
    const { frontmatter } = parseMarkdownString(saved);
    expect(frontmatter).toMatchObject({ noindex: true, canonical: 'https://other.example/x?a=1&b=2', description: 'D' });

    const cleared = stringifyToMarkdown({ ...base, noindex: undefined, canonical: undefined }, 'Body');
    expect(cleared).not.toContain('noindex');
    expect(cleared).not.toContain('canonical');
  });
});
