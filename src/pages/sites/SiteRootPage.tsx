// src/pages/sites/SiteRootPage.tsx

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * A smart entry point for a site's backend.
 * Its only job is to redirect the user to the editor for that site.
 * This component handles the 'index' route for `/sites/:siteId`.
 */
export default function SiteRootPage() {
  const navigate = useNavigate();
  const { siteId } = useParams<{ siteId: string }>();

  useEffect(() => {
    if (siteId) {
      // Use `replace: true` to avoid polluting the browser's history.
      // This sends the user directly to the site editor.
      navigate(`/sites/${siteId}/edit`, { replace: true });
    }
    // This effect runs only when the siteId changes.
  }, [siteId, navigate]);

  // Display a loading message while the redirect is processed by the browser.
  return (
    <div className="flex justify-center items-center h-full">
      <p>Redirecting to editor...</p>
    </div>
  );
}