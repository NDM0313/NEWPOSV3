import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { settingsService } from '@/app/services/settingsService';
import { permissionEngine } from '@/app/services/permissionEngine';
import { branchService } from '@/app/services/branchService';

interface SupabaseContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True once we've finished the first profile fetch for the current user (success, no row, or error). Use to avoid showing "no business" while still loading or after a transient error. */
  profileLoadComplete: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  companyId: string | null;
  userRole: string | null;
  branchId: string | null;
  defaultBranchId: string | null;
  setBranchId: (branchId: string | null) => void;
  /** Branch IDs the user can access (from user_branches, or all company branches for admin). Empty until loaded. */
  accessibleBranchIds: string[];
  setAccessibleBranchIds: (ids: string[]) => void;
  /** Company branch count (1 = single-branch, no assignment needed). */
  branchCount: number;
  /** True only when branch_count > 1 AND user has no branch mapping. Use to show "Branch is required" only then. */
  requiresBranchSelection: boolean;
  /** Global packing (Boxes/Pieces): OFF = hidden everywhere; ON = full packing. Default OFF. */
  enablePacking: boolean;
  setEnablePacking: (value: boolean) => Promise<void>;
  refreshEnablePacking: () => Promise<void>;
  supabaseClient: typeof supabase;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null);
  const [accessibleBranchIds, setAccessibleBranchIds] = useState<string[]>([]);
  const [branchCount, setBranchCount] = useState<number>(0);
  const [requiresBranchSelection, setRequiresBranchSelection] = useState<boolean>(false);
  const [enablePacking, setEnablePackingState] = useState<boolean>(false);
  const [profileLoadComplete, setProfileLoadComplete] = useState<boolean>(false);

  const loadEnablePacking = async (cid: string) => {
    try {
      const value = await settingsService.getEnablePacking(cid);
      setEnablePackingState(value);
    } catch {
      setEnablePackingState(false);
    }
  };

  const refreshEnablePacking = async () => {
    if (companyId) await loadEnablePacking(companyId);
  };

  const setEnablePacking = async (value: boolean) => {
    if (!companyId) return;
    await settingsService.setEnablePacking(companyId, value);
    setEnablePackingState(value);
  };

  // Ref to track ongoing fetch operations (prevent duplicate calls)
  const fetchingRef = useRef<Set<string>>(new Set());
  const fetchedRef = useRef<Set<string>>(new Set());
  const lastFetchedUserIdRef = useRef<string | null>(null);

  // Initialize user session (catch SecurityError / CORS so app shows login instead of stuck "Loading...")
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user && import.meta.env?.DEV) {
          try {
            const { data: authData } = await supabase.auth.getUser();
            console.log('[AUTH] AUTH USER (after getSession):', {
              user_id: authData?.user?.id,
              email: authData?.user?.email,
              has_session: !!session,
              auth_uid: authData?.user?.id,
            });
          } catch {
            // SecurityError / storage denied – ignore
          }
        }
        if (session?.user) {
          fetchUserData(session.user.id);
        }
        setLoading(false);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    // Listen for auth changes (guard against thrown errors in listener)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      try {
      setSession(session);
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      if (newUser) {
        if (event === 'SIGNED_IN' && import.meta.env?.DEV) {
          console.log('[AUTH] SIGNED_IN - auth user:', { id: newUser.id, email: newUser.email });
        }
        if (event === 'SIGNED_IN') {
          supabase.from('users').update({ last_login_at: new Date().toISOString() }).or(`id.eq.${newUser.id},auth_user_id.eq.${newUser.id}`).then(() => {});
        }
        // Clear cache if user changed
        if (lastFetchedUserIdRef.current !== null && lastFetchedUserIdRef.current !== newUser.id) {
          fetchedRef.current.clear();
          fetchingRef.current.clear();
        }
        fetchUserData(newUser.id);
      } else {
        setCompanyId(null);
        setUserRole(null);
        setBranchId(null);
        setDefaultBranchId(null);
        setProfileLoadComplete(false);
        // Clear fetch tracking on sign out
        fetchingRef.current.clear();
        fetchedRef.current.clear();
        lastFetchedUserIdRef.current = null;
      }
      } catch {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user data (company, role). Retries once on transient errors so we don't show "no business" on a single network/CORS blip.
  const fetchUserData = async (userId: string, isRetry = false) => {
    // Prevent duplicate concurrent calls for the same userId
    if (fetchingRef.current.has(userId)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[FETCH USER DATA] Already fetching for user, skipping duplicate call:', { userId });
      }
      return;
    }
    
    // If we already fetched this user and have data, skip (unless forced refresh needed)
    if (fetchedRef.current.has(userId) && companyId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[FETCH USER DATA] Already fetched, using cached data:', { userId, companyId });
      }
      setProfileLoadComplete(true);
      return;
    }
    
    try {
      fetchingRef.current.add(userId);
      if (!isRetry) setProfileLoadComplete(false);
      
      if (import.meta.env?.DEV) {
        console.log('[FETCH USER DATA] Looking for ERP profile with auth_user_id or id:', userId);
        console.log('[FETCH USER DATA] Query: users WHERE id.eq.' + userId + ' OR auth_user_id.eq.' + userId);
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, auth_user_id, company_id, role, is_active')
        .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
        .limit(1)
        .maybeSingle();

      if (import.meta.env?.DEV) {
        console.log('[FETCH USER DATA] Result:', { data, error: error ? { code: error.code, message: error.message } : null });
      }

      if (error) {
        // RLS or permission errors - treat as "need onboarding"
        if (error.code === '42501' || error.message?.includes('permission denied') || error.code === 'PGRST301') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[FETCH USER DATA] Permission error. User may need to create a business first.');
          }
          setCompanyId(null);
          setUserRole(null);
          setBranchId(null);
          setDefaultBranchId(null);
          setProfileLoadComplete(true);
          return;
        }
        // Transient/network/CORS: retry once so we don't falsely show "no business"
        if (!isRetry) {
          console.warn('[FETCH USER DATA] Transient error, retrying once in 1.5s:', { code: error.code, message: error.message });
          fetchingRef.current.delete(userId);
          setTimeout(() => fetchUserData(userId, true), 1500);
          return;
        }
        console.error('[FETCH USER DATA ERROR]', { message: error.message, code: error.code, userId });
        setProfileLoadComplete(true);
        return;
      }

      if (!data) {
        if (import.meta.env?.DEV) {
          console.warn('[FETCH USER DATA] User not found in public.users. User must create a business first.');
        }
        setCompanyId(null);
        setUserRole(null);
        setBranchId(null);
        setDefaultBranchId(null);
        setProfileLoadComplete(true);
        return;
      }

      if (data.is_active === false) {
        if (import.meta.env?.DEV) {
          console.warn('[FETCH USER DATA] User account is inactive. Blocking access.');
        }
        await supabase.auth.signOut();
        setCompanyId(null);
        setUserRole(null);
        setBranchId(null);
        setDefaultBranchId(null);
        setProfileLoadComplete(true);
        return;
      }

      if (import.meta.env?.DEV) console.log('[FETCH USER DATA SUCCESS]', { companyId: data.company_id, role: data.role });
      setCompanyId(data.company_id);
      setUserRole(data.role);
      setProfileLoadComplete(true);
      fetchedRef.current.add(userId);
      lastFetchedUserIdRef.current = userId;

      const erpUserId = data.id;
      if (data.company_id) {
        // Only admin/manager/accountant can INSERT into accounts (RLS); skip ensureDefaultAccounts for other roles to avoid 403
        const canCreateAccounts = ['admin', 'manager', 'accountant'].includes(String(data.role || '').toLowerCase());
        if (canCreateAccounts) {
          import('@/app/services/defaultAccountsService').then(({ defaultAccountsService }) => {
            defaultAccountsService.ensureDefaultAccounts(data.company_id).catch((error: any) => {
              console.error('[SUPABASE CONTEXT] Error ensuring default accounts:', error);
            });
          });
        }
        loadUserBranch(
          { erpUserId, authUserId: (data as { auth_user_id?: string }).auth_user_id ?? null },
          data.company_id,
          data.role
        );
      }
    } catch (error) {
      console.error('[FETCH USER DATA EXCEPTION]', error);
      if (!isRetry) {
        fetchingRef.current.delete(userId);
        setTimeout(() => fetchUserData(userId, true), 1500);
        return;
      }
      setProfileLoadComplete(true);
    } finally {
      fetchingRef.current.delete(userId);
    }
  };

  // Load user's default branch and accessible branch IDs (single vs multi-branch: uses get_effective_user_branch when available)
  const loadUserBranch = async (
    userIds: { erpUserId: string; authUserId: string | null } | string,
    companyId: string,
    userRole?: string | null
  ) => {
    const erpId = typeof userIds === 'string' ? userIds : userIds.erpUserId;
    const authId = typeof userIds === 'string' ? null : userIds.authUserId;
    const lookupId = authId ?? erpId;
    try {
      const isAdmin = userRole === 'admin' || userRole === 'Admin';
      if (isAdmin) {
        setDefaultBranchId('all');
        setBranchId('all');
        setRequiresBranchSelection(false);
        const { data: companyBranches } = await supabase
          .from('branches')
          .select('id')
          .eq('company_id', companyId)
          .eq('is_active', true);
        const ids = (companyBranches || []).map((b: { id: string }) => b.id);
        setAccessibleBranchIds(ids);
        setBranchCount(ids.length);
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED] Admin: All Branches', { count: ids.length });
        return;
      }

      // Non-admin: use get_effective_user_branch (single-branch => auto that branch; multi => user_branches or null)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_effective_user_branch', { p_user_id: lookupId });
      const payload = rpcData as {
        effective_branch_id?: string | null;
        branch_count?: number;
        accessible_branch_ids?: string[] | { [key: string]: unknown }[];
        requires_branch_selection?: boolean;
      } | null;

      if (!rpcError && payload && typeof payload.branch_count === 'number') {
        const count = payload.branch_count;
        setBranchCount(count);
        const accessible = Array.isArray(payload.accessible_branch_ids)
          ? payload.accessible_branch_ids.map((x: unknown) => (typeof x === 'string' ? x : (x as { id?: string })?.id ?? String(x))).filter(Boolean)
          : [];
        setAccessibleBranchIds(accessible);
        setRequiresBranchSelection(Boolean(payload.requires_branch_selection));
        const effectiveId = payload.effective_branch_id ?? null;
        setDefaultBranchId(effectiveId);
        setBranchId(effectiveId);
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED] get_effective_user_branch', { count, effectiveId, requiresBranchSelection: payload.requires_branch_selection });
        return;
      }

      if (rpcError && import.meta.env?.DEV) console.warn('[BRANCH LOAD] get_effective_user_branch failed, using fallback:', rpcError.message);

      // Fallback: manual user_branches + company branch (same as before)
      let query = supabase.from('user_branches').select('branch_id, is_default');
      if (authId && authId !== erpId) {
        query = query.or(`user_id.eq.${erpId},user_id.eq.${authId}`);
      } else {
        query = query.eq('user_id', erpId);
      }
      const { data: userBranches, error: branchError } = await query;

      if (userBranches && userBranches.length > 0) {
        const ids = userBranches.map((ub: { branch_id: string }) => ub.branch_id).filter(Boolean);
        setAccessibleBranchIds(ids);
        setBranchCount(ids.length);
        setRequiresBranchSelection(false);
        const defaultRow = userBranches.find((ub: any) => ub.is_default === true) || userBranches[0];
        const defaultId = defaultRow?.branch_id ?? ids[0];
        setDefaultBranchId(defaultId);
        setBranchId(defaultId);
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED] User branches (fallback)', { count: ids.length, defaultId });
        return;
      }

      const { data: companyBranchList, error: companyBranchError } = await supabase
        .from('branches')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true);

      const branchList = Array.isArray(companyBranchList) ? companyBranchList : companyBranchList ? [companyBranchList] : [];
      const singleBranch = branchList.length === 1 ? branchList[0] : null;
      const multiBranchFirst = branchList.length > 1 ? branchList[0] : null;

      setBranchCount(branchList.length);
      if (singleBranch && (singleBranch as { id?: string }).id) {
        const id = (singleBranch as { id: string }).id;
        setDefaultBranchId(id);
        setBranchId(id);
        setAccessibleBranchIds([id]);
        setRequiresBranchSelection(false);
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED] Single company branch (fallback):', id);
        return;
      }
      if (branchList.length > 1) {
        setAccessibleBranchIds(branchList.map((b: { id: string }) => b.id));
        setRequiresBranchSelection(true);
        setDefaultBranchId(null);
        setBranchId(null);
      } else {
        setRequiresBranchSelection(false);
        setDefaultBranchId(null);
        setBranchId(null);
        setAccessibleBranchIds([]);
      }
      if (import.meta.env?.DEV) console.warn('[BRANCH LOAD] No branches or multi-branch no mapping', { companyBranchError: companyBranchError?.message });
    } catch (error) {
      console.error('[LOAD BRANCH ERROR]', error);
      setDefaultBranchId(null);
      setBranchId(null);
      setAccessibleBranchIds([]);
      setBranchCount(0);
      setRequiresBranchSelection(false);
    }
  };

  // Removed createUserEntry - users must register business first via CreateBusinessForm

  // Sign in
  const signIn = async (email: string, password: string) => {
    if (import.meta.env?.DEV) console.log('[AUTH] Attempting sign in:', { email });
    
    const result = await supabase.auth.signInWithPassword({ email, password });
    
    if (result.error) {
      console.error('[AUTH ERROR] Sign in failed:', {
        status: result.error.status,
        message: result.error.message,
        name: result.error.name,
        email: email,
        timestamp: new Date().toISOString()
      });
    } else if (result.data?.user && import.meta.env?.DEV) {
      console.log('[AUTH SUCCESS] Sign in successful:', { userId: result.data.user.id, email: result.data.user.email });
    }
    
    return result;
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    permissionEngine.clear();
    branchService.clearBranchCache();
    setUser(null);
    setSession(null);
    setCompanyId(null);
    setUserRole(null);
    setBranchId(null);
    setDefaultBranchId(null);
    setAccessibleBranchIds([]);
    // Clear fetch tracking on sign out
    fetchingRef.current.clear();
    fetchedRef.current.clear();
    lastFetchedUserIdRef.current = null;
    setEnablePackingState(false);
  };

  // Load enable_packing when company is set
  useEffect(() => {
    if (companyId) loadEnablePacking(companyId);
    else setEnablePackingState(false);
  }, [companyId]);

  const contextValue = useMemo(() => ({
    user,
    session,
    loading,
    profileLoadComplete,
    signIn,
    signOut,
    companyId,
    userRole,
    branchId,
    defaultBranchId,
    setBranchId,
    accessibleBranchIds,
    setAccessibleBranchIds,
    branchCount,
    requiresBranchSelection,
    enablePacking,
    setEnablePacking,
    refreshEnablePacking,
    supabaseClient: supabase,
  }), [
    user, session, loading, profileLoadComplete, companyId, userRole, branchId, defaultBranchId,
    accessibleBranchIds, branchCount, requiresBranchSelection, enablePacking,
    signIn, signOut, setBranchId, setAccessibleBranchIds, setEnablePacking, refreshEnablePacking,
  ]);

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
};

/** Safe default when outside provider (e.g. ErrorBoundary re-mount or Strict Mode). Avoids crash; consumer sees loading/no-user. */
const defaultSupabaseContext: SupabaseContextType = {
  user: null,
  session: null,
  loading: true,
  profileLoadComplete: false,
  signIn: async () => {},
  signOut: async () => {},
  companyId: null,
  userRole: null,
  branchId: null,
  defaultBranchId: null,
  setBranchId: () => {},
  accessibleBranchIds: [],
  setAccessibleBranchIds: () => {},
  branchCount: 0,
  requiresBranchSelection: false,
  enablePacking: false,
  setEnablePacking: async () => {},
  refreshEnablePacking: async () => {},
  supabaseClient: supabase,
};

export const useSupabase = (): SupabaseContextType => {
  const context = useContext(SupabaseContext);
  if (!context) {
    if (import.meta.env?.DEV) {
      console.warn('[useSupabase] Called outside SupabaseProvider; using safe default (loading=true).');
    }
    return defaultSupabaseContext;
  }
  return context;
};
