// src/features/editor/components/forms/SeoSettingsForm.tsx

import { useEffect, useState } from 'react';
import type { MarkdownFrontmatter } from '@/core/types';
import { validateCanonicalUrl } from '@/core/services/seo/pageSeo';
import { getRedirectFromValues, normalizeRedirectPath } from '@/core/services/seo/redirects';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Switch } from '@/core/components/ui/switch';
import { Textarea } from '@/core/components/ui/textarea';

interface SeoSettingsFormProps {
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

const parseLines = (text: string): string[] =>
  text.split('\n').map((line) => line.trim()).filter((line) => line !== '');

/**
 * Per-page search settings. Blank and "off" values clear the frontmatter key rather than
 * storing an empty one, so files only carry the fields an author has actually set.
 */
export default function SeoSettingsForm({ frontmatter, onFrontmatterChange }: SeoSettingsFormProps) {
  const canonical = typeof frontmatter.canonical === 'string' ? frontmatter.canonical : '';
  const canonicalError = validateCanonicalUrl(canonical);

  // The textarea keeps its own text so a trailing newline survives while typing; it is only
  // replaced when the stored list changes underneath it (another page was opened).
  const stored = getRedirectFromValues(frontmatter);
  const [redirectText, setRedirectText] = useState(() => stored.join('\n'));
  useEffect(() => {
    setRedirectText((current) => (parseLines(current).join('\n') === stored.join('\n') ? current : stored.join('\n')));
  }, [stored.join('\n')]); // eslint-disable-line react-hooks/exhaustive-deps
  const invalidRedirects = parseLines(redirectText).filter((line) => normalizeRedirectPath(line) === null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="seo-description">Description</Label>
        <Textarea
          id="seo-description"
          rows={3}
          placeholder="A short summary shown in search results"
          value={typeof frontmatter.description === 'string' ? frontmatter.description : ''}
          onChange={(event) => onFrontmatterChange({ description: event.target.value })}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="seo-noindex">Hide from search engines</Label>
          <p className="text-xs text-muted-foreground">Adds noindex and leaves the page out of the sitemap.</p>
        </div>
        <Switch
          id="seo-noindex"
          checked={frontmatter.noindex === true}
          onCheckedChange={(checked) => onFrontmatterChange({ noindex: checked ? true : undefined })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="seo-canonical">Canonical URL</Label>
        <Input
          id="seo-canonical"
          type="url"
          placeholder="https://example.com/original-post"
          value={canonical}
          aria-invalid={canonicalError !== null}
          aria-describedby={canonicalError ? 'seo-canonical-error' : undefined}
          onChange={(event) => onFrontmatterChange({ canonical: event.target.value.trim() === '' ? undefined : event.target.value })}
        />
        {canonicalError ? (
          <p id="seo-canonical-error" role="alert" className="text-xs text-destructive">{canonicalError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Only set this when the page republishes content that lives elsewhere.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="seo-redirects">Redirect from</Label>
        <Textarea
          id="seo-redirects"
          rows={3}
          placeholder={'/old-address\n/blog/2019/old-post'}
          value={redirectText}
          aria-invalid={invalidRedirects.length > 0}
          aria-describedby={invalidRedirects.length > 0 ? 'seo-redirects-error' : undefined}
          onChange={(event) => {
            setRedirectText(event.target.value);
            const lines = parseLines(event.target.value);
            onFrontmatterChange({ redirect_from: lines.length > 0 ? lines : undefined });
          }}
        />
        {invalidRedirects.length > 0 ? (
          <p id="seo-redirects-error" role="alert" className="text-xs text-destructive">
            Not a valid path, so it will be ignored: {invalidRedirects.join(', ')}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">One old path per line. Visitors to these addresses are sent to this page.</p>
        )}
      </div>
    </div>
  );
}
