import { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { BranchSelection } from './components/BranchSelection';
import { HomeScreen } from './components/HomeScreen';
import { SalesModule } from './components/sales/SalesModule';
import { PurchaseModule } from './components/purchase/PurchaseModule';
import { RentalModule } from './components/rental/RentalModule';
import { AccountsModule } from './components/accounts/AccountsModule';
import { ExpenseModule } from './components/expenses/ExpenseModule';
import { StudioModule } from './components/studio/StudioModule';
import { ProductsModule } from './components/products/ProductsModule';
import { InventoryModule } from './components/inventory/InventoryModule';
import { POSModule } from './components/pos/POSModule';
import { ContactsModule } from './components/contacts/ContactsModule';
import { ReportsModule } from './components/reports/ReportsModule';
import { SettingsModule } from './components/settings/SettingsModule';
import { BottomNav } from './components/BottomNav';
import { ModuleGrid } from './components/ModuleGrid';
import { TabletSidebar } from './components/TabletSidebar';
import { useResponsive } from './hooks/useResponsive';

export type Screen = 
  | 'login' 
  | 'branch-selection' 
  | 'home' 
  | 'sales' 
  | 'purchase' 
  | 'rental' 
  | 'studio'
  | 'accounts' 
  | 'expense' 
  | 'inventory'
  | 'products'
  | 'pos'
  | 'contacts'
  | 'reports'
  | 'settings';

export interface User {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
}

export interface Branch {
  id: string;
  name: string;
  location: string;
}

type BottomNavTab = 'home' | 'sales' | 'pos' | 'contacts' | 'more';

export default function App() {
  const responsive = useResponsive();
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomNavTab>('home');
  const [showModuleGrid, setShowModuleGrid] = useState(false);

  const handleLogin = (userData: User) => {
    setUser(userData);
    setCurrentScreen('branch-selection');
  };

  const handleBranchSelect = (branch: Branch) => {
    setSelectedBranch(branch);
    setCurrentScreen('home');
    setActiveBottomTab('home');
  };

  const navigateToModule = (screen: Screen) => {
    setCurrentScreen(screen);
    setShowModuleGrid(false);
    
    // Update bottom nav active tab
    if (screen === 'home') setActiveBottomTab('home');
    else if (screen === 'sales') setActiveBottomTab('sales');
    else if (screen === 'pos') setActiveBottomTab('pos');
    else if (screen === 'contacts') setActiveBottomTab('contacts');
    else setActiveBottomTab('home');
  };

  const navigateHome = () => {
    setCurrentScreen('home');
    setActiveBottomTab('home');
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedBranch(null);
    setCurrentScreen('login');
  };

  const handleBottomNavChange = (tab: BottomNavTab) => {
    setActiveBottomTab(tab);
    
    if (tab === 'home') {
      setCurrentScreen('home');
    } else if (tab === 'sales') {
      setCurrentScreen('sales');
    } else if (tab === 'pos') {
      setCurrentScreen('pos');
    } else if (tab === 'contacts') {
      setCurrentScreen('contacts');
    } else if (tab === 'more') {
      setShowModuleGrid(true);
    }
  };

  const handleModuleSelect = (screen: Screen) => {
    setCurrentScreen(screen);
    setShowModuleGrid(false);
  };

  const showBottomNav = currentScreen !== 'login' && currentScreen !== 'branch-selection';
  const showSidebar = showBottomNav && responsive.isTablet;

  // Login and Branch Selection (Full Screen - No Sidebar)
  if (currentScreen === 'login') {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
        <LoginScreen onLogin={handleLogin} />
      </div>
    );
  }

  if (currentScreen === 'branch-selection' && user) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
        <BranchSelection user={user} onBranchSelect={handleBranchSelect} />
      </div>
    );
  }

  // Main App Layout with Sidebar (Tablet) or Bottom Nav (Mobile)
  return (
    <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
      {/* Tablet Layout: Sidebar + Content */}
      {responsive.isTablet ? (
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          {showSidebar && user && selectedBranch && (
            <TabletSidebar
              user={user}
              branch={selectedBranch}
              currentScreen={currentScreen}
              onNavigate={navigateToModule}
              onLogout={handleLogout}
            />
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            {currentScreen === 'home' && user && selectedBranch && (
              <HomeScreen 
                user={user}
                branch={selectedBranch}
                onNavigate={navigateToModule}
                onLogout={handleLogout}
              />
            )}

            {currentScreen === 'sales' && <SalesModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'purchase' && <PurchaseModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'rental' && <RentalModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'accounts' && <AccountsModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'expense' && <ExpenseModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'studio' && <StudioModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'products' && <ProductsModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'inventory' && <InventoryModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'pos' && <POSModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'contacts' && <ContactsModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'reports' && <ReportsModule onBack={navigateHome} user={user!} />}
            {currentScreen === 'settings' && <SettingsModule onBack={navigateHome} user={user!} onLogout={handleLogout} />}
          </div>
        </div>
      ) : (
        // Mobile Layout: Full Screen + Bottom Nav
        <>
          {currentScreen === 'home' && user && selectedBranch && (
            <HomeScreen 
              user={user}
              branch={selectedBranch}
              onNavigate={navigateToModule}
              onLogout={handleLogout}
            />
          )}

          {currentScreen === 'sales' && <SalesModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'purchase' && <PurchaseModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'rental' && <RentalModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'accounts' && <AccountsModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'expense' && <ExpenseModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'studio' && <StudioModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'products' && <ProductsModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'inventory' && <InventoryModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'pos' && <POSModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'contacts' && <ContactsModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'reports' && <ReportsModule onBack={navigateHome} user={user!} />}
          {currentScreen === 'settings' && <SettingsModule onBack={navigateHome} user={user!} onLogout={handleLogout} />}

          {/* Bottom Navigation - Mobile Only */}
          {showBottomNav && (
            <BottomNav 
              activeTab={activeBottomTab}
              onTabChange={handleBottomNavChange}
            />
          )}
        </>
      )}

      {/* Module Grid Drawer (Mobile) */}
      {showModuleGrid && user && !responsive.isTablet && (
        <ModuleGrid
          onClose={() => setShowModuleGrid(false)}
          onModuleSelect={handleModuleSelect}
          userRole={user.role}
        />
      )}
    </div>
  );
}