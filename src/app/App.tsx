import React from 'react';
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
import { AccountingDashboard } from './components/accounting/AccountingDashboard';
import { UserDashboard } from './components/users/UserDashboard';
import { RolesDashboard } from './components/users/RolesDashboard';
import { UserProfilePage } from './components/users/UserProfilePage';
import { PurchasesPage } from './components/purchases/PurchasesPage';
import { SalesPage } from './components/sales/SalesPage';
import { RentalDashboard } from './components/rentals/RentalDashboard';
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
import { ModuleSettings } from './components/settings/ModuleSettings';
import { ReportsDashboard } from './components/reports/ReportsDashboard';
import { ReportsDashboardEnhanced } from './components/reports/ReportsDashboardEnhanced';
import { ViewContactProfile } from './components/contacts/ViewContactProfile';
import { ItemLifecycleReport } from './components/reports/ItemLifecycleReport';
import { ProductionOrderDetail } from './components/production/ProductionOrderDetail';
import { CustomerOrderTracking } from './components/tracking/CustomerOrderTracking';
import { InventoryDashboard } from './components/inventory/InventoryDashboard';
import { InventoryDashboardNew } from './components/inventory/InventoryDashboardNew';
import { StudioDashboard } from './components/studio/StudioDashboard';
import { SettingsPage } from './components/settings/SettingsPage';
import { SettingsPageNew } from './components/settings/SettingsPageNew';
import { SettingsPageComplete } from './components/settings/SettingsPageComplete';
import { SettingsPageClean } from './components/settings/SettingsPageClean';
import { StudioWorkflowPage } from './components/studio/StudioWorkflowPage';
import { PackingEntryPage } from './components/packing/PackingEntryPage';
import { StudioOrdersList } from './components/studio/StudioOrdersList';
import { StudioJobCard } from './components/studio/StudioJobCard';
import { StudioSalesList } from './components/studio/StudioSalesList';
import { StudioSaleDetail } from './components/studio/StudioSaleDetail';
import { StudioSalesListNew } from './components/studio/StudioSalesListNew';
import { StudioSaleDetailNew } from './components/studio/StudioSaleDetailNew';
import { StudioDashboardNew } from './components/studio/StudioDashboardNew';
import { WorkerDetailPage } from './components/studio/WorkerDetailPage';
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
import { CustomerLedgerTestPage } from './components/customer-ledger-test/CustomerLedgerTestPage';
import TestLedger from './TestLedger';
import CustomerLedgerInteractiveTest from './components/customer-ledger-test/CustomerLedgerInteractiveTest';
import { SupabaseProvider } from './context/SupabaseContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
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

  if ((currentView === 'studio' || currentView === 'studio-dashboard-new' || currentView === 'studio-workflow') && !modules.studioModuleEnabled) {
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

  if (currentView === 'accounting' && !modules.accountingModuleEnabled) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Accounting Module Disabled</h2>
            <p className="text-gray-400">Please enable Accounting module in Settings to access this page.</p>
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
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'products' && <ProductsPage />}
      {currentView === 'sales' && <SalesPage />}
      {currentView === 'rentals' && <RentalDashboard />}
      {currentView === 'rental-booking' && <NewRentalBooking />}
      {currentView === 'stock' && <StockDashboard />}
      {currentView === 'inventory' && <InventoryDashboardNew />}
      {currentView === 'studio' && <StudioSalesListNew />}
      {currentView === 'studio-dashboard-new' && <StudioDashboardNew />}
      {currentView === 'studio-sales-list-new' && <StudioSalesListNew />}
      {currentView === 'studio-sale-detail' && <StudioSaleDetailNew />}
      {currentView === 'studio-sale-detail-new' && <StudioSaleDetailNew />}
      {currentView === 'studio-job' && <StudioJobCard />}
      {currentView === 'studio-workflow' && <StudioWorkflowPage />}
      {currentView === 'expenses' && <ExpensesDashboard />}
      {currentView === 'customers' && <ContactList />}
      {currentView === 'contacts' && <ContactsPage />}
      {currentView === 'purchases' && <PurchasesPage />}
      {currentView === 'purchase-example' && <PurchaseListExample />}
      {currentView === 'accounting' && <AccountingDashboard />}
      {currentView === 'accounting-demo' && <AccountingIntegrationDemo />}
      {currentView === 'users' && <UserDashboard />}
      {currentView === 'roles' && <RolesDashboard />}
      
      {/* Placeholders for new modules */}
      {currentView === 'reports' && <ReportsDashboardEnhanced />}
      {currentView === 'settings' && <SettingsPageNew />}
      {currentView === 'user-profile' && <UserProfilePage />}
      {currentView === 'contact-profile' && <ViewContactProfile />}
      {currentView === 'item-report' && <ItemLifecycleReport />}
      {currentView === 'production-detail' && <ProductionOrderDetail />}
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
      {currentView === 'test-ledger' && <TestLedger />}
      {currentView === 'customer-ledger-interactive-test' && <CustomerLedgerInteractiveTest />}
      
      <GlobalDrawer />
    </Layout>
  );
};

export default function App() {
  return (
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
                          <NavigationProvider>
                            <AppContent />
                            <Toaster position="bottom-right" theme="dark" />
                            <KeyboardShortcutsModal />
                          </NavigationProvider>
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
  );
}