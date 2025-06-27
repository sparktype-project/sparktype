// src/core/hooks/useHashNavigation.ts
'use client';

import { useState, useEffect } from 'react';

// A helper to safely get the hash and clean it up.
function getCleanHash() {
  if (typeof window === 'undefined') return '/';
  // Get the hash, remove the leading #, and ensure it starts with a /
  const hash = window.location.hash.substring(1);
  return hash.startsWith('/') ? hash : `/${hash}`;
}

export function useHashNavigation() {
  const [currentPath, setCurrentPath] = useState(getCleanHash());

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(getCleanHash());
    };

    // Listen for changes to the hash
    window.addEventListener('hashchange', handleHashChange);
    // Set the initial path when the component mounts
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return currentPath;
}