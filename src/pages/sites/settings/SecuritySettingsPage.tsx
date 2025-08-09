import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/core/state/useAppStore';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Switch } from '@/core/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Separator } from '@/core/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/core/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Shield, Key, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage edit protection and authentication for your site.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Protection
          </CardTitle>
          <CardDescription>
            Control who can edit your site by requiring passkey authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Require authentication to edit</Label>
              <p className="text-sm text-muted-foreground">
                {isProtected 
                  ? "This site requires a passkey to edit" 
                  : "Anyone can edit this site"}
              </p>
            </div>
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

          {isProtected && site.manifest.auth && (
            <>
              <Separator />
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Credential Information
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
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Site is not protected</p>
                    <p className="text-xs text-muted-foreground">
                      Anyone can edit this site. Enable protection to require authentication.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleEnableProtection}
                  disabled={isRegistering}
                  className="w-full"
                >
                  {isRegistering ? 'Setting up...' : 'Enable Edit Protection'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Edit Protection Works</CardTitle>
          <CardDescription>
            Understanding passkey authentication for your site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <h4 className="font-medium">🔒 What's Protected</h4>
            <ul className="text-muted-foreground space-y-1 ml-4">
              <li>• Editing site content and structure</li>
              <li>• Accessing site settings</li>
              <li>• Publishing and exporting with credentials</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">🌐 What Remains Public</h4>
            <ul className="text-muted-foreground space-y-1 ml-4">
              <li>• Viewing your published site</li>
              <li>• Site content and design</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">🔑 Passkey Benefits</h4>
            <ul className="text-muted-foreground space-y-1 ml-4">
              <li>• Works with Touch ID, Face ID, Windows Hello</li>
              <li>• Syncs across your devices (iCloud, 1Password)</li>
              <li>• No passwords to remember or lose</li>
              <li>• Phishing-resistant security</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}