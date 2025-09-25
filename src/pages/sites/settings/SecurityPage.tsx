import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Switch } from '@/core/components/ui/switch';
import { Separator } from '@/core/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/core/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Key, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function SecuritySettingsPage() {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const getSiteById = useAppStore(state => state.getSiteById);
  const updateManifest = useAppStore(state => state.updateManifest);
  const registerSiteAuthentication = useAppStore(state => state.registerSiteAuthentication);
  const removeSiteAuthentication = useAppStore(state => state.removeSiteAuthentication);
  const getSiteAuthStatus = useAppStore(state => state.getSiteAuthStatus);

  const site = getSiteById(siteId);
  const authStatus = site ? getSiteAuthStatus(siteId, site.manifest) : null;

  if (!site) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Site Not Found</h2>
          <p className="text-sm text-muted-foreground">
            Could not load site settings for ID: {siteId}
          </p>
        </div>
      </div>
    );
  }

  const handleEnableProtection = async () => {
    if (!site) return;

    setIsRegistering(true);
    try {
      const authResult = await registerSiteAuthentication(
        siteId,
        site.manifest.title,
        'Site Owner'
      );

      if (authResult.success && authResult.authConfig) {
        // Update manifest with auth config
        const updatedManifest = {
          ...site.manifest,
          auth: authResult.authConfig
        };

        await updateManifest(siteId, updatedManifest);
        toast.success('Edit protection enabled successfully!');
      } else {
        toast.error(`Failed to enable protection: ${authResult.error}`);
      }
    } catch (error) {
      console.error('Failed to enable edit protection:', error);
      toast.error('Failed to enable edit protection');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDisableProtection = async () => {
    if (!site?.manifest.auth) return;

    setIsLoading(true);
    try {
      // Remove auth from manifest
      const updatedManifest = {
        ...site.manifest,
        auth: undefined
      };

      await updateManifest(siteId, updatedManifest);
      await removeSiteAuthentication(siteId);
      toast.success('Edit protection disabled');
    } catch (error) {
      console.error('Failed to disable edit protection:', error);
      toast.error('Failed to disable edit protection');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateCredential = async () => {
    if (!site) return;

    setIsRegistering(true);
    try {
      const authResult = await registerSiteAuthentication(
        siteId,
        site.manifest.title,
        site.manifest.auth?.userDisplayName || 'Site Owner'
      );

      if (authResult.success && authResult.authConfig) {
        // Update manifest with new auth config
        const updatedManifest = {
          ...site.manifest,
          auth: authResult.authConfig
        };

        await updateManifest(siteId, updatedManifest);
        toast.success('Passkey regenerated successfully!');
      } else {
        toast.error(`Failed to regenerate passkey: ${authResult.error}`);
      }
    } catch (error) {
      console.error('Failed to regenerate passkey:', error);
      toast.error('Failed to regenerate passkey');
    } finally {
      setIsRegistering(false);
    }
  };

  const isProtected = authStatus?.requiresAuth || false;
  const pageTitle = `Publishing - ${site?.manifest?.title || 'Loading...'}`;

  return (
    <>
        <title>{pageTitle}</title>

    <div className="space-y-6 max-w-2xl p-6">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="text-muted-foreground">
          Manage authentication for your site.
        </p>
      </div>

      <hr />
          <h2 className="mb-0.5 text-lg font-bold">Authentication</h2>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground font-normal">Require authentication to open this site in the editor</Label>
              
            <div className="flex items-center gap-2">
              {isProtected ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <Switch
                checked={isProtected}
                onCheckedChange={isProtected ? undefined : handleEnableProtection}
                disabled={isLoading || isRegistering}
              />
            </div>

          </div>
                        <p className='text-xs'>Even with authenticaton disabled</p>

          {isProtected && site.manifest.auth && (
            <>
              <Separator />
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Credential information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Owner:</span>
                      <span>{site.manifest.auth.userDisplayName || 'Site Owner'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Registered:</span>
                      <span>
                        {new Date(site.manifest.auth.registeredAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credential ID:</span>
                      <span className="font-mono text-xs truncate max-w-32">
                        {site.manifest.auth.credentialId}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleRegenerateCredential}
                    disabled={isRegistering || isLoading}
                  >
                    {isRegistering ? 'Regenerating...' : 'Regenerate Passkey'}
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        disabled={isLoading || isRegistering}
                      >
                        Disable Protection
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Disable Edit Protection?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove authentication requirements for editing this site. 
                          Anyone will be able to edit your site content.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDisableProtection}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Disable Protection
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </>
          )}

          {!isProtected && (
            <>
              <Separator />
              
                <Button
                  onClick={handleEnableProtection}
                  disabled={isRegistering}
                  
                >
                  {isRegistering ? 'Setting up...' : 'Save settings'}
                </Button>
            </>
          )}
        </div>
    </div>
    </>
  );
}