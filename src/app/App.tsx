import React, { lazy, Suspense } from 'react';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './components/dashboard/Dashboard';
import { ProductList } from './components/products/ProductList';
import { POS } from './components/pos/POS';
import { SalesEntry } from './components/sales/SalesEntry';
import { StockDashboard } from './components/dashboard/StockDashboard';
import { ExpensesDashboard } from './components/dashboard/ExpensesDashboard';
import { GlobalDrawer } from './components/layout/GlobalDrawer';
import { ContactList } from './components/contacts/ContactList';
import { ContactsPage } from './components/contacts/ContactsPage';
import { ProductsPage } from './components/products/ProductsPage';
import { PurchaseList } from './components/purchases/PurchaseList';
const AccountingDashboard = lazy(() => import('./components/accounting/AccountingDashboard').then(m => ({ default: m.AccountingDashboard })));
const UserDashboard = lazy(() => import('./components/users/UserDashboard').then(m => ({ default: m.UserDashboard })));
const RolesDashboard = lazy(() => import('./components/users/RolesDashboard').then(m => ({ default: m.RolesDashboard })));
import { UserProfilePage } from './components/users/UserProfilePage';
import { PurchasesPage } from './components/purchases/PurchasesPage';
import { SalesPage } from './components/sales/SalesPage';
const RentalDashboard = lazy(() => import('./components/rentals/RentalDashboard').then(m => ({ default: m.RentalDashboard })));
import { NewRentalBooking } from './components/rentals/NewRentalBooking';
import { PaymentFooterDemo } from './components/demo/PaymentFooterDemo';
import { UXImprovementsDemo } from './components/demo/UXImprovementsDemo';
import { InteractiveFeedbackDemo } from './components/demo/InteractiveFeedbackDemo';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { ModuleProvider } from './context/ModuleContext';
import { AccountingProvider } from './context/AccountingContext';
import { SettingsProvider } from './context/SettingsContext';
import { SalesProvider } from './context/SalesContext';
import { PurchaseProvider } from './context/PurchaseContext';
import { RentalProvider } from './context/RentalContext';
import { ExpenseProvider } from './context/ExpenseContext';
import { ProductionProvider } from './context/ProductionContext';
import { ModuleSettings } from './components/settings/ModuleSettings';
import { ReportsDashboard } from './components/reports/ReportsDashboard';
const ReportsDashboardEnhanced = lazy(() => import('./components/reports/ReportsDashboardEnhanced').then(m => ({ default: m.ReportsDashboardEnhanced })));
import { ViewContactProfile } from './components/contacts/ViewContactProfile';
import { ItemLifecycleReport } from './components/reports/ItemLifecycleReport';
import { ProductionOrderDetail } from './components/production/ProductionOrderDetail';
import { CustomerOrderTracking } from './components/tracking/CustomerOrderTracking';
import { InventoryDashboard } from './components/inventory/InventoryDashboard';
const InventoryDashboardNew = lazy(() => import('./components/inventory/InventoryDashboardNew').then(m => ({ default: m.InventoryDashboardNew })));
const InventoryDesignTestPage = lazy(() => import('./components/inventory/InventoryDesignTestPage').then(m => ({ default: m.InventoryDesignTestPage })));
const InventoryAnalyticsTestPage = lazy(() => import('./components/inventory/InventoryAnalyticsTestPage').then(m => ({ default: m.InventoryAnalyticsTestPage })));
const StudioDashboardNew = lazy(() => import('./components/studio/StudioDashboardNew').then(m => ({ default: m.StudioDashboardNew })));
import { SettingsPage } from './components/settings/SettingsPage';
const SettingsPageNew = lazy(() => import('./components/settings/SettingsPageNew').then(m => ({ default: m.SettingsPageNew })));
import { SettingsPageComplete } from './components/settings/SettingsPageComplete';
import { SettingsPageClean } from './components/settings/SettingsPageClean';
import { StudioWorkflowPage } from './components/studio/StudioWorkflowPage';
import { PackingEntryPage } from './components/packing/PackingEntryPage';
import { StudioOrdersList } from './components/studio/StudioOrdersList';
import { StudioJobCard } from './components/studio/StudioJobCard';
import { StudioSalesList } from './components/studio/StudioSalesList';
import { StudioSaleDetail } from './components/studio/StudioSaleDetail';
const StudioSalesListNew = lazy(() => import('./components/studio/StudioSalesListNew').then(m => ({ default: m.StudioSalesListNew })));
const StudioSaleDetailNew = lazy(() => import('./components/studio/StudioSaleDetailNew').then(m => ({ default: m.StudioSaleDetailNew })));
import { WorkerDetailPage } from './components/studio/WorkerDetailPage';
import { StudioProductionListPage } from './components/studio/StudioProductionListPage';
import { StudioProductionDetailPage } from './components/studio/StudioProductionDetailPage';
import { StudioProductionAddPage } from './components/studio/StudioProductionAddPage';
const StudioPipelinePage = lazy(() => import('./components/studio/StudioPipelinePage').then(m => ({ default: m.StudioPipelinePage })));
import { AccountingIntegrationDemo } from './components/accounting/AccountingIntegrationDemo';
import { PurchaseListExample } from './components/purchases/PurchaseListExample';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { KeyboardShortcutsModal } from './components/shared/KeyboardShortcutsModal';
import { ContactSearchTestPage } from './components/demo/ContactSearchTestPage';
import { SaleHeaderTestPage } from './components/test/SaleHeaderTestPage';
import { PurchaseHeaderTestPage } from './components/test/PurchaseHeaderTestPage';
import { TransactionHeaderTestPage } from './components/test/TransactionHeaderTestPage';
import { UserManagementTestPage } from './components/test/UserManagementTestPage';
import { BranchManagementTestPage } from './components/test/BranchManagementTestPage';
import { AccountingChartTestPage } from './components/test/AccountingChartTestPage';
import { LedgerDebugTestPage } from './components/test/LedgerDebugTestPage';
import { RLSValidationPage } from './components/test/RLSValidationPage';
import { Day4FullFlowCertificationPage } from './components/test/Day4FullFlowCertificationPage';
import { ERPIntegrationTestBlockPage } from './components/test/ERPIntegrationTestBlockPage';
import { CutoverPrepPage } from './components/test/CutoverPrepPage';
import { ResponsiveTestPage } from './components/test/ResponsiveTestPage';
import { AccountingTestPage } from './components/test/AccountingTestPage';
import { SalesListDesignTestPage } from './components/test/SalesListDesignTestPage';
const CustomerLedgerTestPage = lazy(() => import('./components/customer-ledger-test/CustomerLedgerTestPage').then(m => ({ default: m.CustomerLedgerTestPage })));
import TestLedger from './TestLedger';
const CustomerLedgerInteractiveTest = lazy(() => import('./components/customer-ledger-test/CustomerLedgerInteractiveTest').then(m => ({ default: m.CustomerLedgerInteractiveTest })));
import { SupabaseProvider } from './context/SupabaseContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicContactForm } from './components/public/PublicContactForm';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { useSettings } from './context/SettingsContext';
import { DateRangeProvider } from './context/DateRangeContext';

// v1.0.1 - Enhanced Product Form with SKU auto-generation and global access

const AppContent = () => {
  const { currentView } = useNavigation();
  const { modules } = useSettings();
  
  // 🎯 Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Route protection based on module toggles
  if (currentView === 'pos' && !modules.posModuleEnabled) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">POS Module Disabled</h2>
            <p className="text-gray-400">Please enable POS module in Settings to access this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (currentView === 'rentals' && !modules.rentalModuleEnabled) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Rental Module Disabled</h2>
            <p className="text-gray-400">Please enable Rental module in Settings to access this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if ((currentView === 'studio' || currentView === 'studio-dashboard-new' || currentView === 'studio-sales-list-new' || currentView === 'studio-pipeline' || currentView === 'studio-sale-detail' || currentView === 'studio-sale-detail-new' || currentView === 'studio-workflow' || currentView === 'worker-detail') && !modules.studioModuleEnabled) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Studio Module Disabled</h2>
            <p className="text-gray-400">Please enable Studio module in Settings to access this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Accounting is always available - single engine, no module toggle gate
  if (currentView === 'pos') {
    return (
      <>
        <POS />
        <GlobalDrawer />
      </>
    );
  }

  return (
    <Layout>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'products' && <ProductsPage />}
      {currentView === 'sales' && <SalesPage />}
      {currentView === 'rentals' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <RentalDashboard />
        </Suspense>
      )}
      {currentView === 'rental-booking' && <NewRentalBooking />}
      {currentView === 'stock' && <StockDashboard />}
      {currentView === 'inventory' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <InventoryDesignTestPage />
        </Suspense>
      )}
      {currentView === 'studio' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <StudioSalesListNew />
        </Suspense>
      )}
      {currentView === 'studio-dashboard-new' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <StudioDashboardNew />
        </Suspense>
      )}
      {currentView === 'studio-sales-list-new' && <StudioSalesListNew />}
      {currentView === 'studio-pipeline' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <StudioPipelinePage />
        </Suspense>
      )}
      {currentView === 'studio-sale-detail' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <StudioSaleDetailNew />
        </Suspense>
      )}
      {currentView === 'studio-sale-detail-new' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <StudioSaleDetailNew />
        </Suspense>
      )}
      {currentView === 'studio-job' && <StudioJobCard />}
      {currentView === 'studio-workflow' && <StudioWorkflowPage />}
      {currentView === 'worker-detail' && <WorkerDetailPage />}
      {currentView === 'expenses' && <ExpensesDashboard />}
      {currentView === 'customers' && <ContactList />}
      {currentView === 'contacts' && <ContactsPage />}
      {currentView === 'purchases' && <PurchasesPage />}
      {currentView === 'purchase-example' && <PurchaseListExample />}
      {currentView === 'accounting' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <AccountingDashboard />
        </Suspense>
      )}
      {currentView === 'accounting-demo' && <AccountingIntegrationDemo />}
      {currentView === 'users' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <UserDashboard />
        </Suspense>
      )}
      {currentView === 'roles' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <RolesDashboard />
        </Suspense>
      )}
      
      {/* Placeholders for new modules */}
      {currentView === 'reports' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <ReportsDashboardEnhanced />
        </Suspense>
      )}
      {currentView === 'settings' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <SettingsPageNew />
        </Suspense>
      )}
      {currentView === 'user-profile' && <UserProfilePage />}
      {currentView === 'contact-profile' && <ViewContactProfile />}
      {currentView === 'item-report' && <ItemLifecycleReport />}
      {currentView === 'production-detail' && <ProductionOrderDetail />}
      {currentView === 'studio-production-list' && <StudioProductionListPage />}
      {currentView === 'studio-production-add' && <StudioProductionAddPage />}
      {currentView === 'studio-production-detail' && <StudioProductionDetailPage />}
      {currentView === 'customer-tracking' && <CustomerOrderTracking />}
      {currentView === 'packing' && <PackingEntryPage />}
      {currentView === 'contact-search-test' && <ContactSearchTestPage />}
      {currentView === 'sale-header-test' && <SaleHeaderTestPage />}
      {currentView === 'purchase-header-test' && <PurchaseHeaderTestPage />}
      {currentView === 'transaction-header-test' && <TransactionHeaderTestPage />}
      {currentView === 'user-management-test' && <UserManagementTestPage />}
      {currentView === 'branch-management-test' && <BranchManagementTestPage />}
      {currentView === 'accounting-chart-test' && <AccountingChartTestPage />}
      {currentView === 'customer-ledger-test' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <CustomerLedgerTestPage />
        </Suspense>
      )}
      {currentView === 'ledger-debug-test' && <LedgerDebugTestPage />}
      {currentView === 'rls-validation' && <RLSValidationPage />}
      {currentView === 'day4-certification' && <Day4FullFlowCertificationPage />}
      {currentView === 'erp-integration-test' && <ERPIntegrationTestBlockPage />}
      {currentView === 'cutover-prep' && <CutoverPrepPage />}
      {currentView === 'responsive-test' && <ResponsiveTestPage />}
      {currentView === 'test-account-entry' && <AccountingTestPage />}
      {currentView === 'test-ledger' && <TestLedger />}
      {currentView === 'customer-ledger-interactive-test' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <CustomerLedgerInteractiveTest />
        </Suspense>
      )}
      {currentView === 'sales-list-design-test' && <SalesListDesignTestPage />}
      {currentView === 'inventory-design-test' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <InventoryDesignTestPage />
        </Suspense>
      )}
      {currentView === 'inventory-analytics-test' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <InventoryAnalyticsTestPage />
        </Suspense>
      )}

      <GlobalDrawer />
    </Layout>
  );
};

export default function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  // Public contact registration - no login required
  if (pathname === '/register-contact' || pathname.startsWith('/register-contact')) {
    return (
      <ErrorBoundary>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <SupabaseProvider>
            <PublicContactForm />
            <Toaster position="bottom-right" theme="dark" />
          </SupabaseProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onError={(err, info) => {
        // Optional: send to logging service in production
        if (import.meta.env?.PROD) {
          // e.g. Sentry.captureException(err, { extra: info });
        }
      }}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <SupabaseProvider>
          <ProtectedRoute>
            <DateRangeProvider>
              <ModuleProvider>
                <AccountingProvider>
                  <SettingsProvider>
                    <SalesProvider>
                      <PurchaseProvider>
                        <RentalProvider>
                          <ExpenseProvider>
                            <ProductionProvider>
                              <NavigationProvider>
                                <AppContent />
                                <Toaster position="bottom-right" theme="dark" />
                                <KeyboardShortcutsModal />
                              </NavigationProvider>
                            </ProductionProvider>
                          </ExpenseProvider>
                        </RentalProvider>
                      </PurchaseProvider>
                    </SalesProvider>
                  </SettingsProvider>
                </AccountingProvider>
              </ModuleProvider>
            </DateRangeProvider>
          </ProtectedRoute>
        </SupabaseProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}