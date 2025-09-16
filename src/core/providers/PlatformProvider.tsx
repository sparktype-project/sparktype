import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import { usePlatform, Platform } from '../hooks/usePlatform'

interface PlatformContextType {
  platform: Platform
  isWeb: boolean
  isDesktop: boolean
  isIOS: boolean
  isAndroid: boolean
  isMobile: boolean
  isTauri: boolean
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined)

export function usePlatformContext(): PlatformContextType {
  const context = useContext(PlatformContext)
  if (!context) {
    throw new Error('usePlatformContext must be used within PlatformProvider')
  }
  return context
}

interface PlatformProviderProps {
  children: ReactNode
}

export function PlatformProvider({ children }: PlatformProviderProps) {
  const platform = usePlatform()
  
  const isWeb = platform === 'web'
  const isDesktop = platform === 'desktop'
  const isIOS = platform === 'ios'
  const isAndroid = platform === 'android'
  const isMobile = isIOS || isAndroid
  const isTauri = !isWeb

  // Add platform class to body
  useEffect(() => {
    const body = document.body
    
    // Remove all platform classes
    body.classList.remove('platform-web', 'platform-desktop', 'platform-ios', 'platform-android')
    
    // Add current platform class
    body.classList.add(`platform-${platform}`)
    
    return () => {
      body.classList.remove(`platform-${platform}`)
    }
  }, [platform])

  const value: PlatformContextType = {
    platform,
    isWeb,
    isDesktop,
    isIOS,
    isAndroid,
    isMobile,
    isTauri
  }

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  )
}