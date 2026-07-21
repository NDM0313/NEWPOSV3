import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ScreenErrorBoundary } from './components/ScreenErrorBoundary';
import { initInputKeyboard } from './utils/inputKeyboard';
import type { Screen, User, Branch, BottomNavTab } from './types';
import * as authApi from './api/auth';
import { getBranches } from './api/branches';
import { canPickAllCompanyBranches, getUserAccessibleBranchIds, getUserAssignedBranchIds, invalidateBranchAccessSessionCache } from './api/permissions';
import { listCacheKeys, listCacheRemove } from './lib/listCache';
import {
  resolveBranchForSingleEffectiveId,
  resolveEffectiveBranchIds,
} from './lib/branchResolution';
import { usePermissions } from './context/PermissionContext';
import { useCounterWorker, useEffectiveWorkerProfile } from './context/CounterWorkerContext';
import { useSettings } from './context/SettingsContext';
import { FEATURE_MOBILE_PERMISSION_V2 } from './config/featureFlags';
import { getPermissionModuleForScreen, screenSkipsModuleViewPermission } from './utils/permissionModules';
import { AccessDenied } from './components/AccessDenied';

const BRANCH_STORAGE_KEY = 'erp_mobile_branch';
import { useResponsive } from './hooks/useResponsive';
import { LoginScreen } from './components/LoginScreen';
import { CreateBusinessWizardScreen } from './components/auth/CreateBusinessWizardScreen';
import { BranchSelection } from './components/BranchSelection';
import { CompanySelection } from './components/CompanySelection';
import { HomeScreen } from './components/HomeScreen';
import { isPlatformCompanyOperator } from './config/functionalRoles';
import { getPlatformActiveCompany } from './api/platformCompany';
import { BottomNav } from './components/BottomNav';
import { ModuleGrid } from './components/ModuleGrid';
import { TabletSidebar } from './components/TabletSidebar';
import { PlaceholderModule } from './components/PlaceholderModule';
import { SyncStatusBar } from './components/SyncStatusBar';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { MainScrollContext } from './contexts/MainScrollContext';
import { runSync, getUnsyncedCount } from './lib/syncEngine';
import { markUnlocked, clearUnlockMark, shouldRelock, markBackgrounded, touchPinActivity } from './lib/pinLock';
import { isMediaCaptureActive, wasMediaCaptureRecent } from './lib/mediaCaptureSession';
import { dispatchMobileInvalidated } from './lib/dataInvalidationBus';
import { subscribeMobileRealtime } from './lib/realtimeSubscriptions';
import { mobileRealtimeHealth } from './lib/supabase';
import { resetLocalDataPlaneForNewCompany } from './lib/sessionIsolation';
import { POSLockScreen } from './components/auth/POSLockScreen';
import {
  safeShouldActivateCounterLockScreen,
  requestCounterLockScreen,
  setLastCounterCompanyId,
} from './lib/sharedCounterMode';
import { dispatchMobileBackPress, registerMobileBackHandler } from './lib/mobileBackPress';
import { initNativeShell } from './lib/nativeShell';
import { withBootTimeout } from './lib/bootTimeout';

const LAST_AUTOSYNC_KEY = 'erp_mobile_last_autosync_at';
const BOOT_AUTH_TIMEOUT_MS = 10_000;

const SalesModule = lazy(() => import('./components/sales/SalesModule').then((m) => ({ default: m.SalesModule })));
const WorkOrdersModule = lazy(() => import('./components/sales/WorkOrdersModule').then((m) => ({ default: m.WorkOrdersModule })));
const POSModule = lazy(() => import('./components/pos/POSModule').then((m) => ({ default: m.POSModule })));
const ContactsModule = lazy(() => import('./components/contacts/ContactsModule').then((m) => ({ default: m.ContactsModule })));
const SettingsModule = lazy(() => import('./components/settings/SettingsModule').then((m) => ({ default: m.SettingsModule })));
const ProductsModule = lazy(() => import('./components/products/ProductsModule').then((m) => ({ default: m.ProductsModule })));
const PurchaseModule = lazy(() => import('./components/purchase/PurchaseModule').then((m) => ({ default: m.PurchaseModule })));
const RentalModule = lazy(() => import('./components/rental/RentalModule').then((m) => ({ default: m.RentalModule })));
const StudioModule = lazy(() => import('./components/studio/StudioModule').then((m) => ({ default: m.StudioModule })));
const AccountsModule = lazy(() => import('./components/accounts/AccountsModule').then((m) => ({ default: m.AccountsModule })));
const ExpenseModule = lazy(() => import('./components/expense/ExpenseModule').then((m) => ({ default: m.ExpenseModule })));
const InventoryModule = lazy(() => import('./components/inventory/InventoryModule').then((m) => ({ default: m.InventoryModule })));
const DashboardModule = lazy(() => import('./components/dashboard/DashboardModule').then((m) => ({ default: m.DashboardModule })));
const PackingListModule = lazy(() => import('./components/packing/PackingListModule').then((m) => ({ default: m.PackingListModule })));

function ModuleLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-12 h-12 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
      <p className="text-[#9CA3AF] text-center">Loading module...</p>
    </div>
  );
}

const MODULE_TITLES: Record<Screen, string> = {
  login: 'Login',
  'company-selection': 'Company',
  'branch-selection': 'Branch',
  home: 'Home',
  dashboard: 'Dashboard',
  sales: 'Sales',
  workorders: 'Work Orders',
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
  packing: 'Shipment & Cargo',
  ledger: 'Ledger',
  settings: 'Settings',
};

export default function App() {
  const responsive = useResponsive();
  const { online, status, setStatus } = useNetworkStatus();
  const { hasPermission, hasBranchAccess, isModuleEnabled, reload, isPermissionLoaded, canUseFullAccounting, branchIds, isAdminOrOwner } = usePermissions();
  const {
    activeCounterWorkerProfile,
    isCounterLocked,
    temporaryLock,
    requestCounterLock,
    resetCounterState,
  } = useCounterWorker();
  const { reload: reloadSettings } = useSettings();
  const [authLoading, setAuthLoading] = useState(true);
  const [isBranchResolving, setIsBranchResolving] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomNavTab>('home');
  const [showModuleGrid, setShowModuleGrid] = useState(false);
  const [salesInitialType, setSalesInitialType] = useState<'regular' | 'studio' | null>(null);
  const [salesInitialDocumentBranchId, setSalesInitialDocumentBranchId] = useState<string | null>(null);
  const [studioFocusSaleId, setStudioFocusSaleId] = useState<string | null>(null);
  const [isPinLocked, setIsPinLocked] = useState(false);
  const counterBootLockCheckedRef = useRef(false);
  /** When true, skip cold-boot POS lock once — user just came through `handleLogin` (already authenticated). */
  const skipCounterBootLockAfterInteractiveLoginRef = useRef(false);
  /** Next PermissionContext.reload should bust branch cache (login / session restore only). */
  const permissionReloadFreshRef = useRef(false);
  const [documentEditIntent, setDocumentEditIntent] = useState<{ kind: 'sale' | 'purchase'; id: string } | null>(null);
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);
  const previousAuthUserIdRef = useRef<string | null>(null);
  const onlineWasOfflineRef = useRef(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const effectiveProfile = useEffectiveWorkerProfile(user);

  useEffect(() => {
    if (authLoading || !user?.id || !companyId) return;
    if (skipCounterBootLockAfterInteractiveLoginRef.current) {
      skipCounterBootLockAfterInteractiveLoginRef.current = false;
      counterBootLockCheckedRef.current = true;
      return;
    }
    if (counterBootLockCheckedRef.current) return;
    void safeShouldActivateCounterLockScreen(companyId)
      .then((lock) => {
        if (lock) {
          requestCounterLock();
        }
      })
      .catch(() => {
        /* vault read failed — stay unlocked */
      })
      .finally(() => {
        counterBootLockCheckedRef.current = true;
      });
  }, [authLoading, user?.id, companyId, requestCounterLock]);

  useEffect(() => {
    const onLockRequested = () => {
      if (!companyId) return;
      void safeShouldActivateCounterLockScreen(companyId)
        .then((lock) => {
          if (lock) {
            requestCounterLock();
          }
        })
        .catch(() => {});
    };
    window.addEventListener('erp-mobile:counter-lock-requested', onLockRequested);
    return () => window.removeEventListener('erp-mobile:counter-lock-requested', onLockRequested);
  }, [companyId, requestCounterLock]);

  useEffect(() => {
    const cleanup = initInputKeyboard();
    void initNativeShell();
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
      resetCounterState();
      counterBootLockCheckedRef.current = false;
      clearUnlockMark();
    };
    window.addEventListener('erp-auth-signed-out', onSignedOut);
    return () => window.removeEventListener('erp-auth-signed-out', onSignedOut);
  }, [resetCounterState]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const checkLock = async () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') return;
      if (isPinLocked || isCounterLocked) return;
      if (isMediaCaptureActive() || wasMediaCaptureRecent()) {
        touchPinActivity();
        return;
      }
      if (!shouldRelock()) return;
      const useCounter = await safeShouldActivateCounterLockScreen(companyId);
      if (cancelled) return;
      if (useCounter) {
        requestCounterLock();
        return;
      }
      const pinSet = await authApi.hasPinSet();
      if (cancelled || !pinSet) return;
      setIsPinLocked(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (!isMediaCaptureActive()) markBackgrounded();
        return;
      }
      if (document.visibilityState === 'visible') {
        if (isMediaCaptureActive() || wasMediaCaptureRecent()) {
          touchPinActivity();
          return;
        }
        void checkLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    let appStateListener: { remove: () => void } | undefined;
    void import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            if (!isMediaCaptureActive()) markBackgrounded();
            return;
          }
          if (isMediaCaptureActive() || wasMediaCaptureRecent()) {
            touchPinActivity();
            return;
          }
          void checkLock();
        }),
      )
      .then((handle) => {
        appStateListener = handle;
      })
      .catch(() => {});

    const onActivity = () => {
      if (!isPinLocked && !isCounterLocked) touchPinActivity();
    };
    document.addEventListener('pointerdown', onActivity);
    document.addEventListener('keydown', onActivity);
    document.addEventListener('touchstart', onActivity, { passive: true });
    document.addEventListener('touchmove', onActivity, { passive: true });
    document.addEventListener('scroll', onActivity, { capture: true, passive: true });

    const idlePoll = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void checkLock();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(idlePoll);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', onActivity);
      document.removeEventListener('keydown', onActivity);
      document.removeEventListener('touchstart', onActivity);
      document.removeEventListener('touchmove', onActivity);
      document.removeEventListener('scroll', onActivity, true);
      appStateListener?.remove();
    };
  }, [user?.id, companyId, isPinLocked, isCounterLocked, requestCounterLock]);

  useEffect(() => {
    if (!user) return;
    if (!online) {
      onlineWasOfflineRef.current = true;
      return;
    }
    let cancelled = false;
    const justReconnected = onlineWasOfflineRef.current;
    onlineWasOfflineRef.current = false;

    const notifyListsRefreshed = () => {
      window.dispatchEvent(new CustomEvent('erp-mobile:autosync-complete'));
    };

    const doSync = () => {
      getUnsyncedCount().then((n) => {
        if (cancelled) return;
        if (n === 0) {
          if (justReconnected) notifyListsRefreshed();
          return;
        }
        setStatus('syncing');
        runSync()
          .then(({ synced, errors }) => {
            if (cancelled) return;
            if (errors === 0) {
              try {
                localStorage.setItem(LAST_AUTOSYNC_KEY, String(Date.now()));
              } catch {
                /* ignore */
              }
              notifyListsRefreshed();
              if (synced > 0 && typeof document !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('erp-mobile:toast', {
                    detail: { message: `${synced} item${synced === 1 ? '' : 's'} synced` },
                  }),
                );
              }
            }
            setStatus(errors > 0 ? 'sync_error' : 'online');
          })
          .catch(() => {
            if (!cancelled) setStatus('sync_error');
          });
      });
    };

    const start = () => {
      if (justReconnected) {
        notifyListsRefreshed();
        window.setTimeout(() => doSync(), 450);
      } else {
        doSync();
      }
    };
    start();
    const t = setInterval(doSync, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [online, user?.id, setStatus]);

  useEffect(() => {
    if (!companyId || !user?.id) return;
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
  }, [companyId, selectedBranch?.id, user?.id]);

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
    if (!companyId || !online) return;
    void Promise.all([
      import('./api/accounts').then((m) => m.getPaymentAccounts(companyId)),
      import('./api/branches').then((m) => m.getBranches(companyId)),
    ]).catch(() => {});
  }, [companyId, online]);

  useEffect(() => {
    if (!user?.id || !user?.role) return;
    if (activeCounterWorkerProfile?.userId) return;
    const fresh = permissionReloadFreshRef.current;
    permissionReloadFreshRef.current = false;
    void reload(user.id, user.role, user.profileId, companyId ?? undefined, fresh ? { fresh: true } : undefined);
  }, [user?.id, user?.role, user?.profileId, companyId, reload, activeCounterWorkerProfile?.userId]);

  /** Keep branchLocked in sync with live permission branchIds (e.g. admin added a second branch). */
  useEffect(() => {
    if (!user || !isPermissionLoaded || isAdminOrOwner) return;
    const locked = branchIds.length === 1;
    if (user.branchLocked === locked && (!locked || user.branchId === branchIds[0])) return;
    setUser((prev) =>
      prev
        ? {
            ...prev,
            branchLocked: locked,
            branchId: locked ? branchIds[0] : prev.branchId,
          }
        : prev,
    );
  }, [user?.id, user?.branchLocked, user?.branchId, branchIds, isPermissionLoaded, isAdminOrOwner]);

  useEffect(() => {
    void reloadSettings(companyId);
  }, [companyId, reloadSettings]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [session, pinSet] = await withBootTimeout(
          Promise.all([authApi.getSession(), authApi.hasPinSet()]),
          BOOT_AUTH_TIMEOUT_MS,
        );
        if (cancelled) return;
        if (pinSet && !session) {
          setCurrentScreen('login');
          return;
        }
        if (!session) {
          return;
        }
        const profile = await authApi.getProfile(session.userId);
        if (cancelled) return;
        if (!profile) {
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
        permissionReloadFreshRef.current = true;
        setUser(u);

        let cid = profile.companyId || '';
        let cname: string | null = null;
        if (isPlatformCompanyOperator(profile.role)) {
          const session = await getPlatformActiveCompany();
          const activeId = session.data?.activeCompanyId ?? null;
          if (!activeId) {
            setCompanyId(null);
            setCompanyName(null);
            setLastCounterCompanyId(null);
            setCurrentScreen('company-selection');
            setIsBranchResolving(false);
            return;
          }
          cid = activeId;
          cname = session.data?.companyName ?? null;
        }
        setCompanyId(cid || null);
        setCompanyName(cname);
        setLastCounterCompanyId(cid || null);
        if (pinSet) {
          const counterLock = cid ? await safeShouldActivateCounterLockScreen(cid) : false;
          if (!counterLock) {
            setIsPinLocked(true);
          }
        }
        try {
          const profileId = profile.profileId;
          if (cid) {
            await listCacheRemove(listCacheKeys.branches(cid));
            invalidateBranchAccessSessionCache();
          }
          const unrestricted = canPickAllCompanyBranches(profile.role);
          const [branchesRes, userBranchIds] = await Promise.all([
            cid ? getBranches(cid) : { data: [] as Branch[], error: null },
            cid
              ? unrestricted
                ? getUserAccessibleBranchIds(profile.userId, profileId, cid, { fresh: true })
                : getUserAssignedBranchIds(profile.userId, profileId ?? profile.userId).then((r) => r.branchIds)
              : Promise.resolve([] as string[]),
          ]);
          const companyBranches = branchesRes.data || [];
          const effectiveBranchIds = resolveEffectiveBranchIds(
            companyBranches,
            userBranchIds,
            unrestricted
          );

          if (companyBranches.length === 1) {
            setSelectedBranch(companyBranches[0]);
            try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(companyBranches[0])); } catch { /* ignore */ }
            setCurrentScreen('home');
            setActiveBottomTab('home');
            setIsBranchResolving(false);
            return;
          }
          if (!unrestricted && effectiveBranchIds.length === 1) {
            const assigned = resolveBranchForSingleEffectiveId(companyBranches, effectiveBranchIds);
            if (assigned) {
              setSelectedBranch(assigned);
              try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(assigned)); } catch { /* ignore */ }
              setCurrentScreen('home');
              setActiveBottomTab('home');
              setIsBranchResolving(false);
              return;
            }
          }
          const saved = localStorage.getItem(BRANCH_STORAGE_KEY);
          const branch = saved ? (JSON.parse(saved) as Branch) : null;
          const mayRestoreSavedBranch =
            branch?.id &&
            branch?.name &&
            (unrestricted || effectiveBranchIds.includes(branch.id));
          if (mayRestoreSavedBranch) {
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
      } catch (e) {
        console.warn('[ERP Mobile] auth bootstrap failed:', e);
        if (!cancelled) {
          setCurrentScreen('login');
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
          setIsBranchResolving(false);
        }
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (u: User, cid: string | null) => {
    skipCounterBootLockAfterInteractiveLoginRef.current = true;
    permissionReloadFreshRef.current = true;
    if (previousAuthUserIdRef.current !== null && previousAuthUserIdRef.current !== u.id) {
      await resetLocalDataPlaneForNewCompany();
    }
    previousAuthUserIdRef.current = u.id;
    setUser(u);
    setIsBranchResolving(true);
    setIsPinLocked(false);
    markUnlocked();
    setSelectedBranch(null);

    if (isPlatformCompanyOperator(u.role)) {
      const session = await getPlatformActiveCompany();
      const activeId = session.data?.activeCompanyId ?? null;
      if (!activeId) {
        setCompanyId(null);
        setCompanyName(null);
        setLastCounterCompanyId(null);
        setCurrentScreen('company-selection');
        setIsBranchResolving(false);
        return;
      }
      const activeName = session.data?.companyName ?? null;
      setCompanyId(activeId);
      setCompanyName(activeName);
      setLastCounterCompanyId(activeId);
      const needsCounterLock = await safeShouldActivateCounterLockScreen(activeId);
      skipCounterBootLockAfterInteractiveLoginRef.current = !needsCounterLock;
      await listCacheRemove(listCacheKeys.branches(activeId));
      invalidateBranchAccessSessionCache();
      await resolveBranchScreenForUser(u, activeId);
      return;
    }

    setCompanyId(cid);
    setCompanyName(null);
    setLastCounterCompanyId(cid);
    const needsCounterLock = cid ? await safeShouldActivateCounterLockScreen(cid) : false;
    skipCounterBootLockAfterInteractiveLoginRef.current = !needsCounterLock;
    if (cid) {
      await listCacheRemove(listCacheKeys.branches(cid));
      invalidateBranchAccessSessionCache();
    }
    await resolveBranchScreenForUser(u, cid);
  };

  const resolveBranchScreenForUser = async (u: User, cid: string | null) => {
    if (cid && (u.profileId || u.id)) {
      try {
        const unrestricted = canPickAllCompanyBranches(u.role);
        const [branchesRes, userBranchIds] = await Promise.all([
          getBranches(cid),
          unrestricted
            ? getUserAccessibleBranchIds(u.id, u.profileId, cid, { fresh: true })
            : getUserAssignedBranchIds(u.id, u.profileId ?? u.id).then((r) => r.branchIds),
        ]);
        const companyBranches = branchesRes.data || [];
        const effectiveBranchIds = resolveEffectiveBranchIds(
          companyBranches,
          userBranchIds,
          unrestricted
        );
        if (companyBranches.length === 1) {
          setSelectedBranch(companyBranches[0]);
          try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(companyBranches[0])); } catch { /* ignore */ }
          setCurrentScreen('home');
          setActiveBottomTab('home');
          setIsBranchResolving(false);
          return;
        }
        if (!unrestricted && effectiveBranchIds.length === 1) {
          const assigned = resolveBranchForSingleEffectiveId(companyBranches, effectiveBranchIds);
          if (assigned) {
            setSelectedBranch(assigned);
            try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(assigned)); } catch { /* ignore */ }
            setCurrentScreen('home');
            setActiveBottomTab('home');
            setIsBranchResolving(false);
            return;
          }
        }
      } catch { /* ignore */ }
    }
    setCurrentScreen('branch-selection');
    setIsBranchResolving(false);
  };

  const handleCompanySelect = async (company: { id: string; name: string }) => {
    if (!user) return;
    permissionReloadFreshRef.current = true;
    setCompanyId(company.id);
    setCompanyName(company.name);
    setLastCounterCompanyId(company.id);
    setSelectedBranch(null);
    setIsBranchResolving(true);
    await listCacheRemove(listCacheKeys.branches(company.id));
    invalidateBranchAccessSessionCache();
    await resolveBranchScreenForUser(user, company.id);
  };

  const handleSwitchCompany = () => {
    setSelectedBranch(null);
    try { localStorage.removeItem(BRANCH_STORAGE_KEY); } catch { /* ignore */ }
    setCurrentScreen('company-selection');
    setIsBranchResolving(false);
  };

  const handleBranchSelect = (b: Branch) => {
    setSelectedBranch(b);
    try { localStorage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
    setCurrentScreen('home');
    setActiveBottomTab('home');
    setIsBranchResolving(false);
  };

  const navigateToModule = (screen: Screen, options?: { studioSale?: boolean; documentBranchId?: string }) => {
    setCurrentScreen(screen);
    setShowModuleGrid(false);
    if (options?.studioSale) setSalesInitialType('studio');
    if (options?.documentBranchId) setSalesInitialDocumentBranchId(options.documentBranchId);
    if (screen === 'home') setActiveBottomTab('home');
    else if (screen === 'sales') setActiveBottomTab('sales');
    else if (screen === 'pos') setActiveBottomTab('pos');
    else if (screen === 'contacts') setActiveBottomTab('contacts');
    else setActiveBottomTab('home');
  };

  const navigateHome = () => {
    setCurrentScreen('home');
    setActiveBottomTab('home');
    setShowModuleGrid(false);
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

  const handleLogoutFull = async () => {
    await authApi.signOutGlobal();
    try { localStorage.removeItem(BRANCH_STORAGE_KEY); } catch { /* ignore */ }
    clearUnlockMark();
    setUser(null);
    setCompanyId(null);
    setCompanyName(null);
    setSelectedBranch(null);
    setIsBranchResolving(false);
    setIsPinLocked(false);
    resetCounterState();
    counterBootLockCheckedRef.current = false;
    setShowCreateBusiness(false);
    previousAuthUserIdRef.current = null;
    setCurrentScreen('login');
  };

  const handleLogout = async () => {
    try {
      if (companyId && (await safeShouldActivateCounterLockScreen(companyId))) {
        temporaryLock();
        return;
      }
    } catch (e) {
      console.warn('[ERP Mobile] counter vault check on logout failed:', e);
    }
    await handleLogoutFull();
  };

  const handleRequestCounterLock = () => {
    requestCounterLockScreen();
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
    if (screenSkipsModuleViewPermission(screen)) {
      return true;
    }
    if (!isPermissionLoaded) return false;
    const module = getPermissionModuleForScreen(screen);
    if (!module) return screen === 'login' || screen === 'branch-selection';
    if (!hasPermission(`${module}.view`)) return false;
    if (!branchId || branchId === 'all' || branchId === 'default') return true;
    if (hasBranchAccess(branchId)) return true;
    // Shared counter tablet: admin-selected branch may differ from worker assignments; modules scope data client-side.
    if (!isAdminOrOwner && branchIds.length > 0) return true;
    return false;
  };

  // Only show BottomNav on home so modules (Sales, Purchase, Expense, Settings, etc.) are full screen
  const showBottomNav = currentScreen === 'home' && user && selectedBranch;
  const showSidebar = (currentScreen !== 'login' && currentScreen !== 'branch-selection' && user && selectedBranch) && responsive.isTablet;
  const lockOverlayActive = Boolean(user && (isCounterLocked || isPinLocked));

  useEffect(() => {
    if (authLoading) return;
    if (!user || currentScreen === 'login' || currentScreen === 'branch-selection') return;
    if (lockOverlayActive) return;

    const unregister = registerMobileBackHandler(() => {
      if (showModuleGrid) {
        setShowModuleGrid(false);
        return true;
      }
      return false;
    });

    let backListener: { remove: () => void } | undefined;
    void import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('backButton', () => {
          if (dispatchMobileBackPress()) return;
          if (currentScreen !== 'home') {
            if (currentScreen === 'sales') {
              setSalesInitialType(null);
              setSalesInitialDocumentBranchId(null);
            }
            navigateHome();
            return;
          }
          void App.exitApp();
        }),
      )
      .then((handle) => {
        backListener = handle;
      })
      .catch(() => {});

    return () => {
      unregister();
      backListener?.remove();
    };
  }, [authLoading, user, currentScreen, lockOverlayActive, showModuleGrid]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          <div className="text-[#9CA3AF] animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  if (currentScreen === 'login' && !user && showCreateBusiness) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
        <CreateBusinessWizardScreen
          onCancel={() => setShowCreateBusiness(false)}
          onComplete={(u, cid) => {
            setShowCreateBusiness(false);
            void handleLogin(u, cid);
          }}
        />
      </div>
    );
  }

  if (currentScreen === 'login' && !user) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
        <LoginScreen
          onLogin={handleLogin}
          onCreateBusiness={() => setShowCreateBusiness(true)}
        />
      </div>
    );
  }

  if (currentScreen === 'company-selection' && user && isPlatformCompanyOperator(user.role)) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
        <CompanySelection
          user={user}
          currentCompanyId={companyId}
          onCompanySelect={(c) => void handleCompanySelect(c)}
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

  const workerShellKey =
    user && companyId
      ? `${companyId}:${effectiveProfile?.userId ?? user.id}`
      : 'guest';

  const lockOverlays = user ? (
    <>
      {isCounterLocked && (
        <div
          className="fixed inset-0 z-[100] bg-[#111827]"
          role="dialog"
          aria-modal="true"
          aria-label="Counter lock"
        >
          <POSLockScreen
            companyId={companyId}
            showPermanentSignOut={isAdminOrOwner}
            onUseFullLogin={() => void handleLogoutFull()}
          />
        </div>
      )}
      {isPinLocked && !isCounterLocked && (
        <div
          className="fixed inset-0 z-[100] bg-[#111827] text-[#F9FAFB]"
          role="dialog"
          aria-modal="true"
          aria-label="PIN unlock"
        >
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
      )}
    </>
  ) : null;

  const content = (
    <div
      key={workerShellKey}
      className={lockOverlayActive ? 'pointer-events-none select-none' : undefined}
      aria-hidden={lockOverlayActive || undefined}
    >
    <Suspense fallback={<ModuleLoadingFallback />}>
    <>
      {currentScreen === 'home' && user && selectedBranch && (
        <HomeScreen
          user={user}
          branch={selectedBranch}
          companyId={companyId}
          companyName={companyName}
          onNavigate={navigateToModule}
          onLogout={handleLogout}
          onSwitchCompany={
            isPlatformCompanyOperator(user.role) ? handleSwitchCompany : undefined
          }
        />
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
                  onBack={() => { setSalesInitialType(null); setSalesInitialDocumentBranchId(null); navigateHome(); }}
                  user={user}
                  companyId={companyId}
                  branchId={selectedBranch.id}
                  initialSaleType={salesInitialType ?? undefined}
                  initialDocumentBranchId={salesInitialDocumentBranchId}
                  onConsumedInitialDocumentBranchId={() => setSalesInitialDocumentBranchId(null)}
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
      {currentScreen === 'workorders' && user && (
        !canAccessScreen('workorders', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : (
            <ScreenErrorBoundary screenName="Work Orders" onBack={navigateHome}>
              <Suspense fallback={<ModuleLoadingFallback />}>
                <WorkOrdersModule
                  onBack={navigateHome}
                  user={user}
                  companyId={companyId}
                  branchId={selectedBranch?.id ?? null}
                />
              </Suspense>
            </ScreenErrorBoundary>
          )
      )}
      {currentScreen === 'pos' && user && (
        !canAccessScreen('pos', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <POSModule
              onBack={navigateHome}
              user={user}
              companyId={companyId}
              branchId={selectedBranch?.id ?? null}
              onRequestCounterLock={handleRequestCounterLock}
            />
      )}
      {currentScreen === 'contacts' && user && (
        !canAccessScreen('contacts', selectedBranch?.id)
          ? <AccessDenied onBack={navigateHome} />
          : <ContactsModule onBack={navigateHome} user={user} companyId={companyId} branchId={selectedBranch?.id ?? null} />
      )}
      {currentScreen === 'settings' && user && (
        <ScreenErrorBoundary screenName="Settings" onBack={navigateHome}>
          <Suspense fallback={<ModuleLoadingFallback />}>
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
          </Suspense>
        </ScreenErrorBoundary>
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
              onNewStudioSale={(documentBranchId) =>
                navigateToModule('sales', { studioSale: true, documentBranchId })
              }
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
          : <ExpenseModule
              onBack={navigateHome}
              user={user}
              companyId={companyId}
              branch={selectedBranch}
              onRequestCounterLock={handleRequestCounterLock}
            />
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
              initialView={canUseFullAccounting ? 'reports' : undefined}
              initialReport={canUseFullAccounting ? 'customer-ledger' : undefined}
              initialWorkerActivity={!canUseFullAccounting}
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
    </Suspense>
    </div>
  );

  const syncBar = user && selectedBranch ? (
    <header className="erp-app-header flex items-center justify-between gap-2 px-3 py-2 border-b border-[#374151]/50 bg-[#111827] min-h-[44px]">
      <span className="text-sm font-semibold text-white truncate">Din Collection</span>
      <SyncStatusBar
        status={status}
        onSyncClick={() => {
          if (!online) return;
          setStatus('syncing');
          runSync().then(({ errors }) => setStatus(errors > 0 ? 'sync_error' : 'online')).catch(() => setStatus('sync_error'));
        }}
      />
    </header>
  ) : null;

  const permissionBar =
    user && FEATURE_MOBILE_PERMISSION_V2 && !isPermissionLoaded ? (
      <div className="px-3 py-2 text-sm text-[#FCD34D] bg-[#78350F]/40 border-b border-[#92400E]/50 flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-[#FCD34D] border-t-transparent rounded-full animate-spin shrink-0" />
        Loading permissions…
      </div>
    ) : null;

  if (responsive.isTablet) {
    return (
      <div className="min-h-screen bg-[#111827] text-[#F9FAFB] flex overflow-hidden">
        {showSidebar && user && selectedBranch && (
          <TabletSidebar
            user={user}
            branch={selectedBranch}
            companyId={companyId}
            currentScreen={currentScreen}
            onNavigate={navigateToModule}
            onLogout={handleLogout}
          />
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          {permissionBar}
          {syncBar}
          <MainScrollContext.Provider value={mainScrollRef}>
            <div
              ref={mainScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden max-w-full min-w-0"
            >
              {content}
            </div>
          </MainScrollContext.Provider>
        </div>
        {lockOverlays}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
      {permissionBar}
      {syncBar}
      {content}
      {lockOverlays}
      {showBottomNav && !lockOverlayActive && (
        <BottomNav activeTab={activeBottomTab} onTabChange={handleBottomNavChange} />
      )}
      {showModuleGrid && user && !responsive.isTablet && !lockOverlayActive && (
        <ModuleGrid
          onClose={() => setShowModuleGrid(false)}
          onModuleSelect={navigateToModule}
          userRole={(effectiveProfile?.role ?? user.role) as User['role']}
        />
      )}
    </div>
  );
}
