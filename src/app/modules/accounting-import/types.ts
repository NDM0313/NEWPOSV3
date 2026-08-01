/**
 * Universal Accounting Import Center — shared types (Phase 1: fund transfers).
 */

import type { CsvRowValidation } from '@/app/modules/csv-workbench/types';

export type AccountingImportProfileId = 'fund_transfers';

export type AccountingImportStep =
  | 'select_profile'
  | 'upload'
  | 'preview'
  | 'dry_run'
  | 'commit'
  | 'done';

export interface AccountingImportProfileMeta {
  id: AccountingImportProfileId;
  displayName: string;
  description: string;
  /** Phase 1 only fund_transfers is implemented */
  isImplemented: boolean;
}

export type { CsvRowValidation };
