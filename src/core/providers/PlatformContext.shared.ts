import { createContext, useContext } from 'react'
import type { Platform, OSPlatform } from '../hooks/usePlatform'

export interface PlatformContextType {
  platform: Platform
  osPlatform: OSPlatform
  isWeb: boolean
  isDesktop: boolean
  isIOS: boolean
  isAndroid: boolean
  isMobile: boolean
  isTauri: boolean
  isMacOS: boolean
  isWindows: boolean
  isLinux: boolean
}

export const PlatformContext = createContext<PlatformContextType | undefined>(undefined)

export function usePlatformContext(): PlatformContextType {
  const context = useContext(PlatformContext)
  if (!context) {
    throw new Error('usePlatformContext must be used within PlatformProvider')
  }
  return context
}
