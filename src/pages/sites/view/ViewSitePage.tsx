// src/pages/sites/view/ViewSitePage.tsx

import SiteViewer from '@/features/viewer/components/SiteViewer';
import { useAppStore } from '@/core/state/useAppStore';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';

export default function ViewSitePage() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const site = useAppStore(useCallback((state) => state.getSiteById(siteId), [siteId]));

  const pageTitle = `Preview: ${site?.manifest?.title || 'Loading...'}`;

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