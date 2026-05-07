export const MEDIA_TYPES = {
  image: 'image',
  video: 'video',
} as const;

export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES];

export const NODE_NAMES = {
  image: 'image',
  video: 'sparktypeVideo',
  mediaEmbed: 'mediaEmbed',
  collectionView: 'collectionView',
  columnGroup: 'columnGroup',
  column: 'column',
} as const;
