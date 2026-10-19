// src/features/editor/components/forms/SeoSettingsForm.tsx

import type { MarkdownFrontmatter } from '@/core/types';
import { validateCanonicalUrl } from '@/core/services/seo/pageSeo';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Switch } from '@/core/components/ui/switch';
import { Textarea } from '@/core/components/ui/textarea';

interface SeoSettingsFormProps {
  frontmatter: MarkdownFrontmatter;
  onFrontmatterChange: (update: Partial<MarkdownFrontmatter>) => void;
}

/**
 * Per-page search settings. Blank and "off" values clear the frontmatter key rather than
 * storing an empty one, so files only carry the fields an author has actually set.
 */
export default function SeoSettingsForm({ frontmatter, onFrontmatterChange }: SeoSettingsFormProps) {
  const canonical = typeof frontmatter.canonical === 'string' ? frontmatter.canonical : '';
  const canonicalError = validateCanonicalUrl(canonical);

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
    </div>
  );
}
