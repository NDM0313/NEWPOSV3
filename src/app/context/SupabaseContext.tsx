import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { settingsService } from '@/app/services/settingsService';

interface SupabaseContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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
  const [enablePacking, setEnablePackingState] = useState<boolean>(false);

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

  // Initialize user session
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && import.meta.env?.DEV) {
        const { data: authData } = await supabase.auth.getUser();
        console.log('[AUTH] AUTH USER (after getSession):', {
          user_id: authData?.user?.id,
          email: authData?.user?.email,
          has_session: !!session,
          auth_uid: authData?.user?.id,
        });
      }
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
        // Clear fetch tracking on sign out
        fetchingRef.current.clear();
        fetchedRef.current.clear();
        lastFetchedUserIdRef.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user data (company, role)
  const fetchUserData = async (userId: string) => {
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
      return;
    }
    
    try {
      fetchingRef.current.add(userId);
      
      if (import.meta.env?.DEV) {
        console.log('[FETCH USER DATA] Looking for ERP profile with auth_user_id or id:', userId);
        console.log('[FETCH USER DATA] Query: users WHERE id.eq.' + userId + ' OR auth_user_id.eq.' + userId);
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, company_id, role, is_active')
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
          return;
        }
        console.error('[FETCH USER DATA ERROR]', { message: error.message, code: error.code, userId });
        return;
      }

      if (!data) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[FETCH USER DATA] User not found in public.users. User must create a business first.');
        }
        setCompanyId(null);
        setUserRole(null);
        setBranchId(null);
        setDefaultBranchId(null);
        return;
      }

      if (data.is_active === false) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[FETCH USER DATA] User account is inactive. Blocking access.');
        }
        await supabase.auth.signOut();
        setCompanyId(null);
        setUserRole(null);
        setBranchId(null);
        setDefaultBranchId(null);
        return;
      }

      if (import.meta.env?.DEV) console.log('[FETCH USER DATA SUCCESS]', { companyId: data.company_id, role: data.role });
      setCompanyId(data.company_id);
      setUserRole(data.role);
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
        loadUserBranch(erpUserId, data.company_id, data.role);
      }
    } catch (error) {
      console.error('[FETCH USER DATA EXCEPTION]', error);
    } finally {
      fetchingRef.current.delete(userId);
    }
  };

  // Load user's default branch and accessible branch IDs (for smart branch selector)
  const loadUserBranch = async (userId: string, companyId: string, userRole?: string | null) => {
    try {
      const isAdmin = userRole === 'admin' || userRole === 'Admin';
      if (isAdmin) {
        setDefaultBranchId('all');
        setBranchId('all');
        const { data: companyBranches } = await supabase
          .from('branches')
          .select('id')
          .eq('company_id', companyId)
          .eq('is_active', true);
        setAccessibleBranchIds((companyBranches || []).map((b: { id: string }) => b.id));
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED] Admin: All Branches', { count: (companyBranches || []).length });
        return;
      }

      // Non-admin: get branches from user_branches (user_id = public.users.id for this user)
      const { data: userBranches, error: branchError } = await supabase
        .from('user_branches')
        .select('branch_id, is_default')
        .eq('user_id', userId);

      if (import.meta.env?.DEV) {
        console.log('[BRANCH LOAD] Non-admin', {
          erpUserId: userId,
          userBranchesCount: userBranches?.length ?? 0,
          branchError: branchError ? { code: branchError.code, message: branchError.message } : null,
        });
      }

      if (userBranches && userBranches.length > 0) {
        const ids = userBranches.map((ub: { branch_id: string }) => ub.branch_id).filter(Boolean);
        setAccessibleBranchIds(ids);
        const defaultRow = userBranches.find((ub: any) => ub.is_default === true) || userBranches[0];
        const defaultId = defaultRow?.branch_id ?? ids[0];
        setDefaultBranchId(defaultId);
        setBranchId(defaultId);
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED] User branches', { count: ids.length, defaultId });
        return;
      }

      if (branchError && (branchError.code === 'PGRST301' || branchError.code === 'PGRST116' || branchError.status === 404 || branchError.status === 406)) {
        // Table doesn't exist - fall back to first company branch
      } else if (branchError) {
        console.warn('[BRANCH LOAD] Unexpected error (non-blocking):', branchError);
      }

      // Fallback: single company branch (e.g. no user_branches table or user not assigned)
      const { data: companyBranch, error: companyBranchError } = await supabase
        .from('branches')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (companyBranch && !companyBranchError) {
        setDefaultBranchId(companyBranch.id);
        setBranchId(companyBranch.id);
        setAccessibleBranchIds([companyBranch.id]);
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED] Default company branch:', companyBranch.id);
      } else {
        if (import.meta.env?.DEV) console.warn('[BRANCH LOAD] No branches for non-admin', { companyBranchError: companyBranchError?.message });
        setDefaultBranchId(null);
        setBranchId(null);
        setAccessibleBranchIds([]);
      }
    } catch (error) {
      console.error('[LOAD BRANCH ERROR]', error);
      setDefaultBranchId(null);
      setBranchId(null);
      setAccessibleBranchIds([]);
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

  return (
    <SupabaseContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signOut,
        companyId,
        userRole,
        branchId,
        defaultBranchId,
        setBranchId,
        accessibleBranchIds,
        setAccessibleBranchIds,
        enablePacking,
        setEnablePacking,
        refreshEnablePacking,
        supabaseClient: supabase,
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider');
  }
  return context;
};
