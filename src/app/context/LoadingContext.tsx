import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface LoadingContextValue {
  isLoading: boolean;
  label: string | null;
  show: (label?: string) => number;
  hide: (handle: number) => void;
  withLoading: <T>(label: string | undefined, task: () => Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

/**
 * Global loading provider: blurred click-blocking overlay while async work runs.
 * Use `useSubmitLock().run(label, task)` for mutations; disable controls when `busy`.
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
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-gray-900 border border-gray-800 px-6 py-5 shadow-2xl">
            <div
              className="w-10 h-10 rounded-full border-4 border-gray-700 border-t-blue-500 animate-spin"
              aria-hidden="true"
            />
            <p className="text-sm text-white font-medium">{firstLabel || 'Processing...'}</p>
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

/** Ref mutex + global overlay — use `busy` to disable all actions on the same surface. */
export function useSubmitLock() {
  const { isLoading, withLoading } = useLoading();
  const inFlightRef = useRef(false);
  const [localInFlight, setLocalInFlight] = useState(false);

  const busy = isLoading || localInFlight;

  const run = useCallback(
    async (label: string | undefined, task: () => Promise<void>): Promise<void> => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setLocalInFlight(true);
      try {
        await withLoading(label, task);
      } finally {
        inFlightRef.current = false;
        setLocalInFlight(false);
      }
    },
    [withLoading],
  );

  return { busy, run, isLoading };
}
