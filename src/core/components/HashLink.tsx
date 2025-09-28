// src/core/components/ui/HashLink.tsx


import { type AnchorHTMLAttributes, type FC, forwardRef } from 'react';
import { cn } from '@/core/libraries/utils';

interface HashLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  // 'to' will be the path without the hash, e.g., "/sites/123"
  to: string;
}

export const HashLink: FC<HashLinkProps> = forwardRef<HTMLAnchorElement, HashLinkProps>(
  ({ to, children, className, ...props }, ref) => {
    // The href is constructed with the required # prefix.
    // We remove a leading slash from 'to' if it exists, as the # acts as the root.
    const href = `#${to.startsWith('/') ? to : `/${to}`}`;
    return (
      <a href={href} className={cn(className)} ref={ref} {...props}>
        {children}
      </a>
    );
  }
);
HashLink.displayName = 'HashLink';