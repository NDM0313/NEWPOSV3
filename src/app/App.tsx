import React, { lazy, Suspense, useEffect, useState } from 'react';
import { FeatureFlagProvider, useFeatureFlag } from './context/FeatureFlagContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { Layout } from './components/layout/Layout';
import { GlobalDrawer } from './components/layout/GlobalDrawer';
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
import { SupabaseProvider } from './context/SupabaseContext';
import { WebRealtimeBridge } from './lib/WebRealtimeBridge';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicContactForm } from './components/public/PublicContactForm';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { useSettings } from './context/SettingsContext';
import { GlobalFilterProvider } from './context/GlobalFilterContext';
import { LoadingProvider } from './context/LoadingContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { KeyboardShortcutsModal } from './components/shared/KeyboardShortcutsModal';
import { useCheckPermission } from './hooks/useCheckPermission';

const GlobalSuspenseFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-sm text-gray-400">Loading…</span>
    </div>
  </div>
);

const Dashboard = lazy(() => import('./components/dashboard/v2/DashboardV2Page').then(m => ({ default: m.DashboardV2Page })));
const ProductsPage = lazy(() => import('./components/products/ProductsPage').then(m => ({ default: m.ProductsPage })));
const POS = lazy(() => import('./components/pos/POS').then(m => ({ default: m.POS })));
const SalesEntry = lazy(() => import('./components/sales/SalesEntry').then(m => ({ default: m.SalesEntry })));
const StockDashboard = lazy(() => import('./components/dashboard/StockDashboard').then(m => ({ default: m.StockDashboard })));
const ExpensesDashboard = lazy(() => import('./components/dashboard/ExpensesDashboard').then(m => ({ default: m.ExpensesDashboard })));
const ContactList = lazy(() => import('./components/contacts/ContactList').then(m => ({ default: m.ContactList })));
const ContactsPage = lazy(() => import('./components/contacts/ContactsPage').then(m => ({ default: m.ContactsPage })));
const PurchaseList = lazy(() => import('./components/purchases/PurchaseList').then(m => ({ default: m.PurchaseList })));
const AccountingDashboard = lazy(() => import('./components/accounting/AccountingDashboard').then(m => ({ default: m.AccountingDashboard })));
const UserDashboard = lazy(() => import('./components/users/UserDashboard').then(m => ({ default: m.UserDashboard })));
const UserProfilePage = lazy(() => import('./components/users/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const PurchasesPage = lazy(() => import('./components/purchases/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const SalesPage = lazy(() => import('./components/sales/SalesPage').then(m => ({ default: m.SalesPage })));
const RentalDashboard = lazy(() => import('./components/rentals/RentalDashboard').then(m => ({ default: m.RentalDashboard })));
const NewRentalBooking = lazy(() => import('./components/rentals/NewRentalBooking').then(m => ({ default: m.NewRentalBooking })));
const ReportsDashboard = lazy(() => import('./components/reports/ReportsDashboard').then(m => ({ default: m.ReportsDashboard })));
const ReportsDashboardEnhanced = lazy(() => import('./components/reports/ReportsDashboardEnhanced').then(m => ({ default: m.ReportsDashboardEnhanced })));
const ViewContactProfile = lazy(() => import('./components/contacts/ViewContactProfile').then(m => ({ default: m.ViewContactProfile })));
const ItemLifecycleReport = lazy(() => import('./components/reports/ItemLifecycleReport').then(m => ({ default: m.ItemLifecycleReport })));
const ProductionOrderDetail = lazy(() => import('./components/production/ProductionOrderDetail').then(m => ({ default: m.ProductionOrderDetail })));
const CustomerOrderTracking = lazy(() => import('./components/tracking/CustomerOrderTracking').then(m => ({ default: m.CustomerOrderTracking })));
const InventoryDashboard = lazy(() => import('./components/inventory/InventoryDashboard').then(m => ({ default: m.InventoryDashboard })));
const InventoryDashboardNew = lazy(() => import('./components/inventory/InventoryDashboardNew').then(m => ({ default: m.InventoryDashboardNew })));
const InventoryDesignTestPage = lazy(() => import('./components/inventory/InventoryDesignTestPage').then(m => ({ default: m.InventoryDesignTestPage })));
const InventoryAnalyticsTestPage = lazy(() => import('./components/inventory/InventoryAnalyticsTestPage').then(m => ({ default: m.InventoryAnalyticsTestPage })));
const StockReportPage = lazy(() => import('./components/reports/StockReportPage').then(m => ({ default: m.StockReportPage })));
const StudioDashboardNew = lazy(() => import('./components/studio/StudioDashboardNew').then(m => ({ default: m.StudioDashboardNew })));
const SettingsPageNew = lazy(() => import('./components/settings/SettingsPageNew').then(m => ({ default: m.SettingsPageNew })));
const ErpPermissionArchitecturePage = lazy(() => import('./components/erp-permissions/ErpPermissionArchitecturePage').then(m => ({ default: m.ErpPermissionArchitecturePage })));
const StudioWorkflowPage = lazy(() => import('./components/studio/StudioWorkflowPage').then(m => ({ default: m.StudioWorkflowPage })));
const PackingEntryPage = lazy(() => import('./components/packing/PackingEntryPage').then(m => ({ default: m.PackingEntryPage })));
const StudioJobCard = lazy(() => import('./components/studio/StudioJobCard').then(m => ({ default: m.StudioJobCard })));
const StudioSalesListNew = lazy(() => import('./components/studio/StudioSalesListNew').then(m => ({ default: m.StudioSalesListNew })));
const StudioSaleDetailNew = lazy(() => import('./components/studio/StudioSaleDetailNew').then(m => ({ default: m.StudioSaleDetailNew })));
const WorkerDetailPage = lazy(() => import('./components/studio/WorkerDetailPage').then(m => ({ default: m.WorkerDetailPage })));
const StudioProductionListPage = lazy(() => import('./components/studio/StudioProductionListPage').then(m => ({ default: m.StudioProductionListPage })));
const StudioProductionDetailPage = lazy(() => import('./components/studio/StudioProductionDetailPage').then(m => ({ default: m.StudioProductionDetailPage })));
const StudioProductionAddPage = lazy(() => import('./components/studio/StudioProductionAddPage').then(m => ({ default: m.StudioProductionAddPage })));
const StudioPipelinePage = lazy(() => import('./components/studio/StudioPipelinePage').then(m => ({ default: m.StudioPipelinePage })));
const AccountingIntegrationDemo = lazy(() => import('./components/accounting/AccountingIntegrationDemo').then(m => ({ default: m.AccountingIntegrationDemo })));
const PurchaseListExample = lazy(() => import('./components/purchases/PurchaseListExample').then(m => ({ default: m.PurchaseListExample })));
const BespokeWorkOrdersPage = lazy(() => import('./components/bespoke/BespokeWorkOrdersPage').then(m => ({ default: m.BespokeWorkOrdersPage })));
const ContactSearchTestPage = lazy(() => import('./components/demo/ContactSearchTestPage').then(m => ({ default: m.ContactSearchTestPage })));
const SaleHeaderTestPage = lazy(() => import('./components/test/SaleHeaderTestPage').then(m => ({ default: m.SaleHeaderTestPage })));
const PurchaseHeaderTestPage = lazy(() => import('./components/test/PurchaseHeaderTestPage').then(m => ({ default: m.PurchaseHeaderTestPage })));
const TransactionHeaderTestPage = lazy(() => import('./components/test/TransactionHeaderTestPage').then(m => ({ default: m.TransactionHeaderTestPage })));
const UserManagementTestPage = lazy(() => import('./components/test/UserManagementTestPage').then(m => ({ default: m.UserManagementTestPage })));
const BranchManagementTestPage = lazy(() => import('./components/test/BranchManagementTestPage').then(m => ({ default: m.BranchManagementTestPage })));
const AccountingChartTestPage = lazy(() => import('./components/test/AccountingChartTestPage').then(m => ({ default: m.AccountingChartTestPage })));
const LedgerDebugTestPage = lazy(() => import('./components/test/LedgerDebugTestPage').then(m => ({ default: m.LedgerDebugTestPage })));
const RLSValidationPage = lazy(() => import('./components/test/RLSValidationPage').then(m => ({ default: m.RLSValidationPage })));
const Day4FullFlowCertificationPage = lazy(() => import('./components/test/Day4FullFlowCertificationPage').then(m => ({ default: m.Day4FullFlowCertificationPage })));
const ERPIntegrationTestBlockPage = lazy(() => import('./components/test/ERPIntegrationTestBlockPage').then(m => ({ default: m.ERPIntegrationTestBlockPage })));
const CutoverPrepPage = lazy(() => import('./components/test/CutoverPrepPage').then(m => ({ default: m.CutoverPrepPage })));
const ResponsiveTestPage = lazy(() => import('./components/test/ResponsiveTestPage').then(m => ({ default: m.ResponsiveTestPage })));
const AccountingTestPage = lazy(() => import('./components/test/AccountingTestPage').then(m => ({ default: m.AccountingTestPage })));
const SalesListDesignTestPage = lazy(() => import('./components/test/SalesListDesignTestPage').then(m => ({ default: m.SalesListDesignTestPage })));
const CustomerLedgerTestPage = lazy(() => import('./components/customer-ledger-test/CustomerLedgerTestPage').then(m => ({ default: m.CustomerLedgerTestPage })));
const TestLedger = lazy(() => import('./TestLedger').then(m => ({ default: m.default })));
const CustomerLedgerInteractiveTest = lazy(() => import('./components/customer-ledger-test/CustomerLedgerInteractiveTest').then(m => ({ default: m.default })));
const PermissionInspectorPage = lazy(() => import('./components/admin/PermissionInspectorPage').then(m => ({ default: m.PermissionInspectorPage })));
const AccountingIntegrityLabPage = lazy(() => import('./components/admin/AccountingIntegrityLabPage').then(m => ({ default: m.default })));
const AccountingTestBenchPage = lazy(() => import('./components/admin/AccountingTestBenchPage').then(m => ({ default: m.default })));
const AccountingDeveloperCenterPage = lazy(() =>
  import('./components/admin/AccountingDeveloperCenterPage').then((m) => ({ default: m.default }))
);
const ArApReconciliationCenterPage = lazy(() => import('./components/accounting/ArApReconciliationCenterPage').then(m => ({ default: m.default })));
const FinancialTraceRedirect = lazy(() =>
  import('./components/accounting/ar-ap-diagnostics/FinancialTraceRedirect').then((m) => ({ default: m.default }))
);
const AccountsHierarchyTestPage = lazy(() => import('./components/test/AccountsHierarchyTestPage').then(m => ({ default: m.default })));
const ExpenseEditTraceTestPage = lazy(() => import('./components/test/ExpenseEditTraceTestPage').then(m => ({ default: m.default })));
const AccountingEditTracePage = lazy(() => import('./components/test/AccountingEditTracePage').then(m => ({ default: m.default })));
const SimpleCanonicalStatementPage = lazy(() => import('./components/test/SimpleCanonicalStatementPage').then(m => ({ default: m.default })));
const ArApTruthLabPage = lazy(() => import('./components/test/ArApTruthLabPage').then(m => ({ default: m.default })));
const EffectivePartyLedgerPage = lazy(() => import('./components/accounting/EffectivePartyLedgerPage').then(m => ({ default: m.default })));
const StudioProductionV2Dashboard = lazy(() => import('./components/studio/StudioProductionV2Dashboard').then(m => ({ default: m.StudioProductionV2Dashboard })));
const StudioProductionV2Pipeline = lazy(() => import('./components/studio/StudioProductionV2Pipeline').then(m => ({ default: m.StudioProductionV2Pipeline })));
const StudioProductionV3Dashboard = lazy(() => import('./components/studio/StudioProductionV3Dashboard').then(m => ({ default: m.StudioProductionV3Dashboard })));
const StudioProductionV3Pipeline = lazy(() => import('./components/studio/StudioProductionV3Pipeline').then(m => ({ default: m.StudioProductionV3Pipeline })));
const StudioProductionV3OrderDetail = lazy(() => import('./components/studio/StudioProductionV3OrderDetail').then(m => ({ default: m.StudioProductionV3OrderDetail })));
const BillOfMaterialsPage = lazy(() => import('./manufacturing/BillOfMaterialsPage').then(m => ({ default: m.BillOfMaterialsPage })));
const ProductionOrdersPage = lazy(() => import('./manufacturing/ProductionOrdersPage').then(m => ({ default: m.ProductionOrdersPage })));
const ProductionWorkflow = lazy(() => import('./manufacturing/ProductionWorkflow').then(m => ({ default: m.ProductionWorkflow })));

const AppContent = () => {
  const { currentView, partyLedgerParams, setCurrentView, setPartyLedgerParams, reportsFinancialInitial } = useNavigation();
  const { modules, featureFlags, businessSettings } = useSettings();
  const { hasPermission } = useCheckPermission();
  const studioProductionV2 = featureFlags?.studio_production_v2 === true;
  const studioProductionV3 = featureFlags?.studio_production_v3 === true;
  const [, bumpRouteSync] = useState(0);
  useEffect(() => {
    const syncRoute = () => bumpRouteSync((n) => n + 1);
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  // 🎯 Enable global keyboard shortcuts
  useKeyboardShortcuts();

  // Dev UI: Accounting accounts hierarchy (route: /test/accounting-accounts-hierarchy)
  if (pathname === '/test/accounting-accounts-hierarchy') {
    return (<Layout><AccountsHierarchyTestPage /><GlobalDrawer /></Layout>);
  }
  if (pathname === '/test/expense-edit-trace') {
    return (<Layout><ExpenseEditTraceTestPage /><GlobalDrawer /></Layout>);
  }
  if (pathname === '/test/accounting-edit-trace') {
    return (<Layout><AccountingEditTracePage /><GlobalDrawer /></Layout>);
  }
  if (pathname === '/test/simple-canonical-statement') {
    return (<Layout><SimpleCanonicalStatementPage /><GlobalDrawer /></Layout>);
  }
  if (pathname === '/test/ar-ap-truth-lab') {
    return (<Layout><ArApTruthLabPage /><GlobalDrawer /></Layout>);
  }
  if (pathname === '/reports/ledger-statement-center-v2') {
    return (
      <Layout>
        <Suspense fallback={<GlobalSuspenseFallback />}>
          <AccountingDashboard />
        </Suspense>
        <GlobalDrawer />
      </Layout>
    );
  }
  if (pathname === '/admin/permission-inspector' || currentView === 'permission-inspector') {
    return (<Layout><PermissionInspectorPage /><GlobalDrawer /></Layout>);
  }
  if (
    pathname === '/admin/developer-integrity-lab' ||
    pathname === '/admin/accounting-test-bench' ||
    currentView === 'developer-integrity-lab' ||
    currentView === 'accounting-test-bench'
  ) {
    return (<Layout><AccountingTestBenchPage /><GlobalDrawer /></Layout>);
  }
  if (pathname === '/admin/accounting-developer-center') {
    return (<Layout><AccountingDeveloperCenterPage /><GlobalDrawer /></Layout>);
  }
  if (pathname === '/admin/financial-trace-center' || currentView === 'financial-trace-center') {
    return (
      <Layout>
        <Suspense fallback={<GlobalSuspenseFallback />}>
          <FinancialTraceRedirect />
        </Suspense>
        <GlobalDrawer />
      </Layout>
    );
  }

  // Route protection: module toggles are company-wide and apply to all users/roles (Admin, Manager, Staff).
  const moduleDisabledScreen = (title: string) => (
    <Layout>
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-gray-400">
            This module is turned off for your business. It is hidden for all users and roles. Enable it in Settings → Module Toggles.
          </p>
        </div>
      </div>
    </Layout>
  );

  if (currentView === 'sales' && !modules.salesModuleEnabled) {
    return moduleDisabledScreen('Sales Module Disabled');
  }
  if (currentView === 'bespoke-work-orders' && !modules.salesModuleEnabled) {
    return moduleDisabledScreen('Sales Module Disabled');
  }
  if (currentView === 'bespoke-work-orders' && !businessSettings.enableBespokeOrders) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md px-4">
            <h2 className="text-2xl font-bold text-white mb-2">Customization Disabled</h2>
            <p className="text-gray-400">
              Bespoke work orders are hidden while <strong className="text-gray-300">Enable customization</strong> is off in Settings → Business. Turn it on to use work orders and fabric posting, or continue with standard sales.
            </p>
          </div>
        </div>
      </Layout>
    );
  }
  if (currentView === 'purchases' && !modules.purchasesModuleEnabled) {
    return moduleDisabledScreen('Purchases Module Disabled');
  }
  if (currentView === 'expenses' && !modules.expensesModuleEnabled && !modules.accountingModuleEnabled) {
    return moduleDisabledScreen('Expenses Module Disabled');
  }
  if (currentView === 'reports' && !modules.reportsModuleEnabled) {
    return moduleDisabledScreen('Reports Module Disabled');
  }

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

  if (
    (currentView === 'manufacturing-bom' ||
      currentView === 'manufacturing-orders' ||
      currentView === 'manufacturing-workflow') &&
    !modules.productionModuleEnabled
  ) {
    return moduleDisabledScreen('Production Module Disabled');
  }

  if (
    (currentView === 'studio' ||
      currentView === 'studio-dashboard-new' ||
      currentView === 'studio-sales-list-new' ||
      currentView === 'studio-pipeline' ||
      currentView === 'studio-sale-detail' ||
      currentView === 'studio-sale-detail-new' ||
      currentView === 'studio-workflow' ||
      currentView === 'worker-detail' ||
      currentView === 'studio-order-detail-v3') &&
    !modules.studioModuleEnabled
  ) {
    return moduleDisabledScreen('Studio Module Disabled');
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
      <Suspense fallback={<GlobalSuspenseFallback />}>
        <POS />
        <GlobalDrawer />
      </Suspense>
    );
  }

  return (
    <Layout>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'products' && <ProductsPage />}
      {currentView === 'sales' && <SalesPage />}
      {currentView === 'bespoke-work-orders' && <BespokeWorkOrdersPage />}
      {currentView === 'rentals' && <RentalDashboard />}
      {currentView === 'rental-booking' && <NewRentalBooking />}
      {currentView === 'stock' && <StockDashboard />}
      {currentView === 'inventory' && <InventoryDesignTestPage />}
      {currentView === 'studio' && <StudioSalesListNew />}
      {currentView === 'studio-dashboard-new' && (studioProductionV3 ? <StudioProductionV3Dashboard /> : studioProductionV2 ? <StudioProductionV2Dashboard /> : <StudioDashboardNew />)}
      {currentView === 'studio-sales-list-new' && <StudioSalesListNew />}
      {currentView === 'studio-pipeline' && (studioProductionV3 ? <StudioProductionV3Pipeline /> : studioProductionV2 ? <StudioProductionV2Pipeline /> : <StudioPipelinePage />)}
      {currentView === 'studio-order-detail-v3' && <StudioProductionV3OrderDetail />}
      {currentView === 'studio-sale-detail' && <StudioSaleDetailNew />}
      {currentView === 'studio-sale-detail-new' && <StudioSaleDetailNew />}
      {currentView === 'studio-job' && <StudioJobCard />}
      {currentView === 'studio-workflow' && <StudioWorkflowPage />}
      {currentView === 'manufacturing-bom' && <BillOfMaterialsPage />}
      {currentView === 'manufacturing-orders' && <ProductionOrdersPage />}
      {currentView === 'manufacturing-workflow' && <ProductionWorkflow />}
      {currentView === 'worker-detail' && <WorkerDetailPage />}
      {currentView === 'expenses' && <ExpensesDashboard />}
      {currentView === 'customers' && <ContactList />}
      {currentView === 'contacts' && <ContactsPage />}
      {currentView === 'purchases' && <PurchasesPage />}
      {currentView === 'purchase-example' && <PurchaseListExample />}
      {currentView === 'accounting' && <AccountingDashboard />}
      {currentView === 'accounting-demo' && <AccountingIntegrationDemo />}
      {currentView === 'users' && <UserDashboard />}
      {currentView === 'roles' && <ErpPermissionArchitecturePage />}
      {currentView === 'reports' && (
        <ReportsDashboardEnhanced
          initialReportType={reportsFinancialInitial ? 'financial' : 'overview'}
          initialFinancialReportType={reportsFinancialInitial ?? undefined}
        />
      )}
      {currentView === 'settings' && (
        hasPermission('settings.view') ? <SettingsPageNew /> : (
          <div className="p-8 text-center text-gray-300">You do not have permission to access Settings.</div>
        )
      )}
      {currentView === 'erp-permissions' && <ErpPermissionArchitecturePage />}
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
      {currentView === 'customer-ledger-test' && <CustomerLedgerTestPage />}
      {currentView === 'ledger-debug-test' && <LedgerDebugTestPage />}
      {currentView === 'rls-validation' && <RLSValidationPage />}
      {currentView === 'day4-certification' && <Day4FullFlowCertificationPage />}
      {currentView === 'erp-integration-test' && <ERPIntegrationTestBlockPage />}
      {currentView === 'cutover-prep' && <CutoverPrepPage />}
      {currentView === 'responsive-test' && <ResponsiveTestPage />}
      {currentView === 'test-account-entry' && <AccountingTestPage />}
      {currentView === 'accounting-integrity-lab' && <AccountingIntegrityLabPage />}
      {currentView === 'ar-ap-reconciliation-center' && <ArApReconciliationCenterPage />}
      {currentView === 'party-ledger' && (
        <EffectivePartyLedgerPage
          contactId={partyLedgerParams?.contactId}
          contactName={partyLedgerParams?.contactName}
          contactType={partyLedgerParams?.contactType}
          onClose={() => {
            setPartyLedgerParams?.(null);
            setCurrentView('contacts');
          }}
        />
      )}
      {currentView === 'test-ledger' && <TestLedger />}
      {currentView === 'customer-ledger-interactive-test' && <CustomerLedgerInteractiveTest />}
      {currentView === 'sales-list-design-test' && <SalesListDesignTestPage />}
      {currentView === 'inventory-design-test' && <InventoryDesignTestPage />}
      {currentView === 'inventory-analytics-test' && <InventoryAnalyticsTestPage />}
      {currentView === 'stock-report' && <StockReportPage />}

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
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
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
      <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
        <FeatureFlagProvider>
          <PermissionV2ThemeSync>
            <SupabaseProvider>
              <ProtectedRoute>
            <WebRealtimeBridge />
            <GlobalFilterProvider>
              <ModuleProvider>
                <AccountingProvider>
                  {/* Inner boundary: feature/UI errors must not unmount AccountingProvider (outer boundary replaces entire tree). */}
                  <ErrorBoundary>
                    <SettingsProvider>
                      <SalesProvider>
                        <PurchaseProvider>
                          <RentalProvider>
                            <ExpenseProvider>
                              <ProductionProvider>
                                <LoadingProvider>
                                  <NavigationProvider>
                                    <Suspense fallback={<GlobalSuspenseFallback />}>
                                      <AppContent />
                                    </Suspense>
                                    <Toaster position="bottom-right" theme="dark" />
                                    <KeyboardShortcutsModal />
                                  </NavigationProvider>
                                </LoadingProvider>
                              </ProductionProvider>
                            </ExpenseProvider>
                          </RentalProvider>
                        </PurchaseProvider>
                      </SalesProvider>
                    </SettingsProvider>
                  </ErrorBoundary>
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