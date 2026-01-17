import React, { createContext, useContext, useState, ReactNode } from 'react';

type View = 'dashboard' | 'products' | 'pos' | 'sales' | 'customers' | 'settings' | 'purchases' | 'stock' | 'expenses' | 'accounting' | 'reports' | 'users' | 'contacts' | 'roles' | 'rentals' | 'inventory' | 'customize' | 'studio';

interface NavigationContextType {
  currentView: View;
  setCurrentView: (view: View) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeDrawer: 'none' | 'addUser' | 'addProduct' | 'addSale' | 'addPurchase' | 'addContact';
  openDrawer: (drawer: 'none' | 'addUser' | 'addProduct' | 'addSale' | 'addPurchase' | 'addContact') => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'addUser' | 'addProduct' | 'addSale' | 'addPurchase' | 'addContact'>('none');

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const openDrawer = (drawer: 'none' | 'addUser' | 'addProduct' | 'addSale' | 'addPurchase' | 'addContact') => setActiveDrawer(drawer);

  return (
    <NavigationContext.Provider value={{ currentView, setCurrentView, isSidebarOpen, toggleSidebar, activeDrawer, openDrawer }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};