/**
 * Hook to close dropdowns/modals when navigation changes
 * 
 * This ensures dropdowns don't stay open when user navigates to a different page/view
 */

import { useEffect, useState } from 'react';
import { useNavigation } from '../context/NavigationContext';

/**
 * Hook that returns a state setter that automatically closes when navigation changes
 * 
 * @param initialState - Initial open/closed state
 * @returns [isOpen, setIsOpen] - State and setter that auto-closes on navigation
 * 
 * @example
 * const [isOpen, setIsOpen] = useCloseOnNavigation(false);
 * // When currentView changes, isOpen will automatically become false
 */
export function useCloseOnNavigation<T = boolean>(initialState: T): [T, (value: T) => void] {
  const { currentView } = useNavigation();
  const [state, setState] = useState<T>(initialState);
  const [prevView, setPrevView] = useState(currentView);

  useEffect(() => {
    // If view changed, close the dropdown/modal
    if (currentView !== prevView) {
      setState(initialState);
      setPrevView(currentView);
    }
  }, [currentView, prevView, initialState]);

  return [state, setState];
}
