import type { ImageService, Manifest } from '@/core/types';
import { cloudinaryImageService } from './cloudinaryImage.service';
import { localImageService } from './localImage.service';

const services = new Map<string, ImageService>([
  ['local', localImageService],
  ['cloudinary', cloudinaryImageService],
]);

export function getRegisteredImageServices(): ImageService[] {
  return Array.from(services.values());
}

export function getImageServiceById(serviceId: string): ImageService | undefined {
  return services.get(serviceId);
}

export function getConfiguredImageServiceId(manifest: Manifest): string {
  return manifest.settings?.imageProvider?.id || manifest.settings?.imageService || 'local';
}

export function getImageProviderPublicConfig(manifest: Manifest, serviceId: string): Record<string, unknown> {
  const providerConfig = manifest.settings?.imageProviders?.[serviceId];
  if (providerConfig) {
    return providerConfig;
  }

  if (serviceId === 'cloudinary') {
    return manifest.settings?.cloudinary || {};
  }

  return {};
}

export function getActiveImageService(manifest: Manifest): ImageService {
  const serviceId = getConfiguredImageServiceId(manifest);
  return getImageServiceById(serviceId) || localImageService;
}
