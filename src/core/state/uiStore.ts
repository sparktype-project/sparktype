// src/core/state/uiStore.ts

import { create, type StateCreator } from 'zustand';
import { type ReactNode } from 'react';

// --- Helper for screen size ---
const isDesktopView = () => typeof window !== 'undefined' && window.innerWidth >= 1024;

// --- Type Definitions for the store structure ---

// Defines the shape of the data in the sidebar slice
interface SidebarState {
  isLeftOpen: boolean;
  isRightOpen: boolean;
  isLeftAvailable: boolean;
  isRightAvailable: boolean;
  leftSidebarContent: ReactNode | null;
  rightSidebarContent: ReactNode | null;
}

// Defines the actions available in the sidebar slice
interface SidebarActions {
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftAvailable: (available: boolean) => void;
  setRightAvailable: (available: boolean) => void;
  setRightOpen: (isOpen: boolean) => void;
  setLeftSidebarContent: (content: ReactNode | null) => void;
  setRightSidebarContent: (content: ReactNode | null) => void;
}

// Defines the shape of the data in the screen slice
interface ScreenState {
  isDesktop: boolean;
  isInitialized: boolean;
}

// Defines the actions available in the screen slice
interface ScreenActions {
    initializeScreenSize: () => void;
}

// The full store shape, combining state and actions
type UIState = {
    sidebar: SidebarState & SidebarActions;
    screen: ScreenState & ScreenActions;
}

// --- Store Slice Implementations ---

// Creates the sidebar slice of the store
const createSidebarSlice: StateCreator<UIState, [], [], { sidebar: SidebarState & SidebarActions }> = (set, get) => ({
  sidebar: {
    isLeftOpen: isDesktopView(),
    isRightOpen: isDesktopView(),
    isLeftAvailable: false,
    isRightAvailable: false,
    leftSidebarContent: null,
    rightSidebarContent: null,
    toggleLeftSidebar: () => set(state => ({ 
        sidebar: { 
            ...state.sidebar, 
            isLeftOpen: !state.sidebar.isLeftOpen, 
            // On mobile, opening one sidebar closes the other
            isRightOpen: !get().screen.isDesktop && !state.sidebar.isLeftOpen ? false : state.sidebar.isRightOpen 
        }
    })),
    toggleRightSidebar: () => set(state => ({ 
        sidebar: { 
            ...state.sidebar, 
            isRightOpen: !state.sidebar.isRightOpen, 
            isLeftOpen: !get().screen.isDesktop && !state.sidebar.isRightOpen ? false : state.sidebar.isLeftOpen 
        }
    })),
    setLeftAvailable: (available) => set(state => ({ sidebar: { ...state.sidebar, isLeftAvailable: available }})),
    setRightAvailable: (available) => set(state => ({ sidebar: { ...state.sidebar, isRightAvailable: available }})),
    setRightOpen: (isOpen) => set(state => ({ sidebar: { ...state.sidebar, isRightOpen: isOpen }})),
    setLeftSidebarContent: (content) => set(state => ({ sidebar: { ...state.sidebar, leftSidebarContent: content }})),
    setRightSidebarContent: (content) => set(state => ({ sidebar: { ...state.sidebar, rightSidebarContent: content }})),

  }
});

// Creates the screen slice of the store
const createScreenSlice: StateCreator<UIState, [], [], { screen: ScreenState & ScreenActions }> = (set, get) => ({
    screen: {
        isDesktop: isDesktopView(),
        isInitialized: false, // Initialize the flag to false
        initializeScreenSize: () => {
          // Add a guard clause to prevent running more than once
          if (get().screen.isInitialized) return;

          // Set the flag to true immediately to block re-entry
          set(state => ({
            screen: { ...state.screen, isInitialized: true }
          }));

          if (typeof window === 'undefined') return;

          const handleResize = () => {
            const desktop = isDesktopView();
            if (desktop !== get().screen.isDesktop) {
              set({
                  screen: { ...get().screen, isDesktop: desktop },
                  sidebar: { ...get().sidebar, isLeftOpen: desktop, isRightOpen: desktop }
                });
            }
          };
          window.addEventListener('resize', handleResize);
          handleResize();
        },
    }
});


// Combine the slices to create the final store
export const useUIStore = create<UIState>()((...a) => ({
    ...createSidebarSlice(...a),
    ...createScreenSlice(...a),
}));