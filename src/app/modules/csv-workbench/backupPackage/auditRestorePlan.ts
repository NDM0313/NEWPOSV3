/**
 * Pre-flight audit for selective restore.
 */

import { BACKUP_ENTITY_BY_KEY } from './backupEntityRegistry';
import { countRowsInCsv } from './parseBackupPackage';
import { validateRestoreSelection } from './dependencyGraph';
import { parseContactsCsvFile } from '../profiles/contactsProfile';
import { parseProductsCsvFile } from '../profiles/productsProfile';
import { parseInventoryStockCsvFile } from '../profiles/inventoryStockProfile';
import type {
  AuditIssue,
  BackupEntityKey,
  ParsedBackupPackage,
  RestoreAuditResult,
} from './types';

function parseOperationalStub(_csv: string): { ok: boolean; error?: string } {
  return { ok: true };
}

const PARSERS: Partial<
  Record<BackupEntityKey, (csv: string) => { ok: boolean; error?: string }>
> = {
  contacts_customers: (csv) => {
    const r = parseContactsCsvFile(csv);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
  contacts_suppliers: (csv) => {
    const r = parseContactsCsvFile(csv);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
  contacts_workers: (csv) => {
    const r = parseContactsCsvFile(csv);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
  products: (csv) => {
    const r = parseProductsCsvFile(csv);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
  inventory_stock_balances: (csv) => {
    const r = parseInventoryStockCsvFile(csv);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  },
  sales: parseOperationalStub,
  purchases: parseOperationalStub,
  sales_items: parseOperationalStub,
  purchase_items: parseOperationalStub,
  expenses: parseOperationalStub,
  rentals: parseOperationalStub,
  rental_items: parseOperationalStub,
  rental_payments: parseOperationalStub,
  sale_returns: parseOperationalStub,
  sale_return_items: parseOperationalStub,
  purchase_returns: parseOperationalStub,
  purchase_return_items: parseOperationalStub,
  product_variations: parseOperationalStub,
};

export function auditRestorePlan(
  pkg: ParsedBackupPackage,
  selected: Set<BackupEntityKey>,
  activeCompanyId: string
): RestoreAuditResult {
  const blocking: AuditIssue[] = [];
  const warnings: AuditIssue[] = [];
  const entitySummaries: RestoreAuditResult['entitySummaries'] = [];

  if (pkg.manifest.company_id !== activeCompanyId) {
    blocking.push({
      entity: 'package',
      severity: 'error',
      message: `Backup company_id (${pkg.manifest.company_id}) does not match active company.`,
    });
  }

  const dep = validateRestoreSelection(selected);
  dep.errors.forEach((msg) => {
    blocking.push({ entity: 'package', severity: 'error', message: msg });
  });

  for (const key of selected) {
    const def = BACKUP_ENTITY_BY_KEY[key];
    const csv = pkg.files[key];
    const rowCount = countRowsInCsv(csv);
    let parseOk = true;

    if (!csv?.trim() && rowCount === 0) {
      warnings.push({
        entity: key,
        severity: 'warning',
        message: `${def.label} is selected but the CSV is empty.`,
      });
    } else if (csv) {
      const parser = PARSERS[key];
      if (parser) {
        const pr = parser(csv);
        if (!pr.ok) {
          parseOk = false;
          blocking.push({
            entity: key,
            severity: 'error',
            message: pr.error ?? `Failed to parse ${def.label} CSV.`,
          });
        }
      }
    }

    if (!def.commitImplemented && rowCount > 0) {
      const hasPhase2 = selected.has(key) && def.phase >= 2;
      if (hasPhase2) {
        warnings.push({
          entity: key,
          severity: 'warning',
          message: `${def.label} can be audited but import commit is not implemented yet (export-only).`,
        });
      }
    }

    entitySummaries.push({
      key,
      rowCount,
      parseOk,
      commitImplemented: def.commitImplemented,
    });
  }

  const commitSelected = [...selected].filter((k) => BACKUP_ENTITY_BY_KEY[k].commitImplemented);
  if (commitSelected.length === 0 && selected.size > 0) {
    blocking.push({
      entity: 'package',
      severity: 'error',
      message: 'No selected entities have import commit implemented. Choose Phase 1 entities (contacts, products, stock).',
    });
  }

  return { blocking, warnings, entitySummaries };
}
