import { useState, useEffect } from 'react';
import { initInputKeyboard } from './utils/inputKeyboard';
import type { Screen, User, Branch, BottomNavTab } from './types';
import * as authApi from './api/auth';
import { getBranches } from './api/branches';
import { getUserBranchIds } from './api/permissions';
import { usePermissions } from './context/PermissionContext';
import { useSettings } from './context/SettingsContext';
import { FEATURE_MOBILE_PERMISSION_V2 } from './config/featureFlags';
import { getPermissionModuleForScreen } from './utils/permissionModules';
import { AccessDenied } from './components/AccessDenied';

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
import { RentalModule } from './components/rental/RentalModule';
import { StudioModule } from './components/studio/StudioModule';
import { AccountsModule } from './components/accounts/AccountsModule';
import { ExpenseModule } from './components/expense/ExpenseModule';
import { InventoryModule } from './components/inventory/InventoryModule';
import { DashboardModule } from './components/dashboard/DashboardModule';
import { PackingListModule } from './components/packing/PackingListModule';
import { SyncStatusBar } from './components/SyncStatusBar';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { runSync, getUnsyncedCount } from './lib/syncEngine';
import { markUnlocked, clearUnlockMark, shouldRelock } from './lib/pinLock';
import { dispatchMobileInvalidated } from './lib/dataInvalidationBus';
import { subscribeMobileRealtime } from './lib/realtimeSubscriptions';
import { mobileRealtimeHealth } from './lib/supabase';

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
  packing: 'Packing List',
  ledger: 'Ledger',
  settings: 'Settings',
};

export default function App() {
  const responsive = useResponsive();
  const { online, status, setStatus } = useNetworkStatus();
  const { hasPermission, hasBranchAccess, isModuleEnabled, reload, isPermissionLoaded } = usePermissions();
  const { reload: reloadSettings } = useSettings();
  const [authLoading, setAuthLoading] = useState(true);
  const [isBranchResolving, setIsBranchResolving] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomNavTab>('home');
  const [showModuleGrid, setShowModuleGrid] = useState(false);
  const [salesInitialType, setSalesInitialType] = useState<'regular' | 'studio' | null>(null);
  const [studioFocusSaleId, setStudioFocusSaleId] = useState<string | null>(null);
  const [isPinLocked, setIsPinLocked] = useState(false);
  const [documentEditIntent, setDocumentEditIntent] = useState<{ kind: 'sale' | 'purchase'; id: string } | null>(null);

  useEffect(() => {
    const cleanup = initInputKeyboard();
    return () => { cleanup?.(); };
  }, []);

  useEffect(() => {
    const onSignedOut = () => {
      setUser(null);
      setCompanyId(null);
      setSelectedBranch(null);
      setIsBranchResolving(false);
      setCurrentScreen('login');
      setIsPinLocked(false);
      clearUnlockMark();
    };
    window.addEventListener('erp-auth-signed-out', onSignedOut);
    return () => window.removeEventListener('erp-auth-signed-out', onSignedOut);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const checkLock = async () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') return;
      if (isPinLocked) return;
      const pinSet = await authApi.hasPinSet();
      if (cancelled || !pinSet) return;
      if (shouldRelock()) setIsPinLocked(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkLock();
      }
    };
    const onFocus = () => { void checkLock(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, isPinLocked]);

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
    if (!companyId) return;
    const cleanup = subscribeMobileRealtime({
      companyId,
      branchId: selectedBranch?.id ?? null,
      channelKey: 'global',
      domains: ['sales', 'purchases', 'accounting', 'contacts'],
      onChange: (domain) => {
        dispatchMobileInvalidated({
          domain,
          companyId,
          branchId: selectedBranch?.id ?? null,
          reason: 'realtime-change',
        });
      },
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [companyId, selectedBranch?.id]);

  useEffect(() => {
    if (!companyId || mobileRealtimeHealth.canUseRealtime) return;
    const fallback = setInterval(() => {
      (['sales', 'purchases', 'accounting', 'contacts'] as const).forEach((domain) =>
        dispatchMobileInvalidated({
          domain,
          companyId,
          branchId: selectedBranch?.id ?? null,
          reason: 'fallback-poll',
        })
      );
    }, 45000);
    return () => clearInterval(fallback);
  }, [companyId, selectedBranch?.id]);

  useEffect(() => {
    if (user?.id && user?.role) reload(user.id, user.role, user.profileId, companyId ?? undefined);
  }, [user?.id, user?.role, user?.profileId, companyId, reload]);

  useEffect(() => {
    void reloadSettings(companyId);
  }, [companyId, reloadSettings]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const [session, pinSet] = await Promise.all([authApi.getSession(), authApi.hasPinSet()]);
      if (cancelled) return;
      if (pinSet && !session) {
        setCurrentScreen('login');
        setAuthLoading(false);
        setIsBranchResolving(false);
        return;
      }
      if (!session) {
        setAuthLoading(false);
        setIsBranchResolving(false);
        return;
      }
      authApi.getProfile(session.userId).then(async (profile) => {
        if (cancelled) return;
        if (!profile) {
          setAuthLoading(false);
          setIsBranchResolving(false);
          setCurrentScreen('login');
          return;
        }
        const u: User = {
          id: profile.userId,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          profileId: profile.profileId,
          branchId: profile.branchId ?? undefined,
          branchLocked: profile.branchLocked,
        };
        setUser(u);
        setCompanyId(profile.companyId);
        if (pinSet) {
          setCurrentScreen('login');
          setAuthLoading(false);
          setIsBranchResolving(false);
          return;
        }
        if (profile.branchLocked && profile.branchId) {
          try {
            const { data: branches } = await getBranches(profile.companyId || '');
            const lockedBranch = branches?.find((b) => b.id === profile.branchId);
            if (lockedBranch) {
              setSelectedBranch(lockedBranch);
              try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(lockedBranch)); } catch { /* ignore */ }
              setCurrentScreen('home');
              setActiveBottomTab('home');
              setIsBranchResolving(false);
            } else {
              setCurrentScreen('branch-selection');
              setIsBranchResolving(false);
            }
          } catch {
            setCurrentScreen('branch-selection');
            setIsBranchResolving(false);
          }
        } else {
          try {
            const cid = profile.companyId || '';
            const profileId = profile.profileId;
            const [branchesRes, userBranchIds] = await Promise.all([
              cid ? getBranches(cid) : { data: [] as Branch[], error: null },
              profileId ? getUserBranchIds(profileId) : Promise.resolve([]),
            ]);
            const companyBranches = branchesRes.data || [];
            const isAdmin = (profile.role || '').toLowerCase() === 'admin';

            if (companyBranches.length === 1) {
              setSelectedBranch(companyBranches[0]);
              try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(companyBranches[0])); } catch { /* ignore */ }
              setCurrentScreen('home');
              setActiveBottomTab('home');
              setIsBranchResolving(false);
              setAuthLoading(false);
              return;
            }
            if (!isAdmin && userBranchIds.length === 1) {
              const assigned = companyBranches.find((b) => b.id === userBranchIds[0]) ?? { id: userBranchIds[0], name: 'Branch', location: '—' };
              setSelectedBranch(assigned);
              try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(assigned)); } catch { /* ignore */ }
              setCurrentScreen('home');
              setActiveBottomTab('home');
              setIsBranchResolving(false);
              setAuthLoading(false);
              return;
            }
            const saved = localStorage.getItem(BRANCH_STORAGE_KEY);
            const branch = saved ? (JSON.parse(saved) as Branch) : null;
            if (branch?.id && branch?.name && (isAdmin || userBranchIds.length === 0 || userBranchIds.includes(branch.id))) {
              setSelectedBranch(branch);
              setCurrentScreen('home');
              setActiveBottomTab('home');
            } else {
              setCurrentScreen('branch-selection');
            }
            setIsBranchResolving(false);
          } catch {
            setCurrentScreen('branch-selection');
            setIsBranchResolving(false);
          }
        }
        setAuthLoading(false);
      }).catch(() => { if (!cancelled) { setAuthLoading(false); setIsBranchResolving(false); } });
    };
    run().catch(() => { setAuthLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (u: User, cid: string | null) => {
    setUser(u);
    setCompanyId(cid);
    setIsBranchResolving(true);
    setIsPinLocked(false);
    markUnlocked();
    if (u.branchLocked && u.branchId && cid) {
      try {
        const { data: branches } = await getBranches(cid);
        const lockedBranch = branches?.find((b) => b.id === u.branchId);
        if (lockedBranch) {
          setSelectedBranch(lockedBranch);
          try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(lockedBranch)); } catch { /* ignore */ }
          setCurrentScreen('home');
          setActiveBottomTab('home');
          setIsBranchResolving(false);
          return;
        }
      } catch { /* fall through */ }
    }
    if (cid && u.profileId) {
      try {
        const [branchesRes, userBranchIds] = await Promise.all([getBranches(cid), getUserBranchIds(u.profileId)]);
        const companyBranches = branchesRes.data || [];
        const isAdmin = (u.role || '').toLowerCase() === 'admin';
        if (companyBranches.length === 1) {
          setSelectedBranch(companyBranches[0]);
          try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(companyBranches[0])); } catch { /* ignore */ }
          setCurrentScreen('home');
          setActiveBottomTab('home');
          setIsBranchResolving(false);
          return;
        }
        if (!isAdmin && userBranchIds.length === 1) {
          const assigned = companyBranches.find((b) => b.id === userBranchIds[0]) ?? { id: userBranchIds[0], name: 'Branch', location: '—' };
          setSelectedBranch(assigned);
          try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(assigned)); } catch { /* ignore */ }
          setCurrentScreen('home');
          setActiveBottomTab('home');
          setIsBranchResolving(false);
          return;
        }
      } catch { /* ignore */ }
    }
    setCurrentScreen('branch-selection');
    setIsBranchResolving(false);
  };

  const handleBranchSelect = (b: Branch) => {
    setSelectedBranch(b);
    try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
    setCurrentScreen('home');
    setActiveBottomTab('home');
    setIsBranchResolving(false);
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

  const navigateToDocumentEdit = (kind: 'sale' | 'purchase', documentId: string) => {
    setDocumentEditIntent({ kind, id: documentId });
    setShowModuleGrid(false);
    if (kind === 'sale') {
      setCurrentScreen('sales');
      setActiveBottomTab('sales');
    } else {
      setCurrentScreen('purchase');
      setActiveBottomTab('home');
    }
  };

  const handleLogout = async () => {
    await authApi.signOut();
    try { localStorage.removeItem(BRANCH_STORAGE_KEY); } catch { /* ignore */ }
    clearUnlockMark();
    setUser(null);
    setCompanyId(null);
    setSelectedBranch(null);
    setIsBranchResolving(false);
    setIsPinLocked(false);
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

  const canAccessScreen = (screen: Screen, branchId: string | null | undefined): boolean => {
    if (!isModuleEnabled(screen)) return false;
    if (!FEATURE_MOBILE_PERMISSION_V2) return true;
    const module = getPermissionModuleForScreen(screen);
    if (!module) return screen === 'login' || screen === 'branch-selection';
    if (!hasPermission(`${module}.view`)) return false;
    if (branchId && branchId !== 'all' && branchId !== 'default' && !hasBranchAccess(branchId)) return false;
    return true;
  };

  // Only show BottomNav on home so modules (Sales, Purchase, Expense, Settings, etc.) are full screen
  const showBottomNav = currentScreen === 'home' && user && selectedBranch;
  const showSidebar = (currentScreen !== 'login' && currentScreen !== 'branch-selection' && user && selectedBranch) && responsive.isTablet;

  if (authLoading || (user && FEATURE_MOBILE_PERMISSION_V2 && !isPermissionLoaded)) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          <div className="text-[#9CA3AF] animate-pulse">Loading permissions...</div>
        </div>
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

  if (isPinLocked && user) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
        <LoginScreen
          onLogin={handleLogin}
          pinUnlockUser={user}
          pinUnlockCompanyId={companyId}
          onUnlock={() => {
            markUnlocked();
            setIsPinLocked(false);
          }}
        />
      </div>
    );
  }

  if (currentScreen === 'branch-selection' && user) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
        <BranchSelection user={user} companyId={companyId} profileId={user.profileId} onBranchSelect={handleBranchSelect} />
      </div>
    );
  }

  const content = (
    <>
      {currentScreen === 'home' && user && selectedBranch && (
        <HomeScreen user={user} branch={selectedBranch} companyId={companyId} onNavigate={navigateToModule} onLogout={handleLogout} />
      )}
      {currentScreen === 'sales' && user && (
        isBranchResolving
          ? (
            <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-12 h-12 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#9CA3AF] text-center">Preparing workspace...</p>
            </div>
            )
          : !selectedBranch
            ? (
              <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center gap-4 p-6">
                <p className="text-[#EF4444] text-center font-medium">No branch assigned. Contact admin.</p>
                <button type="button" onClick={navigateHome} className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium">Go to Home</button>
              </div>
              )
            : !canAccessScreen('sales', selectedBranch?.id)
              ? <AccessDenied onBack={navigateHome} />
              : <SalesModule
                  onBack={() => { setSalesInitialType(null); navigateHome(); }}
                  user={user}
                  companyId={companyId}
                  branchId={selectedBranch.id}
                  initialSaleType={salesInitialType ?? undefined}
                  onOpenStudio={(saleId) => {
                    setSalesInitialType(null);
                    setStudioFocusSaleId(saleId);
                    setCurrentScreen('studio');
                  }}
                  initialEditSaleId={documentEditIntent?.kind === 'sale' ? documentEditIntent.id : null}
                  onConsumedInitialEditSaleId={() =>
                    setDocumentEditIntent((prev) => (prev?.kind === 'sale' ? null : prev))
                  }
                />
      )}
      {currentScreen === 'pos' && user && (
        !canAccessScreen('pos', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <POSModule onBack={navigateHome} user={user} companyId={companyId} branchId={selectedBranch?.id ?? null} />
      )}
      {currentScreen === 'contacts' && user && (
        !canAccessScreen('contacts', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <ContactsModule onBack={navigateHome} user={user} companyId={companyId} branchId={selectedBranch?.id ?? null} />
      )}
      {currentScreen === 'settings' && user && selectedBranch && (
        !canAccessScreen('settings', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <SettingsModule
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
        !canAccessScreen('products', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <ProductsModule onBack={navigateHome} user={user} companyId={companyId} branchId={selectedBranch?.id ?? null} />
      )}
      {currentScreen === 'purchase' && user && (
        !canAccessScreen('purchase', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : (
            <PurchaseModule
              onBack={navigateHome}
              user={user}
              companyId={companyId}
              branchId={selectedBranch?.id ?? null}
              initialEditPurchaseId={documentEditIntent?.kind === 'purchase' ? documentEditIntent.id : null}
              onConsumedInitialEditPurchaseId={() =>
                setDocumentEditIntent((prev) => (prev?.kind === 'purchase' ? null : prev))
              }
            />
            )
      )}
      {currentScreen === 'reports' && user && (
        !canAccessScreen('reports', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : (
            <AccountsModule
              onBack={navigateHome}
              user={user}
              companyId={companyId}
              branch={selectedBranch}
              initialView="reports"
              onNavigateToDocumentEdit={navigateToDocumentEdit}
            />
            )
      )}
      {currentScreen === 'rental' && user && (
        !canAccessScreen('rental', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <RentalModule onBack={navigateHome} user={user} companyId={companyId} branch={selectedBranch} />
      )}
      {currentScreen === 'studio' && user && (
        !canAccessScreen('studio', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <StudioModule
              onBack={navigateHome}
              user={user}
              companyId={companyId}
              branch={selectedBranch}
              onNewStudioSale={() => navigateToModule('sales', { studioSale: true })}
              focusSaleId={studioFocusSaleId}
              onFocusHandled={() => setStudioFocusSaleId(null)}
            />
      )}
      {currentScreen === 'accounts' && user && (
        !canAccessScreen('accounts', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : (
            <AccountsModule
              onBack={navigateHome}
              user={user}
              companyId={companyId}
              branch={selectedBranch}
              onNavigateToDocumentEdit={navigateToDocumentEdit}
            />
            )
      )}
      {currentScreen === 'expense' && user && (
        !canAccessScreen('expense', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <ExpenseModule onBack={navigateHome} user={user} companyId={companyId} branch={selectedBranch} />
      )}
      {currentScreen === 'inventory' && user && (
        !canAccessScreen('inventory', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <InventoryModule onBack={navigateHome} user={user} companyId={companyId} branch={selectedBranch} />
      )}
      {currentScreen === 'packing' && user && (
        !canAccessScreen('sales', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <PackingListModule onBack={navigateHome} user={user} companyId={companyId} branchId={selectedBranch?.id ?? null} />
      )}
      {currentScreen === 'ledger' && user && (
        !canAccessScreen('accounts', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : (
            <AccountsModule
              onBack={navigateHome}
              user={user}
              companyId={companyId}
              branch={selectedBranch}
              initialView="reports"
              onNavigateToDocumentEdit={navigateToDocumentEdit}
            />
            )
      )}
      {currentScreen === 'dashboard' && user && (
        !canAccessScreen('dashboard', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <DashboardModule
              onBack={navigateHome}
              user={user}
              companyId={companyId}
              branchId={selectedBranch?.id ?? null}
              onNewSale={() => navigateToModule('sales')}
              onNewPurchase={() => navigateToModule('purchase')}
            />
      )}
      {currentScreen !== 'home' && currentScreen !== 'dashboard' && currentScreen !== 'sales' && currentScreen !== 'pos' && currentScreen !== 'contacts' && currentScreen !== 'settings' && currentScreen !== 'products' && currentScreen !== 'purchase' && currentScreen !== 'reports' && currentScreen !== 'rental' && currentScreen !== 'studio' && currentScreen !== 'accounts' && currentScreen !== 'expense' && currentScreen !== 'inventory' && currentScreen !== 'packing' && currentScreen !== 'ledger' && user && (
        <PlaceholderModule title={MODULE_TITLES[currentScreen] || currentScreen} onBack={navigateHome} />
      )}
    </>
  );

  const syncBar = user && selectedBranch ? (
    <div className="flex justify-end p-2 border-b border-[#374151]/50 bg-[#111827]">
      <SyncStatusBar
        status={status}
        onSyncClick={() => {
          if (!online) return;
          setStatus('syncing');
          runSync().then(({ errors }) => setStatus(errors > 0 ? 'sync_error' : 'online')).catch(() => setStatus('sync_error'));
        }}
      />
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
