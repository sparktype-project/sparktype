// src/core/components/Navbar.tsx

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Leaf, Home, Settings, Globe } from 'lucide-react';
import { toast } from 'sonner';

// UI Components (no changes needed)
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { cn } from '@/core/libraries/utils';

/**
 * A specialized NavLink component for the main navigation.
 * It uses react-router-dom's useLocation hook to determine if it's the active link.
 */
const NavLink: React.FC<{ to: string; label: string; icon?: React.ReactNode; }> = ({ to, label, icon }) => {
  const location = useLocation();
  // Check if the current path exactly matches or starts with the link's path.
  // This handles nested routes correctly. The `to !== '/'` check prevents the root link
  // from being active for all other routes.
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    // The `asChild` prop on Button allows the Link to control navigation while inheriting the button's styles.
    <Button asChild variant="ghost" className={cn('justify-start', isActive && 'bg-accent text-accent-foreground')}>
      <Link to={to} className="flex items-center space-x-2">
        {icon}
        <span>{label}</span>
      </Link>
    </Button>
  );
};

export default function Navbar() {
  const navigate = useNavigate();
  const [remoteUrl, setRemoteUrl] = useState('');

  const handleBrowseRemoteSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (remoteUrl.trim()) {
      try {
        const url = new URL(remoteUrl.trim());
        // The URL is already a client-side route, so we don't need to encode it further for the hash.
        // We just navigate to the hash route directly.
        // Example: input 'http://localhost:8080' becomes route '#/remote@http://localhost:8080'
        navigate(`/remote@${url.origin}`);
        setRemoteUrl(''); // Clear input after navigation
      } catch (error) {
        // Use toast for better user feedback instead of alert()
        toast.error("Invalid URL entered. Please include http:// or https://");
        console.error("Invalid URL:", error);
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* The main logo links to the marketing page or dashboard root */}
        <Link to="/" className="flex items-center space-x-2">
          <Leaf className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-foreground hidden sm:inline">Sparktype</span>
        </Link>
        
        <form onSubmit={handleBrowseRemoteSite} className="flex-grow max-w-xl flex items-center gap-2">
          <div className="relative w-full">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="url"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="Enter remote Sparktype site URL..."
              className="pl-9"
            />
          </div>
          <Button type="submit">Browse</Button>
        </form>
        
        <nav className="hidden md:flex items-center space-x-1">
          {/* Note: The main dashboard link is now `/sites` */}
          <NavLink to="/sites" label="Dashboard" icon={<Home className="h-4 w-4" />} />
        </nav>

        {/* This mobile menu button is currently a placeholder and would need state management to function */}
        <div className="md:hidden">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>
    </header>
  );
}