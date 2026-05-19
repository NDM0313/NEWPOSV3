/**
 * Backup ZIP package types (client-only CSV workbench).
 */

export const BACKUP_SCHEMA_VERSION = 1;

/** Entity keys inside manifest.files */
export type BackupEntityKey =
  | 'contacts_customers'
  | 'contacts_suppliers'
  | 'contacts_workers'
  | 'products'
  | 'product_variations'
  | 'inventory_stock_balances'
  | 'sales'
  | 'sales_items'
  | 'purchases'
  | 'purchase_items'
  | 'sale_returns'
  | 'sale_return_items'
  | 'purchase_returns'
  | 'purchase_return_items'
  | 'rentals'
  | 'rental_items'
  | 'rental_payments'
  | 'expenses';

export type BackupEntityPhase = 1 | 2 | 3;

export interface BackupManifestFileEntry {
  filename: string;
  row_count: number;
  phase: BackupEntityPhase;
  commit_implemented: boolean;
}

export interface BackupManifest {
  schema_version: number;
  exported_at: string;
  company_id: string;
  company_name?: string;
  branch_id: string | null;
  branch_scope: 'all' | 'single';
  files: Partial<Record<BackupEntityKey, BackupManifestFileEntry>>;
}

export type BackupPackageFiles = Partial<Record<BackupEntityKey, string>>;

export interface ParsedBackupPackage {
  manifest: BackupManifest;
  files: BackupPackageFiles;
}

export interface AuditIssue {
  entity: BackupEntityKey | 'package';
  severity: 'error' | 'warning';
  message: string;
  rowIndex?: number;
}

export interface RestoreAuditResult {
  blocking: AuditIssue[];
  warnings: AuditIssue[];
  entitySummaries: Array<{
    key: BackupEntityKey;
    rowCount: number;
    parseOk: boolean;
    commitImplemented: boolean;
  }>;
}

export interface RestoreCommitProgress {
  entity: BackupEntityKey;
  phase: BackupEntityPhase;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
  message?: string;
}

export interface RestoreCommitResult {
  progress: RestoreCommitProgress[];
  summaries: Record<string, { created?: number; skipped?: number; failed?: number; errors?: unknown[] }>;
}
