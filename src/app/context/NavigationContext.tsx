import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { parseNavLocationFromUrl, type FinancialReportType } from '@/app/lib/navDeepLinks';
import { clearStuckModalLocks, shouldClearStuckModalLocks } from '@/app/lib/clearStuckModalLocks';
import type { LedgerStatementV2Initial } from '@/app/features/ledger-statement-center-v2/types';

export type AccountingTabInitial = 'account_statements' | null;

export type View = 
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
  | 'accounting-edit-trace'
  | 'ar-ap-truth-lab'
  | 'expense-edit-trace'
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
  | 'responsive-test'
  | 'test-account-entry'
  | 'accounting-integrity-lab'
  | 'accounting-test-bench'
  | 'developer-integrity-lab'
  | 'accounting-developer-center'
  | 'ar-ap-reconciliation-center'
  | 'financial-trace-center'
  | 'erp-permissions'
  | 'permission-inspector'
  | 'studio-order-detail-v3'
  | 'manufacturing-bom'
  | 'manufacturing-orders'
  | 'manufacturing-workflow'
  | 'party-ledger'
  | 'stock-report'
  | 'stock-movement-history'
  | 'bespoke-work-orders';

type DrawerType = 'none' | 'addUser' | 'addProduct' | 'edit-product' | 'addSale' | 'edit-sale' | 'addPurchase' | 'edit-purchase' | 'addContact';

interface NavigationContextType {
  currentView: View;
  setCurrentView: (view: View) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  activeDrawer: DrawerType;
  openDrawer: (drawer: DrawerType, parentDrawer?: DrawerType, options?: { contactType?: 'customer' | 'supplier' | 'worker'; product?: any; duplicateFrom?: any; sale?: any; purchase?: any; contact?: any; prefillName?: string; prefillPhone?: string; convertToFinal?: boolean; bespokeOrder?: boolean }) => void;
  closeDrawer: () => void;
  /** True when sale drawer opened via Create New → Custom / Bespoke Order */
  saleDrawerBespokeMode: boolean;
  clearSaleDrawerBespokeMode: () => void;
  parentDrawer: DrawerType | null;
  selectedStudioSaleId?: string;
  setSelectedStudioSaleId?: (id: string) => void;
  /** When set and user is on Sales view, open the sale details drawer for this invoice (e.g. after Generate Sale Invoice from Studio). */
  openSaleIdForView?: string | null;
  setOpenSaleIdForView?: (id: string | null) => void;
  selectedProductionId?: string;
  setSelectedProductionId?: (id: string) => void;
  selectedStudioOrderIdV3?: string | null;
  setSelectedStudioOrderIdV3?: (id: string | null) => void;
  selectedManufacturingOrderId?: string | null;
  setSelectedManufacturingOrderId?: (id: string | null) => void;
  drawerContactType?: 'customer' | 'supplier' | 'worker';
  drawerData?: any; // For passing data to drawers (e.g., product for edit)
  drawerPrefillName?: string; // Prefill name when opening contact form
  drawerPrefillPhone?: string; // Prefill phone when opening contact form
  createdContactId?: string | null; // Store newly created contact ID for auto-selection
  createdContactType?: 'customer' | 'supplier' | 'both' | null; // Store contact type for filtering
  setCreatedContactId?: (id: string | null, type?: 'customer' | 'supplier' | 'both' | null) => void;
  /** When set, Sale/Purchase form should auto-select this product (and then clear it). */
  createdProduct?: any | null;
  setCreatedProduct?: (product: any | null) => void;
  // Packing Modal State (Global)
  packingModalOpen?: boolean;
  openPackingModal?: (data: { itemId: number | string; productName: string; initialData?: any; onSave: (details: any) => void }) => void;
  closePackingModal?: () => void;
  packingModalData?: { itemId: number | string | null; productName: string; initialData?: any; onSave?: (details: any) => void } | null;
  /** Party-ledger navigation state */
  partyLedgerParams?: { contactId?: string; contactName?: string; contactType?: 'customer' | 'supplier' } | null;
  setPartyLedgerParams?: (p: { contactId?: string; contactName?: string; contactType?: 'customer' | 'supplier' } | null) => void;
  openPartyLedger?: (params: { contactId?: string; contactName?: string; contactType?: 'customer' | 'supplier' }) => void;
  /** Set from `?financial=` when opening Reports via deep link. */
  reportsFinancialInitial: FinancialReportType | null;
  /** Pre-select party/account when opening Account Statements (embedded V2) from Balance Sheet etc. */
  accountStatementV2Initial: LedgerStatementV2Initial | null;
  setAccountStatementV2Initial: (p: LedgerStatementV2Initial | null) => void;
  /** One-shot tab to open when navigating to Accounting (e.g. account_statements). */
  accountingTabInitial: AccountingTabInitial;
  setAccountingTabInitial: (tab: AccountingTabInitial) => void;
  openLedgerStatementV2: (params: LedgerStatementV2Initial) => void;
  /** @deprecated use accountStatementV2Initial */
  ledgerV2Initial: LedgerStatementV2Initial | null;
  /** @deprecated use setAccountStatementV2Initial */
  setLedgerV2Initial: (p: LedgerStatementV2Initial | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

/** Safe default when used outside provider (e.g. HMR or portal). Avoids crash; warn in dev. */
const defaultNavigationContext: NavigationContextType = {
  currentView: 'dashboard',
  setCurrentView: () => {},
  isSidebarOpen: true,
  toggleSidebar: () => {},
  mobileNavOpen: false,
  setMobileNavOpen: () => {},
  activeDrawer: 'none',
  openDrawer: () => {},
  closeDrawer: () => {},
  parentDrawer: null,
  openSaleIdForView: null,
  setOpenSaleIdForView: () => {},
  setCreatedContactId: () => {},
  createdProduct: null,
  setCreatedProduct: () => {},
  openPackingModal: () => {},
  closePackingModal: () => {},
  packingModalOpen: false,
  packingModalData: null,
  partyLedgerParams: null,
  setPartyLedgerParams: () => {},
  openPartyLedger: () => {},
  saleDrawerBespokeMode: false,
  clearSaleDrawerBespokeMode: () => {},
  reportsFinancialInitial: null,
  accountStatementV2Initial: null,
  setAccountStatementV2Initial: () => {},
  accountingTabInitial: null,
  setAccountingTabInitial: () => {},
  ledgerV2Initial: null,
  setLedgerV2Initial: () => {},
  openLedgerStatementV2: () => {},
};

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>('none');
  const [parentDrawer, setParentDrawer] = useState<DrawerType | null>(null);
  const [selectedStudioSaleId, setSelectedStudioSaleId] = useState<string | undefined>(undefined);
  const [openSaleIdForView, setOpenSaleIdForView] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | undefined>(undefined);
  const [selectedProductionId, setSelectedProductionId] = useState<string | undefined>(undefined);
  const [selectedStudioOrderIdV3, setSelectedStudioOrderIdV3] = useState<string | null>(null);
  const [selectedManufacturingOrderId, setSelectedManufacturingOrderId] = useState<string | null>(null);
  const [drawerContactType, setDrawerContactType] = useState<'customer' | 'supplier' | 'worker' | undefined>(undefined);
  const [drawerData, setDrawerData] = useState<any>(undefined);
  const [drawerPrefillName, setDrawerPrefillName] = useState<string | undefined>(undefined);
  const [drawerPrefillPhone, setDrawerPrefillPhone] = useState<string | undefined>(undefined);
  const [createdContactId, setCreatedContactIdState] = useState<string | null>(null);
  const [createdContactType, setCreatedContactType] = useState<'customer' | 'supplier' | 'both' | null>(null);
  const [createdProduct, setCreatedProduct] = useState<any | null>(null);
  const [saleDrawerBespokeMode, setSaleDrawerBespokeMode] = useState(false);
  const [reportsFinancialInitial, setReportsFinancialInitial] = useState<FinancialReportType | null>(null);
  const [accountStatementV2Initial, setAccountStatementV2Initial] = useState<LedgerStatementV2Initial | null>(null);
  const [accountingTabInitial, setAccountingTabInitial] = useState<AccountingTabInitial>(null);

  useEffect(() => {
    const { view, financial, openAccountStatements } = parseNavLocationFromUrl();
    if (view) {
      setCurrentView(view as View);
      if (financial) setReportsFinancialInitial(financial);
      if (openAccountStatements) {
        setAccountingTabInitial('account_statements');
      }
    }
  }, []);

  const clearSaleDrawerBespokeMode = useCallback(() => {
    setSaleDrawerBespokeMode(false);
  }, []);

  // Packing Modal State (Global)
  const [packingModalOpen, setPackingModalOpen] = useState(false);
  const [packingModalData, setPackingModalData] = useState<{ itemId: number | string | null; productName: string; initialData?: any; onSave?: (details: any) => void } | null>(null);
  
  // Wrapper function to set both ID and type
  const setCreatedContactId = useCallback((id: string | null, type?: 'customer' | 'supplier' | 'both' | null) => {
    setCreatedContactIdState(id);
    setCreatedContactType(type || null);
  }, []);

  // Packing Modal Functions
  const openPackingModal = useCallback((data: { itemId: number | string; productName: string; initialData?: any; onSave: (details: any) => void }) => {
    setPackingModalData({
      itemId: data.itemId,
      productName: data.productName,
      initialData: data.initialData,
      onSave: data.onSave
    });
    setPackingModalOpen(true);
  }, []);

  const closePackingModal = useCallback(() => {
    setPackingModalOpen(false);
    // Clear data after a short delay to allow modal to close smoothly
    setTimeout(() => {
      setPackingModalData(null);
    }, 200);
  }, []);

  const [partyLedgerParams, setPartyLedgerParams] = useState<{ contactId?: string; contactName?: string; contactType?: 'customer' | 'supplier' } | null>(null);

  const openPartyLedger = useCallback((params: { contactId?: string; contactName?: string; contactType?: 'customer' | 'supplier' }) => {
    setPartyLedgerParams(params);
    setCurrentView('party-ledger');
  }, []);

  const openLedgerStatementV2 = useCallback((params: LedgerStatementV2Initial) => {
    setAccountStatementV2Initial(params);
    setAccountingTabInitial('account_statements');
    setCurrentView('accounting');
  }, []);

  // Use functional updater to avoid stale closure on isSidebarOpen
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  const openDrawer = useCallback((drawer: DrawerType, parent?: DrawerType, options?: { contactType?: 'customer' | 'supplier' | 'worker'; product?: any; sale?: any; purchase?: any; contact?: any; prefillName?: string; prefillPhone?: string; convertToFinal?: boolean; bespokeOrder?: boolean }) => {
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
      setDrawerData({ sale: options.sale, convertToFinal: options?.convertToFinal });
    } else if (options?.purchase) {
      setDrawerData({ purchase: options.purchase });
    } else if (options?.product) {
      setDrawerData({ product: options.product });
    } else if (options?.duplicateFrom) {
      setDrawerData({ duplicateFrom: options.duplicateFrom });
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
    if (drawer === 'addProduct') setCreatedProduct(null);
    if (drawer === 'addSale' && options?.bespokeOrder) {
      setSaleDrawerBespokeMode(true);
    } else if (drawer === 'addSale' && !parent) {
      setSaleDrawerBespokeMode(false);
    }
    setActiveDrawer(drawer);
  }, []);

  const closeDrawer = useCallback(() => {
    // Clear contact type, data, and prefill when closing
    setDrawerContactType(undefined);
    setDrawerData(undefined);
    setDrawerPrefillName(undefined);
    setDrawerPrefillPhone(undefined);
    setSaleDrawerBespokeMode(false);
    
    // If there's a parent drawer, return to it
    setParentDrawer(prev => {
      if (prev) {
        setActiveDrawer(prev);
        return null;
      }
      setActiveDrawer('none');
      return null;
    });
    // Release orphaned Radix scroll-lock if modal layers desync
    window.setTimeout(() => {
      if (shouldClearStuckModalLocks()) clearStuckModalLocks();
    }, 400);
    // Note: Don't clear createdContactId here - let the parent form use it first
  }, []);

  const contextValue = useMemo(() => ({
    currentView, 
    setCurrentView, 
    isSidebarOpen, 
    toggleSidebar, 
    mobileNavOpen,
    setMobileNavOpen,
    activeDrawer, 
    openDrawer, 
    closeDrawer, 
    parentDrawer,
    selectedStudioSaleId,
    setSelectedStudioSaleId,
    openSaleIdForView,
    setOpenSaleIdForView,
    selectedWorkerId,
    setSelectedWorkerId,
    selectedProductionId,
    setSelectedProductionId,
    selectedStudioOrderIdV3,
    setSelectedStudioOrderIdV3,
    selectedManufacturingOrderId,
    setSelectedManufacturingOrderId,
    drawerContactType,
    drawerData,
    drawerPrefillName,
    drawerPrefillPhone,
    createdContactId,
    createdContactType,
    setCreatedContactId,
    createdProduct,
    setCreatedProduct,
    packingModalOpen,
    openPackingModal,
    closePackingModal,
    packingModalData,
    partyLedgerParams,
    setPartyLedgerParams,
    openPartyLedger,
    saleDrawerBespokeMode,
    clearSaleDrawerBespokeMode,
    reportsFinancialInitial,
    accountStatementV2Initial,
    setAccountStatementV2Initial,
    accountingTabInitial,
    setAccountingTabInitial,
    ledgerV2Initial: accountStatementV2Initial,
    setLedgerV2Initial: setAccountStatementV2Initial,
    openLedgerStatementV2,
  }), [
    currentView, isSidebarOpen, mobileNavOpen, activeDrawer, parentDrawer,
    selectedStudioSaleId, openSaleIdForView, selectedWorkerId, selectedProductionId,
    selectedStudioOrderIdV3, selectedManufacturingOrderId, drawerContactType, drawerData, drawerPrefillName,
    drawerPrefillPhone, createdContactId, createdContactType, createdProduct, packingModalOpen,
    packingModalData, partyLedgerParams, toggleSidebar, openDrawer, closeDrawer, setCreatedContactId, setCreatedProduct,
    openPackingModal, closePackingModal, openPartyLedger, openLedgerStatementV2, saleDrawerBespokeMode, clearSaleDrawerBespokeMode,
    reportsFinancialInitial, accountStatementV2Initial, accountingTabInitial,
  ]);

  return (
    <NavigationContext.Provider value={contextValue}>
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