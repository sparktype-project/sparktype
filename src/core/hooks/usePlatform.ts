import { useState, useEffect } from 'react'

export type Platform = 'web' | 'desktop' | 'ios' | 'android'
export type OSPlatform = 'macos' | 'windows' | 'linux' | 'ios' | 'android' | 'web'

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('web')

  useEffect(() => {
    const detectPlatform = async () => {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        try {
          const { platform } = await import('@tauri-apps/plugin-os')
          const platformName = await platform()

          switch (platformName) {
            case 'ios':
              setPlatform('ios')
              break
            case 'android':
              setPlatform('android')
              break
            case 'macos':
            case 'windows':
            case 'linux':
              setPlatform('desktop')
              break
            default:
              setPlatform('web')
          }
        } catch (error) {
          // Fallback to desktop if Tauri but can't detect platform
          setPlatform('desktop')
        }
      } else {
        setPlatform('web')
      }
    }

    detectPlatform()
  }, [])

  return platform
}

export function useOSPlatform(): OSPlatform {
  const [osPlatform, setOSPlatform] = useState<OSPlatform>('web')

  useEffect(() => {
    const detectOSPlatform = async () => {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        try {
          const { platform } = await import('@tauri-apps/plugin-os')
          const platformName = await platform()
          setOSPlatform(platformName as OSPlatform)
        } catch (error) {
          // Fallback based on user agent for desktop detection
          const userAgent = navigator.userAgent.toLowerCase()
          if (userAgent.includes('mac')) {
            setOSPlatform('macos')
          } else if (userAgent.includes('win')) {
            setOSPlatform('windows')
          } else if (userAgent.includes('linux')) {
            setOSPlatform('linux')
          } else {
            setOSPlatform('web')
          }
        }
      } else {
        setOSPlatform('web')
      }
    }

    detectOSPlatform()
  }, [])

  return osPlatform
}

// Helper functions for conditional styling
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function platformClass(platform: Platform, classes: Record<Platform, string>): string {
  return classes[platform] || ''
}