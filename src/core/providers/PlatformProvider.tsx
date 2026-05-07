import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { usePlatform, useOSPlatform } from '../hooks/usePlatform'
import type { PlatformContextType } from './PlatformContext.shared'
import { PlatformContext } from './PlatformContext.shared'

interface PlatformProviderProps {
  children: ReactNode
}

export function PlatformProvider({ children }: PlatformProviderProps) {
  const platform = usePlatform()
  const osPlatform = useOSPlatform()

  const isWeb = platform === 'web'
  const isDesktop = platform === 'desktop'
  const isIOS = platform === 'ios'
  const isAndroid = platform === 'android'
  const isMobile = isIOS || isAndroid
  const isTauri = !isWeb
  const isMacOS = osPlatform === 'macos'
  const isWindows = osPlatform === 'windows'
  const isLinux = osPlatform === 'linux'

  // Add platform class to body
  useEffect(() => {
    const body = document.body

    // Remove all platform classes
    body.classList.remove('platform-web', 'platform-desktop', 'platform-ios', 'platform-android')
    body.classList.remove('os-macos', 'os-windows', 'os-linux')

    // Add current platform class
    body.classList.add(`platform-${platform}`)

    // Add OS-specific class
    if (osPlatform !== 'web') {
      body.classList.add(`os-${osPlatform}`)
    }

    return () => {
      body.classList.remove(`platform-${platform}`)
      if (osPlatform !== 'web') {
        body.classList.remove(`os-${osPlatform}`)
      }
    }
  }, [platform, osPlatform])

  const value: PlatformContextType = {
    platform,
    osPlatform,
    isWeb,
    isDesktop,
    isIOS,
    isAndroid,
    isMobile,
    isTauri,
    isMacOS,
    isWindows,
    isLinux
  }

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  )
}
