import { useState, useEffect } from 'react';
import type { Screen, User, Branch, BottomNavTab } from './types';
import * as authApi from './api/auth';

const BRANCH_STORAGE_KEY = 'erp_mobile_branch';
import { useResponsive } from './hooks/useResponsive';
import { LoginScreen } from './components/LoginScreen';
import { BranchSelection } from './components/BranchSelection';
import { HomeScreen } from './components/HomeScreen';
import { BottomNav } from './components/BottomNav';
import { ModuleGrid } from './components/ModuleGrid';
import { TabletSidebar } from './components/TabletSidebar';
import { PlaceholderModule } from './components/PlaceholderModule';
import { SalesModule } from './components/sales/SalesModule';
import { POSModule } from './components/pos/POSModule';
import { ContactsModule } from './components/contacts/ContactsModule';
import { SettingsModule } from './components/settings/SettingsModule';
import { ProductsModule } from './components/products/ProductsModule';
import { PurchaseModule } from './components/purchase/PurchaseModule';
import { ReportsModule } from './components/reports/ReportsModule';

const MODULE_TITLES: Record<Screen, string> = {
  login: 'Login',
  'branch-selection': 'Branch',
  home: 'Home',
  sales: 'Sales',
  purchase: 'Purchase',
  rental: 'Rental',
  studio: 'Studio',
  accounts: 'Accounts',
  expense: 'Expense',
  inventory: 'Inventory',
  products: 'Products',
  pos: 'POS',
  contacts: 'Contacts',
  reports: 'Reports',
  settings: 'Settings',
};

export default function App() {
  const responsive = useResponsive();
  const [authLoading, setAuthLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomNavTab>('home');
  const [showModuleGrid, setShowModuleGrid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi.getSession().then((session) => {
      if (cancelled) return;
      if (!session) {
        setAuthLoading(false);
        return;
      }
      authApi.getProfile(session.userId).then((profile) => {
        if (cancelled) return;
        if (!profile) {
          setAuthLoading(false);
          setCurrentScreen('login');
          return;
        }
        setUser({ name: profile.name, email: profile.email, role: profile.role });
        setCompanyId(profile.companyId);
        try {
          const saved = localStorage.getItem(BRANCH_STORAGE_KEY);
          const branch = saved ? (JSON.parse(saved) as Branch) : null;
          if (branch?.id && branch?.name) {
            setSelectedBranch(branch);
            setCurrentScreen('home');
            setActiveBottomTab('home');
          } else {
            setCurrentScreen('branch-selection');
          }
        } catch {
          setCurrentScreen('branch-selection');
        }
        setAuthLoading(false);
      }).catch(() => { if (!cancelled) setAuthLoading(false); });
    }).catch(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleLogin = (u: User, cid: string | null) => {
    setUser(u);
    setCompanyId(cid);
    setCurrentScreen('branch-selection');
  };

  const handleBranchSelect = (b: Branch) => {
    setSelectedBranch(b);
    try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
    setCurrentScreen('home');
    setActiveBottomTab('home');
  };

  const navigateToModule = (screen: Screen) => {
    setCurrentScreen(screen);
    setShowModuleGrid(false);
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

  const handleLogout = async () => {
    await authApi.signOut();
    try { localStorage.removeItem(BRANCH_STORAGE_KEY); } catch { /* ignore */ }
    setUser(null);
    setCompanyId(null);
    setSelectedBranch(null);
    setCurrentScreen('login');
  };

  const handleBottomNavChange = (tab: BottomNavTab) => {
    setActiveBottomTab(tab);
    if (tab === 'home') setCurrentScreen('home');
    else if (tab === 'sales') setCurrentScreen('sales');
    else if (tab === 'pos') setCurrentScreen('pos');
    else if (tab === 'contacts') setCurrentScreen('contacts');
    else if (tab === 'more') setShowModuleGrid(true);
  };

  const showBottomNav = currentScreen !== 'login' && currentScreen !== 'branch-selection' && user && selectedBranch;
  const showSidebar = showBottomNav && responsive.isTablet;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB] flex items-center justify-center">
        <div className="text-[#9CA3AF]">Loading...</div>
      </div>
    );
  }

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
        <BranchSelection user={user} companyId={companyId} onBranchSelect={handleBranchSelect} />
      </div>
    );
  }

  const content = (
    <>
      {currentScreen === 'home' && user && selectedBranch && (
        <HomeScreen user={user} branch={selectedBranch} onNavigate={navigateToModule} onLogout={handleLogout} />
      )}
      {currentScreen === 'sales' && user && (
        <SalesModule onBack={navigateHome} user={user} companyId={companyId} />
      )}
      {currentScreen === 'pos' && user && (
        <POSModule onBack={navigateHome} user={user} companyId={companyId} />
      )}
      {currentScreen === 'contacts' && user && (
        <ContactsModule onBack={navigateHome} user={user} companyId={companyId} />
      )}
      {currentScreen === 'settings' && user && (
        <SettingsModule onBack={navigateHome} user={user} onLogout={handleLogout} />
      )}
      {currentScreen === 'products' && user && (
        <ProductsModule onBack={navigateHome} user={user} companyId={companyId} />
      )}
      {currentScreen === 'purchase' && user && (
        <PurchaseModule onBack={navigateHome} user={user} />
      )}
      {currentScreen === 'reports' && (
        <ReportsModule onBack={navigateHome} />
      )}
      {currentScreen !== 'home' && currentScreen !== 'sales' && currentScreen !== 'pos' && currentScreen !== 'contacts' && currentScreen !== 'settings' && currentScreen !== 'products' && currentScreen !== 'purchase' && currentScreen !== 'reports' && user && (
        <PlaceholderModule title={MODULE_TITLES[currentScreen] || currentScreen} onBack={navigateHome} />
      )}
    </>
  );

  if (responsive.isTablet) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB] flex overflow-hidden">
        {showSidebar && user && selectedBranch && (
          <TabletSidebar
            user={user}
            branch={selectedBranch}
            currentScreen={currentScreen}
            onNavigate={navigateToModule}
            onLogout={handleLogout}
          />
        )}
        <div className="flex-1 overflow-y-auto">{content}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
      {content}
      {showBottomNav && (
        <BottomNav activeTab={activeBottomTab} onTabChange={handleBottomNavChange} />
      )}
      {showModuleGrid && user && !responsive.isTablet && (
        <ModuleGrid
          onClose={() => setShowModuleGrid(false)}
          onModuleSelect={navigateToModule}
          userRole={user.role}
        />
      )}
    </div>
  );
}
