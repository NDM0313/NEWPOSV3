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
  branch_id?: string;
  branch_name?: string;
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
  // STRICT RULE: Lookup ONLY in journal_entries table by entry_no
  async getEntryByReference(referenceNumber: string, companyId: string) {
    if (!referenceNumber || !companyId) {
      console.error('[ACCOUNTING SERVICE] getEntryByReference: Missing referenceNumber or companyId');
      return null;
    }

    // PRIMARY: Find by entry_no (exact match first, then case-insensitive)
    const cleanRef = referenceNumber.trim().toUpperCase();
    
    // Try exact match first (case-insensitive)
    let { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(
          *,
          account:accounts(id, name, code, type)
        ),
        payment:payments(id, reference_number, amount, payment_method, payment_date),
        sale:sales(id, invoice_no, customer_name, total, paid_amount, due_amount),
        branch:branches(id, name, code)
      `)
      .eq('company_id', companyId)
      .eq('entry_no', cleanRef)
      .maybeSingle();
    
    // If not found with exact match, try case-insensitive search
    if (!data && (!error || error.code === 'PGRST116')) {
      const { data: ilikeData, error: ilikeError } = await supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(
            *,
            account:accounts(id, name, code, type)
          ),
          payment:payments(id, reference_number, amount, payment_method, payment_date),
          sale:sales(id, invoice_no, customer_name, total, paid_amount, due_amount),
          branch:branches(id, name, code)
        `)
        .eq('company_id', companyId)
        .ilike('entry_no', cleanRef)
        .maybeSingle();
      
      if (ilikeData) {
        data = ilikeData;
        error = null;
      } else if (ilikeError && ilikeError.code !== 'PGRST116') {
        error = ilikeError;
      }
    }

    // If not found, log for debugging
    if (!data && error && error.code !== 'PGRST116') {
      console.error('[ACCOUNTING SERVICE] Error finding entry by reference:', error);
      console.error('[ACCOUNTING SERVICE] Reference searched:', cleanRef, 'Original:', referenceNumber);
    }

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  },

  // Get account ledger entries
  async getAccountLedger(
    accountId: string,
    companyId: string,
    startDate?: string,
    endDate?: string,
    branchId?: string,
    searchTerm?: string
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
            branch_id,
            created_by,
            created_at,
            branch:branches(id, name, code)
          )
        `)
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });
      
      // Apply branch filter if provided
      if (branchId) {
        query = query.eq('journal_entry.branch_id', branchId);
      }

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
        const entry = line.journal_entry;
        if (!entry) return false;
        
        const entryDate = entry.entry_date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        
        // Apply branch filter if provided
        if (branchId && entry.branch_id !== branchId) return false;
        
        // Apply search filter if provided
        if (searchTerm && searchTerm.trim()) {
          const search = searchTerm.toLowerCase().trim();
          const entryNo = entry.entry_no?.toLowerCase() || '';
          const description = (entry.description || line.description || '').toLowerCase();
          const amount = ((line.debit || 0) + (line.credit || 0)).toString();
          
          if (!entryNo.includes(search) && 
              !description.includes(search) && 
              !amount.includes(search)) {
            return false;
          }
        }
        
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

          // Use entry_no if it's in short format (EXP-0001, JE-0001, etc.)
          // If entry_no is UUID or missing, generate short reference
          let referenceNumber = entry.entry_no;
          
          // Check if entry_no is UUID or invalid format
          const isUUID = referenceNumber && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referenceNumber);
          const isShortFormat = referenceNumber && /^[A-Z]+-[0-9]+$/.test(referenceNumber);
          
          if (!referenceNumber || referenceNumber.length > 20 || isUUID || !isShortFormat) {
            // Try to get from payment reference first
            if (entry.payment_id && paymentRefsMap.has(entry.payment_id)) {
              referenceNumber = paymentRefsMap.get(entry.payment_id)!;
            } else if (entry.reference_type === 'expense' || entry.reference_type === 'extra_expense') {
              // Generate EXP-XXXX format
              referenceNumber = `EXP-${entry.id.substring(0, 4).toUpperCase()}`;
            } else if (entry.reference_type === 'sale') {
              // Try to get invoice number from sale
              // This will be handled by salesMap in getCustomerLedger
              referenceNumber = `JE-${entry.id.substring(0, 4).toUpperCase()}`;
            } else {
              // Generate JE-XXXX format for manual entries
              referenceNumber = `JE-${entry.id.substring(0, 4).toUpperCase()}`;
            }
          }

          // Get branch info from joined data
          const branch = (entry as any).branch;
          const branchName = branch ? (branch.code ? `${branch.code} | ${branch.name}` : branch.name) : null;

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
            branch_id: entry.branch_id,
            branch_name: branchName,
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

  // Get customer ledger from journal_entries (filtered by Accounts Receivable account)
  async getCustomerLedger(
    customerId: string,
    companyId: string,
    branchId?: string,
    startDate?: string,
    endDate?: string,
    searchTerm?: string
  ): Promise<AccountLedgerEntry[]> {
    try {
      // First, find Accounts Receivable account
      const { data: arAccounts } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('company_id', companyId)
        .or('code.eq.2000,code.eq.1100,name.ilike.%Accounts Receivable%')
        .limit(1);

      if (!arAccounts || arAccounts.length === 0) {
        console.warn('[ACCOUNTING SERVICE] Accounts Receivable account not found');
        return [];
      }

      const arAccountId = arAccounts[0].id;

      // Get journal entry lines for Accounts Receivable account
      // Filter by customer through linked sales or payments
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
            branch_id,
            created_by,
            created_at,
            sale:sales(id, invoice_no, customer_id, customer_name)
          )
        `)
        .eq('account_id', arAccountId)
        .order('created_at', { ascending: true });

      const { data: lines, error } = await query;

      if (error) {
        console.error('[ACCOUNTING SERVICE] Error fetching customer ledger:', error);
        return [];
      }

      if (!lines || lines.length === 0) {
        return [];
      }

      // Get payments for this customer to filter payment-related entries
      const { data: customerPayments } = await supabase
        .from('payments')
        .select('id, reference_number')
        .eq('company_id', companyId)
        .eq('contact_id', customerId);

      const paymentIds = customerPayments?.map(p => p.id) || [];
      const paymentRefsMap = new Map<string, string>();
      customerPayments?.forEach((p: any) => {
        if (p.reference_number) {
          paymentRefsMap.set(p.id, p.reference_number);
        }
      });

      // Get sales data for reference number generation
      const saleIds = lines
        .map((line: any) => line.journal_entry?.reference_id)
        .filter((id: string | undefined) => id && lines.find((l: any) => l.journal_entry?.reference_type === 'sale' && l.journal_entry?.reference_id === id)) as string[];

      const salesMap = new Map();
      if (saleIds.length > 0) {
        const { data: sales } = await supabase
          .from('sales')
          .select('id, invoice_no, customer_id, customer_name')
          .in('id', saleIds);

        if (sales) {
          sales.forEach((sale: any) => {
            salesMap.set(sale.id, sale);
          });
        }
      }

      // Filter by customer ID (from sales.customer_id or payments.contact_id)
      const customerLines = lines.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;

        // Check if linked to this customer via sale
        if (entry.reference_type === 'sale' && entry.reference_id) {
          const sale = salesMap.get(entry.reference_id);
          if (sale && sale.customer_id === customerId) {
            return true;
          }
        }

        // Check if linked via payment
        if (entry.payment_id && paymentIds.includes(entry.payment_id)) {
          return true;
        }

        return false;
      });

      // Further filter by date range and branch
      const filteredLines = customerLines.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;

        const entryDate = entry.entry_date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        if (branchId && entry.branch_id !== branchId) return false;

        return true;
      });

      // Calculate opening balance (balance before start date)
      let openingBalance = 0;
      if (startDate) {
        const priorLines = filteredLines.filter((line: any) => {
          const entry = line.journal_entry;
          return entry && entry.entry_date < startDate;
        });

        priorLines.forEach((line: any) => {
          openingBalance += (line.debit || 0) - (line.credit || 0);
        });
      }

      let runningBalance = openingBalance;

      // Build ledger entries with running balance
      const ledgerEntries: AccountLedgerEntry[] = filteredLines.map((line: any) => {
        const entry = line.journal_entry;
        runningBalance += (line.debit || 0) - (line.credit || 0);

        // Determine source module
        let sourceModule = 'Accounting';
        if (entry.reference_type === 'sale') {
          sourceModule = 'Sales';
        } else if (entry.payment_id) {
          sourceModule = 'Payment';
        } else if (entry.reference_type === 'expense') {
          sourceModule = 'Expense';
        }

        // Generate short reference number
        let referenceNumber = entry.entry_no;
        if (!referenceNumber || referenceNumber.length > 20 || 
            (referenceNumber.includes('-') && referenceNumber.length === 36)) {
          // Generate short reference based on type
          const sale = entry.reference_id ? salesMap.get(entry.reference_id) : null;
          if (entry.reference_type === 'sale' && sale?.invoice_no) {
            referenceNumber = sale.invoice_no;
          } else if (entry.payment_id && paymentRefsMap.has(entry.payment_id)) {
            referenceNumber = paymentRefsMap.get(entry.payment_id)!;
          } else if (entry.payment_id) {
            referenceNumber = `PAY-${entry.payment_id.substring(0, 4).toUpperCase()}`;
          } else if (entry.reference_type === 'expense') {
            referenceNumber = `EXP-${entry.id.substring(0, 4).toUpperCase()}`;
          } else {
            referenceNumber = `JE-${entry.id.substring(0, 4).toUpperCase()}`;
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
      console.error('[ACCOUNTING SERVICE] Error getting customer ledger:', error);
      return [];
    }
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
