import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '@/app/lib/safeBrowserStorage';

/** Desktop sidebar expanded (260) / collapsed icon-rail (80). Persist across refresh. */
export const SIDEBAR_OPEN_STORAGE_KEY = 'erp_sidebar_open';

/** Parse stored preference; null = use default expanded. */
export function parseSidebarOpenStoredValue(raw: string | null): boolean | null {
  if (raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  return null;
}

export function readStoredSidebarOpen(): boolean | null {
  return parseSidebarOpenStoredValue(safeLocalStorageGetItem(SIDEBAR_OPEN_STORAGE_KEY));
}

export function writeStoredSidebarOpen(isOpen: boolean): void {
  safeLocalStorageSetItem(SIDEBAR_OPEN_STORAGE_KEY, isOpen ? '1' : '0');
}
