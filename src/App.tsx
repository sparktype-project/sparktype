// src/App.tsx

import { Suspense, useEffect, useState, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// Global State and UI Management
import { useAppStore } from './core/state/useAppStore';
import { useInitialiseUIStore } from './core/hooks/useInitialiseUIStore';
import { Toaster } from "./core/components/ui/sonner";
import AuthGuard from './core/components/AuthGuard';
import { PlatformProvider } from './core/providers/PlatformProvider';
import Loader from './core/components/ui/Loader';
import { Button } from './core/components/ui/button';
// --- Code-Splitting Page Imports using React.lazy ---
// This is a best practice to keep the initial bundle size small.
// Each page component is only loaded when its route is visited.

// Marketing and Site Management Pages
const HomePageDashboard = lazy(() => import('./pages/HomePageDashboard')); // app/sites/page.tsx

// Site-Specific Layouts and Pages
const SiteLayout = lazy(() => import('./pages/sites/SiteLayout'));             // app/sites/[siteId]/layout.tsx
const EditContentPage = lazy(() => import('./pages/sites/edit/EditContentPage'));// app/sites/[siteId]/edit/content/[[...slug]]/page.tsx
const CollectionManagementPage = lazy(() => import('./pages/sites/collections/CollectionManagementPage')); // app/sites/[siteId]/collections/[collectionId]/page.tsx
const TagGroupManagementPage = lazy(() => import('./pages/sites/taggroups/TagGroupManagementPage')); // app/sites/[siteId]/taggroups/[tagGroupId]/page.tsx
const SettingsSectionLayout = lazy(() => import('@/pages/sites/settings/SettingsLayout')); // app/sites/[siteId]/settings/layout.tsx
const SiteSettingsPage = lazy(() => import('@/pages/sites/settings/SiteDetailsPage'));         // app/sites/[siteId]/settings/page.tsx
const ThemeSettingsPage = lazy(() => import('@/pages/sites/settings/AppearancePage'));       // app/sites/[siteId]/settings/theme/page.tsx
const ImageSettingsPage = lazy(() => import('@/pages/sites/settings/MediaPage'));       // app/sites/[siteId]/settings/images/page.tsx
const PublishingSettingsPage = lazy(() => import('@/pages/sites/settings/PublishingPage')); // app/sites/[siteId]/settings/publishing/page.tsx
const SecuritySettingsPage = lazy(() => import('@/pages/sites/settings/SecurityPage')); // app/sites/[siteId]/settings/security/page.tsx
const ViewSitePage = lazy(() => import('@/pages/sites/view/ViewSitePage'));                     // app/sites/[siteId]/view/[[...slug]]/page.tsx


export default function App() {
  // This initialization logic is ported directly from your RootLayout.
  useInitialiseUIStore();
  const initialize = useAppStore(state => state.initialize);
  const isInitialized = useAppStore(state => state.isInitialized);
  const initError = useAppStore(state => state.initError);
  const retryInitialize = useAppStore(state => state.retryInitialize);
  const clearInitError = useAppStore(state => state.clearInitError);
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  const showLoading = clientMounted && !isInitialized;

  if (showLoading) {
    return <Loader fullScreen />;
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-xl w-full rounded-xl border bg-card p-6 space-y-4 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Local storage needs attention</h1>
            <p className="text-sm text-muted-foreground">{initError}</p>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground space-y-2">
            <p>Recommended recovery steps:</p>
            <p>1. Close every open `app.sparktype.org` tab in this browser.</p>
            <p>2. Reopen a single tab and try again.</p>
            <p>3. If it still works in incognito but not here, this profile&apos;s IndexedDB is likely blocked or corrupted.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={retryInitialize}>Retry loading sites</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button variant="ghost" onClick={clearInitError}>
              Continue with app shell
            </Button>
          </div>
        </div>
      </div>
    );
  }

   return (
    <>
        <PlatformProvider>
            <Suspense fallback={<Loader fullScreen />}>
              <Routes>
          

          <Route path="/" element={<HomePageDashboard />} />
          <Route path="/sites/:siteId" element={<SiteLayout />}>

          <Route path="view/*" element={<ViewSitePage />} />
            
          <Route path="edit/*" element={<AuthGuard><EditContentPage /></AuthGuard>} />

          <Route path="collections/:collectionId" element={<AuthGuard><CollectionManagementPage /></AuthGuard>} />
          
          <Route path="taggroups/:tagGroupId" element={<AuthGuard><TagGroupManagementPage /></AuthGuard>} />
            
          <Route path="collection/:collectionId/:slug" element={<ViewSitePage />} />

            <Route path="settings" element={<AuthGuard><SettingsSectionLayout /></AuthGuard>}>
              <Route index element={<SiteSettingsPage />} />
              <Route path="theme" element={<ThemeSettingsPage />} />
              <Route path="images" element={<ImageSettingsPage />} />
              <Route path="publishing" element={<PublishingSettingsPage />} />
              <Route path="security" element={<SecuritySettingsPage />} />
            </Route>
          </Route>
          
          <Route path="*" element={<div>404 - Page Not Found</div>} />
              </Routes>
            </Suspense>
            <Toaster richColors position="top-center" />
        </PlatformProvider>
    </>
  );
}
