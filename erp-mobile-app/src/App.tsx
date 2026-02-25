import { useState, useEffect } from 'react';
import { initInputKeyboard } from './utils/inputKeyboard';
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
import { RentalModule } from './components/rental/RentalModule';
import { StudioModule } from './components/studio/StudioModule';
import { AccountsModule } from './components/accounts/AccountsModule';
import { ExpenseModule } from './components/expense/ExpenseModule';
import { InventoryModule } from './components/inventory/InventoryModule';
import { DashboardModule } from './components/dashboard/DashboardModule';
import { SyncStatusBar } from './components/SyncStatusBar';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { runSync, getUnsyncedCount } from './lib/syncEngine';

const MODULE_TITLES: Record<Screen, string> = {
  login: 'Login',
  'branch-selection': 'Branch',
  home: 'Home',
  dashboard: 'Dashboard',
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
  const { online, status, setStatus } = useNetworkStatus();
  const [authLoading, setAuthLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomNavTab>('home');
  const [showModuleGrid, setShowModuleGrid] = useState(false);
  const [salesInitialType, setSalesInitialType] = useState<'regular' | 'studio' | null>(null);

  useEffect(() => {
    const cleanup = initInputKeyboard();
    return () => { cleanup?.(); };
  }, []);

  useEffect(() => {
    const onSignedOut = () => {
      setUser(null);
      setCompanyId(null);
      setSelectedBranch(null);
      setCurrentScreen('login');
    };
    window.addEventListener('erp-auth-signed-out', onSignedOut);
    return () => window.removeEventListener('erp-auth-signed-out', onSignedOut);
  }, []);

  useEffect(() => {
    if (!online || !user) return;
    let cancelled = false;
    const doSync = () => {
      getUnsyncedCount().then((n) => {
        if (cancelled || n === 0) return;
        setStatus('syncing');
        runSync().then(({ errors }) => {
          if (!cancelled) setStatus(errors > 0 ? 'sync_error' : 'online');
        }).catch(() => { if (!cancelled) setStatus('sync_error'); });
      });
    };
    doSync();
    const t = setInterval(doSync, 60 * 1000);
    const onOnline = () => doSync();
    window.addEventListener('online', onOnline);
    return () => { cancelled = true; clearInterval(t); window.removeEventListener('online', onOnline); };
  }, [online, user?.id, setStatus]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const [session, pinSet] = await Promise.all([authApi.getSession(), authApi.hasPinSet()]);
      if (cancelled) return;
      if (pinSet && !session) {
        setCurrentScreen('login');
        setAuthLoading(false);
        return;
      }
      if (!session) {
        setAuthLoading(false);
        return;
      }
      authApi.getProfile(session.userId).then(async (profile) => {
        if (cancelled) return;
        if (!profile) {
          setAuthLoading(false);
          setCurrentScreen('login');
          return;
        }
        const u: User = {
          id: profile.userId,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          branchId: profile.branchId ?? undefined,
          branchLocked: profile.branchLocked,
        };
        setUser(u);
        setCompanyId(profile.companyId);
        if (pinSet) {
          setCurrentScreen('login');
          setAuthLoading(false);
          return;
        }
        if (profile.branchLocked && profile.branchId) {
          try {
            const { getBranches } = await import('./api/branches');
            const { data: branches } = await getBranches(profile.companyId || '');
            const lockedBranch = branches?.find((b) => b.id === profile.branchId);
            if (lockedBranch) {
              setSelectedBranch(lockedBranch);
              try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(lockedBranch)); } catch { /* ignore */ }
              setCurrentScreen('home');
              setActiveBottomTab('home');
            } else {
              setCurrentScreen('branch-selection');
            }
          } catch {
            setCurrentScreen('branch-selection');
          }
        } else {
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
        }
        setAuthLoading(false);
      }).catch(() => { if (!cancelled) setAuthLoading(false); });
    };
    run().catch(() => { setAuthLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (u: User, cid: string | null) => {
    setUser(u);
    setCompanyId(cid);
    if (u.branchLocked && u.branchId && cid) {
      try {
        const { getBranches } = await import('./api/branches');
        const { data: branches } = await getBranches(cid);
        const lockedBranch = branches?.find((b) => b.id === u.branchId);
        if (lockedBranch) {
          setSelectedBranch(lockedBranch);
          try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(lockedBranch)); } catch { /* ignore */ }
          setCurrentScreen('home');
          setActiveBottomTab('home');
          return;
        }
      } catch { /* fall through */ }
    }
    setCurrentScreen('branch-selection');
  };

  const handleBranchSelect = (b: Branch) => {
    setSelectedBranch(b);
    try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
    setCurrentScreen('home');
    setActiveBottomTab('home');
  };

  const navigateToModule = (screen: Screen, options?: { studioSale?: boolean }) => {
    setCurrentScreen(screen);
    setShowModuleGrid(false);
    if (options?.studioSale) setSalesInitialType('studio');
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

  // Only show BottomNav on home so modules (Sales, Purchase, Expense, Settings, etc.) are full screen
  const showBottomNav = currentScreen === 'home' && user && selectedBranch;
  const showSidebar = (currentScreen !== 'login' && currentScreen !== 'branch-selection' && user && selectedBranch) && responsive.isTablet;

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
        <LoginScreen
          onLogin={handleLogin}
          pinUnlockUser={user}
          pinUnlockCompanyId={companyId}
        />
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
        <HomeScreen user={user} branch={selectedBranch} companyId={companyId} onNavigate={navigateToModule} onLogout={handleLogout} />
      )}
      {currentScreen === 'sales' && user && (
        <SalesModule
          onBack={() => { setSalesInitialType(null); navigateHome(); }}
          user={user}
          companyId={companyId}
          branchId={selectedBranch?.id ?? null}
          initialSaleType={salesInitialType ?? undefined}
        />
      )}
      {currentScreen === 'pos' && user && (
        <POSModule onBack={navigateHome} user={user} companyId={companyId} branchId={selectedBranch?.id ?? null} />
      )}
      {currentScreen === 'contacts' && user && (
        <ContactsModule onBack={navigateHome} user={user} companyId={companyId} />
      )}
      {currentScreen === 'settings' && user && selectedBranch && (
        <SettingsModule
          onBack={navigateHome}
          user={user}
          branch={selectedBranch}
          companyId={companyId}
          isOnline={online}
          onChangeBranch={() => setCurrentScreen('branch-selection')}
          onLogout={handleLogout}
          onSyncTriggered={() => {
            setStatus('syncing');
            runSync().then(({ errors }) => setStatus(errors > 0 ? 'sync_error' : 'online')).catch(() => setStatus('sync_error'));
          }}
        />
      )}
      {currentScreen === 'products' && user && (
        <ProductsModule onBack={navigateHome} user={user} companyId={companyId} branchId={selectedBranch?.id ?? null} />
      )}
      {currentScreen === 'purchase' && user && (
        <PurchaseModule onBack={navigateHome} user={user} companyId={companyId} branchId={selectedBranch?.id ?? null} />
      )}
      {currentScreen === 'reports' && user && (
        <ReportsModule onBack={navigateHome} user={user} companyId={companyId} branchId={selectedBranch?.id ?? null} />
      )}
      {currentScreen === 'rental' && user && (
        <RentalModule onBack={navigateHome} user={user} companyId={companyId} branch={selectedBranch} />
      )}
      {currentScreen === 'studio' && user && (
        <StudioModule
          onBack={navigateHome}
          user={user}
          companyId={companyId}
          branch={selectedBranch}
          onNewStudioSale={() => navigateToModule('sales', { studioSale: true })}
        />
      )}
      {currentScreen === 'accounts' && user && (
        <AccountsModule onBack={navigateHome} user={user} companyId={companyId} branch={selectedBranch} />
      )}
      {currentScreen === 'expense' && user && (
        <ExpenseModule onBack={navigateHome} user={user} companyId={companyId} branch={selectedBranch} />
      )}
      {currentScreen === 'inventory' && user && (
        <InventoryModule onBack={navigateHome} user={user} companyId={companyId} branch={selectedBranch} />
      )}
      {currentScreen === 'dashboard' && user && (
        <DashboardModule
          onBack={navigateHome}
          user={user}
          companyId={companyId}
          branchId={selectedBranch?.id ?? null}
          onNewSale={() => navigateToModule('sales')}
          onNewPurchase={() => navigateToModule('purchase')}
        />
      )}
      {currentScreen !== 'home' && currentScreen !== 'dashboard' && currentScreen !== 'sales' && currentScreen !== 'pos' && currentScreen !== 'contacts' && currentScreen !== 'settings' && currentScreen !== 'products' && currentScreen !== 'purchase' && currentScreen !== 'reports' && currentScreen !== 'rental' && currentScreen !== 'studio' && currentScreen !== 'accounts' && currentScreen !== 'expense' && currentScreen !== 'inventory' && user && (
        <PlaceholderModule title={MODULE_TITLES[currentScreen] || currentScreen} onBack={navigateHome} />
      )}
    </>
  );

  const syncBar = user && selectedBranch ? (
    <div className="flex justify-end p-2 border-b border-[#374151]/50 bg-[#111827]">
      <SyncStatusBar status={status} />
    </div>
  ) : null;

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
        <div className="flex-1 flex flex-col overflow-hidden">
          {syncBar}
          <div className="flex-1 overflow-y-auto overflow-x-hidden max-w-full min-w-0">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
      {syncBar}
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
