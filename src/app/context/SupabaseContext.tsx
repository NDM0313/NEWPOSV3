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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      if (newUser) {
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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[FETCH USER DATA] Attempting to fetch user data:', { userId });
      }
      
      const { data, error } = await supabase
        .from('users')
        .select('company_id, role, is_active')
        .eq('id', userId)
        .maybeSingle();

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

      if (import.meta.env?.DEV) console.log('[FETCH USER DATA SUCCESS]', { companyId: data.company_id, role: data.role });
      setCompanyId(data.company_id);
      setUserRole(data.role);
      fetchedRef.current.add(userId);
      lastFetchedUserIdRef.current = userId;

      if (data.company_id) {
        import('@/app/services/defaultAccountsService').then(({ defaultAccountsService }) => {
          defaultAccountsService.ensureDefaultAccounts(data.company_id).catch((error: any) => {
            console.error('[SUPABASE CONTEXT] Error ensuring default accounts:', error);
          });
        });
        loadUserBranch(userId, data.company_id, data.role);
      }
    } catch (error) {
      console.error('[FETCH USER DATA EXCEPTION]', error);
    } finally {
      fetchingRef.current.delete(userId);
    }
  };

  // Load user's default branch (admin → All Branches; normal user → assigned/first branch)
  const loadUserBranch = async (userId: string, companyId: string, userRole?: string | null) => {
    try {
      const isAdmin = userRole === 'admin' || userRole === 'Admin';
      if (isAdmin) {
        setDefaultBranchId('all');
        setBranchId('all');
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED] Admin: All Branches');
        return;
      }

      // First, try to get user's default branch (table may not exist)
      const { data: userBranch, error: branchError } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      if (userBranch && !branchError) {
        setDefaultBranchId(userBranch.branch_id);
        setBranchId(userBranch.branch_id);
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED]', { branchId: userBranch.branch_id });
        return;
      }

      if (branchError && (branchError.code === 'PGRST301' || branchError.code === 'PGRST116' || branchError.status === 404 || branchError.status === 406)) {
        // Table doesn't exist - continue to company branch
      } else if (branchError) {
        console.warn('[BRANCH LOAD] Unexpected error (non-blocking):', branchError);
      }

      const { data: companyBranch, error: companyBranchError } = await supabase
        .from('branches')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (companyBranch && !companyBranchError) {
        setDefaultBranchId(companyBranch.id);
        setBranchId(companyBranch.id);
        if (import.meta.env?.DEV) console.log('[BRANCH LOADED] Default company branch:', companyBranch.id);
      } else {
        setDefaultBranchId(null);
        setBranchId(null);
      }
    } catch (error) {
      console.error('[LOAD BRANCH ERROR]', error);
      setDefaultBranchId(null);
      setBranchId(null);
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
