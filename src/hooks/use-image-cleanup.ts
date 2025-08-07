// src/hooks/use-image-cleanup.ts

import { useState, useCallback } from 'react';
import { useAppStore } from '@/core/state/useAppStore';
import { 
  getImageUsageStats, 
  previewCleanup, 
  cleanupOrphanedImages,
  type CleanupResult 
} from '@/core/services/images/imageCleanup.service';
import { toast } from 'sonner';

export interface ImageUsageStats {
  totalOriginalImages: number;
  totalDerivatives: number;
  referencedImages: number;
  orphanedOriginals: number;
  orphanedDerivatives: number;
  totalStorageBytes: number;
}

export interface CleanupPreview {
  orphanedOriginals: string[];
  orphanedDerivatives: string[];
  estimatedBytesFreed: number;
}

export function useImageCleanup(siteId?: string) {
  const { getSiteById } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ImageUsageStats | null>(null);
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [lastCleanupResult, setLastCleanupResult] = useState<CleanupResult | null>(null);

  const loadStats = useCallback(async () => {
    if (!siteId) return;
    
    const siteData = getSiteById(siteId);
    if (!siteData) {
      console.error('Site not found:', siteId);
      return;
    }

    setLoading(true);
    try {
      const imageStats = await getImageUsageStats(siteData);
      setStats(imageStats);
    } catch (error) {
      console.error('Failed to load image stats:', error);
      toast.error('Failed to load image usage statistics');
    } finally {
      setLoading(false);
    }
  }, [siteId, getSiteById]);

  const loadPreview = useCallback(async () => {
    if (!siteId) return;
    
    const siteData = getSiteById(siteId);
    if (!siteData) {
      console.error('Site not found:', siteId);
      return;
    }

    setLoading(true);
    try {
      const cleanupPreview = await previewCleanup(siteData);
      setPreview(cleanupPreview);
    } catch (error) {
      console.error('Failed to load cleanup preview:', error);
      toast.error('Failed to preview cleanup');
    } finally {
      setLoading(false);
    }
  }, [siteId, getSiteById]);

  const performCleanup = useCallback(async () => {
    if (!siteId) return;
    
    const siteData = getSiteById(siteId);
    if (!siteData) {
      console.error('Site not found:', siteId);
      return;
    }

    setLoading(true);
    try {
      const result = await cleanupOrphanedImages(siteData);
      setLastCleanupResult(result);
      
      // Refresh stats after cleanup
      await loadStats();
      setPreview(null); // Clear preview since it's no longer accurate
      
      const mbFreed = (result.bytesFreed / 1024 / 1024).toFixed(2);
      toast.success(`Cleanup completed! Removed ${result.originalImagesRemoved} images and ${result.derivativesRemoved} derivatives, freeing ${mbFreed} MB`);
      
      return result;
    } catch (error) {
      console.error('Failed to perform cleanup:', error);
      toast.error('Failed to clean up images');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [siteId, getSiteById, loadStats]);

  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const getStorageEfficiency = useCallback((): number => {
    if (!stats) return 0;
    if (stats.totalOriginalImages === 0) return 100;
    return (stats.referencedImages / stats.totalOriginalImages) * 100;
  }, [stats]);

  const hasOrphanedImages = useCallback((): boolean => {
    return Boolean(stats && (stats.orphanedOriginals > 0 || stats.orphanedDerivatives > 0));
  }, [stats]);

  return {
    // State
    loading,
    stats,
    preview,
    lastCleanupResult,

    // Actions  
    loadStats,
    loadPreview,
    performCleanup,

    // Utilities
    formatBytes,
    getStorageEfficiency,
    hasOrphanedImages,

    // Computed values
    canCleanup: Boolean(stats && (stats.orphanedOriginals > 0 || stats.orphanedDerivatives > 0)),
    storageEfficiency: getStorageEfficiency(),
  };
}