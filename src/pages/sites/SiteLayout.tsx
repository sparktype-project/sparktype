// src/pages/sites/SiteLayout.tsx

import { useEffect, useCallback, useState, type ReactNode } from 'react';
import { Link, Outlet, useParams, useLocation } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';

// Services
import { getActiveImageService } from '@/core/services/images/images.service';

// UI and Icons
import { TbEdit, TbSettings } from "react-icons/tb";
import { cn } from '@/core/libraries/utils';

// Header Components
import UnifiedHeader from '@/core/components/UnifiedHeader';
import { HeaderContext } from '@/core/contexts/HeaderContext';
import DefaultHeaderContent from '@/core/components/header-content/DefaultHeaderContent';
import SparkotypeLogo from '@/core/components/ui/SparkotypeLogo';

/**
 * Renders the site-specific icon, either the logo or a text fallback.
 */
function SiteIcon({ site }: { site: AppStore['sites'][0] }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const generateLogoUrl = async () => {
      if (site.manifest?.logo) {
        try {
          const service = getActiveImageService(site.manifest);
          const url = await service.getDisplayUrl(site.manifest, site.manifest.logo, { width: 40, height: 40, crop: 'fill' }, false);
          setLogoUrl(url);
          if (url.startsWith('blob:')) {
            objectUrl = url;
          }
        } catch (error) {
          console.error("Could not generate logo URL:", error);
          setLogoUrl(null);
        }
      } else {
        setLogoUrl(null);
      }
    };

    generateLogoUrl();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [site.manifest]);

  if (logoUrl) {
    return <img src={logoUrl} alt={`${site.manifest.title} Logo`} className="h-full w-full object-cover" />;
  }

  const firstLetter = site.manifest.title ? site.manifest.title.charAt(0).toUpperCase() : '?';
  
  return (
    <div className="flex h-full w-full items-center justify-center border rounded-lg text-muted-foreground">
      <span className="text-xl font-semibold">{firstLetter}</span>
    </div>
  );
}



/**
 * A simple loading component displayed while the core site data is being fetched.
 */
function SiteLayoutLoader() {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-muted-foreground">Loading Site Data...</p>
            </div>
        </div>
    );
}

export default function SiteLayout() {
  const { siteId } = useParams<{ siteId: string }>();
  const { pathname } = useLocation();
  const [headerContent, setHeaderContent] = useState<ReactNode>(null);

  const site = useAppStore(useCallback((state: AppStore) => siteId ? state.getSiteById(siteId) : undefined, [siteId]));
  const loadSite = useAppStore((state: AppStore) => state.loadSite);
  const setActiveSiteId = useAppStore((state: AppStore) => state.setActiveSiteId);

  useEffect(() => {
    if (siteId) {
      setActiveSiteId(siteId);
      if (!site || !site.contentFiles) {
        loadSite(siteId);
      }
    }
    return () => {
      setActiveSiteId(null);
    };
  }, [siteId, site, loadSite, setActiveSiteId]);

  if (!site || !site.contentFiles) {
    return <SiteLayoutLoader />;
  }
    
  const isEditorActive = pathname.startsWith(`/sites/${siteId}/edit`);
  const isSettingsActive = pathname.startsWith(`/sites/${siteId}/settings`);
  const isViewActive = !isEditorActive && !isSettingsActive;

  // --- FIX: Add a property to distinguish standard icons ---
  const navItems = [
    // This item will not receive the extra size class.
    { to: siteId ? `/sites/${siteId}/view` : '#', title: 'View Site', icon: () => <SiteIcon site={site} />, isStandardIcon: false, isActive: isViewActive },
    // These items will receive the `size-6` class.
    { to: siteId ? `/sites/${siteId}/edit` : '#', title: 'Edit Content', icon: TbEdit, isStandardIcon: true, isActive: isEditorActive },
    { to: siteId ? `/sites/${siteId}/settings` : '#', title: 'Site Settings', icon: TbSettings, isStandardIcon: true, isActive: isSettingsActive },
  ];

  return (
    <HeaderContext.Provider value={{ setHeaderContent }}>
      <div className="flex h-screen flex-col">
        {/* Global UnifiedHeader for all site pages */}
        <UnifiedHeader showLogo={false}>
          {headerContent || <DefaultHeaderContent />}
        </UnifiedHeader>

        <div className="flex flex-1 md:flex-row flex-col">
          <aside className="fixed inset-x-0 bottom-0 z-30 flex h-16 w-full shrink-0 border-t md:border-t-0 md:border-r bg-background md:static md:inset-y-0 md:left-0 md:h-full md:w-[50px]">
            <nav className=" px-8 md:p-0 flex w-full items-center justify-between gap-3  md:flex-col md:justify-start">
              <Link
                to="/"
                title="Dashboard"
                className='md:flex flex-col items-center md:w-[50px] md:h-[50px] md:border-b'
              >
                <SparkotypeLogo size={32} className="m-auto" />
              </Link>

              {navItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={item.title}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-colors overflow-hidden',
                      item.isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >

                    <IconComponent className={cn(item.isStandardIcon && 'size-5')} />
                  </Link>
                )
              })}
            </nav>
          </aside>

          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>
    </HeaderContext.Provider>
  );
}

