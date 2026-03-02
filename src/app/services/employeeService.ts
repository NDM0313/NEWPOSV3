import { supabase } from '@/lib/supabase';

export interface Employee {
  id: string;
  user_id: string;
  basic_salary: number;
  commission_rate: number;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  user?: {
    full_name?: string;
    name?: string;
    email?: string;
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
  created_by?: string;
}

export const employeeService = {
  async getAvailableUsers(companyId: string) {
    try {
      // 1. Get all users for the company
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('company_id', companyId);

      if (usersError) throw usersError;
      if (!users) return [];

      // 2. Get users who are already employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('user_id');

      if (empError) throw empError;

      const employeeUserIds = new Set((employees || []).map(e => e.user_id));

      // 3. Filter out users who are already employees
      return users.filter(u => !employeeUserIds.has(u.id));
    } catch (error) {
      console.error('Error in getAvailableUsers:', error);
      return [];
    }
  },

  async updateEmployee(employeeId: string, updates: { basic_salary?: number; commission_rate?: number; is_active?: boolean }) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', employeeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error in updateEmployee:', error);
      return null;
    }
  },

  async createEmployee(userId: string, basicSalary: number, commissionRate: number, createdBy?: string) {
    try {
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

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error in createEmployee:', error);
      return null;
    }
  },

  async getEmployeeByUser(userId: string) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, user:users(full_name, email)')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error in getEmployeeByUser:', error);
      return null;
    }
  },

  async getAllEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, user:users(full_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error in getAllEmployees:', error);
      return [];
    }
  },

  async addLedgerEntry(employeeId: string, type: EmployeeLedgerEntry['type'], amount: number, description: string, referenceId?: string, createdBy?: string) {
    try {
      const { data, error } = await supabase
        .from('employee_ledger')
        .insert({
          employee_id: employeeId,
          type,
          amount,
          description,
          reference_id: referenceId,
          created_by: createdBy
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error in addLedgerEntry:', error);
      return null;
    }
  },

  async getEmployeeLedger(employeeId: string) {
    try {
      const { data, error } = await supabase
        .from('employee_ledger')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error in getEmployeeLedger:', error);
      return [];
    }
  },

  async getEmployeeBalance(employeeId: string) {
    try {
      const { data, error } = await supabase
        .from('employee_ledger')
        .select('amount, type')
        .eq('employee_id', employeeId);

      if (error) throw error;

      const balance = (data || []).reduce((acc, entry) => {
        // Earnings increase balance (positive), Payments decrease balance (negative)
        if (['salary', 'bonus', 'commission'].includes(entry.type)) {
          return acc + Number(entry.amount);
        } else if (entry.type === 'payment') {
          return acc - Number(entry.amount);
        } else if (entry.type === 'adjustment') {
          return acc + Number(entry.amount); // Adjustment can be positive or negative
        }
        return acc;
      }, 0);

      return balance;
    } catch (error) {
      console.error('Error in getEmployeeBalance:', error);
      return 0;
    }
  },

  async payEmployee(employeeId: string, amount: number, description: string, createdBy?: string) {
    return this.addLedgerEntry(employeeId, 'payment', amount, description, undefined, createdBy);
  },

  async runMonthlySalaryCredit(companyId: string, createdBy?: string) {
    try {
      // 1. Get all active employees
      const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      if (!employees || employees.length === 0) return { success: true, message: 'No active employees found' };

      const results = [];
      const monthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

      for (const emp of employees) {
        if (Number(emp.basic_salary) > 0) {
          const entry = await this.addLedgerEntry(
            emp.id,
            'salary',
            Number(emp.basic_salary),
            `Monthly Salary Credit - ${monthYear}`,
            undefined,
            createdBy
          );
          results.push(entry);
        }
      }

      return { success: true, processed: results.length };
    } catch (error) {
      console.error('Error in runMonthlySalaryCredit:', error);
      return { success: false, error };
    }
  }
};
