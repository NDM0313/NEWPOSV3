// ============================================================================
// DOCUMENT NUMBER SERVICE - Collision-Safe Number Generation
// ============================================================================
// SOURCE LOCK (Phase 1): Payment numbering = erp_document_sequences (via generate_document_number RPC).
// Ensures document numbers are always unique by checking database.
// ============================================================================

import { supabase } from '@/lib/supabase';

export type DocumentType = 'invoice' | 'quotation' | 'draft' | 'order' | 'purchase' | 'rental' | 'studio' | 'expense' | 'payment' | 'job' | 'journal' | 'production';

/** Document types for ERP Numbering Engine (generate_document_number RPC). Includes documents + master records. */
export type ErpDocumentType = 'sale' | 'purchase' | 'payment' | 'expense' | 'rental' | 'stock' | 'stock_adjustment' | 'journal' | 'product' | 'studio' | 'job' | 'pos' | 'customer' | 'supplier' | 'worker';

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
   * Get next product SKU from ERP numbering engine (atomic, PRD-0001, PRD-0002, ...).
   * Uses generate_document_number RPC (same engine as Sale, Purchase, Payment). No duplicates.
   */
  async getNextProductSKU(companyId: string, branchId?: string | null): Promise<string> {
    const next = await this.getNextDocumentNumber(companyId, branchId ?? null, 'product', false);
    if (!next || typeof next !== 'string') {
      throw new Error('Invalid product SKU returned from ERP numbering engine');
    }
    return next;
  },

  /**
   * Get next production product SKU: STD-PROD-00001, STD-PROD-00002, ...
   * For products manufactured through studio production (product_type = 'production').
   */
  async getNextProductionProductSKU(companyId: string): Promise<string> {
    const prefix = 'STD-PROD-';
    const maxNum = await this.getMaxDocumentNumber(companyId, 'production', prefix);
    const nextNum = maxNum + 1;
    const padded = String(nextNum).padStart(5, '0');
    return `${prefix}${padded}`;
  },

  /**
   * ERP Numbering Engine: get next document number (atomic, duplicate-free, multi-user safe).
   * Uses generate_document_number RPC → erp_document_sequences. PAY refs: use this only; do not use document_sequences for new payments.
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
   * Sales: SL (invoice), PS (POS), DRAFT (draft), QT (quotation), SO (order), STD (studio).
   * Other: PUR, PAY, RNT. Frontend must NOT generate numbers manually.
   */
  async getNextDocumentNumberGlobal(
    companyId: string,
    type:
      | 'SL'
      | 'PS'
      | 'DRAFT'
      | 'QT'
      | 'SO'
      | 'SDR'
      | 'SQT'
      | 'SOR'
      | 'CUS'
      | 'PUR'
      | 'PDR'
      | 'POR'
      | 'PAY'
      | 'RNT'
      | 'STD'
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
