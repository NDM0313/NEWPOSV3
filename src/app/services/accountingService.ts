import { supabase } from '@/lib/supabase';

export interface JournalEntry {
  id: string;
  company_id: string;
  branch_id?: string;
  entry_no?: string;
  entry_date: string;
  description?: string;
  reference_type?: string;
  reference_id?: string;
  payment_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
  created_at?: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalEntryLine[];
}

export interface AccountLedgerEntry {
  date: string;
  reference_number: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  source_module: string;
  created_by?: string;
  journal_entry_id: string;
  payment_id?: string;
  sale_id?: string;
}

export const accountingService = {
  // Get all journal entries with lines
  async getAllEntries(companyId: string, branchId?: string, startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(*),
          payment:payments(reference_number, payment_method, amount)
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
      
      // Handle missing table gracefully
      if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
        console.warn('[ACCOUNTING SERVICE] journal_entries table does not exist, returning empty array');
        return [];
      }
      
      // Handle missing columns gracefully
      if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
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
        if (retryError) {
          console.warn('[ACCOUNTING SERVICE] Error fetching journal entries:', retryError.message);
          return [];
        }
        return retryData || [];
      }

      if (error) {
        console.warn('[ACCOUNTING SERVICE] Error fetching journal entries:', error.message);
        return [];
      }
      
      return data || [];
    } catch (error: any) {
      console.warn('[ACCOUNTING SERVICE] Error:', error.message);
      return [];
    }
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

  // Get journal entry by reference number
  // Reference can be entry_no, payment reference_number, or journal entry id
  async getEntryByReference(referenceNumber: string, companyId: string) {
    // Try to find by entry_no first
    let { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(
          *,
          account:accounts(id, name, code, type)
        ),
        payment:payments(id, reference_number, amount, payment_method, payment_date),
        sale:sales(id, invoice_no, customer_name, total, paid_amount, due_amount)
      `)
      .eq('entry_no', referenceNumber)
      .eq('company_id', companyId)
      .maybeSingle();

    // If not found by entry_no, try by payment reference_number
    if (!data && !error) {
      const { data: paymentData } = await supabase
        .from('payments')
        .select('id')
        .eq('reference_number', referenceNumber)
        .eq('company_id', companyId)
        .maybeSingle();

      if (paymentData) {
        const result = await supabase
          .from('journal_entries')
          .select(`
            *,
            lines:journal_entry_lines(
              *,
              account:accounts(id, name, code, type)
            ),
            payment:payments(id, reference_number, amount, payment_method, payment_date),
            sale:sales(id, invoice_no, customer_name, total, paid_amount, due_amount)
          `)
          .eq('payment_id', paymentData.id)
          .eq('company_id', companyId)
          .maybeSingle();
        
        data = result.data;
        error = result.error;
      }
    }

    // If still not found, try by journal entry id (if referenceNumber looks like UUID)
    if (!data && !error && referenceNumber.length === 36) {
      const result = await supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(
            *,
            account:accounts(id, name, code, type)
          ),
          payment:payments(id, reference_number, amount, payment_method, payment_date),
          sale:sales(id, invoice_no, customer_name, total, paid_amount, due_amount)
        `)
        .eq('id', referenceNumber)
        .eq('company_id', companyId)
        .maybeSingle();
      
      data = result.data;
      error = result.error;
    }

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  // Get account ledger entries
  async getAccountLedger(
    accountId: string,
    companyId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AccountLedgerEntry[]> {
    try {
      // Get all journal entry lines for this account
      // Sort by Date ASC, then ID ASC (as per requirements)
      let query = supabase
        .from('journal_entry_lines')
        .select(`
          *,
          journal_entry:journal_entries(
            id,
            entry_no,
            entry_date,
            description,
            reference_type,
            reference_id,
            payment_id,
            created_by,
            created_at
          )
        `)
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });

      const { data: lines, error } = await query;

      if (error) {
        console.error('[ACCOUNTING SERVICE] Error fetching ledger:', error);
        return [];
      }

      if (!lines || lines.length === 0) {
        return [];
      }

      // Get account opening balance (balance before first entry)
      const { data: account } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', accountId)
        .single();

      let runningBalance = account?.balance || 0;

      // Calculate running balance from all entries before start date
      if (startDate) {
        const { data: priorEntries } = await supabase
          .from('journal_entry_lines')
          .select(`
            debit,
            credit,
            journal_entry:journal_entries(entry_date)
          `)
          .eq('account_id', accountId)
          .lt('journal_entry.entry_date', startDate);

        if (priorEntries) {
          priorEntries.forEach((entry: any) => {
            runningBalance += (entry.debit || 0) - (entry.credit || 0);
          });
        }
      }

      // Get payment references for entries that need them (batch fetch)
      const paymentIds = lines
        .map((line: any) => line.journal_entry?.payment_id)
        .filter((id: string | undefined) => id) as string[];
      
      const paymentRefsMap = new Map<string, string>();
      if (paymentIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('id, reference_number')
          .in('id', paymentIds);
        
        if (payments) {
          payments.forEach((p: any) => {
            if (p.reference_number) {
              paymentRefsMap.set(p.id, p.reference_number);
            }
          });
        }
      }

      // Build ledger entries with running balance
      // First filter, then sort by Date ASC, ID ASC (as per requirements)
      const filteredLines = lines.filter((line: any) => {
        const entryDate = line.journal_entry?.entry_date;
        if (!entryDate) return false;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });

      // Sort by Date ASC, then ID ASC
      filteredLines.sort((a: any, b: any) => {
        const dateA = new Date(a.journal_entry?.entry_date || 0).getTime();
        const dateB = new Date(b.journal_entry?.entry_date || 0).getTime();
        if (dateA !== dateB) {
          return dateA - dateB; // Date ASC
        }
        // If dates are equal, sort by ID ASC
        const idA = a.journal_entry?.id || '';
        const idB = b.journal_entry?.id || '';
        return idA.localeCompare(idB);
      });

      const ledgerEntries: AccountLedgerEntry[] = filteredLines.map((line: any) => {
          const entry = line.journal_entry;
          runningBalance += (line.debit || 0) - (line.credit || 0);

          // Determine source module
          let sourceModule = 'Accounting';
          if (entry.reference_type === 'sale') {
            sourceModule = 'Sales';
          } else if (entry.payment_id) {
            sourceModule = 'Payment';
          }

          // Prioritize entry_no (short reference) over UUID
          // If entry_no is missing or looks like UUID, try to get from payment reference
          let referenceNumber = entry.entry_no;
          if (!referenceNumber || referenceNumber.length > 20 || 
              (referenceNumber.includes('-') && referenceNumber.length === 36)) {
            // If entry_no is UUID or missing, try to get from payment
            if (entry.payment_id && paymentRefsMap.has(entry.payment_id)) {
              referenceNumber = paymentRefsMap.get(entry.payment_id)!;
            } else {
              // Fallback to short UUID if still missing
              referenceNumber = entry.id.substring(0, 8).toUpperCase();
            }
          }

          return {
            date: entry.entry_date,
            reference_number: referenceNumber,
            description: entry.description || line.description || 'Journal Entry',
            debit: line.debit || 0,
            credit: line.credit || 0,
            running_balance: runningBalance,
            source_module: sourceModule,
            created_by: entry.created_by,
            journal_entry_id: entry.id,
            payment_id: entry.payment_id,
            sale_id: entry.reference_id,
          };
        });

      return ledgerEntries;
    } catch (error: any) {
      console.error('[ACCOUNTING SERVICE] Error getting account ledger:', error);
      return [];
    }
  },

  // Get account transactions (simplified view)
  async getAccountTransactions(accountId: string, companyId: string) {
    const ledger = await this.getAccountLedger(accountId, companyId);
    return ledger.map(entry => ({
      date: entry.date,
      reference: entry.reference_number,
      description: entry.description,
      amount: entry.debit > 0 ? entry.debit : -entry.credit,
      type: entry.debit > 0 ? 'Debit' : 'Credit',
      balance: entry.running_balance,
    }));
  },

  // Create journal entry with lines
  async createEntry(entry: JournalEntry, lines: JournalEntryLine[], paymentId?: string) {
    // Validate double-entry: total_debit must equal total_credit
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Double-entry validation failed: Debit (${totalDebit}) must equal Credit (${totalCredit})`);
    }

    // Create journal entry (database doesn't have total_debit/total_credit columns)
    // CRITICAL FIX: Only include fields that are not null/undefined to prevent "undefinedundefined" UUID error
    const insertData: any = {
      company_id: entry.company_id,
      entry_no: entry.entry_no,
      entry_date: entry.entry_date,
      description: entry.description,
      reference_type: entry.reference_type,
    };
    
    // Only add optional UUID fields if they have valid values (not null/undefined)
    if (entry.branch_id) {
      insertData.branch_id = entry.branch_id;
    }
    if (entry.reference_id) {
      insertData.reference_id = entry.reference_id;
    }
    if (entry.created_by) {
      insertData.created_by = entry.created_by;
    }
    // CRITICAL: Link journal entry to payment if provided
    if (paymentId) {
      insertData.payment_id = paymentId;
    }
    
    const { data: entryData, error: entryError } = await supabase
      .from('journal_entries')
      .insert(insertData)
      .select()
      .single();

    // CRITICAL FIX: Handle missing table error with helpful message
    if (entryError && (entryError.code === 'PGRST205' || entryError.message?.includes('does not exist'))) {
      const errorMessage = `❌ Journal Entries table not found!\n\nThe 'journal_entries' table doesn't exist in your database. Please run this SQL in your Supabase SQL Editor:\n\nCREATE TABLE IF NOT EXISTS journal_entries (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,\n  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,\n  entry_no VARCHAR(100),\n  entry_date DATE NOT NULL,\n  description TEXT,\n  reference_type VARCHAR(50),\n  reference_id UUID,\n  created_by UUID REFERENCES users(id) ON DELETE SET NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nCREATE TABLE IF NOT EXISTS journal_entry_lines (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,\n  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,\n  debit DECIMAL(15,2) DEFAULT 0,\n  credit DECIMAL(15,2) DEFAULT 0,\n  description TEXT,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nSee: supabase-extract/migrations/03_frontend_driven_schema.sql for complete schema.`;
      throw new Error(errorMessage);
    }

    if (entryError) throw entryError;

    // Insert journal entry lines
    const linesData = lines.map(line => ({
      journal_entry_id: entryData.id,
      account_id: line.account_id,
      debit: line.debit || 0,
      credit: line.credit || 0,
      description: line.description,
    }));

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(linesData);

    if (linesError) throw linesError;

    // Return entry with lines
    return {
      ...entryData,
      lines: linesData.map((l, idx) => ({
        ...l,
        id: `temp-${idx}`,
      })),
    };
  },
};
