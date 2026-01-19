import { supabase } from '@/lib/supabase';

export interface JournalEntry {
  id?: string;
  company_id: string;
  branch_id: string;
  entry_no: string;
  entry_date: string;
  description: string;
  reference_type?: string; // 'sale', 'purchase', 'expense', 'rental', 'manual'
  reference_id?: string;
  total_debit: number;
  total_credit: number;
  is_posted?: boolean;
  posted_at?: string;
  is_manual?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JournalEntryLine {
  id?: string;
  journal_entry_id: string;
  account_id: string;
  account_name: string;
  debit: number;
  credit: number;
  description?: string;
  created_at?: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines?: JournalEntryLine[];
}

export const accountingService = {
  // Get all journal entries with lines
  async getAllEntries(companyId: string, branchId?: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(*)
      `)
      .eq('company_id', companyId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (startDate) {
      query = query.gte('entry_date', startDate);
    }

    if (endDate) {
      query = query.lte('entry_date', endDate);
    }

    const { data, error } = await query;
    
    // Handle missing columns gracefully
    if (error && error.code === '42703') {
      // Retry without company_id filter if column doesn't exist
      let retryQuery = supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(*)
        `)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (branchId) {
        retryQuery = retryQuery.eq('branch_id', branchId);
      }

      if (startDate) {
        retryQuery = retryQuery.gte('entry_date', startDate);
      }

      if (endDate) {
        retryQuery = retryQuery.lte('entry_date', endDate);
      }

      const { data: retryData, error: retryError } = await retryQuery;
      if (retryError) throw retryError;
      return retryData;
    }

    if (error) throw error;
    return data;
  },

  // Get single journal entry with lines
  async getEntry(id: string) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create journal entry with lines
  async createEntry(entry: JournalEntry, lines: JournalEntryLine[]) {
    // Validate double-entry: total_debit must equal total_credit
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Double-entry validation failed: Debit (${totalDebit}) must equal Credit (${totalCredit})`);
    }

    // Create journal entry
    const { data: entryData, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        ...entry,
        total_debit: totalDebit,
        total_credit: totalCredit,
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Create journal entry lines
    const linesWithEntryId = lines.map(line => ({
      ...line,
      journal_entry_id: entryData.id,
    }));

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(linesWithEntryId);

    if (linesError) {
      // Rollback: Delete entry
      await supabase.from('journal_entries').delete().eq('id', entryData.id);
      throw linesError;
    }

    // Return entry with lines
    return this.getEntry(entryData.id);
  },

  // Update journal entry
  async updateEntry(id: string, entry: Partial<JournalEntry>, lines?: JournalEntryLine[]) {
    // If lines are provided, validate and update
    if (lines && lines.length > 0) {
      const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Double-entry validation failed: Debit (${totalDebit}) must equal Credit (${totalCredit})`);
      }

      entry.total_debit = totalDebit;
      entry.total_credit = totalCredit;

      // Delete existing lines
      await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', id);

      // Insert new lines
      const linesWithEntryId = lines.map(line => ({
        ...line,
        journal_entry_id: id,
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesWithEntryId);

      if (linesError) throw linesError;
    }

    // Update entry
    const { data, error } = await supabase
      .from('journal_entries')
      .update(entry)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete journal entry (and its lines via CASCADE)
  async deleteEntry(id: string) {
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Get entries by reference
  async getEntriesByReference(referenceType: string, referenceId: string) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(*)
      `)
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .order('entry_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get account balance from journal entries
  async getAccountBalance(accountId: string, companyId: string, branchId?: string) {
    let query = supabase
      .from('journal_entry_lines')
      .select('debit, credit')
      .eq('account_id', accountId);

    // Join with journal_entries to filter by company/branch
    const { data: entries, error: entriesError } = await supabase
      .from('journal_entries')
      .select('id, company_id, branch_id')
      .eq('company_id', companyId);

    if (entriesError) throw entriesError;

    let entryIds = entries.map(e => e.id);
    if (branchId) {
      entryIds = entries.filter(e => e.branch_id === branchId).map(e => e.id);
    }

    if (entryIds.length === 0) return 0;

    const { data: lines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select('debit, credit')
      .in('journal_entry_id', entryIds)
      .eq('account_id', accountId);

    if (linesError) throw linesError;

    const balance = lines.reduce((sum, line) => {
      return sum + (line.debit || 0) - (line.credit || 0);
    }, 0);

    return balance;
  },
};
