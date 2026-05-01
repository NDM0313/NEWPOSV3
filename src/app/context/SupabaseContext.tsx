import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { settingsService } from '@/app/services/settingsService';
import { permissionEngine } from '@/app/services/permissionEngine';
import { branchService } from '@/app/services/branchService';

/** True when Supabase returned 502/503/504 and retries are exhausted; show "Service temporarily unavailable" and offer retry. */
const CONNECTION_ERROR_MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

function isServerError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message ?? err ?? '');
  const code = err?.code ?? err?.status;
  const name = err?.name ?? '';
  return (
    name === 'AuthRetryableFetchError' ||
    code === 502 || code === 503 || code === 504 ||
    msg.includes('502') || msg.includes('503') || msg.includes('504') ||
    msg.includes('Bad Gateway') || msg.includes('Service Unavailable') || msg.includes('Gateway Timeout')
  );
}

function isAbortError(err: any): boolean {
  return err?.name === 'AbortError' || String(err?.message ?? '').toLowerCase().includes('aborted');
}

/** SecurityError / request denied (storage blocked, CORS, or opaque response) – retry like server errors, never sign out. */
function isStorageOrSecurityError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message ?? err ?? '').toLowerCase();
  const name = String(err?.name ?? '').toLowerCase();
  return (
    name === 'securityerror' ||
    msg.includes('securityerror') ||
    msg.includes('request was denied') ||
    msg.includes('access is denied') ||
    msg.includes('the request was denied')
  );
}

interface SupabaseContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True once we've finished the first profile fetch for the current user (success, no row, or error). Use to avoid showing "no business" while still loading or after a transient error. */
  profileLoadComplete: boolean;
  /** True when Supabase returned 502/5xx and retries exhausted; UI can show "Service temporarily unavailable" and retry button. */
  connectionError: boolean;
  /** Call after connectionError to retry loading profile (getSession + fetchUserData). */
  retryConnection: () => void;
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
  const [connectionError, setConnectionError] = useState<boolean>(false);

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
  const lastProfileRequestAtRef = useRef<Map<string, number>>(new Map());
  /** Production: ignore logout (session=null) for this many ms after sign-in – GoTrue can emit SIGNED_OUT on SecurityError. */
  /** Log storage/security retry only once per userId to avoid 15–20 console messages. */
  const storageErrorLoggedRef = useRef<Set<string>>(new Set());

  const requestUserProfileLoad = (userId: string) => {
    const now = Date.now();
    const lastAt = lastProfileRequestAtRef.current.get(userId) ?? 0;
    if (now - lastAt < 1500) return;
    lastProfileRequestAtRef.current.set(userId, now);
    fetchUserData(userId, false, 0);
  };

  // Initialize user session. Retry getSession on 502/5xx so transient gateway errors don't immediately show login.
  const attemptSessionLoad = async (attempt = 0): Promise<void> => {
    setConnectionError(false);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error && isServerError(error)) {
        if (attempt < CONNECTION_ERROR_MAX_RETRIES) {
          if (import.meta.env?.DEV) console.warn('[AUTH] getSession 5xx, retrying in', RETRY_DELAY_MS, 'ms', { attempt: attempt + 1 });
          setTimeout(() => attemptSessionLoad(attempt + 1), RETRY_DELAY_MS);
          return;
        }
        setConnectionError(true);
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && import.meta.env?.DEV) {
        console.log('[AUTH] AUTH USER (after getSession):', {
          user_id: session.user.id,
          email: session.user.email,
          has_session: !!session,
        });
      }
      if (session?.user) {
        requestUserProfileLoad(session.user.id);
      }
      setLoading(false);
    } catch (e: any) {
      if (isAbortError(e)) {
        setLoading(false);
        return;
      }
      const storageErr = isStorageOrSecurityError(e);
      if (storageErr && attempt < CONNECTION_ERROR_MAX_RETRIES) {
        console.warn('[AUTH] getSession threw storage/security error, retrying in', RETRY_DELAY_MS, 'ms', { attempt: attempt + 1 });
        setTimeout(() => attemptSessionLoad(attempt + 1), RETRY_DELAY_MS);
        return;
      }
      if (storageErr) setConnectionError(true);
      if (isServerError(e) && attempt < CONNECTION_ERROR_MAX_RETRIES) {
        if (import.meta.env?.DEV) console.warn('[AUTH] getSession threw 5xx, retrying in', RETRY_DELAY_MS, 'ms', { attempt: attempt + 1 });
        setTimeout(() => attemptSessionLoad(attempt + 1), RETRY_DELAY_MS);
        return;
      }
      if (isServerError(e)) setConnectionError(true);
      // Do NOT clear session/user when getSession() throws (e.g. SecurityError). Only signOut() should clear.
      setLoading(false);
    }
  };

  useEffect(() => {
    attemptSessionLoad();

    // Listen for auth changes (guard against thrown errors in listener)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
      const newUser = session?.user ?? null;

      // PRODUCTION: Never clear session in the listener. GoTrue emits session=null/SIGNED_OUT on SecurityError
      // and breaks production login. Only our signOut() (user clicked Sign Out) should clear state.
      if (!newUser) {
        try {
          const { data: { session: current } } = await supabase.auth.getSession();
          if (current?.user) {
            setSession(current);
            setUser(current.user);
            requestUserProfileLoad(current.user.id);
            return;
          }
        } catch {
          // getSession threw – keep existing session
        }
        setConnectionError(true);
        return;
      }

      setSession(session);
      setUser(newUser);

      if (newUser) {
        if (event === 'SIGNED_IN') {
          if (import.meta.env?.DEV) {
            console.log('[AUTH] SIGNED_IN - auth user:', { id: newUser.id, email: newUser.email });
          }
          supabase.from('users').update({ last_login_at: new Date().toISOString() }).or(`id.eq.${newUser.id},auth_user_id.eq.${newUser.id}`).then(() => {});
        }
        // Clear cache if user changed
        if (lastFetchedUserIdRef.current !== null && lastFetchedUserIdRef.current !== newUser.id) {
          fetchingRef.current.clear();
          fetchedRef.current.clear();
        }
        requestUserProfileLoad(newUser.id);
      }
      } catch {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user data (company, role). Retries on transient/502 errors so we don't show "no business" on a single gateway blip.
  const fetchUserData = async (userId: string, isRetry = false, retryCount = 0) => {
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
      setConnectionError(false);
      
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
        const errDiag = error
          ? {
              code: error.code,
              message: error.message,
              details: (error as { details?: string }).details,
              hint: (error as { hint?: string }).hint,
            }
          : null;
        console.log('[FETCH USER DATA] Result:', { data, error: errDiag });
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
        // 502/503/504 or SecurityError/request denied: retry with backoff; NEVER sign out on these
        const serverErr = isServerError(error);
        const storageErr = isStorageOrSecurityError(error);
        if ((serverErr || storageErr) && retryCount < CONNECTION_ERROR_MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * (retryCount + 1);
          if (!storageErrorLoggedRef.current.has(userId)) {
            storageErrorLoggedRef.current.add(userId);
            console.warn('[FETCH USER DATA]', storageErr ? 'Storage/security error' : 'Server error', ', will retry up to', CONNECTION_ERROR_MAX_RETRIES, 'times');
          }
          fetchingRef.current.delete(userId);
          setTimeout(() => fetchUserData(userId, true, retryCount + 1), delay);
          return;
        }
        if ((serverErr || storageErr) && retryCount >= CONNECTION_ERROR_MAX_RETRIES) {
          setConnectionError(true);
        }
        // Other transient: single retry (existing behavior)
        if (!serverErr && !storageErr && !isRetry) {
          console.warn('[FETCH USER DATA] Transient error, retrying once in 1.5s:', {
            code: error.code,
            message: error.message,
            details: (error as { details?: string }).details,
            hint: (error as { hint?: string }).hint,
          });
          fetchingRef.current.delete(userId);
          setTimeout(() => fetchUserData(userId, true, 0), 1500);
          return;
        }
        console.error('[FETCH USER DATA ERROR]', {
          userId,
          code: error.code,
          message: error.message,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
        });
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
      // SecurityError / request denied: retry like server errors; NEVER sign out
      const storageErr = isStorageOrSecurityError(error);
      if (storageErr && retryCount < CONNECTION_ERROR_MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * (retryCount + 1);
        console.warn('[FETCH USER DATA] Exception (storage/security), retrying in', delay, 'ms');
        fetchingRef.current.delete(userId);
        setTimeout(() => fetchUserData(userId, true, retryCount + 1), delay);
        return;
      }
      if (storageErr && retryCount >= CONNECTION_ERROR_MAX_RETRIES) {
        setConnectionError(true);
      }
      if (!storageErr && !isRetry) {
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

  const retryConnection = () => {
    setConnectionError(false);
    setLoading(true);
    attemptSessionLoad(0);
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setConnectionError(false);
    setProfileLoadComplete(false);
    permissionEngine.clear();
    branchService.clearBranchCache();
    setUser(null);
    setSession(null);
    setCompanyId(null);
    setUserRole(null);
    setBranchId(null);
    setDefaultBranchId(null);
    setAccessibleBranchIds([]);
    fetchingRef.current.clear();
    fetchedRef.current.clear();
    lastFetchedUserIdRef.current = null;
    storageErrorLoggedRef.current.clear();
    setEnablePackingState(false);
  };

  // Load enable_packing when company is set; ensure explicit inventory_settings row (negative stock default false)
  useEffect(() => {
    if (companyId) {
      loadEnablePacking(companyId);
      settingsService.ensureDefaultInventorySettings(companyId).catch(() => {
        /* RLS or missing settings table — getAllowNegativeStock still defaults to false */
      });
      settingsService.ensureCompanyBootstrapDefaults(companyId).catch(() => {
        /* best-effort self-heal for partially seeded companies */
      });
    } else setEnablePackingState(false);
  }, [companyId]);

  const contextValue = useMemo(() => ({
    user,
    session,
    loading,
    profileLoadComplete,
    connectionError,
    retryConnection,
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
    user, session, loading, profileLoadComplete, connectionError, companyId, userRole, branchId, defaultBranchId,
    accessibleBranchIds, branchCount, requiresBranchSelection, enablePacking,
    signIn, signOut, retryConnection, setBranchId, setAccessibleBranchIds, setEnablePacking, refreshEnablePacking,
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
  connectionError: false,
  retryConnection: () => {},
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