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
import { PurchaseList } from './components/purchases/PurchaseList';
import { AccountingDashboard } from './components/accounting/AccountingDashboard';
import { UserDashboard } from './components/users/UserDashboard';
import { RolesDashboard } from './components/users/RolesDashboard';
import { PurchaseDashboard } from './components/purchases/PurchaseDashboard';
import { SalesDashboard } from './components/sales/SalesDashboard';
import { RentalDashboard } from './components/rentals/RentalDashboard';
import { PaymentFooterDemo } from './components/demo/PaymentFooterDemo';
import { UXImprovementsDemo } from './components/demo/UXImprovementsDemo';
import { InteractiveFeedbackDemo } from './components/demo/InteractiveFeedbackDemo';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { ModuleProvider } from './context/ModuleContext';
import { ModuleSettings } from './components/settings/ModuleSettings';
import { ReportsDashboard } from './components/reports/ReportsDashboard';
import { ViewContactProfile } from './components/contacts/ViewContactProfile';
import { ItemLifecycleReport } from './components/reports/ItemLifecycleReport';
import { ProductionOrderDetail } from './components/production/ProductionOrderDetail';
import { CustomerOrderTracking } from './components/tracking/CustomerOrderTracking';
import { NewCustomOrder } from './components/custom-studio/NewCustomOrder';
import { PipelineBoard } from './components/custom-studio/PipelineBoard';
import { VendorList } from './components/custom-studio/VendorList';
import { InventoryDashboard } from './components/inventory/InventoryDashboard';
import { CustomizeStudio } from './components/customize/CustomizeStudio';
import { StudioDashboard } from './components/studio/StudioDashboard';
import { SettingsPage } from './components/settings/SettingsPage';
import { StudioWorkflowPage } from './components/studio/StudioWorkflowPage';
import { PackingEntryPage } from './components/packing/PackingEntryPage';

const AppContent = () => {
  const { currentView } = useNavigation();

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
      {currentView === 'products' && <ProductList />}
      {currentView === 'sales' && <SalesDashboard />}
      {currentView === 'rentals' && <RentalDashboard />}
      {currentView === 'stock' && <StockDashboard />}
      {currentView === 'inventory' && <InventoryDashboard />}
      {currentView === 'customize' && <CustomizeStudio />}
      {currentView === 'studio' && <StudioDashboard />}
      {currentView === 'studio-workflow' && <StudioWorkflowPage />}
      {currentView === 'expenses' && <ExpensesDashboard />}
      {currentView === 'customers' && <ContactList />}
      {currentView === 'contacts' && <ContactList />}
      {currentView === 'purchases' && <PurchaseDashboard />}
      {currentView === 'accounting' && <AccountingDashboard />}
      {currentView === 'users' && <UserDashboard />}
      {currentView === 'roles' && <RolesDashboard />}
      
      {/* Placeholders for new modules */}
      {currentView === 'reports' && <ReportsDashboard />}
      {currentView === 'settings' && <SettingsPage />}
      {currentView === 'contact-profile' && <ViewContactProfile />}
      {currentView === 'item-report' && <ItemLifecycleReport />}
      {currentView === 'production-detail' && <ProductionOrderDetail />}
      {currentView === 'customer-tracking' && <CustomerOrderTracking />}
      {currentView === 'custom-new-order' && <NewCustomOrder />}
      {currentView === 'custom-pipeline' && <PipelineBoard />}
      {currentView === 'custom-vendors' && <VendorList />}
      {currentView === 'packing' && <PackingEntryPage />}
      
      <GlobalDrawer />
    </Layout>
  );
};

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ModuleProvider>
        <NavigationProvider>
          <AppContent />
          <Toaster position="bottom-right" theme="dark" />
        </NavigationProvider>
      </ModuleProvider>
    </ThemeProvider>
  );
}