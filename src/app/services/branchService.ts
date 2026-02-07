import { supabase } from '@/lib/supabase';
import { settingsService } from './settingsService';

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  code?: string; // Human-readable code: BR-001, BR-002, etc.
  branch_code?: string; // Alias for code (for UI consistency)
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const branchService = {
  // Get all branches for a company
  async getAllBranches(companyId: string) {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data;
  },

  // Get single branch
  async getBranch(id: string) {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Generate next branch code
  async generateBranchCode(companyId: string): Promise<string> {
    try {
      // Try to use document sequence
      return await settingsService.getNextDocumentNumber(companyId, undefined, 'branch');
    } catch (error) {
      // Fallback: Get max code and increment
      const { data: branches } = await supabase
        .from('branches')
        .select('code')
        .eq('company_id', companyId)
        .not('code', 'is', null)
        .order('code', { ascending: false })
        .limit(1);

      if (branches && branches.length > 0 && branches[0].code) {
        const lastCode = branches[0].code;
        const match = lastCode.match(/BR-(\d+)/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          return `BR-${String(nextNum).padStart(3, '0')}`;
        }
      }
      
      // Default: start from BR-001
      return 'BR-001';
    }
  },

  // Create branch
  async createBranch(branch: Partial<Branch>) {
    console.log('[BRANCH SERVICE] Creating branch with payload:', JSON.stringify(branch, null, 2));
    
    try {
      // Auto-generate code if not provided
      if (!branch.code && branch.company_id) {
        branch.code = await this.generateBranchCode(branch.company_id);
        console.log('[BRANCH SERVICE] Auto-generated branch code:', branch.code);
      }

      const { data, error } = await supabase
        .from('branches')
        .insert(branch)
        .select()
        .single();

      if (error) {
        console.error('[BRANCH SERVICE] Error creating branch:', error);
        throw error;
      }
      
      // CRITICAL: Create default accounts for new branch (Cash, Bank, Other)
      if (data && data.company_id) {
        try {
          const { defaultAccountsService } = await import('@/app/services/defaultAccountsService');
          await defaultAccountsService.ensureDefaultAccounts(data.company_id);
          console.log('[BRANCH SERVICE] ✅ Default accounts ensured for branch:', data.id);
        } catch (accountError) {
          console.warn('[BRANCH SERVICE] Warning: Could not create default accounts:', accountError);
          // Don't block branch creation if account creation fails
        }
      }
      
      console.log('[BRANCH SERVICE] Branch created successfully:', data);
      return data;
    } catch (error: any) {
      console.error('[BRANCH SERVICE] Exception creating branch:', error);
      throw error;
    }
  },

  // Update branch
  async updateBranch(id: string, updates: Partial<Branch>) {
    console.log('[BRANCH SERVICE] Updating branch:', id, 'with payload:', JSON.stringify(updates, null, 2));
    
    try {
      const { data, error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[BRANCH SERVICE] Error updating branch:', error);
        throw error;
      }
      
      console.log('[BRANCH SERVICE] Branch updated successfully:', data);
      return data;
    } catch (error: any) {
      console.error('[BRANCH SERVICE] Exception updating branch:', error);
      throw error;
    }
  },

  // Delete branch (soft delete)
  async deleteBranch(id: string) {
    const { error } = await supabase
      .from('branches')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};
