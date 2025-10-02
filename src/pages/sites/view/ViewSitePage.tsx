// src/pages/sites/view/ViewSitePage.tsx

import SiteViewer from '@/features/viewer/components/SiteViewer';
import ViewHeaderContent from '@/features/viewer/components/ViewHeaderContent';
import { useAppStore } from '@/core/state/useAppStore';
import { useCallback, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { HeaderContext } from '@/core/contexts/HeaderContext';

export default function ViewSitePage() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const site = useAppStore(useCallback((state) => state.getSiteById(siteId), [siteId]));
  const { setHeaderContent } = useContext(HeaderContext);

  const pageTitle = `Preview: ${site?.manifest?.title || 'Loading...'}`;

  // Replace the default header with ViewHeaderContent
  useEffect(() => {
    setHeaderContent(<ViewHeaderContent />);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  return (
    <>
      <title>{pageTitle}</title>
      <SiteViewer />
    </>
  );
}