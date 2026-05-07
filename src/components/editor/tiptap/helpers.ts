import type { ImageRef, VideoRef } from '@/core/types';

export interface CollectionViewAttrs {
  collection: string;
  layout: string;
  displayType: string;
  maxItems: number;
  sortBy: string;
  sortOrder: string;
  tagFilters: string[];
}

export interface SparktypeImageAttrs {
  src: string;
  alt: string;
  title: string | null;
  imageRef: ImageRef | null;
}

export interface SparktypeVideoAttrs {
  src: string;
  poster: string | null;
  isUpload: boolean;
  videoRef: VideoRef | null;
}

export interface MediaEmbedAttrs {
  url: string;
  embedSrc: string;
  provider: string | null;
}

export const DEFAULT_COLLECTION_VIEW_ATTRS: CollectionViewAttrs = {
  collection: '',
  layout: 'list-view',
  displayType: '',
  maxItems: 10,
  sortBy: 'date',
  sortOrder: 'desc',
  tagFilters: [],
};

const DIRECT_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.ogg'];

export function isAbsoluteOrSpecialUrl(url: string): boolean {
  return /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('/');
}

export function isDirectVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return DIRECT_VIDEO_EXTENSIONS.some((extension) =>
      parsed.pathname.toLowerCase().endsWith(extension),
    );
  } catch {
    return false;
  }
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function parseImageRef(src: string, alt = ''): ImageRef | null {
  return inferImageRefFromSource(src, alt);
}

export function inferImageRefFromSource(
  src: string,
  alt = '',
  defaultServiceId?: string,
): ImageRef | null {
  if (src.startsWith('assets/images/') || src.startsWith('assets/originals/')) {
    return {
      serviceId: 'local',
      src,
      alt,
    };
  }

  if (defaultServiceId && defaultServiceId !== 'local' && !isAbsoluteOrSpecialUrl(src)) {
    return {
      serviceId: defaultServiceId,
      src,
      alt,
    };
  }

  return null;
}

export function parseMaybeJson<T>(value: unknown): T | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function serializeMaybeJson(value: unknown): string | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseDirectiveValue(rawValue: string): string {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseDirectiveAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,\s}]+)/g;

  for (const match of raw.matchAll(pattern)) {
    const [, key, value] = match;

    if (!key || value === undefined) {
      continue;
    }

    attributes[key] = parseDirectiveValue(value);
  }

  return attributes;
}

export function serializeDirectiveAttributes(attributes: Record<string, string | number | undefined>): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}="${String(value).replaceAll('"', '\\"')}"`)
    .join(' ');
}

export function parseCollectionViewAttrs(raw: string): CollectionViewAttrs {
  const parsed = parseDirectiveAttributes(raw);

  return {
    collection: parsed.collection ?? '',
    layout: parsed.layout ?? DEFAULT_COLLECTION_VIEW_ATTRS.layout,
    displayType: parsed.displayType ?? '',
    maxItems: parsed.maxItems ? Number(parsed.maxItems) || DEFAULT_COLLECTION_VIEW_ATTRS.maxItems : DEFAULT_COLLECTION_VIEW_ATTRS.maxItems,
    sortBy: parsed.sortBy ?? DEFAULT_COLLECTION_VIEW_ATTRS.sortBy,
    sortOrder: parsed.sortOrder ?? DEFAULT_COLLECTION_VIEW_ATTRS.sortOrder,
    tagFilters: parsed.tagFilters
      ? parsed.tagFilters.split(',').map((value) => value.trim()).filter(Boolean)
      : [],
  };
}

export function renderCollectionViewDirective(attrs: Partial<CollectionViewAttrs>): string {
  const tagFilters = attrs.tagFilters?.filter(Boolean).join(',');
  const body = serializeDirectiveAttributes({
    collection: attrs.collection ?? '',
    layout: attrs.layout ?? DEFAULT_COLLECTION_VIEW_ATTRS.layout,
    displayType: attrs.displayType ?? '',
    maxItems: attrs.maxItems ?? DEFAULT_COLLECTION_VIEW_ATTRS.maxItems,
    sortBy: attrs.sortBy ?? DEFAULT_COLLECTION_VIEW_ATTRS.sortBy,
    sortOrder: attrs.sortOrder ?? DEFAULT_COLLECTION_VIEW_ATTRS.sortOrder,
    tagFilters: tagFilters || undefined,
  });

  return `::collection_view{${body}}`;
}

export function getEmbedProvider(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return 'youtube';
    }
    if (host.includes('vimeo.com')) {
      return 'vimeo';
    }
    if (host.includes('twitter.com') || host.includes('x.com')) {
      return 'twitter';
    }

    return host;
  } catch {
    return null;
  }
}

export function getEmbedSrc(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${id}`;
    }

    if (host.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }

    if (host.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      if (id) {
        return `https://player.vimeo.com/video/${id}`;
      }
    }

    return url;
  } catch {
    return url;
  }
}

const PROVIDER_KEY_MAP: Record<string, string> = {
  publicid: 'publicId',
  resourcetype: 'resourceType',
  secureurl: 'secureUrl',
  thumbnailurl: 'thumbnailUrl',
  playbackurl: 'playbackUrl',
};

export function normalizeProviderAttributeKey(key: string): string {
  return PROVIDER_KEY_MAP[key] ?? key;
}
