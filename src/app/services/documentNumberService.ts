// ============================================================================
// DOCUMENT NUMBER SERVICE - Collision-Safe Number Generation
// ============================================================================
// Ensures document numbers are always unique by checking database
// Single source of truth for document numbering validation
// ============================================================================

import { supabase } from '@/lib/supabase';

export type DocumentType = 'invoice' | 'quotation' | 'draft' | 'order' | 'purchase' | 'rental' | 'studio' | 'expense' | 'payment' | 'job' | 'journal' | 'production';

/** Document types for ERP Numbering Engine (generate_document_number RPC). */
export type ErpDocumentType = 'sale' | 'purchase' | 'payment' | 'expense' | 'rental' | 'stock' | 'stock_adjustment' | 'journal' | 'product' | 'studio' | 'job' | 'pos';

interface DocumentNumberCheck {
  exists: boolean;
  maxNumber?: number;
}

export const documentNumberService = {
  /**
   * Check if a document number already exists in the database
   * Returns true if exists, false otherwise
   */
  async checkDocumentNumberExists(
    companyId: string,
    documentNumber: string,
    documentType: DocumentType
  ): Promise<boolean> {
    try {
      // Map document type to table and column
      const tableColumnMap: Record<DocumentType, { table: string; column: string }> = {
        'invoice': { table: 'sales', column: 'invoice_no' },
        'quotation': { table: 'sales', column: 'invoice_no' }, // Quotations also use invoice_no
        'draft': { table: 'sales', column: 'invoice_no' },
        'order': { table: 'sales', column: 'invoice_no' },
        'purchase': { table: 'purchases', column: 'po_no' },
        'rental': { table: 'rentals', column: 'booking_no' },
        'studio': { table: 'sales', column: 'invoice_no' },
        'expense': { table: 'expenses', column: 'expense_no' },
        'payment': { table: 'payments', column: 'reference_number' },
        'job': { table: 'jobs', column: 'job_no' },
        'journal': { table: 'journal_entries', column: 'entry_no' },
        'production': { table: 'products', column: 'sku' },
      };

      const mapping = tableColumnMap[documentType];
      if (!mapping) {
        console.warn(`[DOCUMENT NUMBER] Unknown document type: ${documentType}`);
        return false;
      }

      const { data, error } = await supabase
        .from(mapping.table)
        .select('id')
        .eq('company_id', companyId)
        .eq(mapping.column, documentNumber)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error(`[DOCUMENT NUMBER] Error checking ${documentType} number:`, error);
        return false; // Assume doesn't exist on error
      }

      return !!data;
    } catch (error) {
      console.error(`[DOCUMENT NUMBER] Exception checking ${documentType} number:`, error);
      return false; // Assume doesn't exist on error
    }
  },

  /**
   * Get the maximum document number for a type (to sync sequences)
   * Returns the highest numeric part found in existing documents
   */
  async getMaxDocumentNumber(
    companyId: string,
    documentType: DocumentType,
    prefix: string
  ): Promise<number> {
    try {
      const tableColumnMap: Record<DocumentType, { table: string; column: string }> = {
        'invoice': { table: 'sales', column: 'invoice_no' },
        'quotation': { table: 'sales', column: 'invoice_no' },
        'draft': { table: 'sales', column: 'invoice_no' },
        'order': { table: 'sales', column: 'invoice_no' },
        'purchase': { table: 'purchases', column: 'po_no' },
        'rental': { table: 'rentals', column: 'booking_no' },
        'studio': { table: 'sales', column: 'invoice_no' },
        'expense': { table: 'expenses', column: 'expense_no' },
        'payment': { table: 'payments', column: 'reference_number' },
        'job': { table: 'jobs', column: 'job_no' },
        'journal': { table: 'journal_entries', column: 'entry_no' },
        'production': { table: 'products', column: 'sku' },
      };

      const mapping = tableColumnMap[documentType];
      if (!mapping) {
        return 0;
      }

      // Fetch all documents of this type for this company
      const { data, error } = await supabase
        .from(mapping.table)
        .select(mapping.column)
        .eq('company_id', companyId)
        .not(mapping.column, 'is', null);

      if (error) {
        console.error(`[DOCUMENT NUMBER] Error fetching max ${documentType} number:`, error);
        return 0;
      }

      if (!data || data.length === 0) {
        return 0;
      }

      // Extract numeric parts and find maximum
      let maxNum = 0;
      const prefixUpper = prefix.toUpperCase();

      for (const row of data) {
        const docNumber = (row as any)[mapping.column];
        if (!docNumber || typeof docNumber !== 'string') continue;

        // Check if it starts with the prefix
        if (docNumber.toUpperCase().startsWith(prefixUpper)) {
          // Extract numeric part after prefix
          const numericPart = docNumber.substring(prefixUpper.length).replace(/\D/g, '');
          if (numericPart) {
            const num = parseInt(numericPart, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }

      return maxNum;
    } catch (error) {
      console.error(`[DOCUMENT NUMBER] Exception getting max ${documentType} number:`, error);
      return 0;
    }
  },

  /**
   * Get next product SKU from database (atomic, PRD-0001, PRD-0002, ...).
   * Uses get_next_document_number RPC. branchId can be null for company-level sequence.
   */
  async getNextProductSKU(companyId: string, branchId?: string | null): Promise<string> {
    const { data, error } = await supabase.rpc('get_next_document_number', {
      p_company_id: companyId,
      p_branch_id: branchId ?? null,
      p_document_type: 'product',
    });
    if (error) {
      console.error('[DOCUMENT NUMBER] get_next_document_number(product) error:', error);
      throw new Error(error.message || 'Failed to get next product SKU');
    }
    if (typeof data !== 'string' || !data) {
      throw new Error('Invalid product SKU returned from database');
    }
    return data;
  },

  /**
   * ERP Numbering Engine: get next document number (atomic, duplicate-free, multi-user safe).
   * Uses generate_document_number RPC. Use for payments, and optionally sales/purchases/expenses.
   * @param includeYear - if true, format is PREFIX-YY-NNNN (e.g. SL-26-0001); else PREFIX-NNNN
   */
  async getNextDocumentNumber(
    companyId: string,
    branchId: string | null,
    documentType: ErpDocumentType,
    includeYear?: boolean
  ): Promise<string> {
    const { data, error } = await supabase.rpc('generate_document_number', {
      p_company_id: companyId,
      p_branch_id: branchId,
      p_document_type: documentType,
      p_include_year: includeYear ?? false,
    });
    if (error) {
      console.warn('[DOCUMENT NUMBER] generate_document_number error:', error);
      throw new Error(error.message || 'Failed to get next document number');
    }
    if (typeof data !== 'string' || !data) {
      throw new Error('Invalid document number from generate_document_number');
    }
    return data;
  },

  /**
   * Get next global document number from database (company-level, atomic).
   * Sales: SL (invoice), DRAFT (draft), QT (quotation), SO (order), STD (studio).
   * Other: PUR, PAY, RNT. Frontend must NOT generate numbers manually.
   */
  async getNextDocumentNumberGlobal(
    companyId: string,
    type: 'SL' | 'DRAFT' | 'QT' | 'SO' | 'CUS' | 'PUR' | 'PAY' | 'RNT' | 'STD'
  ): Promise<string> {
    const { data, error } = await supabase.rpc('get_next_document_number_global', {
      p_company_id: companyId,
      p_type: type,
    });
    if (error) {
      console.error('[DOCUMENT NUMBER] get_next_document_number_global error:', error);
      throw new Error(error.message || 'Failed to get next document number');
    }
    if (typeof data !== 'string' || !data) {
      throw new Error('Invalid document number returned from database');
    }
    return data;
  },
};
