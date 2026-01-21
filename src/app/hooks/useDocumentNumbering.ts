// ============================================
// 🎯 DOCUMENT NUMBERING HOOK
// ============================================
// Centralized hook for generating document numbers
// Uses Settings → Numbering Rules

import { useSettings } from '@/app/context/SettingsContext';

export type DocumentType = 
  | 'invoice' 
  | 'quotation'
  | 'draft'
  | 'order'
  | 'purchase' 
  | 'rental' 
  | 'studio' 
  | 'expense';

interface NumberingConfig {
  prefix: string;
  nextNumber: number;
  padding: number; // Number of digits (e.g., 4 = 0001)
}

export const useDocumentNumbering = () => {
  const settings = useSettings();

  // Get numbering config for document type
  const getNumberingConfig = (type: DocumentType): NumberingConfig => {
    const numbering = settings.numberingRules;

    switch (type) {
      case 'invoice':
        return {
          prefix: numbering.salePrefix || 'INV-', // CRITICAL FIX: Use salePrefix (not salesPrefix)
          nextNumber: numbering.saleNextNumber || 1, // CRITICAL FIX: Use saleNextNumber (not salesNextNumber)
          padding: 4
        };
      
      case 'quotation':
        return {
          prefix: numbering.quotationPrefix || 'QT',
          nextNumber: numbering.quotationNextNumber || 1,
          padding: 4
        };
      
      case 'draft':
        return {
          prefix: 'DRAFT',
          nextNumber: numbering.draftNextNumber || 1,
          padding: 4
        };
      
      case 'order':
        return {
          prefix: 'SO',
          nextNumber: numbering.orderNextNumber || 1,
          padding: 4
        };
      
      case 'purchase':
        return {
          prefix: numbering.purchasePrefix,
          nextNumber: numbering.purchaseNextNumber,
          padding: 4
        };
      
      case 'rental':
        return {
          prefix: numbering.rentalPrefix,
          nextNumber: numbering.rentalNextNumber,
          padding: 4
        };
      
      case 'studio':
        return {
          prefix: numbering.studioPrefix,
          nextNumber: numbering.studioNextNumber,
          padding: 4
        };
      
      case 'expense':
        return {
          prefix: numbering.expensePrefix,
          nextNumber: numbering.expenseNextNumber,
          padding: 4
        };
      
      default:
        return {
          prefix: 'DOC',
          nextNumber: 1,
          padding: 4
        };
    }
  };

  // Generate next document number
  const generateDocumentNumber = (type: DocumentType): string => {
    const config = getNumberingConfig(type);
    const paddedNumber = String(config.nextNumber).padStart(config.padding, '0');
    return `${config.prefix}${paddedNumber}`;
  };

  // Generate preview (for settings page)
  const getNumberPreview = (type: DocumentType): string => {
    return generateDocumentNumber(type);
  };

  // Increment next number (call this after creating a document)
  const incrementNextNumber = (type: DocumentType) => {
    // This will be handled by SettingsContext.updateNumberingRules
    const config = getNumberingConfig(type);
    const updatedNumbering = { ...settings.numberingRules };

    switch (type) {
      case 'invoice':
        updatedNumbering.saleNextNumber = (updatedNumbering.saleNextNumber || config.nextNumber || 1) + 1; // CRITICAL FIX: Use saleNextNumber (not salesNextNumber)
        break;
      case 'quotation':
        updatedNumbering.quotationNextNumber = config.nextNumber + 1;
        break;
      case 'draft':
        updatedNumbering.draftNextNumber = (updatedNumbering.draftNextNumber || 1) + 1;
        break;
      case 'order':
        updatedNumbering.orderNextNumber = (updatedNumbering.orderNextNumber || 1) + 1;
        break;
      case 'purchase':
        updatedNumbering.purchaseNextNumber = config.nextNumber + 1;
        break;
      case 'rental':
        updatedNumbering.rentalNextNumber = config.nextNumber + 1;
        break;
      case 'studio':
        updatedNumbering.studioNextNumber = config.nextNumber + 1;
        break;
      case 'expense':
        updatedNumbering.expenseNextNumber = config.nextNumber + 1;
        break;
    }

    settings.updateNumberingRules(updatedNumbering);
  };

  return {
    generateDocumentNumber,
    getNumberPreview,
    incrementNextNumber,
    getNumberingConfig
  };
};
