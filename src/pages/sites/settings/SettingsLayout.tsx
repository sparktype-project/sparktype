// src/pages/sites/settings/SettingsSectionLayout.tsx

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

// UI and State Management
import ThreeColumnLayout from '@/core/components/layout/ThreeColumnLayout';
import SettingsNav from '@/features/site-settings/components/SettingsNav';
import { useUIStore } from '@/core/state/uiStore';

/**
 * The root layout for the entire settings section.
 * It provides the consistent ThreeColumnLayout structure and manages the
 * global UI state to ensure the left sidebar (with the settings menu) is
 * always visible and the right sidebar is always hidden.
 */
export default function SettingsSectionLayout() {
  const { 
    leftSidebarContent, 
    setLeftAvailable, 
    setRightAvailable, 
    setRightOpen,
    setLeftSidebarContent,
    setRightSidebarContent 
  } = useUIStore(state => state.sidebar);

  useEffect(() => {
    // Configure the sidebars for the entire settings section
    setLeftAvailable(true);
    setRightAvailable(false);
    setRightOpen(false);
    setLeftSidebarContent(<SettingsNav />);
    setRightSidebarContent(null);

    // Cleanup when navigating away from the settings section
    return () => {
      setLeftAvailable(false);
      setLeftSidebarContent(null);
    };
  }, [setLeftAvailable, setRightAvailable, setRightOpen, setLeftSidebarContent, setRightSidebarContent]);

  return (
    <ThreeColumnLayout
      leftSidebar={leftSidebarContent}
      rightSidebar={null} // No right sidebar in settings
    >
      {/* The <Outlet/> renders the specific settings page (e.g., SiteSettingsPage) */}
      <Outlet />
    </ThreeColumnLayout>
  );
}