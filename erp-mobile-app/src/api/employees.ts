import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Employee {
  id: string;
  user_id: string;
  basic_salary: number;
  commission_rate: number;
  is_active: boolean;
  created_at: string;
  user?: {
    full_name?: string;
    name?: string;
    email: string;
    role?: string;
  };
}

export interface EmployeeLedgerEntry {
  id: string;
  employee_id: string;
  type: 'salary' | 'bonus' | 'commission' | 'payment' | 'adjustment';
  amount: number;
  reference_id?: string;
  description?: string;
  created_at: string;
}

export async function getEmployees(companyId: string): Promise<{ data: Employee[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  
  // Join employees with users to filter by company_id
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      user:users!inner(full_name, email, role, company_id)
    `)
    .eq('user.company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function getEmployeeLedger(employeeId: string): Promise<{ data: EmployeeLedgerEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from('employee_ledger')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function getEmployeeBalance(employeeId: string): Promise<{ balance: number; error: string | null }> {
  const { data, error } = await supabase
    .from('employee_ledger')
    .select('type, amount')
    .eq('employee_id', employeeId);

  if (error) return { balance: 0, error: error.message };

  const balance = (data || []).reduce((acc, entry) => {
    if (['salary', 'bonus', 'commission', 'adjustment'].includes(entry.type)) {
      return acc + Number(entry.amount);
    } else if (entry.type === 'payment') {
      return acc - Number(entry.amount);
    }
    return acc;
  }, 0);

  return { balance, error: null };
}

export async function addLedgerEntry(
  employeeId: string, 
  type: EmployeeLedgerEntry['type'], 
  amount: number, 
  description: string,
  createdBy?: string,
  referenceId?: string
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase
    .from('employee_ledger')
    .insert({
      employee_id: employeeId,
      type,
      amount,
      description,
      created_by: createdBy,
      reference_id: referenceId
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function getAvailableUsers(companyId: string): Promise<{ data: any[]; error: string | null }> {
  // Get users in the company
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('company_id', companyId);

  if (usersError) return { data: [], error: usersError.message };
  if (!users) return { data: [], error: null };

  // Get users who are already employees
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('user_id');

  if (empError) return { data: [], error: empError.message };

  const employeeUserIds = new Set((employees || []).map(e => e.user_id));

  // Filter out users who are already employees
  const availableUsers = users.filter(u => !employeeUserIds.has(u.id));

  return { data: availableUsers, error: null };
}

export async function payEmployee(
  employeeId: string, 
  amount: number, 
  description: string,
  createdBy?: string
): Promise<{ data: any; error: string | null }> {
  return addLedgerEntry(employeeId, 'payment', amount, description, createdBy);
}

export async function addBonus(
  employeeId: string, 
  amount: number, 
  description: string,
  createdBy?: string
): Promise<{ data: any; error: string | null }> {
  return addLedgerEntry(employeeId, 'bonus', amount, description, createdBy);
}

export async function updateEmployee(
  employeeId: string, 
  updates: { basic_salary?: number; commission_rate?: number; is_active?: boolean }
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', employeeId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function updateUserRole(
  userId: string,
  role: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId);
  
  return { error: error ? error.message : null };
}

export async function getUserBranches(
  userId: string
): Promise<{ data: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from('user_branches')
    .select('branch_id')
    .eq('user_id', userId);
  
  if (error) return { data: [], error: error.message };
  return { data: (data || []).map(d => d.branch_id), error: null };
}

export async function updateUserBranches(
  userId: string,
  branchIds: string[],
  companyId: string
): Promise<{ error: string | null }> {
  // Delete existing
  const { error: delError } = await supabase
    .from('user_branches')
    .delete()
    .eq('user_id', userId);
  
  if (delError) return { error: delError.message };

  if (branchIds.length === 0) return { error: null };

  // Insert new
  const { error: insError } = await supabase
    .from('user_branches')
    .insert(branchIds.map(branchId => ({
      user_id: userId,
      branch_id: branchId,
      company_id: companyId
    })));
  
  return { error: insError ? insError.message : null };
}

export async function createEmployee(
  userId: string, 
  basicSalary: number, 
  commissionRate: number,
  createdBy?: string
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase
    .from('employees')
    .insert({
      user_id: userId,
      basic_salary: basicSalary,
      commission_rate: commissionRate,
      created_by: createdBy,
      is_active: true
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
