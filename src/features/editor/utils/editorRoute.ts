import type { MarkdownFrontmatter } from '@/core/types';
import type { CollectionContext } from '@/core/services/collectionContext.service';

export function shouldDisplayCollectionList(
  frontmatter: MarkdownFrontmatter | null | undefined,
  collectionContext: CollectionContext,
): boolean {
  return Boolean(frontmatter?.layoutConfig?.collectionId) && !collectionContext.isCollectionItem;
}

