// src/core/services/images/images.service.ts

import type { ImageService, Manifest } from '@/core/types';
import { localImageService } from './localImage.service';
import { cloudinaryImageService } from './cloudinaryImage.service';

const services: Record<string, ImageService> = {
  local: localImageService,
  cloudinary: cloudinaryImageService,
};

export function getActiveImageService(manifest: Manifest): ImageService {
  const serviceId = manifest.settings?.imageService || 'local';
  return services[serviceId] || localImageService;
}