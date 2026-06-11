import { useState } from 'react';

import { ArrowLeft, Loader2 } from 'lucide-react';

import { CustomSelect } from '../common';

import * as accountsApi from '../../api/accounts';

import { OPERATIONAL_ACCOUNT_ROLES } from '../../api/accounts';

import { ensureDefaultAccounts } from '../../api/defaultAccounts';

import { dispatchMobileAccountingInvalidated } from '../../lib/dataInvalidationBus';

import { resolveCanonicalParentId, type OperationalLedgerRole } from '../../lib/accountHierarchy';

import { getOperationalCodeWithParent } from '../../lib/operationalAccountCode';

import { useSubmitLock } from '../../contexts/LoadingContext';

import { SaveBlockingOverlay } from '../common/SaveBlockingOverlay';



type OperationalRole = (typeof OPERATIONAL_ACCOUNT_ROLES)[number]['value'];



interface AddAccountFormProps {

  onBack: () => void;

  onSuccess: () => void;

  companyId: string | null;

}



export function AddAccountForm({ onBack, onSuccess, companyId }: AddAccountFormProps) {

  const [code, setCode] = useState('');

  const [name, setName] = useState('');

  const [role, setRole] = useState<OperationalRole>(OPERATIONAL_ACCOUNT_ROLES[0].value);

  const [balance, setBalance] = useState('');

  const { run: runSave, busy: saving } = useSubmitLock();

  const [error, setError] = useState('');



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

    const hierarchyList = list.map((a) => ({

      id: a.id,

      code: a.code,

      name: a.name,

      type: a.type,

      parent_id: a.parentId ?? null,

      is_group: a.isGroup ?? false,

    }));



    const accountCode = getOperationalCodeWithParent(role as OperationalLedgerRole, hierarchyList, code.trim());

    const parentId = resolveCanonicalParentId(hierarchyList, role as OperationalLedgerRole);



    const { data, error: err } = await accountsApi.createAccount(companyId, {

      code: accountCode,

      name: trimmedName,

      type: role,

      balance: balance === '' ? 0 : parseFloat(balance) || 0,

      is_active: true,

      parent_id: parentId,

    });

    if (err) {

      setError(err);

      return;

    }

    if (data) {

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

          <button onClick={onBack} disabled={saving} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white disabled:opacity-50">

            <ArrowLeft className="w-5 h-5" />

          </button>

          <div>

            <h1 className="font-semibold text-white">Add Account</h1>

            <p className="text-xs text-white/80">Chart of Accounts (same rules as Web ERP)</p>

          </div>

        </div>

      </div>



      <form onSubmit={handleSubmit} className="p-4 space-y-4">

        {error && (

          <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-[#EF4444] text-sm">

            {error}

          </div>

        )}



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



        <div>

          <CustomSelect

            label="Account role *"

            value={role}

            onChange={(v) => setRole(v as OperationalRole)}

            options={OPERATIONAL_ACCOUNT_ROLES.map((t) => ({ value: t.value, label: t.label }))}

            zIndexClass="z-[100]"

          />

          <p className="text-xs text-[#6B7280] mt-2">

            Cash / Bank / Wallet / AR / AP sub-accounts link under the same canonical groups as Web ERP (1050, 1060, 1070,

            1100, 2000). Expense and Income stay top-level unless added from Web Professional tab.

          </p>

        </div>



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

