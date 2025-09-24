// src/features/site-settings/components/SettingsNav.tsx

import { NavLink, useParams } from 'react-router-dom'; // Import NavLink and useParams
import { TbUserCircle, TbPalette, TbPhoto, TbCloudUpload, TbShield } from 'react-icons/tb';
import { cn } from '@/core/libraries/utils';

/**
 * Renders the vertical navigation menu for the settings section.
 * It uses NavLink from react-router-dom to automatically handle active link styling.
 */
export default function SettingsNav() {
  const { siteId } = useParams<{ siteId: string }>();

  // The base path for all settings links.
  const settingsBasePath = `/sites/${siteId}/settings`;

  const navItems = [
    // Use the `end` prop for the index route to prevent it from matching all child routes.
    { to: settingsBasePath, title: 'Site details', icon: TbUserCircle, end: true },
    { to: `${settingsBasePath}/theme`, title: 'Theme config', icon: TbPalette, end: false },
    { to: `${settingsBasePath}/images`, title: 'Image handling', icon: TbPhoto, end: false },
    { to: `${settingsBasePath}/publishing`, title: 'Publishing', icon: TbCloudUpload, end: false },
    { to: `${settingsBasePath}/security`, title: 'Security', icon: TbShield, end: false },
  ];

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="text-lg font-semibold">Settings</h2>
      <nav className="mt-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end} // The 'end' prop ensures exact matching for the parent route
            // The `className` prop on NavLink can accept a function that receives an `isActive` boolean.
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded px-2 py-1 text-xs font-normal transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground' // Style for the active link
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground' // Style for inactive links
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.title}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}