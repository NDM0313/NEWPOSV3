import { useState, useEffect, useMemo } from 'react';

import { ArrowLeft, Loader2 } from 'lucide-react';

import { CustomSelect, CustomSearchableSheet } from '../common';

import * as accountsApi from '../../api/accounts';

import { OPERATIONAL_ACCOUNT_ROLES, type AccountRow } from '../../api/accounts';

import { ensureDefaultAccounts } from '../../api/defaultAccounts';

import { syncChartAccountOpening } from '../../api/openingBalanceJournal';

import { dispatchMobileAccountingInvalidated } from '../../lib/dataInvalidationBus';

import { resolveCanonicalParentId, type OperationalLedgerRole } from '../../lib/accountHierarchy';

import { getOperationalCodeWithParent } from '../../lib/operationalAccountCode';

import {
  accountMatchesProfessionalCategory,
  mapDbAccountTypeToOpeningCategory,
  type ProfessionalCategory,
} from '../../lib/accountProfessionalCategory';

import { getNextChildAccountCode, isPartyOrLinkedLeafAccount } from '../../lib/addAccountCoaPicker';

import { useSubmitLock } from '../../contexts/LoadingContext';

import { SaveBlockingOverlay } from '../common/SaveBlockingOverlay';

import { localNowDateString, toLocalDateString } from '../../utils/localDate';
import { DateInputField } from '../shared/DateTimePicker';

type OperationalRole = (typeof OPERATIONAL_ACCOUNT_ROLES)[number]['value'];

type AddMode = 'operational' | 'professional';

const PROFESSIONAL_CATEGORIES: { value: ProfessionalCategory; label: string }[] = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
];

interface AddAccountFormProps {
  onBack: () => void;
  onSuccess: () => void;
  companyId: string | null;
}

function toHierarchyList(list: AccountRow[]) {
  return list.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    parent_id: a.parentId ?? null,
    is_group: a.isGroup ?? false,
    linked_contact_id: a.linkedContactId ?? null,
  }));
}

export function AddAccountForm({ onBack, onSuccess, companyId }: AddAccountFormProps) {
  const [mode, setMode] = useState<AddMode>('operational');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<OperationalRole>(OPERATIONAL_ACCOUNT_ROLES[0].value);
  const [professionalCategory, setProfessionalCategory] = useState<ProfessionalCategory>('asset');
  const [parentId, setParentId] = useState('');
  const [balance, setBalance] = useState('');
  const [openingDate, setOpeningDate] = useState(() => localNowDateString());
  const [existingAccounts, setExistingAccounts] = useState<AccountRow[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const { run: runSave, busy: saving } = useSubmitLock();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyId) return;
    setLoadingAccounts(true);
    accountsApi.getAccounts(companyId).then(({ data }) => {
      setExistingAccounts(data || []);
      setLoadingAccounts(false);
    });
  }, [companyId]);

  useEffect(() => {
    if (mode !== 'professional' || !parentId || !existingAccounts.length) return;
    if (code.trim()) return;
    const parent = existingAccounts.find((a) => a.id === parentId);
    if (!parent) return;
    setCode(
      getNextChildAccountCode(
        { id: parent.id, code: parent.code, parent_id: parent.parentId ?? null },
        existingAccounts.map((a) => ({ id: a.id, code: a.code, parent_id: a.parentId ?? null })),
      ),
    );
  }, [parentId, professionalCategory, existingAccounts, mode, code]);

  const parentOptions = useMemo(() => {
    const candidates = existingAccounts.filter(
      (a) =>
        !isPartyOrLinkedLeafAccount({
          id: a.id,
          code: a.code,
          name: a.name,
          linked_contact_id: a.linkedContactId ?? null,
        }) &&
        accountMatchesProfessionalCategory(
          { type: a.type, code: a.code, name: a.name },
          professionalCategory,
        ),
    );
    return [
      { value: '', label: 'None (top-level)', description: 'No parent account' },
      ...candidates.map((a) => ({
        value: a.id,
        label: `${String(a.code ?? '').trim()} — ${String(a.name ?? '').trim()}`,
      })),
    ];
  }, [existingAccounts, professionalCategory]);

  const openingAmount = balance === '' ? 0 : parseFloat(balance) || 0;
  const showOpeningDate = Math.abs(openingAmount) >= 0.01;

  const professionalValidation = (): string | null => {
    if (!name.trim()) return 'Account name is required.';
    if (!parentId) return null;
    const parent = existingAccounts.find((a) => a.id === parentId);
    if (!parent) return null;
    const p = String(parent.type || '').toLowerCase().trim();
    const childType = professionalCategory;
    const compatible =
      p === childType ||
      (childType === 'asset' && ['cash', 'bank', 'mobile_wallet', 'asset'].includes(p)) ||
      (childType === 'liability' && ['liability', 'payable'].includes(p)) ||
      (childType === 'equity' && p === 'equity') ||
      (childType === 'revenue' && ['revenue', 'income'].includes(p)) ||
      (childType === 'expense' && p === 'expense');
    if (!compatible) {
      return `Parent type "${p}" is not valid for category "${childType}" (e.g. link bank sub-accounts under the Bank group 1010).`;
    }
    return null;
  };

  const postOpeningIfNeeded = async (params: {
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
  }) => {
    const ob = Math.round((Number(openingAmount) || 0) * 100) / 100;
    if (Math.abs(ob) < 0.01) return;
    try {
      await syncChartAccountOpening({
        companyId: companyId!,
        accountId: params.accountId,
        accountCode: params.accountCode,
        accountName: params.accountName,
        category: mapDbAccountTypeToOpeningCategory(params.accountType),
        openingAmount: ob,
        entryDate: openingDate,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Opening balance did not post to GL.';
      setError(`Account saved but opening balance did not post: ${msg}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      setError('Company not set.');
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Account name is required.');
      return;
    }
    if (mode === 'professional') {
      const vErr = professionalValidation();
      if (vErr) {
        setError(vErr);
        return;
      }
    }
    setError('');

    await runSave('Saving account...', async () => {
      const seedErr = await ensureDefaultAccounts(companyId);
      if (seedErr.error) {
        setError(seedErr.error);
        return;
      }

      const { data: acctList, error: loadErr } = await accountsApi.getAccounts(companyId);
      if (loadErr) {
        setError(loadErr);
        return;
      }
      const list = acctList || [];
      const hierarchyList = toHierarchyList(list);

      let accountCode: string;
      let accountType: string;
      let parent_id: string | null = null;

      if (mode === 'operational') {
        accountType = role;
        accountCode = getOperationalCodeWithParent(role as OperationalLedgerRole, hierarchyList, code.trim());
        parent_id = resolveCanonicalParentId(hierarchyList, role as OperationalLedgerRole);
      } else {
        accountType = professionalCategory;
        parent_id = parentId || null;
        const trimmedCode = code.trim();
        if (trimmedCode) {
          accountCode = trimmedCode;
        } else if (parent_id) {
          const parent = list.find((a) => a.id === parent_id);
          accountCode = parent
            ? getNextChildAccountCode(
                { id: parent.id, code: parent.code, parent_id: parent.parentId ?? null },
                list.map((a) => ({ id: a.id, code: a.code, parent_id: a.parentId ?? null })),
              )
            : '';
        } else {
          accountCode = '';
        }
      }

      const { data, error: err } = await accountsApi.createAccount(companyId, {
        code: accountCode || undefined,
        name: trimmedName,
        type: accountType,
        balance: 0,
        is_active: true,
        parent_id,
      });
      if (err) {
        setError(err);
        return;
      }
      if (data) {
        await postOpeningIfNeeded({
          accountId: data.id,
          accountCode: data.code,
          accountName: data.name,
          accountType,
        });
        dispatchMobileAccountingInvalidated({
          companyId,
          reason: 'account-created',
        });
        onSuccess();
      }
    });
  };

  return (
    <div className="relative min-h-screen pb-24 bg-[#111827]">
      <SaveBlockingOverlay active={saving} label="Saving account..." />
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            disabled={saving}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-white">Add Account</h1>
            <p className="text-xs text-white/80">Operational or full chart of accounts</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-[#EF4444] text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-2 bg-[#1F2937] p-1 rounded-xl border border-[#374151]">
          {(['operational', 'professional'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setMode(tab);
                setError('');
              }}
              disabled={saving}
              className={`py-2.5 rounded-lg text-sm font-medium capitalize transition-colors disabled:opacity-50 ${
                mode === tab ? 'bg-[#F59E0B] text-white' : 'text-[#9CA3AF] hover:bg-[#374151]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {mode === 'operational' ? (
          <>
            <div>
              <CustomSelect
                label="Account role *"
                value={role}
                onChange={(v) => setRole(v as OperationalRole)}
                options={OPERATIONAL_ACCOUNT_ROLES.map((t) => ({ value: t.value, label: t.label }))}
                zIndexClass="z-[100]"
              />
              <p className="text-xs text-[#6B7280] mt-2">
                Cash / Bank / Wallet / AR / AP sub-accounts link under the same canonical groups as Web ERP (1050, 1060,
                1070, 1100, 2000). Expense and Income stay top-level unless added from Professional tab.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Account name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Cash"
                className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Code (optional – auto under parent)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Leave blank for next code in group"
                className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
              />
            </div>
          </>
        ) : (
          <>
            <CustomSelect
              label="Category *"
              value={professionalCategory}
              onChange={(v) => {
                setProfessionalCategory(v as ProfessionalCategory);
                setParentId('');
                setCode('');
              }}
              options={PROFESSIONAL_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              zIndexClass="z-[100]"
            />

            {loadingAccounts ? (
              <p className="text-sm text-[#9CA3AF] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Loading accounts…
              </p>
            ) : (
              <CustomSearchableSheet
                label="Parent account (optional)"
                sheetTitle="Select parent account"
                value={parentId}
                onChange={(v) => {
                  setParentId(v);
                  if (!v) setCode('');
                }}
                options={parentOptions}
                placeholder="Search parent by code or name…"
                searchPlaceholder="Search accounts…"
                hint="Pick a group header (e.g. 1170) or leave top-level."
                zIndexClass="z-[100]"
              />
            )}

            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Account name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Committee fund A"
                className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Code (optional – auto when parent set)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Leave blank to suggest next child code"
                className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-[#9CA3AF] mb-2">Opening balance (optional)</label>
          <input
            type="number"
            inputMode="decimal"
            pattern="[0-9.]*"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        {showOpeningDate && (
          <DateInputField
            label="Opening balance effective date"
            value={openingDate}
            onChange={(v) => setOpeningDate(toLocalDateString(v))}
            max={localNowDateString()}
            helperText="Journal entry date for this opening balance."
          />
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {saving ? 'Saving...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
