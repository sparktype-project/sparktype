import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

export const mediaResizeHandleVariants = cva(
  cn(
    'top-0 flex w-6 flex-col justify-center select-none',
    "after:flex after:h-16 after:w-[3px] after:rounded-[6px] after:bg-ring after:opacity-0 after:content-['_'] group-hover:after:opacity-100"
  ),
  {
    variants: {
      direction: {
        left: '-left-3 -ml-3 pl-3',
        right: '-right-3 -mr-3 items-end pr-3',
      },
    },
  }
);
