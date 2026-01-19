// ============================================
// 🎯 KEYBOARD SHORTCUTS HOOK
// ============================================
// Global keyboard shortcuts for the ERP system

import { useEffect } from 'react';
import { useNavigation } from '@/app/context/NavigationContext';

export const useKeyboardShortcuts = () => {
  const { setActivePage } = useNavigation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl/Cmd is pressed
      const isMod = e.ctrlKey || e.metaKey;

      // Ignore shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Only allow Ctrl+S even in inputs
        if (isMod && e.key.toLowerCase() === 's') {
          e.preventDefault();
          // Trigger save event (can be handled by individual components)
          const saveEvent = new CustomEvent('global-save');
          document.dispatchEvent(saveEvent);
        }
        return;
      }

      // ============================================
      // NAVIGATION SHORTCUTS
      // ============================================

      if (isMod) {
        switch (e.key.toLowerCase()) {
          case 'h':
            e.preventDefault();
            setActivePage('home');
            break;
          
          case 'p':
            e.preventDefault();
            setActivePage('pos');
            break;
          
          case 's':
            e.preventDefault();
            // Trigger global save
            const saveEvent = new CustomEvent('global-save');
            document.dispatchEvent(saveEvent);
            break;
          
          case 'n':
            e.preventDefault();
            // Trigger new entry
            const newEvent = new CustomEvent('global-new');
            document.dispatchEvent(newEvent);
            break;
          
          case 'f':
            e.preventDefault();
            // Focus search bar
            const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
            }
            break;
          
          case 'k':
            e.preventDefault();
            // Open command palette (future feature)
            break;

          case '1':
            e.preventDefault();
            setActivePage('home');
            break;

          case '2':
            e.preventDefault();
            setActivePage('products');
            break;

          case '3':
            e.preventDefault();
            setActivePage('inventory');
            break;

          case '4':
            e.preventDefault();
            setActivePage('sales');
            break;

          case '5':
            e.preventDefault();
            setActivePage('purchases');
            break;

          case '6':
            e.preventDefault();
            setActivePage('rentals');
            break;

          case '7':
            e.preventDefault();
            setActivePage('expenses');
            break;

          case '8':
            e.preventDefault();
            setActivePage('accounting');
            break;

          case '9':
            e.preventDefault();
            setActivePage('reports');
            break;

          case '0':
            e.preventDefault();
            setActivePage('settings');
            break;
        }
      }

      // ============================================
      // ESCAPE KEY
      // ============================================
      if (e.key === 'Escape') {
        // Close any open modals/dialogs
        const closeEvent = new CustomEvent('global-escape');
        document.dispatchEvent(closeEvent);
      }

      // ============================================
      // F KEYS (without modifiers)
      // ============================================
      if (!isMod) {
        switch (e.key) {
          case 'F2':
            e.preventDefault();
            // Edit mode
            const editEvent = new CustomEvent('global-edit');
            document.dispatchEvent(editEvent);
            break;
          
          case 'F3':
            e.preventDefault();
            // Search
            const searchEvent = new CustomEvent('global-search');
            document.dispatchEvent(searchEvent);
            break;
          
          case 'F4':
            e.preventDefault();
            // Delete (with confirmation)
            const deleteEvent = new CustomEvent('global-delete');
            document.dispatchEvent(deleteEvent);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setActivePage]);
};

// ============================================
// KEYBOARD SHORTCUT INFO
// ============================================
export const KEYBOARD_SHORTCUTS = {
  navigation: [
    { key: 'Ctrl+H', description: 'Go to Home' },
    { key: 'Ctrl+P', description: 'Go to POS' },
    { key: 'Ctrl+1-0', description: 'Go to specific module' },
  ],
  actions: [
    { key: 'Ctrl+N', description: 'New Entry' },
    { key: 'Ctrl+S', description: 'Save' },
    { key: 'Ctrl+F', description: 'Search' },
    { key: 'F2', description: 'Edit' },
    { key: 'F4', description: 'Delete' },
    { key: 'Esc', description: 'Close Dialog' },
  ],
};
