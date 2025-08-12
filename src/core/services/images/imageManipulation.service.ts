// src/core/services/images/imageManipulation.service.ts

import type { ImageTransformOptions } from '@/core/types';

/**
 * Lightweight canvas-based image manipulation utilities for client-side processing.
 * Provides efficient cropping, resizing, and format conversion without external dependencies.
 */

/**
 * Creates an image element from a blob for canvas operations
 */
const createImageFromBlob = (blob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load timeout after 30 seconds'));
    }, 30000);
    
    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = (error) => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      console.error('[ImageManipulation] Image load error:', error);
      reject(new Error(`Failed to load image: ${error instanceof Event ? 'Load error' : error}`));
    };
    
    // Set src after event listeners are attached
    img.src = url;
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
    
    // Set canvas dimensions
    canvas.width = cropParams.canvasWidth;
    canvas.height = cropParams.canvasHeight;
    
    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Fill with white background for JPEG format
    if (outputFormat === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Draw the cropped/resized image
    ctx.drawImage(
      img,
      cropParams.sourceX,
      cropParams.sourceY,
      cropParams.sourceWidth,
      cropParams.sourceHeight,
      cropParams.destX,
      cropParams.destY,
      cropParams.destWidth,
      cropParams.destHeight
    );
    
    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
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