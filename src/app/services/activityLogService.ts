/**
 * Activity Log Service
 * 
 * Provides functions to:
 * - Log activities (create, update, delete, payment, status_change)
 * - Query activity logs (by module, entity, user, date range)
 * - Format activity logs for display
 */

import { supabase } from '@/lib/supabase';

export interface ActivityLog {
  id: string;
  company_id: string;
  module: 'sale' | 'purchase' | 'inventory' | 'payment' | 'expense' | 'accounting' | 'contact' | 'product' | 'rental';
  entity_id: string;
  entity_reference?: string;
  action: string;
  field?: string;
  old_value?: any;
  new_value?: any;
  amount?: number;
  payment_method?: string;
  payment_account_id?: string;
  performed_by?: string;
  performed_by_name?: string;
  performed_by_email?: string;
  description?: string;
  notes?: string;
  created_at: string;
}

export interface ActivityLogFilters {
  companyId: string;
  module?: string;
  entityId?: string;
  entityReference?: string;
  action?: string;
  performedBy?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityLogSummary {
  total: number;
  byModule: Record<string, number>;
  byAction: Record<string, number>;
  byUser: Record<string, number>;
}

export const activityLogService = {
  /**
   * Log an activity
   */
  async logActivity(params: {
    companyId: string;
    module: ActivityLog['module'];
    entityId: string;
    entityReference?: string;
    action: string;
    field?: string;
    oldValue?: any;
    newValue?: any;
    amount?: number;
    paymentMethod?: string;
    paymentAccountId?: string;
    performedBy?: string;
    description?: string;
    notes?: string;
  }): Promise<ActivityLog | null> {
    try {
      const { data, error } = await supabase
        .rpc('log_activity', {
          p_company_id: params.companyId,
          p_module: params.module,
          p_entity_id: params.entityId,
          p_entity_reference: params.entityReference || null,
          p_action: params.action,
          p_field: params.field || null,
          p_old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
          p_new_value: params.newValue ? JSON.stringify(params.newValue) : null,
          p_amount: params.amount || null,
          p_payment_method: params.paymentMethod || null,
          p_payment_account_id: params.paymentAccountId || null,
          p_performed_by: params.performedBy || null,
          p_description: params.description || null,
          p_notes: params.notes || null,
        });

      if (error) {
        // If RPC function doesn't exist, insert directly
        if (error.code === '42883' || error.message?.includes('function')) {
          return await this.logActivityDirect(params);
        }
        throw error;
      }

      // Fetch the created log
      if (data) {
        return await this.getActivityLogById(data);
      }

      return null;
    } catch (error: any) {
      console.error('[ACTIVITY LOG SERVICE] Error logging activity:', error);
      // Fallback to direct insert
      return await this.logActivityDirect(params);
    }
  },

  /**
   * Direct insert (fallback if RPC function doesn't exist)
   */
  async logActivityDirect(params: {
    companyId: string;
    module: ActivityLog['module'];
    entityId: string;
    entityReference?: string;
    action: string;
    field?: string;
    oldValue?: any;
    newValue?: any;
    amount?: number;
    paymentMethod?: string;
    paymentAccountId?: string;
    performedBy?: string;
    description?: string;
    notes?: string;
  }): Promise<ActivityLog | null> {
    try {
      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      let userName: string | undefined;
      let userEmail: string | undefined;

      // Identity: performed_by must be auth.users.id. Resolve name via users.auth_user_id (or users.id for legacy).
      const authUserId = params.performedBy || user?.id || null;
      if (authUserId) {
        const { data: userData } = await supabase
          .from('users')
          .select('full_name, email')
          .or(`auth_user_id.eq.${authUserId},id.eq.${authUserId}`)
          .limit(1)
          .maybeSingle();

        if (userData) {
          userName = userData.full_name;
          userEmail = userData.email;
        }
      }

      const { data, error } = await supabase
        .from('activity_logs')
        .insert({
          company_id: params.companyId,
          module: params.module,
          entity_id: params.entityId,
          entity_reference: params.entityReference || null,
          action: params.action,
          field: params.field || null,
          old_value: params.oldValue ? params.oldValue : null,
          new_value: params.newValue ? params.newValue : null,
          amount: params.amount || null,
          payment_method: params.paymentMethod || null,
          payment_account_id: params.paymentAccountId || null,
          performed_by: authUserId,
          performed_by_name: userName || null,
          performed_by_email: userEmail || null,
          description: params.description || null,
          notes: params.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ActivityLog;
    } catch (error: any) {
      console.error('[ACTIVITY LOG SERVICE] Error in direct insert:', error);
      return null;
    }
  },

  /**
   * Get activity log by ID
   */
  async getActivityLogById(logId: string): Promise<ActivityLog | null> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('id', logId)
        .single();

      if (error) throw error;
      return data as ActivityLog;
    } catch (error: any) {
      console.error('[ACTIVITY LOG SERVICE] Error fetching activity log:', error);
      return null;
    }
  },

  /**
   * Get activity logs with filters
   */
  async getActivityLogs(filters: ActivityLogFilters): Promise<ActivityLog[]> {
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', filters.companyId)
        .order('created_at', { ascending: false });

      if (filters.module) {
        query = query.eq('module', filters.module);
      }

      if (filters.entityId) {
        query = query.eq('entity_id', filters.entityId);
      }

      if (filters.entityReference) {
        query = query.eq('entity_reference', filters.entityReference);
      }

      if (filters.action) {
        query = query.eq('action', filters.action);
      }

      if (filters.performedBy) {
        query = query.eq('performed_by', filters.performedBy);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ActivityLog[];
    } catch (error: any) {
      console.error('[ACTIVITY LOG SERVICE] Error fetching activity logs:', error);
      return [];
    }
  },

  /**
   * Get activity logs for a specific entity (sale, purchase, etc.)
   */
  async getEntityActivityLogs(
    companyId: string,
    module: ActivityLog['module'],
    entityId: string
  ): Promise<ActivityLog[]> {
    return this.getActivityLogs({
      companyId,
      module,
      entityId,
    });
  },

  /**
   * Format activity log for display
   */
  formatActivityLog(log: ActivityLog): string {
    const userName = log.performed_by_name || 'Unknown User';
    const timestamp = new Date(log.created_at).toLocaleString();
    
    switch (log.action) {
      case 'create':
        return `${userName} created ${log.module} ${log.entity_reference || log.entity_id} on ${timestamp}`;
      
      case 'update':
        if (log.field && log.old_value !== undefined && log.new_value !== undefined) {
          return `${userName} updated ${log.field} from ${log.old_value} to ${log.new_value} on ${timestamp}`;
        }
        return `${userName} updated ${log.module} ${log.entity_reference || log.entity_id} on ${timestamp}`;
      
      case 'status_change':
        return `${userName} changed status from ${log.old_value} to ${log.new_value} on ${timestamp}`;
      
      case 'payment_added':
        return `${userName} added payment of Rs ${log.amount?.toLocaleString()} via ${log.payment_method} on ${timestamp}`;
      
      case 'payment_deleted':
        return `${userName} deleted payment of Rs ${log.amount?.toLocaleString()} on ${timestamp}`;
      
      case 'delete':
        return `${userName} deleted ${log.module} ${log.entity_reference || log.entity_id} on ${timestamp}`;
      
      default:
        return log.description || `${userName} performed ${log.action} on ${timestamp}`;
    }
  },

  /**
   * Get activity summary (for admin dashboard)
   */
  async getActivitySummary(
    companyId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ActivityLogSummary> {
    try {
      const logs = await this.getActivityLogs({
        companyId,
        startDate,
        endDate,
        limit: 1000, // Get more for summary
      });

      const summary: ActivityLogSummary = {
        total: logs.length,
        byModule: {},
        byAction: {},
        byUser: {},
      };

      logs.forEach(log => {
        // Count by module
        summary.byModule[log.module] = (summary.byModule[log.module] || 0) + 1;
        
        // Count by action
        summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
        
        // Count by user
        const userKey = log.performed_by_name || 'Unknown';
        summary.byUser[userKey] = (summary.byUser[userKey] || 0) + 1;
      });

      return summary;
    } catch (error: any) {
      console.error('[ACTIVITY LOG SERVICE] Error getting summary:', error);
      return {
        total: 0,
        byModule: {},
        byAction: {},
        byUser: {},
      };
    }
  },
};
