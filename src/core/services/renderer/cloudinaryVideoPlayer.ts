import type { Manifest } from '@/core/types';

const CLOUDINARY_PLAYER_BASE_URL = 'https://player.cloudinary.com/embed/';
const DEFAULT_ASPECT_RATIO = 56.25;

function parseHtmlAttributes(attributeString: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributeRegex = /([\w:-]+)="([^"]*)"/g;

  for (const match of attributeString.matchAll(attributeRegex)) {
    const [, key, value] = match;
    if (key) {
      attributes[key] = value || '';
    }
  }

  return attributes;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function getCloudinaryCloudName(manifest: Manifest, attributes: Record<string, string>): string | null {
  const providerConfig = manifest.settings?.imageProviders?.cloudinary;
  const configuredCloudName =
    providerConfig && typeof providerConfig.cloudName === 'string'
      ? providerConfig.cloudName
      : typeof manifest.settings?.cloudinary?.cloudName === 'string'
        ? manifest.settings.cloudinary.cloudName
        : null;

  if (configuredCloudName) {
    return configuredCloudName;
  }

  const src = attributes.src;
  if (!src) {
    return null;
  }

  try {
    const parsed = new URL(src);
    const match = parsed.pathname.match(/^\/([^/]+)\//);
    if (parsed.hostname === 'res.cloudinary.com' && match?.[1]) {
      return match[1];
    }
  } catch {
    return null;
  }

  return null;
}

function getCloudinaryPublicId(attributes: Record<string, string>): string | null {
  return (
    attributes['data-sparktype-video-src'] ||
    attributes['data-sparktype-provider-publicId'] ||
    null
  );
}

function getAspectRatioPercent(attributes: Record<string, string>): number {
  const width = Number(attributes['data-sparktype-width'] || '');
  const height = Number(attributes['data-sparktype-height'] || '');

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return (height / width) * 100;
  }

  return DEFAULT_ASPECT_RATIO;
}

function getPreferredSourceTypes(attributes: Record<string, string>): string[] {
  const format = (attributes['data-sparktype-provider-format'] || '').toLowerCase();

  if (format === 'webm') {
    return ['webm', 'mp4'];
  }

  if (format === 'ogv' || format === 'ogg') {
    return ['ogv', 'mp4'];
  }

  return ['mp4'];
}

function buildCloudinaryPlayerUrl(
  cloudName: string,
  publicId: string,
  attributes: Record<string, string>,
): string {
  const params = new URLSearchParams();
  params.set('cloud_name', cloudName);
  params.set('public_id', publicId);

  getPreferredSourceTypes(attributes).forEach((sourceType, index) => {
    params.append(`source[source_types][${index}]`, sourceType);
  });

  return `${CLOUDINARY_PLAYER_BASE_URL}?${params.toString()}`;
}

function buildCloudinaryPlayerIframe(manifest: Manifest, attributes: Record<string, string>): string | null {
  if (attributes['data-sparktype-upload'] !== 'true' || attributes['data-sparktype-service-id'] !== 'cloudinary') {
    return null;
  }

  const publicId = getCloudinaryPublicId(attributes);
  const cloudName = getCloudinaryCloudName(manifest, attributes);

  if (!publicId || !cloudName) {
    return null;
  }

  const playerUrl = buildCloudinaryPlayerUrl(cloudName, publicId, attributes);
  const paddingTop = getAspectRatioPercent(attributes);
  const title = escapeHtmlAttribute(attributes.title || publicId);

  return [
    `<div class="sparktype-cloudinary-video not-prose" data-sparktype-cloudinary-player="true" style="position:relative;width:100%;padding-top:${paddingTop}%;overflow:hidden;border-radius:0.75rem;background:#000;">`,
    `<iframe src="${escapeHtmlAttribute(playerUrl)}" title="${title}" loading="lazy" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen frameborder="0" width="100%" height="100%" style="position:absolute;inset:0;border:0;width:100%;height:100%;"></iframe>`,
    '</div>',
  ].join('');
}

export function replaceCloudinaryHostedVideos(htmlContent: string, manifest: Manifest): string {
  return htmlContent.replace(/<video\b([^>]*)>\s*<\/video>/gi, (fullMatch, attributeString: string) => {
    const replacement = buildCloudinaryPlayerIframe(manifest, parseHtmlAttributes(attributeString));
    return replacement ?? fullMatch;
  });
}
