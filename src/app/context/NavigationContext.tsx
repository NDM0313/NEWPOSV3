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
  | 'studio-pipeline'
  | 'studio-sale-detail'
  | 'studio-sale-detail-new'
  | 'rental-booking'
  | 'studio-workflow'
  | 'studio-production-list'
  | 'studio-production-add'
  | 'studio-production-detail'
  | 'contact-profile'
  | 'item-report'
  | 'production-detail'
  | 'customer-tracking'
  | 'custom-new-order'
  | 'custom-pipeline'
  | 'custom-vendors'
  | 'packing'
  | 'contact-search-test'
  | 'sale-header-test'
  | 'purchase-header-test'
  | 'transaction-header-test'
  | 'user-management-test'
  | 'branch-management-test'
  | 'accounting-chart-test'
  | 'customer-ledger-test'
  | 'test-ledger'
  | 'customer-ledger-interactive-test'
  | 'ledger-debug-test'
  | 'sales-list-design-test'
  | 'worker-detail'
  | 'inventory-design-test'
  | 'inventory-analytics-test'
  | 'rls-validation'
  | 'day4-certification'
  | 'erp-integration-test'
  | 'cutover-prep'
  | 'responsive-test';

type DrawerType = 'none' | 'addUser' | 'addProduct' | 'edit-product' | 'addSale' | 'edit-sale' | 'addPurchase' | 'edit-purchase' | 'addContact';

interface NavigationContextType {
  currentView: View;
  setCurrentView: (view: View) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeDrawer: DrawerType;
  openDrawer: (drawer: DrawerType, parentDrawer?: DrawerType, options?: { contactType?: 'customer' | 'supplier' | 'worker'; product?: any; sale?: any; purchase?: any; contact?: any; prefillName?: string; prefillPhone?: string }) => void;
  closeDrawer: () => void;
  parentDrawer: DrawerType | null;
  selectedStudioSaleId?: string;
  setSelectedStudioSaleId?: (id: string) => void;
  selectedProductionId?: string;
  setSelectedProductionId?: (id: string) => void;
  drawerContactType?: 'customer' | 'supplier' | 'worker';
  drawerData?: any; // For passing data to drawers (e.g., product for edit)
  drawerPrefillName?: string; // Prefill name when opening contact form
  drawerPrefillPhone?: string; // Prefill phone when opening contact form
  createdContactId?: string | null; // Store newly created contact ID for auto-selection
  createdContactType?: 'customer' | 'supplier' | 'both' | null; // Store contact type for filtering
  setCreatedContactId?: (id: string | null, type?: 'customer' | 'supplier' | 'both' | null) => void;
  // Packing Modal State (Global)
  packingModalOpen?: boolean;
  openPackingModal?: (data: { itemId: number | string; productName: string; initialData?: any; onSave: (details: any) => void }) => void;
  closePackingModal?: () => void;
  packingModalData?: { itemId: number | string | null; productName: string; initialData?: any; onSave?: (details: any) => void } | null;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

/** Safe default when used outside provider (e.g. HMR or portal). Avoids crash; warn in dev. */
const defaultNavigationContext: NavigationContextType = {
  currentView: 'dashboard',
  setCurrentView: () => {},
  isSidebarOpen: true,
  toggleSidebar: () => {},
  activeDrawer: 'none',
  openDrawer: () => {},
  closeDrawer: () => {},
  parentDrawer: null,
  setCreatedContactId: () => {},
  openPackingModal: () => {},
  closePackingModal: () => {},
  packingModalOpen: false,
  packingModalData: null,
};

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>('none');
  const [parentDrawer, setParentDrawer] = useState<DrawerType | null>(null);
  const [selectedStudioSaleId, setSelectedStudioSaleId] = useState<string | undefined>(undefined);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | undefined>(undefined);
  const [selectedProductionId, setSelectedProductionId] = useState<string | undefined>(undefined);
  const [drawerContactType, setDrawerContactType] = useState<'customer' | 'supplier' | 'worker' | undefined>(undefined);
  const [drawerData, setDrawerData] = useState<any>(undefined);
  const [drawerPrefillName, setDrawerPrefillName] = useState<string | undefined>(undefined);
  const [drawerPrefillPhone, setDrawerPrefillPhone] = useState<string | undefined>(undefined);
  const [createdContactId, setCreatedContactIdState] = useState<string | null>(null);
  const [createdContactType, setCreatedContactType] = useState<'customer' | 'supplier' | 'both' | null>(null);
  
  // Packing Modal State (Global)
  const [packingModalOpen, setPackingModalOpen] = useState(false);
  const [packingModalData, setPackingModalData] = useState<{ itemId: number | string | null; productName: string; initialData?: any; onSave?: (details: any) => void } | null>(null);
  
  // Wrapper function to set both ID and type
  const setCreatedContactId = (id: string | null, type?: 'customer' | 'supplier' | 'both' | null) => {
    setCreatedContactIdState(id);
    setCreatedContactType(type || null);
  };

  // Packing Modal Functions
  const openPackingModal = (data: { itemId: number | string; productName: string; initialData?: any; onSave: (details: any) => void }) => {
    setPackingModalData({
      itemId: data.itemId,
      productName: data.productName,
      initialData: data.initialData,
      onSave: data.onSave
    });
    setPackingModalOpen(true);
  };

  const closePackingModal = () => {
    setPackingModalOpen(false);
    // Clear data after a short delay to allow modal to close smoothly
    setTimeout(() => {
      setPackingModalData(null);
    }, 200);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  const openDrawer = (drawer: DrawerType, parent?: DrawerType, options?: { contactType?: 'customer' | 'supplier' | 'worker'; product?: any; sale?: any; purchase?: any; contact?: any; prefillName?: string; prefillPhone?: string }) => {
    // Set contact type if provided (or from contact when editing)
    if (options?.contactType) {
      setDrawerContactType(options.contactType);
    } else if (options?.contact?.type) {
      const t = options.contact.type;
      setDrawerContactType(t === 'customer' || t === 'supplier' || t === 'worker' ? t : undefined);
    } else {
      setDrawerContactType(undefined);
    }
    
    // Set prefill data for contact form
    if (options?.prefillName) {
      setDrawerPrefillName(options.prefillName);
    } else {
      setDrawerPrefillName(undefined);
    }
    
    if (options?.prefillPhone) {
      setDrawerPrefillPhone(options.prefillPhone);
    } else {
      setDrawerPrefillPhone(undefined);
    }
    
    // Set drawer data if provided (TASK 3 FIX - Support sale, purchase, product for edit)
    if (options?.sale) {
      setDrawerData({ sale: options.sale });
    } else if (options?.purchase) {
      setDrawerData({ purchase: options.purchase });
    } else if (options?.product) {
      setDrawerData({ product: options.product });
    } else if (options?.contact) {
      setDrawerData({ contact: options.contact });
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
    // Clear contact type, data, and prefill when closing
    setDrawerContactType(undefined);
    setDrawerData(undefined);
    setDrawerPrefillName(undefined);
    setDrawerPrefillPhone(undefined);
    
    // If there's a parent drawer, return to it
    if (parentDrawer) {
      setActiveDrawer(parentDrawer);
      setParentDrawer(null);
    } else {
      // Otherwise close completely
      setActiveDrawer('none');
    }
    // Note: Don't clear createdContactId here - let the parent form use it first
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
      selectedWorkerId,
      setSelectedWorkerId,
      selectedProductionId,
      setSelectedProductionId,
      drawerContactType,
      drawerData,
      drawerPrefillName,
      drawerPrefillPhone,
      createdContactId,
      createdContactType,
      setCreatedContactId,
      packingModalOpen,
      openPackingModal,
      closePackingModal,
      packingModalData
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV !== undefined ? import.meta.env.DEV : (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');
    if (isDev) {
      console.warn('[NavigationContext] useNavigation called outside NavigationProvider (e.g. HMR or portal). Using safe defaults.');
    }
    return defaultNavigationContext;
  }
  return context;
};