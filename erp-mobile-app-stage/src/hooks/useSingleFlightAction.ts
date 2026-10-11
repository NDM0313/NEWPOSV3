import { useCallback, useRef, useState } from 'react';

/**
 * Ensures an async action runs only once at a time.
 * Repeated taps/clicks while pending are ignored.
 */
export function useSingleFlightAction() {
  const inFlightRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  const runSingleFlight = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    if (inFlightRef.current) return undefined;
    inFlightRef.current = true;
    setIsRunning(true);
    try {
      return await action();
    } finally {
      inFlightRef.current = false;
      setIsRunning(false);
    }
  }, []);

  return { runSingleFlight, isRunning };
}

