import React, { createContext, useContext, useState, ReactNode } from 'react';

type View = 
  | 'dashboard' 
  | 'products' 
  | 'pos' 
  | 'sales' 
  | 'customers' 
  | 'settings' 
  | 'purchases' 
  | 'stock' 
  | 'expenses' 
  | 'accounting' 
  | 'reports' 
  | 'users' 
  | 'contacts' 
  | 'roles' 
  | 'rentals' 
  | 'inventory' 
  | 'customize' 
  | 'studio'
  | 'studio-dashboard-new'
  | 'studio-sales-list-new'
  | 'studio-sale-detail'
  | 'studio-sale-detail-new'
  | 'rental-booking'
  | 'studio-workflow'
  | 'contact-profile'
  | 'item-report'
  | 'production-detail'
  | 'customer-tracking'
  | 'custom-new-order'
  | 'custom-pipeline'
  | 'custom-vendors'
  | 'packing';

type DrawerType = 'none' | 'addUser' | 'addProduct' | 'addSale' | 'addPurchase' | 'addContact';

interface NavigationContextType {
  currentView: View;
  setCurrentView: (view: View) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeDrawer: DrawerType;
  openDrawer: (drawer: DrawerType, parentDrawer?: DrawerType, options?: { contactType?: 'customer' | 'supplier' | 'worker' }) => void;
  closeDrawer: () => void;
  parentDrawer: DrawerType | null;
  selectedStudioSaleId?: string;
  setSelectedStudioSaleId?: (id: string) => void;
  drawerContactType?: 'customer' | 'supplier' | 'worker';
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>('none');
  const [parentDrawer, setParentDrawer] = useState<DrawerType | null>(null);
  const [selectedStudioSaleId, setSelectedStudioSaleId] = useState<string | undefined>(undefined);
  const [drawerContactType, setDrawerContactType] = useState<'customer' | 'supplier' | 'worker' | undefined>(undefined);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  const openDrawer = (drawer: DrawerType, parent?: DrawerType, options?: { contactType?: 'customer' | 'supplier' | 'worker' }) => {
    // Set contact type if provided
    if (options?.contactType) {
      setDrawerContactType(options.contactType);
    } else {
      setDrawerContactType(undefined);
    }
    
    // If opening a child drawer (like addProduct from addSale), store the parent
    if (parent) {
      setParentDrawer(parent);
    } else {
      // If opening a root drawer, clear parent
      setParentDrawer(null);
    }
    setActiveDrawer(drawer);
  };

  const closeDrawer = () => {
    // Clear contact type when closing
    setDrawerContactType(undefined);
    
    // If there's a parent drawer, return to it
    if (parentDrawer) {
      setActiveDrawer(parentDrawer);
      setParentDrawer(null);
    } else {
      // Otherwise close completely
      setActiveDrawer('none');
    }
  };

  return (
    <NavigationContext.Provider value={{ 
      currentView, 
      setCurrentView, 
      isSidebarOpen, 
      toggleSidebar, 
      activeDrawer, 
      openDrawer, 
      closeDrawer,
      parentDrawer,
      selectedStudioSaleId,
      setSelectedStudioSaleId,
      drawerContactType
    }}>
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