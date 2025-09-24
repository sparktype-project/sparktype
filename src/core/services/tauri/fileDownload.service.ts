// src/core/services/tauri/fileDownload.service.ts

import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { downloadDir } from '@tauri-apps/api/path';
import { isTauriApp } from '@/core/utils/platform';

/**
 * Service for handling file downloads in Tauri applications
 */
export class TauriFileDownloadService {
  /**
   * Downloads a file as a Blob to the user's Downloads folder
   * @param blob - The file content as a Blob
   * @param filename - The desired filename
   * @param showSaveDialog - Whether to show a save dialog (default: true)
   * @returns Promise resolving to the saved file path
   */
  async downloadBlob(blob: Blob, filename: string, showSaveDialog: boolean = true): Promise<string | null> {
    if (!isTauriApp()) {
      // Fallback for web - trigger browser download
      this.downloadBlobWeb(blob, filename);
      return null;
    }

    try {
      // Convert blob to array buffer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      let filePath: string | null;

      if (showSaveDialog) {
        // Show save dialog
        filePath = await save({
          defaultPath: filename,
          filters: [
            {
              name: 'ZIP Files',
              extensions: ['zip']
            },
            {
              name: 'All Files',
              extensions: ['*']
            }
          ]
        });
      } else {
        // Save directly to Downloads folder
        const downloadsPath = await downloadDir();
        filePath = `${downloadsPath}/${filename}`;
      }

      if (!filePath) {
        // User cancelled the save dialog
        return null;
      }

      // Write the file
      await writeFile(filePath, uint8Array);

      console.log(`[TauriFileDownload] File saved to: ${filePath}`);
      return filePath;

    } catch (error) {
      console.error('[TauriFileDownload] Failed to save file:', error);
      throw new Error(`Failed to save file: ${error}`);
    }
  }

  /**
   * Downloads a text/string content as a file
   * @param content - The text content to save
   * @param filename - The desired filename
   * @param mimeType - MIME type for the content (default: text/plain)
   * @param showSaveDialog - Whether to show a save dialog (default: true)
   */
  async downloadText(content: string, filename: string, mimeType: string = 'text/plain', showSaveDialog: boolean = true): Promise<string | null> {
    const blob = new Blob([content], { type: mimeType });
    return this.downloadBlob(blob, filename, showSaveDialog);
  }

  /**
   * Downloads a ZIP file content
   * @param zipBlob - The ZIP file as a Blob
   * @param siteName - The site name to use in the filename
   * @param showSaveDialog - Whether to show a save dialog (default: true)
   */
  async downloadSiteZip(zipBlob: Blob, siteName: string, showSaveDialog: boolean = true): Promise<string | null> {
    const filename = `${this.sanitizeFilename(siteName)}-export-${new Date().toISOString().split('T')[0]}.zip`;
    return this.downloadBlob(zipBlob, filename, showSaveDialog);
  }

  /**
   * Fallback download method for web browsers
   * @private
   */
  private downloadBlobWeb(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Sanitizes a filename to remove invalid characters
   * @private
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid characters with dash
      .replace(/\s+/g, '-') // Replace spaces with dash
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .trim();
  }
}

// Export singleton instance
export const tauriFileDownloadService = new TauriFileDownloadService();