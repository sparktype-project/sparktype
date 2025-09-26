// src/core/services/images/imageManipulation.service.ts

import type { ImageTransformOptions } from '@/core/types';
import { isTauriApp } from '@/core/utils/platform';

/**
 * Lightweight canvas-based image manipulation utilities for client-side processing.
 * Provides efficient cropping, resizing, and format conversion without external dependencies.
 */

/**
 * Creates an image element from a blob for canvas operations
 * Uses data URLs for Tauri contexts to avoid WebKit blob URL limitations
 */
const createImageFromBlob = (blob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error('Image load timeout after 30 seconds'));
    }, 30000);

    const onLoad = () => {
      clearTimeout(timeout);
      resolve(img);
    };

    const onError = (error: any) => {
      clearTimeout(timeout);
      console.error('[ImageManipulation] Image load error:', error);
      reject(new Error(`Failed to load image: ${error instanceof Event ? 'Load error' : error}`));
    };

    img.onload = onLoad;
    img.onerror = onError;

    // Use data URLs for Tauri to avoid WebKit blob URL limitations
    if (isTauriApp()) {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to read blob as data URL'));
      };
      reader.readAsDataURL(blob);
    } else {
      // Use blob URLs for web browsers (better performance)
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (error) => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        onError(error);
      };
      img.src = url;
    }
  });
};

/**
 * Calculates crop dimensions and position based on crop mode
 */
const calculateCropDimensions = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  crop: 'fill' | 'fit' | 'scale',
  gravity: 'center' | 'north' | 'south' | 'east' | 'west' | 'auto' = 'center'
) => {
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const targetAspectRatio = targetWidth / targetHeight;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;
  let drawWidth = targetWidth;
  let drawHeight = targetHeight;

  switch (crop) {
    case 'fill':
      // Fill the target dimensions exactly, cropping excess
      if (sourceAspectRatio > targetAspectRatio) {
        // Source is wider, crop width
        cropWidth = sourceHeight * targetAspectRatio;
        cropHeight = sourceHeight;
        cropX = gravity === 'west' ? 0 : 
                gravity === 'east' ? sourceWidth - cropWidth :
                (sourceWidth - cropWidth) / 2; // center
      } else {
        // Source is taller, crop height
        cropWidth = sourceWidth;
        cropHeight = sourceWidth / targetAspectRatio;
        cropY = gravity === 'north' ? 0 :
                gravity === 'south' ? sourceHeight - cropHeight :
                (sourceHeight - cropHeight) / 2; // center
      }
      break;
      
    case 'fit':
      // Fit within dimensions, maintain aspect ratio, no cropping
      if (sourceAspectRatio > targetAspectRatio) {
        drawHeight = targetWidth / sourceAspectRatio;
      } else {
        drawWidth = targetHeight * sourceAspectRatio;
      }
      break;
      
    case 'scale':
    default:
      // Scale to fill exactly, may distort
      break;
  }

  return {
    sourceX: Math.round(cropX),
    sourceY: Math.round(cropY),
    sourceWidth: Math.round(cropWidth),
    sourceHeight: Math.round(cropHeight),
    destX: 0,
    destY: 0,
    destWidth: Math.round(drawWidth),
    destHeight: Math.round(drawHeight),
    canvasWidth: targetWidth,
    canvasHeight: targetHeight
  };
};

/**
 * Crops and resizes an image blob using HTML5 Canvas
 * @param sourceBlob - The source image blob
 * @param options - Transform options including width, height, crop mode, and gravity
 * @param outputFormat - Output format (defaults to 'image/jpeg')
 * @param quality - Output quality for JPEG (0-1, defaults to 0.85)
 * @returns Promise<Blob> - The processed image blob
 */
export async function cropAndResizeImage(
  sourceBlob: Blob,
  options: ImageTransformOptions,
  outputFormat: string = 'image/jpeg',
  quality: number = 0.85
): Promise<Blob> {
  const { width, height, crop = 'scale', gravity = 'center' } = options;
  
  console.log(`[ImageManipulation] cropAndResizeImage called with: ${width}x${height}, crop: ${crop}, gravity: ${gravity}`);
  
  // If no dimensions specified, return original
  if (!width && !height) {
    console.log(`[ImageManipulation] No dimensions specified, returning original`);
    return sourceBlob;
  }
  
  try {
    // Load the source image
    const img = await createImageFromBlob(sourceBlob);
    const sourceWidth = img.naturalWidth;
    const sourceHeight = img.naturalHeight;
    
    // Calculate target dimensions if only one is provided
    const targetWidth = width || Math.round((height! * sourceWidth) / sourceHeight);
    const targetHeight = height || Math.round((width! * sourceHeight) / sourceWidth);
    
    // Calculate crop/resize parameters
    console.log(`[ImageManipulation] Source: ${sourceWidth}x${sourceHeight}, Target: ${targetWidth}x${targetHeight}`);
    const cropParams = calculateCropDimensions(
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      crop,
      gravity
    );
    console.log(`[ImageManipulation] Crop params:`, cropParams);
    
    // Create canvas and context
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Unable to get canvas 2D context');
    }
    
    // Set canvas dimensions with validation
    const canvasWidth = Math.max(1, Math.min(cropParams.canvasWidth, 4096)); // Clamp to reasonable limits
    const canvasHeight = Math.max(1, Math.min(cropParams.canvasHeight, 4096));

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Validate canvas dimensions
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      throw new Error(`Invalid canvas dimensions: ${canvasWidth}x${canvasHeight}`);
    }

    console.log(`[ImageManipulation] Canvas dimensions set to: ${canvasWidth}x${canvasHeight}`);
    
    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Fill with white background for JPEG format
    if (outputFormat === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Validate drawImage parameters
    const { sourceX, sourceY, sourceWidth: srcWidth, sourceHeight: srcHeight, destX, destY, destWidth, destHeight } = cropParams;

    if (srcWidth <= 0 || srcHeight <= 0 || destWidth <= 0 || destHeight <= 0) {
      throw new Error(`Invalid draw dimensions: source ${srcWidth}x${srcHeight}, dest ${destWidth}x${destHeight}`);
    }

    console.log(`[ImageManipulation] Drawing image: source(${sourceX},${sourceY},${srcWidth},${srcHeight}) -> dest(${destX},${destY},${destWidth},${destHeight})`);

    // Draw the cropped/resized image
    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      srcWidth,
      srcHeight,
      destX,
      destY,
      destWidth,
      destHeight
    );
    
    // Convert canvas to blob with timeout protection
    return new Promise((resolve, reject) => {
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error('Canvas to blob conversion timed out after 10 seconds'));
      }, 10000);

      canvas.toBlob(
        (blob) => {
          clearTimeout(timeout);
          if (blob) {
            console.log(`[ImageManipulation] Canvas to blob complete: ${sourceBlob.size} -> ${blob.size} bytes`);
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        outputFormat,
        quality
      );
    });
  } catch (error) {
    console.error('[ImageManipulation] Failed to crop/resize image:', error);
    throw error;
  }
}

/**
 * Determines optimal output format based on input format and alpha channel
 */
export function getOptimalOutputFormat(inputFormat: string, hasAlpha: boolean = false): string {
  // Keep PNG for images with transparency
  if (hasAlpha || inputFormat === 'image/png') {
    return 'image/png';
  }
  
  // Use WebP if supported, fallback to JPEG
  const canvas = document.createElement('canvas');
  const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  
  return supportsWebP ? 'image/webp' : 'image/jpeg';
}

/**
 * Gets image dimensions from a blob without loading it into canvas
 */
export async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const img = await createImageFromBlob(blob);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight
  };
}