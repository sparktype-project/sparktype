// src/features/viewer/contexts/ViewerLoadingContext.tsx

import { create } from 'zustand';

interface ViewerLoadingState {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useViewerLoading = create<ViewerLoadingState>((set) => ({
  isLoading: false,
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
}));
