import type { MarkdownFrontmatter } from '@/core/types';
import type { CollectionContext } from '@/core/services/collectionContext.service';

export function shouldUseCollectionDisplayEditor(
  frontmatter: MarkdownFrontmatter | null | undefined,
  collectionContext: CollectionContext,
): boolean {
  if (collectionContext.isCollectionItem) {
    return false;
  }

  return frontmatter?.displayCollection === true;
}
