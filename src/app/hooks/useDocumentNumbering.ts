// ============================================
// 🎯 DOCUMENT NUMBERING HOOK
// ============================================
// Centralized hook for generating document numbers
// Uses Settings → Numbering Rules (safe when used outside SettingsProvider)

import { useContext } from 'react';
import { SettingsContext } from '@/app/context/SettingsContext';

export type DocumentType = 
  | 'invoice' 
  | 'quotation'
  | 'draft'
  | 'order'
  | 'pos'
  | 'purchase' 
  | 'rental' 
  | 'studio' 
  | 'expense'
  | 'production';

interface NumberingConfig {
  prefix: string;
  nextNumber: number;
  padding: number; // Number of digits (e.g., 4 = 0001)
}

const DEFAULT_NUMBERING = {
  salePrefix: 'SL-',
  saleNextNumber: 1,
  quotationPrefix: 'QT-',
  quotationNextNumber: 1,
  draftPrefix: 'DRAFT-',
  draftNextNumber: 1,
  orderPrefix: 'SO-',
  orderNextNumber: 1,
  posPrefix: 'POS-',
  posNextNumber: 1,
  purchasePrefix: 'PO-',
  purchaseNextNumber: 1,
  rentalPrefix: 'RNT-',
  rentalNextNumber: 1,
  expensePrefix: 'EXP-',
  expenseNextNumber: 1,
  productPrefix: 'PRD-',
  productNextNumber: 1,
  studioPrefix: 'STD-',
  studioNextNumber: 1,
  productionPrefix: 'PRD-',
  productionNextNumber: 1,
};

export const useDocumentNumbering = () => {
  const settings = useContext(SettingsContext);
  const numbering = settings?.numberingRules ?? DEFAULT_NUMBERING;

  // Get numbering config for document type
  const getNumberingConfig = (type: DocumentType): NumberingConfig => {
    switch (type) {
      case 'invoice':
        return {
          prefix: numbering.salePrefix || 'SL-', // Regular sale: SL-0001
          nextNumber: numbering.saleNextNumber || 1,
          padding: 4
        };
      
      case 'quotation':
        return {
          prefix: numbering.quotationPrefix || 'QT-',
          nextNumber: numbering.quotationNextNumber || 1,
          padding: 4
        };
      
      case 'draft':
        return {
          prefix: numbering.draftPrefix || 'DRAFT-',
          nextNumber: numbering.draftNextNumber || 1,
          padding: 4
        };
      
      case 'order':
        return {
          prefix: numbering.orderPrefix || 'SO-',
          nextNumber: numbering.orderNextNumber || 1,
          padding: 4
        };
      
      case 'pos':
        return {
          prefix: numbering.posPrefix || 'POS-',
          nextNumber: numbering.posNextNumber || 1,
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

      case 'production':
        return {
          prefix: numbering.productionPrefix || 'PRD-',
          nextNumber: numbering.productionNextNumber ?? 1,
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
    // Ensure nextNumber is a valid number
    const nextNum = typeof config.nextNumber === 'number' && !isNaN(config.nextNumber) 
      ? config.nextNumber 
      : 1;
    const paddedNumber = String(nextNum).padStart(config.padding, '0');
    const prefix = config.prefix || 'DOC';
    const result = `${prefix}${paddedNumber}`;
    
    // Validate result is not undefined or contains invalid values
    if (!result || result.includes('undefined') || result.includes('NaN')) {
      console.error('[DOCUMENT NUMBERING] Invalid document number generated:', { type, config, result });
      return `${prefix}001`; // Fallback to safe default
    }
    
    return result;
  };

  // Generate preview (for settings page)
  const getNumberPreview = (type: DocumentType): string => {
    return generateDocumentNumber(type);
  };

  // Increment next number (call this after creating a document)
  const incrementNextNumber = (type: DocumentType) => {
    if (!settings?.updateNumberingRules) return;
    const config = getNumberingConfig(type);
    const updatedNumbering = { ...numbering };

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
      case 'pos':
        updatedNumbering.posNextNumber = (updatedNumbering.posNextNumber || config.nextNumber || 1) + 1;
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
      case 'production':
        updatedNumbering.productionNextNumber = (config.nextNumber || 1) + 1;
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
