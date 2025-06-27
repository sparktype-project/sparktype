// src/components/core/ThemeProvider.tsx
"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
// Corrected import for ThemeProviderProps:
import { type ThemeProviderProps } from "next-themes"; // Import directly from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}