import { createContext, useContext, type RefObject } from 'react';

export const MainScrollContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useMainScrollRef(): RefObject<HTMLElement | null> | undefined {
  return useContext(MainScrollContext) ?? undefined;
}
