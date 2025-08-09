import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// State Management
import { useAppStore } from '@/core/state/useAppStore';

// Services and Config
import { generateSiteId } from '@/core/libraries/utils';
import { getMergedThemeDataForForm } from '@/core/services/config/theme.service';
import { GENERATOR_VERSION, CORE_THEMES } from '@/config/editorConfig';

// Types
import { type LocalSiteData, type Manifest, type ThemeInfo } from '@/core/types';

// UI Components
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/components/ui/select';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Switch } from '@/core/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';

interface CreateSiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateSiteModal({ open, onOpenChange }: CreateSiteModalProps) {
  const navigate = useNavigate();
  const addSite = useAppStore((state) => state.addSite);
  const registerSiteAuthentication = useAppStore((state) => state.registerSiteAuthentication);

  // Form state
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [enableEditProtection, setEnableEditProtection] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const availableThemes = useMemo(() => CORE_THEMES, []);
  const [selectedTheme, setSelectedTheme] = useState<ThemeInfo | null>(availableThemes[0] || null);

  // Reset form when modal opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setSiteTitle('');
      setSiteDescription('');
      setEnableEditProtection(true);
      setSelectedTheme(availableThemes[0] || null);
      setIsLoading(false);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!siteTitle.trim() || !selectedTheme) {
      toast.error('Site title and a theme are required.');
      return;
    }
    
    setIsLoading(true);
    try {
      const newSiteId = generateSiteId(siteTitle);
      const { initialConfig } = await getMergedThemeDataForForm(selectedTheme.path, {});
      
      const newManifest: Manifest = {
        siteId: newSiteId,
        generatorVersion: GENERATOR_VERSION,
        title: siteTitle.trim(),
        description: siteDescription.trim(),
        theme: {
          name: selectedTheme.path,
          config: initialConfig,
        },
        structure: [],
      };
      
      const newSiteData: LocalSiteData = {
        siteId: newSiteId,
        manifest: newManifest,
        contentFiles: [],
        themeFiles: [],
        layoutFiles: [],
      };
      
      await addSite(newSiteData);
      
      // Handle edit protection setup
      if (enableEditProtection) {
        try {
          const authResult = await registerSiteAuthentication(
            newSiteId, 
            siteTitle.trim(),
            'Site Owner'
          );
          
          if (authResult.success && authResult.authConfig) {
            // Update the manifest with auth config
            const updatedManifest = {
              ...newManifest,
              auth: authResult.authConfig
            };
            
            // Save the updated manifest with auth
            const updateManifest = useAppStore.getState().updateManifest;
            await updateManifest(newSiteId, updatedManifest);
            
            toast.success(`Site "${siteTitle}" created with edit protection!`);
          } else {
            toast.warning(`Site created but edit protection setup failed: ${authResult.error}`);
          }
        } catch (error) {
          console.error('Failed to setup edit protection:', error);
          toast.warning('Site created but edit protection setup failed');
        }
      } else {
        toast.success(`Site "${siteTitle}" created successfully!`);
      }
      
      // Close modal and navigate to the new site's editor page
      handleOpenChange(false);
      navigate(`/sites/${newSiteId}/edit`);

    } catch (error) {
      console.error("Error during site creation:", error);
      toast.error(`Failed to create site: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = siteTitle.trim() && selectedTheme && !isLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create a New Site</DialogTitle>
          <DialogDescription>
            Set up your new site with a title, description, theme, and security settings.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="site-title">Site Title</Label>
            <Input
              id="site-title"
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              placeholder="My Awesome Project"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="site-description">Site Description (Optional)</Label>
            <Textarea
              id="site-description"
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
              placeholder="A short and catchy description of your new site."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="theme-select">Theme</Label>
            <Select 
              value={selectedTheme?.path || ''} 
              onValueChange={(themePath) => {
                const theme = availableThemes.find(t => t.path === themePath);
                if (theme) setSelectedTheme(theme);
              }} 
            >
              <SelectTrigger id="theme-select">
                <SelectValue placeholder="Select a theme..." />
              </SelectTrigger>
              <SelectContent>
                {availableThemes.map(theme => (
                  <SelectItem key={theme.path} value={theme.path}>
                    {theme.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the overall design for your site. You can change this later.
            </p>
          </div>
          
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label 
                  htmlFor="edit-protection" 
                  className="text-sm font-medium flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Edit protection
                </Label>
                <p className="text-xs text-muted-foreground">
                  Require authentication to edit this site
                </p>
              </div>
              <Switch
                id="edit-protection"
                checked={enableEditProtection}
                onCheckedChange={setEnableEditProtection}
              />
            </div>
            {enableEditProtection && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                You'll be prompted to set up a passkey after creating the site.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isLoading ? 'Creating...' : 'Create Site'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}