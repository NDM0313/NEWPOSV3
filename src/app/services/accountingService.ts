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
  entry_no?: string; // Actual entry_no from database (for lookup)
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
  account_name?: string; // Payment Account name (from account_id)
  notes?: string; // User notes/narration (separate from description)
  document_type?: string; // Document Type (Sale, Payment, etc.)
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
  // Get journal entry by ID (PRIMARY METHOD - NO GUESSING)
  async getEntryById(journalEntryId: string, companyId: string) {
    if (!journalEntryId || !companyId) {
      console.error('[ACCOUNTING SERVICE] getEntryById: Missing journalEntryId or companyId');
      return null;
    }

    console.log('[ACCOUNTING SERVICE] getEntryById:', { journalEntryId, companyId });

    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(
          *,
          account:accounts(id, name, code, type)
        ),
        payment:payments(id, reference_number, amount, payment_method, payment_date, contact_id),
        branch:branches(id, name, code)
      `)
      .eq('id', journalEntryId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('[ACCOUNTING SERVICE] getEntryById error:', error);
      return null;
    }

    if (!data) {
      console.warn('[ACCOUNTING SERVICE] getEntryById: No entry found for ID:', journalEntryId);
      return null;
    }

    // CRITICAL FIX: Fetch sale data separately if reference_type is 'sale'
    if (data.reference_type === 'sale' && data.reference_id) {
      try {
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .select('id, invoice_no, customer_name, total, paid_amount, due_amount, customer_id')
          .eq('id', data.reference_id)
          .single();
        
        if (!saleError && saleData) {
          (data as any).sale = saleData;
        }
      } catch (saleErr) {
        console.warn('[ACCOUNTING SERVICE] Could not fetch sale data:', saleErr);
      }
    }

    console.log('[ACCOUNTING SERVICE] getEntryById SUCCESS:', { entry_no: data.entry_no, id: data.id });
    return data;
  },

  // CRITICAL FIX: Lookup by entry_no, payment reference_number, or invoice_no (FALLBACK ONLY)
  async getEntryByReference(referenceNumber: string, companyId: string) {
    if (!referenceNumber || !companyId) {
      console.error('[ACCOUNTING SERVICE] getEntryByReference: Missing referenceNumber or companyId');
      return null;
    }

    // CRITICAL: Don't force uppercase - preserve original case for exact match
    // But use uppercase for ilike search (case-insensitive)
    const cleanRef = referenceNumber.trim();
    const cleanRefUpper = cleanRef.toUpperCase();
    
    // STEP 1: Try to find by journal_entries.entry_no (primary lookup)
    let { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(
          *,
          account:accounts(id, name, code, type)
        ),
        payment:payments(id, reference_number, amount, payment_method, payment_date),
        branch:branches(id, name, code)
      `)
      .eq('company_id', companyId)
      .ilike('entry_no', cleanRefUpper) // Use uppercase for case-insensitive search
      .maybeSingle();
    
    // STEP 2: If not found by entry_no, try payment reference_number
    if (!data && (!error || error.code === 'PGRST116')) {
      const { data: paymentData } = await supabase
        .from('payments')
        .select('id')
        .eq('company_id', companyId)
        .ilike('reference_number', cleanRef)
        .maybeSingle();

      if (paymentData) {
        const { data: jeData, error: jeError } = await supabase
          .from('journal_entries')
          .select(`
            *,
            lines:journal_entry_lines(
              *,
              account:accounts(id, name, code, type)
            ),
            payment:payments(id, reference_number, amount, payment_method, payment_date),
            branch:branches(id, name, code)
          `)
          .eq('company_id', companyId)
          .eq('payment_id', paymentData.id)
          .maybeSingle();
        
        if (jeData) {
          data = jeData;
          error = null;
        } else if (jeError && jeError.code !== 'PGRST116') {
          error = jeError;
        }
      }
    }

    // STEP 3: If still not found, try invoice_no (for sales)
    if (!data && (!error || error.code === 'PGRST116')) {
      const { data: saleData } = await supabase
        .from('sales')
        .select('id')
        .eq('company_id', companyId)
        .ilike('invoice_no', cleanRef)
        .maybeSingle();

      if (saleData) {
        const { data: jeData, error: jeError } = await supabase
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
          .eq('reference_type', 'sale')
          .eq('reference_id', saleData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (jeData) {
          data = jeData;
          error = null;
          // CRITICAL FIX: Fetch sale data separately if needed
          if (jeData.reference_type === 'sale' && jeData.reference_id) {
            try {
              const { data: saleData } = await supabase
                .from('sales')
                .select('id, invoice_no, customer_name, total, paid_amount, due_amount')
                .eq('id', jeData.reference_id)
                .single();
              if (saleData) (data as any).sale = saleData;
            } catch {}
          }
        } else if (jeError && jeError.code !== 'PGRST116') {
          error = jeError;
        }
      }
    }

    // STEP 4: If still not found, try exact match on entry_no (case-sensitive)
    if (!data && (!error || error.code === 'PGRST116')) {
      const { data: exactData, error: exactError } = await supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(
            *,
            account:accounts(id, name, code, type)
          ),
          payment:payments(id, reference_number, amount, payment_method, payment_date),
          branch:branches(id, name, code)
        `)
        .eq('company_id', companyId)
        .eq('entry_no', referenceNumber.trim()) // Exact match (case-sensitive)
        .maybeSingle();
      
      if (exactData) {
        data = exactData;
        error = null;
      } else if (exactError && exactError.code !== 'PGRST116') {
        error = exactError;
      }
    }

    // STEP 5: If still not found and reference looks like JE-XXXX (generated from ID),
    // try to find by matching the pattern in entry_no
    if (!data && (!error || error.code === 'PGRST116')) {
      // Try partial match - if reference is JE-0066, try to find entries with entry_no containing this
      const { data: patternData, error: patternError } = await supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(
            *,
            account:accounts(id, name, code, type)
          ),
          payment:payments(id, reference_number, amount, payment_method, payment_date),
          branch:branches(id, name, code)
        `)
        .eq('company_id', companyId)
        .ilike('entry_no', '%' + cleanRefUpper + '%')
        .limit(1)
        .maybeSingle();
      
      if (patternData) {
        data = patternData;
        error = null;
      } else if (patternError && patternError.code !== 'PGRST116') {
        error = patternError;
      }
    }

    // Log if not found
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

      // PHASE 5: LOG FINAL RESULTS
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - FINAL RESULT:', {
        totalEntries: ledgerEntries.length,
        totalDebit: ledgerEntries.reduce((sum, e) => sum + (e.debit || 0), 0),
        totalCredit: ledgerEntries.reduce((sum, e) => sum + (e.credit || 0), 0),
        sampleEntries: ledgerEntries.slice(0, 3).map(e => ({
          reference: e.reference_number,
          debit: e.debit,
          credit: e.credit,
          journal_entry_id: e.journal_entry_id
        }))
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
      // CRITICAL: Journal entries use account code 2000, so we MUST prioritize code 2000
      // Query all AR accounts and pick code 2000 first, then fallback to 1100
      const { data: allArAccounts } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('company_id', companyId)
        .or('code.eq.2000,code.eq.1100,name.ilike.%Accounts Receivable%');

      if (!allArAccounts || allArAccounts.length === 0) {
        console.warn('[ACCOUNTING SERVICE] Accounts Receivable account not found');
        return [];
      }

      // Prioritize code 2000 (used by journal entries), then 1100, then any AR account
      let arAccount = allArAccounts.find(a => a.code === '2000') ||
                      allArAccounts.find(a => a.code === '1100') ||
                      allArAccounts[0];

      const arAccountId = arAccount.id;
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - AR Account found:', {
        id: arAccountId,
        code: arAccount.code,
        name: arAccount.name,
        totalArAccounts: allArAccounts.length
      });

      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 1: Starting with customerId:', customerId);

      // Get journal entry lines for Accounts Receivable account
      // Filter by customer through linked sales or payments
      let query = supabase
        .from('journal_entry_lines')
        .select(`
          *,
          account:accounts(id, name, code),
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
        .eq('account_id', arAccountId)
        .order('created_at', { ascending: true });

      const { data: lines, error } = await query;
      
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 1: Total AR journal entry lines:', lines?.length || 0);

      if (error) {
        console.error('[ACCOUNTING SERVICE] Error fetching customer ledger:', error);
        return [];
      }

      if (!lines || lines.length === 0) {
        return [];
      }

      // PHASE 2: Get ALL payments for this customer via sales
      // Payments are linked to sales, not directly to contacts
      // So we need to find payments where the linked sale has customer_id = customerId
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 2: Fetching payments via sales', { customerId, companyId });
      
      // First, get all sales for this customer
      const { data: customerSales } = await supabase
        .from('sales')
        .select('id')
        .eq('company_id', companyId)
        .eq('customer_id', customerId);
      
      const saleIds = customerSales?.map(s => s.id) || [];
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - Customer sales found:', saleIds.length);
      
      // Then get payments linked to those sales (include notes and payment_account_id)
      const { data: customerPayments } = await supabase
        .from('payments')
        .select('id, reference_number, payment_method, amount, payment_date, reference_id, reference_type, notes, payment_account_id')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale')
        .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);
      
      // Fetch account names for payment accounts
      const paymentAccountIds = customerPayments?.map(p => p.payment_account_id).filter(Boolean) || [];
      const accountMap = new Map<string, string>();
      if (paymentAccountIds.length > 0) {
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, name')
          .in('id', paymentAccountIds);
        
        accounts?.forEach(acc => {
          accountMap.set(acc.id, acc.name);
        });
      }

      console.log('[ACCOUNTING SERVICE] getCustomerLedger - Payments found:', customerPayments?.length || 0);
      if (customerPayments && customerPayments.length > 0) {
        console.log('[ACCOUNTING SERVICE] getCustomerLedger - Sample payment:', {
          id: customerPayments[0].id,
          reference_id: customerPayments[0].reference_id,
          reference_number: customerPayments[0].reference_number
        });
      }

      const paymentIds = customerPayments?.map(p => p.id) || [];
      const paymentRefsMap = new Map<string, string>();
      const paymentDetailsMap = new Map<string, any>();
      customerPayments?.forEach((p: any) => {
        if (p.reference_number) {
          paymentRefsMap.set(p.id, p.reference_number);
        }
        // Add account name to payment details
        if (p.payment_account_id && accountMap.has(p.payment_account_id)) {
          p.payment_account = { name: accountMap.get(p.payment_account_id) };
        }
        paymentDetailsMap.set(p.id, p);
      });
      
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - Payments found:', paymentIds.length);

      // Get ALL sales for this customer (needed for matching journal entries)
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - Fetching customer sales', { customerId, companyId });
      const { data: allCustomerSales } = await supabase
        .from('sales')
        .select('id, invoice_no, customer_id, customer_name')
        .eq('company_id', companyId)
        .eq('customer_id', customerId);
      
      const salesMap = new Map();
      if (allCustomerSales) {
        allCustomerSales.forEach((sale: any) => {
          salesMap.set(sale.id, sale);
        });
        console.log('[ACCOUNTING SERVICE] getCustomerLedger - Customer sales found:', allCustomerSales.length);
      }
      

      // PHASE 3: Filter by customer ID (from sales.customer_id OR payments via sales)
      // MUST include BOTH sales (debit) AND payments (credit) entries
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 3: Filtering lines', {
        totalLines: lines.length,
        paymentIds: paymentIds.length,
        customerSalesCount: salesMap.size,
        customerId,
        salesMapKeys: Array.from(salesMap.keys()).slice(0, 5)
      });

      let saleMatchCount = 0;
      let paymentMatchCount = 0;
      let noMatchCount = 0;

      const customerLines = lines.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;

        // CRITICAL: Exclude commission entries - Commission is COMPANY expense, NOT customer-related
        const desc = entry.description?.toLowerCase() || '';
        if (desc.includes('commission')) {
          console.log(`[ACCOUNTING SERVICE] EXCLUDING commission entry: ${entry.entry_no} - ${entry.description}`);
          return false; // Commission should NOT be in customer ledger
        }

        // Check if linked to this customer via sale (DEBIT entries - sales increase receivable)
        if (entry.reference_type === 'sale' && entry.reference_id) {
          const sale = salesMap.get(entry.reference_id);
          if (sale) {
            console.log(`[ACCOUNTING SERVICE] Sale check: entry.ref_id=${entry.reference_id}, sale.customer_id=${sale.customer_id}, customerId=${customerId}, match=${sale.customer_id === customerId}`);
            if (sale.customer_id === customerId) {
              saleMatchCount++;
              return true;
            }
          } else {
            console.log(`[ACCOUNTING SERVICE] Sale NOT in map: entry.ref_id=${entry.reference_id}`);
          }
        }

        // CRITICAL: Check if linked via payment (CREDIT entries - payments received decrease receivable)
        // Payment journal entries can be:
        // 1. reference_type='payment' with reference_id=payment.id
        // 2. reference_type='sale' with payment_id set (payment linked to sale)
        
        // Pattern 1: reference_type='payment'
        if (entry.reference_type === 'payment' && entry.reference_id) {
          // Check if this payment is in our customer payments list
          if (paymentIds.includes(entry.reference_id)) {
            return true;
          }
          
          // Also check via payment's linked sale
          const payment = paymentDetailsMap.get(entry.reference_id);
          if (payment && payment.reference_id) {
            const sale = salesMap.get(payment.reference_id);
            if (sale && sale.customer_id === customerId) {
              return true;
            }
          }
        }
        
        // Pattern 2: reference_type='sale' with payment_id set
        if (entry.reference_type === 'sale' && entry.payment_id) {
          // Check if this payment is in our customer payments list
          if (paymentIds.includes(entry.payment_id)) {
            return true;
          }
          
          // Also check if the sale belongs to this customer
          if (entry.reference_id) {
            const sale = salesMap.get(entry.reference_id);
            if (sale && sale.customer_id === customerId) {
              return true;
            }
          }
        }

        return false;
      });

      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 3: Filter results:', {
        saleMatches: saleMatchCount,
        paymentMatches: paymentMatchCount,
        noMatches: noMatchCount,
        totalCustomerLines: customerLines.length,
        sampleNoMatches: lines.filter((l: any) => {
          const e = l.journal_entry;
          if (!e) return false;
          if (e.reference_type === 'sale' && e.reference_id && !salesMap.get(e.reference_id)) return true;
          return false;
        }).slice(0, 3).map((l: any) => ({
          entry_no: l.journal_entry?.entry_no,
          ref_type: l.journal_entry?.reference_type,
          ref_id: l.journal_entry?.reference_id
        }))
      });

      // Filter by branch first (applies to all lines)
      const branchFiltered = branchId
        ? customerLines.filter((line: any) => line.journal_entry?.branch_id === branchId)
        : customerLines;

      // Opening balance = sum of (debit - credit) for ALL lines BEFORE startDate (from customer data, not from date-filtered set)
      let openingBalance = 0;
      if (startDate) {
        branchFiltered.forEach((line: any) => {
          const entry = line.journal_entry;
          if (!entry || entry.entry_date >= startDate) return;
          openingBalance += (line.debit || 0) - (line.credit || 0);
        });
      }

      // Lines to display: only those within date range [startDate, endDate]
      const rangeLines = branchFiltered.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;
        const entryDate = entry.entry_date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });

      // Sort by entry_date then created_at for correct running balance
      rangeLines.sort((a: any, b: any) => {
        const dateA = (a.journal_entry?.entry_date || '').toString();
        const dateB = (b.journal_entry?.entry_date || '').toString();
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const createdA = (a.journal_entry?.created_at || a.created_at || '').toString();
        const createdB = (b.journal_entry?.created_at || b.created_at || '').toString();
        return createdA.localeCompare(createdB);
      });

      let runningBalance = openingBalance;

      // PHASE 4: Build ledger entries with running balance (from rangeLines only)
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 4: Building ledger entries', {
        rangeLines: rangeLines.length,
        openingBalance,
        sampleEntries: rangeLines.slice(0, 3).map((l: any) => ({
          entry_no: l.journal_entry?.entry_no,
          ref_type: l.journal_entry?.reference_type,
          ref_id: l.journal_entry?.reference_id,
          payment_id: l.journal_entry?.payment_id,
          debit: l.debit,
          credit: l.credit
        }))
      });

      const ledgerEntriesFromRange: AccountLedgerEntry[] = rangeLines.map((line: any) => {
        const entry = line.journal_entry;
        
        // STEP 3: BACKEND JOURNAL ENTRY RULE - Verify debit/credit are mutually exclusive
        const debit = line.debit || 0;
        const credit = line.credit || 0;
        
        // STEP 4: SQL VERIFICATION - Log if both debit and credit are non-zero (DATA CORRUPTION)
        if (debit > 0 && credit > 0) {
          console.error('[ACCOUNTING SERVICE] DATA CORRUPTION: Both debit and credit > 0:', {
            journal_entry_id: entry.id,
            entry_no: entry.entry_no,
            debit,
            credit,
            description: entry.description
          });
        }
        
        // STEP 6: Running Balance Formula for ASSET account: balance = previous + debit - credit
        runningBalance += debit - credit;

        // Determine source module and document type
        let sourceModule = 'Accounting';
        let documentType = 'Journal Entry';
        if (entry.reference_type === 'sale') {
          sourceModule = 'Sales';
          documentType = 'Sale Invoice';
        } else if (entry.payment_id) {
          sourceModule = 'Payment';
          documentType = 'Payment';
        } else if (entry.reference_type === 'expense') {
          sourceModule = 'Expense';
          documentType = 'Expense';
        }

        // Get Payment Account name (from journal_entry_lines.account or payment.payment_account)
        let accountName = '';
        // First try: Get from journal_entry_lines.account (for AR entries, this is the AR account itself)
        // For payment entries, we need the OTHER side (Cash/Bank account)
        if (entry.payment_id) {
          const payment = paymentDetailsMap.get(entry.payment_id);
          if (payment?.payment_account?.name) {
            accountName = payment.payment_account.name;
          } else if (payment?.payment_account_id && accountMap.has(payment.payment_account_id)) {
            accountName = accountMap.get(payment.payment_account_id) || '';
          } else if (payment?.payment_method) {
            // Fallback to payment_method if account not found
            accountName = payment.payment_method;
          }
        } else if (line.account) {
          // For non-payment entries, use the account from journal_entry_lines
          accountName = line.account.name || '';
        }

        // Get Notes (from payment.notes, separate from description)
        let notes = '';
        if (entry.payment_id) {
          const payment = paymentDetailsMap.get(entry.payment_id);
          if (payment?.notes) {
            notes = payment.notes;
          }
        }

        // CRITICAL FIX: Use entry_no from database as PRIMARY reference
        // Only generate fallback if entry_no is truly missing or invalid
        let referenceNumber = entry.entry_no;
        
        // Check if entry_no is missing, empty, or looks like UUID
        const isInvalidEntryNo = !referenceNumber || 
                                  referenceNumber.trim() === '' || 
                                  (referenceNumber.includes('-') && referenceNumber.length === 36) ||
                                  referenceNumber.length > 50;
        
        if (isInvalidEntryNo) {
          // Generate short reference based on type (FALLBACK ONLY)
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
            // Last resort: Use entry ID substring (but this won't match database lookup)
            referenceNumber = `JE-${entry.id.substring(0, 4).toUpperCase()}`;
          }
        }
        
        // Get branch info from joined data
        const branch = (entry as any).branch;
        const branchName = branch ? (branch.code ? `${branch.code} | ${branch.name}` : branch.name) : null;

        // STEP 2: DATA SOURCE CONFIRMATION - Ensure debit/credit are properly set
        const finalDebit = debit;
        const finalCredit = credit;
        
        // Verify: Dono aik sath non-zero NA hon
        if (finalDebit > 0 && finalCredit > 0) {
          console.warn('[ACCOUNTING SERVICE] Invalid entry: Both debit and credit non-zero:', {
            entry_id: entry.id,
            entry_no: entry.entry_no,
            debit: finalDebit,
            credit: finalCredit
          });
        }

        return {
          date: entry.entry_date,
          reference_number: referenceNumber,
          // CRITICAL: Store actual entry_no from database (for lookup)
          // If entry_no exists in DB, use it. Otherwise, use referenceNumber (which is generated from entry_no or UUID)
          entry_no: entry.entry_no || null, // Keep actual DB entry_no, don't fallback to generated referenceNumber
          description: entry.description || line.description || 'Journal Entry',
          // STEP 1: DIRECT mapping - NO Math.abs(), NO conditionals
          debit: finalDebit,
          credit: finalCredit,
          running_balance: runningBalance,
          source_module: sourceModule,
          document_type: documentType,
          account_name: accountName,
          notes: notes,
          created_by: entry.created_by,
          journal_entry_id: entry.id, // Use journal_entry_id as fallback if entry_no is missing
          payment_id: entry.payment_id,
          sale_id: entry.reference_id,
          branch_id: entry.branch_id,
          branch_name: branchName,
        };
      });

      // When date range is applied, prepend opening balance row so UI/PDF/Print show it and totals are correct
      const ledgerEntries: AccountLedgerEntry[] = startDate
        ? [
            {
              date: startDate,
              reference_number: '-',
              entry_no: null,
              description: 'Opening Balance',
              debit: 0,
              credit: 0,
              running_balance: openingBalance,
              source_module: 'Accounting',
              journal_entry_id: '',
              document_type: 'Opening Balance',
              account_name: '',
              notes: '',
            },
            ...ledgerEntriesFromRange,
          ]
        : ledgerEntriesFromRange;

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
    // CRITICAL FIX: Validate branch_id - must be valid UUID, not "all"
    if (entry.branch_id && entry.branch_id !== 'all') {
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
    
    // STEP 2 FIX: Fix journal_entries query - use proper select instead of select()
    const { data: entryData, error: entryError } = await supabase
      .from('journal_entries')
      .insert(insertData)
      .select('*')
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
