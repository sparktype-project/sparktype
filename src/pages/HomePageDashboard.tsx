// src/pages/HomePageDashboard.tsx

import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Use react-router-dom's Link

// State Management (no changes needed)
import { useAppStore } from '@/core/state/useAppStore';
import { type AppStore } from '@/core/state/useAppStore';
import { type LocalSiteData } from '@/core/types';

// Services
import { importSiteFromZip } from '@/core/services/siteBackup.service';
import { downloadSiteBackup } from '@/core/services/backup/downloadSiteBackup';
import { restoreImportedImageRegistry } from '@/core/services/backup/backupImport';
import { MEDIA_INDEX_PATH } from '@/core/services/backup/backupFormat';
import { importSiteFromGitHub, importSiteFromUrl } from '@/core/services/remoteImport.service';
import { saveAllImageAssetsForSite, getManifestById } from '@/core/services/localFileSystem.service';

// UI Components & Icons
import { Button } from '@/core/components/ui/button';
import { toast } from 'sonner';
import { Eye, Edit3, Archive, Trash2, MoreVertical, Upload, FilePlus2, ChevronDown, Github, Globe } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/core/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/core/components/ui/alert-dialog";
import CreateSiteModal from '@/core/components/CreateSiteModal';
import ImportModal, { type ImportModalMode } from '@/core/components/ImportModal';
import UnifiedHeader from '@/core/components/UnifiedHeader';

export default function HomePageDashboard() {
  // Focused selectors: subscribing to the bare store re-rendered this page on every
  // unrelated update (activeSiteId, slug tracking, initialisation). Actions are stable
  // references, so selecting them individually adds no re-renders of its own.
  const sites = useAppStore((state: AppStore) => state.sites);
  const getSiteById = useAppStore((state: AppStore) => state.getSiteById);
  const addSite = useAppStore((state: AppStore) => state.addSite);
  const updateSiteSecrets = useAppStore((state: AppStore) => state.updateSiteSecrets);
  const loadSite = useAppStore((state: AppStore) => state.loadSite);
  const deleteSiteAndState = useAppStore((state: AppStore) => state.deleteSiteAndState);
  const authenticateForSite = useAppStore((state: AppStore) => state.authenticateForSite);
  const [isImporting, setIsImporting] = useState(false);
  const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<(LocalSiteData & { imageAssetsToSave?: Record<string, Blob> }) | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeImportModal, setActiveImportModal] = useState<ImportModalMode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const finishImport = useCallback(async (data: LocalSiteData & { imageAssetsToSave?: Record<string, Blob> }) => {
    const { imageAssetsToSave, ...siteDataToSave } = data;
    const { siteId } = siteDataToSave;
    let clearedPreviousSite = false;
    try {
      // Importing replaces the target site: if a site already occupies this
      // siteId, clear it (blobs, derivatives, image registry, data files,
      // secrets) before writing the imported data, so no stale original survives
      // an overwrite. Checked against storage, not just the loaded store. The
      // archive is fully validated and parsed in memory first, so nothing is
      // cleared unless the import can actually be written.
      if (await getManifestById(siteId)) {
        await deleteSiteAndState(siteId);
        clearedPreviousSite = true;
      }
      await addSite(siteDataToSave);
      if (siteDataToSave.secrets) {
        await updateSiteSecrets(siteId, siteDataToSave.secrets);
      }
      if (imageAssetsToSave) {
        await saveAllImageAssetsForSite(siteId, imageAssetsToSave);
      }
      // Only now can the registry be rebuilt from the imported media index: the
      // teardown above deletes whatever registry existed, and this restores the
      // image metadata (dimensions, alt text, references) the archive carried.
      const mediaIndexJson = siteDataToSave.dataFiles?.[MEDIA_INDEX_PATH];
      if (mediaIndexJson) {
        await restoreImportedImageRegistry(siteId, mediaIndexJson);
      }
      toast.success(`Site "${data.manifest.title}" imported successfully!`);
    } catch (error) {
      console.error("Error finishing site import:", error);
      const lossNote = clearedPreviousSite
        ? " The site that was already stored under this ID has been cleared; the backup file is untouched, so importing it again will retry from scratch."
        : "";
      toast.error(`Failed to save imported site: ${(error as Error).message}${lossNote}`);
    }
  }, [addSite, deleteSiteAndState, updateSiteSecrets]);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    toast.info("Importing site from backup...");
    try {
      const data = await importSiteFromZip(file);
      const existingSite = getSiteById(data.siteId);
      if (existingSite) {
        setImportedData(data);
        setIsOverwriteDialogOpen(true);
      } else {
        await finishImport(data);
      }
    } catch (error) {
      console.error("Error during site import:", error);
      toast.error(`Import failed: ${(error as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsImporting(false);
    }
  };

  const handleOverwriteConfirm = async () => {
    if (importedData) await finishImport(importedData);
    setIsOverwriteDialogOpen(false);
    setImportedData(null);
  };

  const handleExportBackup = async (siteId: string) => {
    toast.info("Preparing site backup...");
    try {
      await loadSite(siteId);
      const siteToExport = getSiteById(siteId);
      if (!siteToExport) throw new Error("Could not load site data for export.");
      await downloadSiteBackup(siteToExport);
      toast.success("Site backup downloaded!");
    } catch (error) {
      console.error("Failed to export site:", error);
      toast.error(`Export failed: ${(error as Error).message}`);
    }
  };

  const handleDeleteSite = async (siteId: string, siteTitle: string) => {
    try {
      await deleteSiteAndState(siteId);
      toast.success(`Site "${siteTitle}" has been deleted.`);
    } catch (error) {
      toast.error(`Failed to delete site "${siteTitle}".`);
      console.error("Error deleting site:", error);
    }
  };


  const handleGitHubImport = async (repoUrl: string, branch?: string) => {
    setIsImporting(true);
    toast.info("Importing site from GitHub...");
    try {
      const data = await importSiteFromGitHub(repoUrl, branch);
      const existingSite = getSiteById(data.siteId);
      if (existingSite) {
        setImportedData(data);
        setIsOverwriteDialogOpen(true);
      } else {
        await finishImport(data);
      }
    } catch (error) {
      console.error("Error during GitHub import:", error);
      toast.error(`GitHub import failed: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleUrlImport = async (siteUrl: string) => {
    setIsImporting(true);
    toast.info("Importing site from URL...");
    try {
      const data = await importSiteFromUrl(siteUrl, authenticateForSite);
      const existingSite = getSiteById(data.siteId);
      if (existingSite) {
        setImportedData(data);
        setIsOverwriteDialogOpen(true);
      } else {
        await finishImport(data);
      }
    } catch (error) {
      console.error("Error during URL import:", error);
      toast.error(`URL import failed: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Listen for global import trigger from menu
  useEffect(() => {
    const handleTriggerImport = () => {
      // Trigger file input directly for import
      fileInputRef.current?.click();
    };

    window.addEventListener('triggerImport', handleTriggerImport);
    return () => {
      window.removeEventListener('triggerImport', handleTriggerImport);
    };
  }, []);

  const validSites = sites.filter((site: LocalSiteData) => site && site.manifest);

  return (
    <>
      <title>My sites | Sparktype</title>

      <UnifiedHeader>
        <></>
      </UnifiedHeader>

      <main className="p-4 max-w-5xl mx-auto ">
        <div className="flex justify-between items-center my-8">
          <h1 className="text-4xl text-foreground font-serif">My sites</h1>

          {/* Action buttons moved from header */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  disabled={isImporting}
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? 'Importing...' : 'Import site'}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload ZIP file
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveImportModal('github')} disabled={isImporting}>
                  <Github className="mr-2 h-4 w-4" />
                  Import from GitHub repo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveImportModal('url')} disabled={isImporting}>
                  <Globe className="mr-2 h-4 w-4" />
                  Import from URL
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <FilePlus2 className="h-4 w-4" />
              Create new site
            </Button>
          </div>
        </div>
        {validSites.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">No sites yet</h2>
            <p className="text-muted-foreground mb-4">Click create new site or import a site to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {validSites.map((site: LocalSiteData) => (
              <div key={site.siteId} className=" border-b flex flex-row justify-between pb-6">
                <Link to={`/sites/${site.siteId}/view`} className='flex-1 hover:cursor-pointer group'>
                  <div className=''>
                    <h2 className="text-2xl cursor-pointer font-bold text-card-foreground mb-2 truncate group-hover:underline" title={site.manifest.title}>
                      {site.manifest.title || "Untitled Site"}
                    </h2>
                    <p className="text-sm text-muted-foreground line-clamp-2" title={site.manifest.description}>
                      {site.manifest.description || 'No description provided.'}
                    </p>
                  </div>
                </Link>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/sites/${site.siteId}/edit`}><Edit3 className="mr-2 h-4 w-4" /> Edit</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/*
                          The "View Live Preview" link now correctly navigates to the hash-based route.
                          `target="_blank"` will open a new browser tab with the hash URL, which works perfectly.
                        */}
                      <DropdownMenuItem asChild>
                        <Link to={`/sites/${site.siteId}/view`} target="_blank" rel="noopener noreferrer">
                          <Eye className="mr-2 h-4 w-4" /> View site
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportBackup(site.siteId)}><Archive className="mr-2 h-4 w-4" /> Export backup</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e: Event) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete site
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete "{site.manifest.title}" and cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSite(site.siteId, site.manifest.title)} className="bg-destructive hover:bg-destructive/90">Yes, delete site</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

            ))}
          </div>
        )}
      </main>

      <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".zip" className="hidden" />

      {/* The AlertDialog logic is self-contained and requires no changes */}
      <AlertDialog open={isOverwriteDialogOpen} onOpenChange={setIsOverwriteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Site Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              A site with the ID "{importedData?.siteId}" already exists. Do you want to overwrite it with the data from the backup file?
              <br /><br />
              <strong>This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImportedData(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwriteConfirm} className="bg-destructive hover:bg-destructive/90">Overwrite</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Site Modal */}
      <CreateSiteModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />

      {/* GitHub Import Modal - Available on both web and Tauri */}
      <ImportModal
        open={activeImportModal !== null}
        onOpenChange={(open) => {
          if (!open) setActiveImportModal(null);
        }}
        mode={activeImportModal ?? 'github'}
        onImport={activeImportModal === 'url' ? handleUrlImport : handleGitHubImport}
      />
    </>
  );
}
