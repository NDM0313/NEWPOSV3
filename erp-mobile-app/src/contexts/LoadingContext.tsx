import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface LoadingContextValue {
  /** True while one or more async operations are in progress. */
  isLoading: boolean;
  /** Current user-facing label, if one was provided. */
  label: string | null;
  /** Show the overlay. Returns a handle that MUST be passed to `hide(handle)` when done. */
  show: (label?: string) => number;
  /** Hide the overlay for a given handle. */
  hide: (handle: number) => void;
  /** Run an async task with the overlay visible. Automatically hides on success or error. */
  withLoading: <T>(label: string | undefined, task: () => Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

/**
 * Global loading provider: renders a blurred, click-blocking overlay whenever
 * any async action is in flight. Use `useLoading().withLoading(label, task)`
 * from any component to gate a request behind the overlay.
 */
export function LoadingProvider({ children }: { children: ReactNode }) {
  const counterRef = useRef(0);
  const [active, setActive] = useState<Record<number, string>>({});

  const show = useCallback((label?: string) => {
    counterRef.current += 1;
    const handle = counterRef.current;
    setActive((prev) => ({ ...prev, [handle]: label ?? '' }));
    return handle;
  }, []);

  const hide = useCallback((handle: number) => {
    setActive((prev) => {
      if (!(handle in prev)) return prev;
      const next = { ...prev };
      delete next[handle];
      return next;
    });
  }, []);

  const withLoading = useCallback(
    async <T,>(label: string | undefined, task: () => Promise<T>): Promise<T> => {
      const handle = show(label);
      try {
        return await task();
      } finally {
        hide(handle);
      }
    },
    [show, hide],
  );

  const isLoading = Object.keys(active).length > 0;
  const firstLabel = useMemo(() => {
    const entries = Object.values(active).filter((v) => v && v.length > 0);
    return entries.length > 0 ? entries[0] : null;
  }, [active]);

  const value = useMemo<LoadingContextValue>(
    () => ({ isLoading, label: firstLabel, show, hide, withLoading }),
    [isLoading, firstLabel, show, hide, withLoading],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#1F2937] border border-[#374151] px-6 py-5 shadow-2xl">
            <div
              className="w-10 h-10 rounded-full border-4 border-[#374151] border-t-[#8B5CF6] animate-spin"
              aria-hidden="true"
            />
            <p className="text-sm text-white font-medium">{firstLabel || 'Saving...'}</p>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return ctx;
}
