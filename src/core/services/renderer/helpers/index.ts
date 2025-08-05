// src/lib/theme-helpers/index.ts
// ... (other helper imports)
import { queryHelper } from './query.helper';
import { comparisonHelpers } from './comparison.helper';
import { markdownHelper } from './markdown.helper';
import { strUtilHelper } from './strUtil.helper';
import { formatDateHelper } from './formatDate.helper';
import { pagerHelper } from './pager.helper';
import type { SparktypeHelper } from './types';
import { getUrlHelper } from './getUrl.helper';
import { assignHelper } from './assign.helper';
import { imageHelper } from './image.helper';
import { concatHelper } from './concat.helper';
import { imageUrlHelper } from './imageUrl.helper';
import { renderLayoutHelper } from './renderLayout.helper';
import { renderItemHelper } from './renderItem.helper';
import { renderCollectionHelper } from './renderCollection.helper';
import { themeDataHelper, rawThemeDataHelper } from './themeData.helper';
// render_blocks.helper removed - BlockNote handles this natively
import { collectionViewHelper } from './collectionView.helper';

export const coreHelpers: SparktypeHelper[] = [
  queryHelper,
  strUtilHelper,
  formatDateHelper,
  comparisonHelpers,
  markdownHelper,
  renderItemHelper, 
  renderCollectionHelper,
  pagerHelper,
  getUrlHelper,
  assignHelper,
  imageHelper,
  concatHelper,
  imageUrlHelper,
  renderLayoutHelper,
  themeDataHelper,
  rawThemeDataHelper,
  // renderBlocksHelper removed - BlockNote handles this natively
  collectionViewHelper
];