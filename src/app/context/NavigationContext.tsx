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

type DrawerType = 'none' | 'addUser' | 'addProduct' | 'edit-product' | 'addSale' | 'edit-sale' | 'addPurchase' | 'edit-purchase' | 'addContact';

interface NavigationContextType {
  currentView: View;
  setCurrentView: (view: View) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeDrawer: DrawerType;
  openDrawer: (drawer: DrawerType, parentDrawer?: DrawerType, options?: { contactType?: 'customer' | 'supplier' | 'worker'; product?: any }) => void;
  closeDrawer: () => void;
  parentDrawer: DrawerType | null;
  selectedStudioSaleId?: string;
  setSelectedStudioSaleId?: (id: string) => void;
  drawerContactType?: 'customer' | 'supplier' | 'worker';
  drawerData?: any; // For passing data to drawers (e.g., product for edit)
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>('none');
  const [parentDrawer, setParentDrawer] = useState<DrawerType | null>(null);
  const [selectedStudioSaleId, setSelectedStudioSaleId] = useState<string | undefined>(undefined);
  const [drawerContactType, setDrawerContactType] = useState<'customer' | 'supplier' | 'worker' | undefined>(undefined);
  const [drawerData, setDrawerData] = useState<any>(undefined);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  const openDrawer = (drawer: DrawerType, parent?: DrawerType, options?: { contactType?: 'customer' | 'supplier' | 'worker'; product?: any }) => {
    // Set contact type if provided
    if (options?.contactType) {
      setDrawerContactType(options.contactType);
    } else {
      setDrawerContactType(undefined);
    }
    
    // Set drawer data if provided (e.g., product for edit)
    if (options?.product) {
      setDrawerData({ product: options.product });
    } else {
      setDrawerData(undefined);
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
    // Clear contact type and data when closing
    setDrawerContactType(undefined);
    setDrawerData(undefined);
    
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
      drawerContactType,
      drawerData
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