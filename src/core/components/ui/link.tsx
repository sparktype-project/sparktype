// src/core/components/ui/link.tsx

import React from 'react';
import { Link as RouterLink, type LinkProps } from 'react-router-dom';

/**
 * A wrapper around react-router-dom's Link component.
 *
 * This component ensures that all internal navigation leverages client-side
 * routing, preventing full-page reloads and preserving application state.
 *
 * It accepts a 'to' prop for the destination path and forwards all other
 * standard anchor tag props (like className, children, target, etc.) to the
 * underlying router link. The `ref` is also forwarded for compatibility with
 * other UI libraries and direct DOM access.
 */
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, ...props }, ref) => {
    // The underlying component from react-router-dom handles the navigation logic.
    // All other props, including `className` and `children`, are passed through.
    return <RouterLink ref={ref} to={to} {...props} />;
  }
);

Link.displayName = 'Link';