import React, { lazy, Suspense, useEffect } from 'react';
import { FeatureFlagProvider, useFeatureFlag } from './context/FeatureFlagContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { Layout } from './components/layout/Layout';
const Dashboard = lazy(() => import('./components/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
import { ProductList } from './components/products/ProductList';
import { POS } from './components/pos/POS';
import { SalesEntry } from './components/sales/SalesEntry';
const StockDashboard = lazy(() => import('./components/dashboard/StockDashboard').then(m => ({ default: m.StockDashboard })));
import { ExpensesDashboard } from './components/dashboard/ExpensesDashboard';
import { GlobalDrawer } from './components/layout/GlobalDrawer';
import { ContactList } from './components/contacts/ContactList';
import { ContactsPage } from './components/contacts/ContactsPage';
import { ProductsPage } from './components/products/ProductsPage';
import { PurchaseList } from './components/purchases/PurchaseList';
const AccountingDashboard = lazy(() => import('./components/accounting/AccountingDashboard').then(m => ({ default: m.AccountingDashboard })));
const UserDashboard = lazy(() => import('./components/users/UserDashboard').then(m => ({ default: m.UserDashboard })));
import { UserProfilePage } from './components/users/UserProfilePage';
import { PurchasesPage } from './components/purchases/PurchasesPage';
const SalesPage = lazy(() => import('./components/sales/SalesPage').then(m => ({ default: m.SalesPage })));
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
const ReportsDashboard = lazy(() => import('./components/reports/ReportsDashboard').then(m => ({ default: m.ReportsDashboard })));
const ReportsDashboardEnhanced = lazy(() => import('./components/reports/ReportsDashboardEnhanced').then(m => ({ default: m.ReportsDashboardEnhanced })));
import { ViewContactProfile } from './components/contacts/ViewContactProfile';
import { ItemLifecycleReport } from './components/reports/ItemLifecycleReport';
import { ProductionOrderDetail } from './components/production/ProductionOrderDetail';
import { CustomerOrderTracking } from './components/tracking/CustomerOrderTracking';
const InventoryDashboard = lazy(() => import('./components/inventory/InventoryDashboard').then(m => ({ default: m.InventoryDashboard })));
const InventoryDashboardNew = lazy(() => import('./components/inventory/InventoryDashboardNew').then(m => ({ default: m.InventoryDashboardNew })));
const InventoryDesignTestPage = lazy(() => import('./components/inventory/InventoryDesignTestPage').then(m => ({ default: m.InventoryDesignTestPage })));
const InventoryAnalyticsTestPage = lazy(() => import('./components/inventory/InventoryAnalyticsTestPage').then(m => ({ default: m.InventoryAnalyticsTestPage })));
const StudioDashboardNew = lazy(() => import('./components/studio/StudioDashboardNew').then(m => ({ default: m.StudioDashboardNew })));
import { SettingsPage } from './components/settings/SettingsPage';
const SettingsPageNew = lazy(() => import('./components/settings/SettingsPageNew').then(m => ({ default: m.SettingsPageNew })));
const ErpPermissionArchitecturePage = lazy(() => import('./components/erp-permissions/ErpPermissionArchitecturePage').then(m => ({ default: m.ErpPermissionArchitecturePage })));
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
const CustomerLedgerInteractiveTest = lazy(() =>
  import('./components/customer-ledger-test/CustomerLedgerInteractiveTest').then((m) => ({ default: m.default }))
);
import { SupabaseProvider } from './context/SupabaseContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicContactForm } from './components/public/PublicContactForm';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { useSettings } from './context/SettingsContext';
import { GlobalFilterProvider } from './context/GlobalFilterContext';
import { PermissionInspectorPage } from './components/admin/PermissionInspectorPage';
const AccountingIntegrityLabPage = lazy(() =>
  import('./components/admin/AccountingIntegrityLabPage').then((m) => ({ default: m.default }))
);
const AccountingTestBenchPage = lazy(() =>
  import('./components/admin/AccountingTestBenchPage').then((m) => ({ default: m.default }))
);
const ArApReconciliationCenterPage = lazy(() =>
  import('./components/accounting/ArApReconciliationCenterPage').then((m) => ({ default: m.default }))
);
const AccountsHierarchyTestPage = lazy(() =>
  import('./components/test/AccountsHierarchyTestPage').then((m) => ({ default: m.default }))
);
const ExpenseEditTraceTestPage = lazy(() =>
  import('./components/test/ExpenseEditTraceTestPage').then((m) => ({ default: m.default }))
);
const AccountingEditTracePage = lazy(() =>
  import('./components/test/AccountingEditTracePage').then((m) => ({ default: m.default }))
);

// v1.0.1 - Enhanced Product Form with SKU auto-generation and global access

const StudioProductionV2Dashboard = lazy(() => import('./components/studio/StudioProductionV2Dashboard').then(m => ({ default: m.StudioProductionV2Dashboard })));
const StudioProductionV2Pipeline = lazy(() => import('./components/studio/StudioProductionV2Pipeline').then(m => ({ default: m.StudioProductionV2Pipeline })));
const StudioProductionV3Dashboard = lazy(() => import('./components/studio/StudioProductionV3Dashboard').then(m => ({ default: m.StudioProductionV3Dashboard })));
const StudioProductionV3Pipeline = lazy(() => import('./components/studio/StudioProductionV3Pipeline').then(m => ({ default: m.StudioProductionV3Pipeline })));
const StudioProductionV3OrderDetail = lazy(() => import('./components/studio/StudioProductionV3OrderDetail').then(m => ({ default: m.StudioProductionV3OrderDetail })));
const BillOfMaterialsPage = lazy(() => import('./manufacturing/BillOfMaterialsPage').then(m => ({ default: m.BillOfMaterialsPage })));
const ProductionOrdersPage = lazy(() => import('./manufacturing/ProductionOrdersPage').then(m => ({ default: m.ProductionOrdersPage })));
const ProductionWorkflow = lazy(() => import('./manufacturing/ProductionWorkflow').then(m => ({ default: m.ProductionWorkflow })));

const AppContent = () => {
  const { currentView } = useNavigation();
  const { modules, featureFlags } = useSettings();
  const studioProductionV2 = featureFlags?.studio_production_v2 === true;
  const studioProductionV3 = featureFlags?.studio_production_v3 === true;
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  // 🎯 Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Dev UI: Accounting accounts hierarchy (route: /test/accounting-accounts-hierarchy)
  if (pathname === '/test/accounting-accounts-hierarchy') {
    return (
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center p-12 text-gray-500">Loading…</div>}>
          <AccountsHierarchyTestPage />
        </Suspense>
        <GlobalDrawer />
      </Layout>
    );
  }

  if (pathname === '/test/expense-edit-trace') {
    return (
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center p-12 text-gray-500">Loading…</div>}>
          <ExpenseEditTraceTestPage />
        </Suspense>
        <GlobalDrawer />
      </Layout>
    );
  }

  if (pathname === '/test/accounting-edit-trace') {
    return (
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center p-12 text-gray-500">Loading…</div>}>
          <AccountingEditTracePage />
        </Suspense>
        <GlobalDrawer />
      </Layout>
    );
  }

  // Admin-only Permission Inspector (route: /admin/permission-inspector)
  if (pathname === '/admin/permission-inspector' || currentView === 'permission-inspector') {
    return (
      <Layout>
        <PermissionInspectorPage />
        <GlobalDrawer />
      </Layout>
    );
  }

  // Developer Integrity Lab (routes: /admin/developer-integrity-lab | legacy /admin/accounting-test-bench)
  if (
    pathname === '/admin/developer-integrity-lab' ||
    pathname === '/admin/accounting-test-bench' ||
    currentView === 'developer-integrity-lab' ||
    currentView === 'accounting-test-bench'
  ) {
    return (
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center p-12 text-gray-500">Loading Integrity Lab…</div>}>
          <AccountingTestBenchPage />
        </Suspense>
        <GlobalDrawer />
      </Layout>
    );
  }

  // Route protection: module toggles are company-wide and apply to all users/roles (Admin, Manager, Staff).
  if (currentView === 'pos' && !modules.posModuleEnabled) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">POS Module Disabled</h2>
            <p className="text-gray-400">This module is turned off for your business. It is hidden for all users and roles. Enable it in Settings → Module Toggles.</p>
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
            <p className="text-gray-400">This module is turned off for your business. It is hidden for all users and roles. Enable it in Settings → Module Toggles.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if ((currentView === 'studio' || currentView === 'studio-dashboard-new' || currentView === 'studio-sales-list-new' || currentView === 'studio-pipeline' || currentView === 'studio-sale-detail' || currentView === 'studio-sale-detail-new' || currentView === 'studio-workflow' || currentView === 'worker-detail' || currentView === 'studio-order-detail-v3' || currentView === 'manufacturing-bom' || currentView === 'manufacturing-orders' || currentView === 'manufacturing-workflow') && !modules.studioModuleEnabled) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Studio Module Disabled</h2>
            <p className="text-gray-400">This module is turned off for your business. It is hidden for all users and roles. Enable it in Settings → Module Toggles.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if ((currentView === 'accounting' || currentView === 'ar-ap-reconciliation-center') && !modules.accountingModuleEnabled) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Accounting Module Disabled</h2>
            <p className="text-gray-400">This module is turned off for your business. It is hidden for all users and roles. Enable it in Settings → Module Toggles.</p>
          </div>
        </div>
      </Layout>
    );
  }
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
      {currentView === 'dashboard' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <Dashboard />
        </Suspense>
      )}
      {currentView === 'products' && <ProductsPage />}
      {currentView === 'sales' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <SalesPage />
        </Suspense>
      )}
      {currentView === 'rentals' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <RentalDashboard />
        </Suspense>
      )}
      {currentView === 'rental-booking' && <NewRentalBooking />}
      {currentView === 'stock' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <StockDashboard />
        </Suspense>
      )}
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
          {studioProductionV3 ? <StudioProductionV3Dashboard /> : studioProductionV2 ? <StudioProductionV2Dashboard /> : <StudioDashboardNew />}
        </Suspense>
      )}
      {currentView === 'studio-sales-list-new' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <StudioSalesListNew />
        </Suspense>
      )}
      {currentView === 'studio-pipeline' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          {studioProductionV3 ? <StudioProductionV3Pipeline /> : studioProductionV2 ? <StudioProductionV2Pipeline /> : <StudioPipelinePage />}
        </Suspense>
      )}
      {currentView === 'studio-order-detail-v3' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <StudioProductionV3OrderDetail />
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
      {currentView === 'manufacturing-bom' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <BillOfMaterialsPage />
        </Suspense>
      )}
      {currentView === 'manufacturing-orders' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <ProductionOrdersPage />
        </Suspense>
      )}
      {currentView === 'manufacturing-workflow' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <ProductionWorkflow />
        </Suspense>
      )}
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
      {/* Repointed: 'roles' now shows ERP Permissions (Roles tab lives there). Mock RolesDashboard removed from nav. */}
      {currentView === 'roles' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <ErpPermissionArchitecturePage />
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
      {currentView === 'erp-permissions' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading...</div></div>}>
          <ErpPermissionArchitecturePage />
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
      {currentView === 'accounting-integrity-lab' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading lab…</div></div>}>
          <AccountingIntegrityLabPage />
        </Suspense>
      )}
      {currentView === 'ar-ap-reconciliation-center' && (
        <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-pulse text-gray-500">Loading…</div></div>}>
          <ArApReconciliationCenterPage />
        </Suspense>
      )}
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

function PermissionV2ThemeSync({ children }: { children: React.ReactNode }) {
  const { permissionV2 } = useFeatureFlag();
  useEffect(() => {
    if (permissionV2) {
      document.body.setAttribute('data-theme', 'enterprise-v2');
    } else {
      document.body.removeAttribute('data-theme');
    }
    return () => document.body.removeAttribute('data-theme');
  }, [permissionV2]);
  return <>{children}</>;
}

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
        <FeatureFlagProvider>
          <PermissionV2ThemeSync>
            <SupabaseProvider>
              <ProtectedRoute>
            <GlobalFilterProvider>
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
            </GlobalFilterProvider>
              </ProtectedRoute>
            </SupabaseProvider>
          </PermissionV2ThemeSync>
        </FeatureFlagProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}