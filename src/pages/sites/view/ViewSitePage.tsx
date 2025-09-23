// src/pages/sites/view/ViewSitePage.tsx

import SiteViewer from '@/features/viewer/components/SiteViewer';
import { useAppStore } from '@/core/state/useAppStore';
import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useHeaderContext } from '@/core/contexts/HeaderContext';
import ViewHeaderContent from '@/core/components/header-content/ViewHeaderContent';

export default function ViewSitePage() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const site = useAppStore(useCallback((state) => state.getSiteById(siteId), [siteId]));
  const { setHeaderContent } = useHeaderContext();

  const pageTitle = `Preview: ${site?.manifest?.title || 'Loading...'}`;

  // Set the header content when this page mounts
  useEffect(() => {
    setHeaderContent(<ViewHeaderContent />);

    // Clean up when unmounting
    return () => {
      setHeaderContent(null);
    };
  }, [setHeaderContent]);

  return (
    <>
      <title>{pageTitle}</title>

      {/*
        This page's only job is to render the master preview component.
        The SiteViewer component itself will read the URL and parameters
        to determine what to render inside the iframe.
      */}
      <SiteViewer />
    </>
  );
}