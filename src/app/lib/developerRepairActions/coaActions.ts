/**
 * COA safe display-field repair actions (Phase F2).
 */

import { classifyAccountEditSafety, type CoaAccountRow } from '@/app/lib/coaHealthChecks';
import { computeDryRunHash } from '@/app/lib/developerRepairHash';
import type { ApplyResult, DeveloperRepairAction, DeveloperRepairContext, DryRunResult } from '@/app/lib/developerRepairTypes';
import { accountService } from '@/app/services/accountService';
import { supabase } from '@/lib/supabase';

function mapAccountRow(account: Record<string, unknown>): CoaAccountRow {
  return {
    id: String(account.id),
    code: account.code as string | null,
    name: account.name as string | null,
    type: account.type as string | null,
    parent_id: account.parent_id as string | null,
    is_active: account.is_active as boolean | null,
    is_group: account.is_group as boolean | null,
  };
}

async function loadAccountSnapshot(companyId: string, accountId: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, company_id, code, name, type, parent_id, is_active, is_group, description')
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (String((data as { company_id?: string }).company_id) !== companyId) return null;

  const { count } = await supabase
    .from('journal_entry_lines')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);
  const lineCount = count ?? 0;
  const mapped = mapAccountRow(data as Record<string, unknown>);
  const editSafety = classifyAccountEditSafety(mapped, lineCount);

  return {
    account: data as Record<string, unknown>,
    mapped,
    lineCount,
    editSafety,
  };
}

function accountBefore(snapshot: NonNullable<Awaited<ReturnType<typeof loadAccountSnapshot>>>) {
  const a = snapshot.account;
  return {
    accountId: String(a.id),
    code: String(a.code || ''),
    name: String(a.name || ''),
    description: (a.description as string | null) ?? null,
    is_active: a.is_active !== false,
    type: String(a.type || ''),
    parent_id: (a.parent_id as string | null) ?? null,
    lineCount: snapshot.lineCount,
    editSafety: snapshot.editSafety,
  };
}

function buildCoaAction(
  id: string,
  title: string,
  description: string,
  confirmSuffix: string,
  validate: (
    snapshot: NonNullable<Awaited<ReturnType<typeof loadAccountSnapshot>>>,
    params: Record<string, unknown>
  ) => { ok: boolean; reason?: string; afterPreview?: Record<string, unknown> },
  applyPatch: (
    snapshot: NonNullable<Awaited<ReturnType<typeof loadAccountSnapshot>>>,
    params: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
): DeveloperRepairAction {
  return {
    id,
    title,
    description,
    riskLevel: 'low',
    requiredRole: 'super-admin',
    confirmPhrase: (params) => {
      const code = String(params.accountCode || params.code || 'ACCOUNT').trim().toUpperCase();
      return `${confirmSuffix}-${code}`;
    },
    whatItChanges: ['accounts display/metadata fields only'],
    whatItNeverChanges: [
      'Account code, type, parent_id',
      'Journal entry lines or amounts',
      'Delete or merge accounts',
    ],
    rollbackNote: 'Restore field from before_json using accountService.updateAccount.',
    auditPayload: (before, after) => ({ before, after }),
    dryRun: async (params, ctx) => {
      const accountId = String(params.accountId || '');
      if (!accountId) {
        return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'accountId required' };
      }
      const snapshot = await loadAccountSnapshot(ctx.companyId, accountId);
      if (!snapshot) {
        return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Account not found' };
      }
      const before = accountBefore(snapshot);
      const check = validate(snapshot, params);
      if (!check.ok) {
        return {
          ok: false,
          dryRunHash: '',
          before,
          afterPreview: before,
          blockedReason: check.reason,
          targetTable: 'accounts',
          targetId: accountId,
        };
      }
      const afterPreview = check.afterPreview || before;
      return {
        ok: true,
        dryRunHash: computeDryRunHash(id, params, before),
        before,
        afterPreview,
        targetTable: 'accounts',
        targetId: accountId,
        title,
      };
    },
    apply: async (params, ctx, dryRunHash) => {
      const accountId = String(params.accountId || '');
      const snapshot = await loadAccountSnapshot(ctx.companyId, accountId);
      if (!snapshot) return { ok: false, error: 'Account not found' };
      const before = accountBefore(snapshot);
      const expectedHash = computeDryRunHash(id, params, before);
      if (expectedHash !== dryRunHash) {
        return { ok: false, error: 'Dry-run hash mismatch — re-run dry-run' };
      }
      const check = validate(snapshot, params);
      if (!check.ok) return { ok: false, error: check.reason };
      try {
        const after = await applyPatch(snapshot, params);
        return { ok: true, after, message: `${title} applied` };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Apply failed' };
      }
    },
  };
}

export const coaRenameAccountAction = buildCoaAction(
  'coa.rename_account',
  'Rename account (display name)',
  'Updates accounts.name when structural fields stay locked.',
  'RENAME-ACCOUNT',
  (snapshot, params) => {
    if (snapshot.editSafety.cannotTouch && !snapshot.editSafety.canEditName) {
      return { ok: false, reason: snapshot.editSafety.reason };
    }
    if (!snapshot.editSafety.canEditName) {
      return { ok: false, reason: 'Name edit blocked for this account' };
    }
    const newName = String(params.newName || '').trim();
    if (!newName) return { ok: false, reason: 'newName is required' };
    const before = accountBefore(snapshot);
    return { ok: true, afterPreview: { ...before, name: newName } };
  },
  async (snapshot, params) => {
    const newName = String(params.newName || '').trim();
    const updated = await accountService.updateAccount(String(snapshot.account.id), { name: newName });
    if (!updated) throw new Error('Account update failed');
    return accountBefore({ ...snapshot, account: { ...snapshot.account, name: newName } });
  }
);

export const coaUpdateDescriptionAction = buildCoaAction(
  'coa.update_description',
  'Update account description',
  'Updates accounts.description when safe.',
  'UPDATE-DESCRIPTION',
  (snapshot, params) => {
    if (snapshot.editSafety.cannotTouch) {
      return { ok: false, reason: snapshot.editSafety.reason };
    }
    const newDescription = params.newDescription == null ? '' : String(params.newDescription);
    const before = accountBefore(snapshot);
    return { ok: true, afterPreview: { ...before, description: newDescription || null } };
  },
  async (snapshot, params) => {
    const newDescription = params.newDescription == null ? '' : String(params.newDescription);
    const updated = await accountService.updateAccount(String(snapshot.account.id), {
      description: newDescription || null,
    });
    if (!updated) throw new Error('Account update failed');
    return accountBefore({ ...snapshot, account: { ...snapshot.account, description: newDescription } });
  }
);

export const coaToggleActiveAction = buildCoaAction(
  'coa.toggle_active_if_safe',
  'Toggle account active (if safe)',
  'Sets accounts.is_active when no journal lines or safe inactive archive candidate.',
  'TOGGLE-ACTIVE',
  (snapshot, params) => {
    const targetActive = params.isActive === true || params.isActive === 'true';
    if (targetActive === false && snapshot.lineCount > 0) {
      return { ok: false, reason: 'Cannot deactivate account with journal lines' };
    }
    if (snapshot.editSafety.cannotTouch && !snapshot.editSafety.canArchive) {
      return { ok: false, reason: snapshot.editSafety.reason };
    }
    if (!targetActive && !snapshot.editSafety.canArchive && snapshot.lineCount > 0) {
      return { ok: false, reason: 'Archive blocked — account has transactions' };
    }
    const before = accountBefore(snapshot);
    return { ok: true, afterPreview: { ...before, is_active: targetActive } };
  },
  async (snapshot, params) => {
    const targetActive = params.isActive === true || params.isActive === 'true';
    const updated = await accountService.updateAccount(String(snapshot.account.id), {
      is_active: targetActive,
    });
    if (!updated) throw new Error('Account update failed');
    return accountBefore({ ...snapshot, account: { ...snapshot.account, is_active: targetActive } });
  }
);

export const COA_REPAIR_ACTIONS = [coaRenameAccountAction, coaUpdateDescriptionAction, coaToggleActiveAction];
