/**
 * Phased selective restore commit (Phase 1 masters + stock only).
 */

import { BACKUP_ENTITY_BY_KEY } from './backupEntityRegistry';
import { computeImportOrder } from './dependencyGraph';
import { commitContactImport, parseContactsCsvFile } from '../profiles/contactsProfile';
import {
  commitProductImport,
  parseProductsCsvFile,
  rowsFromParsedCsvWithIndices,
  type ProductCommitDeps,
} from '../profiles/productsProfile';
import {
  commitInventoryStockImport,
  parseInventoryStockCsvFile,
} from '../profiles/inventoryStockProfile';
import type {
  BackupEntityKey,
  ParsedBackupPackage,
  RestoreCommitProgress,
  RestoreCommitResult,
} from './types';

export interface CommitRestorePlanOptions {
  companyId: string;
  branchId: string | null;
  selected: Set<BackupEntityKey>;
  pkg: ParsedBackupPackage;
  productCommitDeps: ProductCommitDeps;
  onProgress?: (p: RestoreCommitProgress) => void;
}

export async function commitRestorePlan(
  options: CommitRestorePlanOptions
): Promise<RestoreCommitResult> {
  const { companyId, branchId, selected, pkg, productCommitDeps, onProgress } = options;
  const order = computeImportOrder(selected);
  const progress: RestoreCommitProgress[] = order.map((entity) => ({
    entity,
    phase: BACKUP_ENTITY_BY_KEY[entity].phase,
    status: 'pending',
  }));
  const summaries: RestoreCommitResult['summaries'] = {};

  const update = (entity: BackupEntityKey, patch: Partial<RestoreCommitProgress>) => {
    const idx = progress.findIndex((p) => p.entity === entity);
    if (idx >= 0) {
      progress[idx] = { ...progress[idx]!, ...patch };
      onProgress?.(progress[idx]!);
    }
  };

  for (const entity of order) {
    const def = BACKUP_ENTITY_BY_KEY[entity];
    const csv = pkg.files[entity];

    if (!def.commitImplemented) {
      update(entity, {
        status: 'skipped',
        message: 'Import commit not implemented (export/audit only).',
      });
      continue;
    }

    if (!csv?.trim()) {
      update(entity, { status: 'skipped', message: 'Empty file.' });
      continue;
    }

    update(entity, { status: 'running' });

    try {
      if (
        entity === 'contacts_customers' ||
        entity === 'contacts_suppliers' ||
        entity === 'contacts_workers'
      ) {
        const parsed = parseContactsCsvFile(csv);
        if (!parsed.ok || !parsed.data) {
          throw new Error(parsed.error ?? 'Parse failed');
        }
        let rows = parsed.data.rows;
        const wantType =
          entity === 'contacts_suppliers'
            ? 'supplier'
            : entity === 'contacts_workers'
              ? 'worker'
              : 'customer';
        rows = rows.map((r) => ({ ...r, type: wantType as typeof r.type }));
        const summary = await commitContactImport(rows, companyId);
        summaries[entity] = summary;
        update(entity, {
          status: summary.failed > 0 ? 'failed' : 'done',
          message: `Created ${summary.created}, skipped ${summary.skipped}, failed ${summary.failed}`,
        });
      } else if (entity === 'products') {
        const parsed = parseProductsCsvFile(csv);
        if (!parsed.ok || !parsed.data) {
          throw new Error(parsed.error ?? 'Parse failed');
        }
        const rows = rowsFromParsedCsvWithIndices(parsed.data.parsed);
        const summary = await commitProductImport(rows, {
          ...productCommitDeps,
          companyId,
          branchIdOrNull: branchId && branchId !== 'all' ? branchId : null,
        });
        summaries[entity] = summary;
        update(entity, {
          status: summary.failed > 0 ? 'failed' : 'done',
          message: `Created ${summary.created}, skipped ${summary.skipped}, failed ${summary.failed}`,
        });
      } else if (entity === 'inventory_stock_balances') {
        const parsed = parseInventoryStockCsvFile(csv);
        if (!parsed.ok || !parsed.data) {
          throw new Error(parsed.error ?? 'Parse failed');
        }
        const summary = await commitInventoryStockImport(
          parsed.data.rows,
          companyId,
          branchId
        );
        summaries[entity] = summary;
        update(entity, {
          status: summary.failed > 0 ? 'failed' : 'done',
          message: `Adjusted ${summary.adjusted}, skipped ${summary.skipped}, failed ${summary.failed}`,
        });
      } else {
        update(entity, { status: 'skipped', message: 'No commit handler.' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      update(entity, { status: 'failed', message: msg });
      summaries[entity] = { failed: 1, errors: [{ message: msg }] };
    }
  }

  return { progress, summaries };
}
