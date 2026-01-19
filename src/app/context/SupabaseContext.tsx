import React, { createContext, useContext, useEffect, useState } from 'react';
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
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setCompanyId(null);
        setUserRole(null);
        setBranchId(null);
        setDefaultBranchId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user data (company, role)
  const fetchUserData = async (userId: string) => {
    try {
      console.log('[FETCH USER DATA] Attempting to fetch user data:', { userId });
      
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
        
        // If user doesn't exist in public.users, create entry
        if (error.code === 'PGRST116' || error.message.includes('No rows')) {
          console.warn('[FETCH USER DATA] User not found in public.users, attempting to create entry');
          await createUserEntry(userId);
          return;
        }
        
        // RLS policy violation - user might not have entry in public.users
        if (error.code === '42501' || error.message.includes('permission denied') || error.status === 400) {
          console.warn('[FETCH USER DATA] RLS policy violation - user entry missing in public.users');
          await createUserEntry(userId);
          return;
        }
      } else if (data) {
        console.log('[FETCH USER DATA SUCCESS]', {
          userId: userId,
          companyId: data.company_id,
          role: data.role,
          isActive: data.is_active
        });
        setCompanyId(data.company_id);
        setUserRole(data.role);
        
        // Load user's default branch
        if (data.company_id) {
          loadUserBranch(userId, data.company_id);
        }
      }
    } catch (error) {
      console.error('[FETCH USER DATA EXCEPTION]', error);
    }
  };

  // Load user's default branch
  const loadUserBranch = async (userId: string, companyId: string) => {
    try {
      // First, try to get user's default branch (table may not exist)
      const { data: userBranch, error: branchError } = await supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      // If table doesn't exist (406 error) or no data, skip to company branch
      if (userBranch && !branchError) {
        setDefaultBranchId(userBranch.branch_id);
        setBranchId(userBranch.branch_id);
        console.log('[BRANCH LOADED]', { branchId: userBranch.branch_id });
        return;
      }
      
      // If error is 406 (Not Acceptable), table doesn't exist - skip to company branch
      if (branchError && branchError.code === 'PGRST301') {
        // Table doesn't exist, continue to company branch lookup
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
        // Fallback to default branch ID
        const fallbackBranchId = '00000000-0000-0000-0000-000000000011';
        setDefaultBranchId(fallbackBranchId);
        setBranchId(fallbackBranchId);
        console.log('[BRANCH LOADED] Using fallback branch ID');
      }
    } catch (error) {
      console.error('[LOAD BRANCH ERROR]', error);
      // Fallback to default branch ID
      const fallbackBranchId = '00000000-0000-0000-0000-000000000011';
      setDefaultBranchId(fallbackBranchId);
      setBranchId(fallbackBranchId);
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
