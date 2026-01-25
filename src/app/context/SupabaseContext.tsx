import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

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
        .single();

      if (error) {
        console.error('[FETCH USER DATA ERROR]', {
          error: error,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId: userId
        });
        
        // If user doesn't exist in public.users, log warning and clear state
        if (error.code === 'PGRST116' || error.message.includes('No rows')) {
          console.warn('[FETCH USER DATA] User not found in public.users. User must create a business first.');
          setCompanyId(null);
          setUserRole(null);
          setBranchId(null);
          setDefaultBranchId(null);
          return;
        }
        
        // RLS policy violation or other errors - clear state
        if (error.code === '42501' || error.message.includes('permission denied') || error.status === 400 || error.code === 'PGRST301') {
          console.warn('[FETCH USER DATA] Error fetching user data. User may need to create a business first.');
          setCompanyId(null);
          setUserRole(null);
          setBranchId(null);
          setDefaultBranchId(null);
          return;
        }
      } else if (data) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[FETCH USER DATA SUCCESS]', {
            userId: userId,
            companyId: data.company_id,
            role: data.role,
            isActive: data.is_active
          });
        }
        setCompanyId(data.company_id);
        setUserRole(data.role);
        fetchedRef.current.add(userId);
        lastFetchedUserIdRef.current = userId;
        
        // CRITICAL: Ensure default accounts exist for this company
        if (data.company_id) {
          // Initialize default accounts asynchronously (don't block login)
          import('@/app/services/defaultAccountsService').then(({ defaultAccountsService }) => {
            defaultAccountsService.ensureDefaultAccounts(data.company_id).catch((error: any) => {
              console.error('[SUPABASE CONTEXT] Error ensuring default accounts:', error);
            });
          });
          
          // Load user's default branch
          loadUserBranch(userId, data.company_id);
        }
      }
    } catch (error) {
      console.error('[FETCH USER DATA EXCEPTION]', error);
    } finally {
      fetchingRef.current.delete(userId);
    }
  };

  // Load user's default branch
  const loadUserBranch = async (userId: string, companyId: string) => {
    try {
      // First, try to get user's default branch (table may not exist)
      // Suppress 404 errors as this table is optional
      const { data: userBranch, error: branchError } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      // If table doesn't exist (404/406 error) or no data, skip to company branch
      if (userBranch && !branchError) {
        setDefaultBranchId(userBranch.branch_id);
        setBranchId(userBranch.branch_id);
        console.log('[BRANCH LOADED]', { branchId: userBranch.branch_id });
        return;
      }
      
      // If error is 404 (Not Found) or 406 (Not Acceptable), table doesn't exist - skip silently
      // Don't log these errors as they're expected when table doesn't exist
      if (branchError && (branchError.code === 'PGRST301' || branchError.code === 'PGRST116' || branchError.status === 404 || branchError.status === 406)) {
        // Table doesn't exist, continue to company branch lookup (silent)
        // This is expected behavior - user_branches is optional
      } else if (branchError) {
        // Only log unexpected errors
        console.warn('[BRANCH LOAD] Unexpected error (non-blocking):', branchError);
      }

      // If no default branch, get first branch for company
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
        console.log('[BRANCH LOADED] Default company branch:', companyBranch.id);
      } else {
        // No branch found - don't set fallback, let user create branch
        console.warn('[BRANCH LOADED] No branch found for company. User should create a branch.');
        setDefaultBranchId(null);
        setBranchId(null);
      }
    } catch (error) {
      console.error('[LOAD BRANCH ERROR]', error);
      // Don't use fallback - let user create branch
      setDefaultBranchId(null);
      setBranchId(null);
    }
  };

  // Removed createUserEntry - users must register business first via CreateBusinessForm

  // Sign in
  const signIn = async (email: string, password: string) => {
    console.log('[AUTH] Attempting sign in:', { email, timestamp: new Date().toISOString() });
    
    const result = await supabase.auth.signInWithPassword({ email, password });
    
    if (result.error) {
      console.error('[AUTH ERROR] Sign in failed:', {
        status: result.error.status,
        message: result.error.message,
        name: result.error.name,
        email: email,
        timestamp: new Date().toISOString()
      });
    } else if (result.data?.user) {
      console.log('[AUTH SUCCESS] Sign in successful:', {
        userId: result.data.user.id,
        email: result.data.user.email,
        emailConfirmed: !!result.data.user.email_confirmed_at,
        sessionExists: !!result.data.session,
        timestamp: new Date().toISOString()
      });
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
  };

  return (
    <SupabaseContext.Provider
      value={{ user, session, loading, signIn, signOut, companyId, userRole, branchId, defaultBranchId, setBranchId, supabaseClient: supabase }}
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
