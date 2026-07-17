import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check, Search, Paperclip } from 'lucide-react';
import type { User } from '../../types';
import { DateInputField } from '../shared/DateTimePicker';
import { getAccounts, createJournalEntry } from '../../api/accounts';
import { addPending } from '../../lib/offlineStore';
import { useSubmitLock } from '../../contexts/LoadingContext';
import { localNowDateString } from '../../utils/localDate';
import { usePermissions } from '../../context/PermissionContext';
import { formatAccountBalanceInline } from '../../utils/balancePrivacy';
import { isRealBranchUuid } from '../../utils/branchId';
import { AttachmentFilePicker } from '../shared/AttachmentFilePicker';
import { uploadJournalEntryAttachments } from '../../api/journalAttachments';
import { TransactionSuccessModal, type TransactionSuccessData } from '../shared/TransactionSuccessModal';
import { JournalDescriptionFields } from './JournalDescriptionFields';
import {
  buildGeneralJournalAutoDescription,
  composeJournalEntryDescription,
  readJournalAutoDescriptionEnabled,
} from '../../utils/journalEntryDescription';
import { accountInOutBadgeLabel, formatPostingFieldLabel, inOutSelectionClasses, POSTING_FIELD_TITLES } from '../../lib/accountPostingInOutLabel';

export interface GeneralEntrySeed {
  debitAccountId?: string;
  debitAccountName?: string;
  creditAccountId?: string;
  creditAccountName?: string;
  amount?: number;
  date?: string;
  userNotes?: string;
  reference?: string;
  attachmentFiles?: File[];
  /** When true, jump to amount/details step if both accounts are seeded. */
  startAtDetails?: boolean;
}

interface GeneralEntryFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
  seed?: GeneralEntrySeed | null;
}

interface AccountRow {
  id: string;
  name: string;
  code: string;
  type: string;
  balance: number;
}

interface EntryData {
  debitAccountId: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountName: string;
  amount: number;
  date: string;
  userNotes: string;
  reference: string;
}

function isPostingAccount(a: { isGroup?: boolean }): boolean {
  return a.isGroup !== true;
}

export function GeneralEntryFlow({ onBack, onComplete, user, companyId, branchId, seed }: GeneralEntryFlowProps) {
  const { canViewBalances } = usePermissions();
  const effectiveBranchId = isRealBranchUuid(branchId) ? branchId.trim() : null;
  const hasSeededAccounts = Boolean(seed?.debitAccountId && seed?.creditAccountId);
  const [step, setStep] = useState(hasSeededAccounts && seed?.startAtDetails !== false ? 3 : 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const { run: runSave, busy: submitting } = useSubmitLock();
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<TransactionSuccessData | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>(() =>
    seed?.attachmentFiles?.length ? [...seed.attachmentFiles] : []
  );
  const [entryData, setEntryData] = useState<EntryData>({
    debitAccountId: seed?.debitAccountId ?? '',
    debitAccountName: seed?.debitAccountName ?? '',
    creditAccountId: seed?.creditAccountId ?? '',
    creditAccountName: seed?.creditAccountName ?? '',
    amount: seed?.amount && seed.amount > 0 ? seed.amount : 0,
    date: seed?.date || localNowDateString(),
    userNotes: seed?.userNotes ?? '',
    reference: seed?.reference ?? '',
  });

  useEffect(() => {
    if (!companyId) return;
    getAccounts(companyId).then((r) => {
      if (r.data?.length) {
        setAccounts(
          r.data
            .filter(isPostingAccount)
            .map((a) => ({
              id: a.id,
              name: a.name,
              code: a.code,
              type: a.type,
              balance: a.balance,
            }))
        );
      }
    });
  }, [companyId]);

  const getAccount = (id: string) => accounts.find((a) => a.id === id);

  const autoDescription = useMemo(() => {
    if (!entryData.debitAccountId || !entryData.creditAccountId || entryData.amount <= 0) {
      return 'Complete amount and accounts to generate description.';
    }
    const debit = getAccount(entryData.debitAccountId);
    const credit = getAccount(entryData.creditAccountId);
    return buildGeneralJournalAutoDescription({
      debitName: entryData.debitAccountName,
      debitCode: debit?.code,
      creditName: entryData.creditAccountName,
      creditCode: credit?.code,
      addedByName: user.name,
    });
  }, [entryData, accounts, user.name]);

  const handleNextWithReset = () => {
    if (step < 3) {
      setStep(step + 1);
      setSearchQuery('');
    }
  };

  const handlePreviousWithReset = () => {
    if (step > 1) {
      setStep(step - 1);
      setSearchQuery('');
    }
  };

  const handleSubmit = async () => {
    if (!companyId || !entryData.debitAccountId || !entryData.creditAccountId || entryData.amount <= 0) return;
    await runSave('Saving entry...', async () => {
      setError(null);
      const desc = composeJournalEntryDescription({
        auto: autoDescription,
        userNotes: entryData.userNotes,
        reference: entryData.reference,
        includeAuto: readJournalAutoDescriptionEnabled(),
      });
      let attachments: { url: string; name: string }[] | undefined;
      if (attachmentFiles.length > 0) {
        const { results, failures } = await uploadJournalEntryAttachments(companyId, attachmentFiles);
        attachments = results.length > 0 ? results : undefined;
        if (failures.length > 0 && results.length < attachmentFiles.length) {
          setError(failures[0]?.userMessage ?? 'Some attachments did not upload.');
        }
      }
      const payload = {
        companyId,
        branchId: effectiveBranchId,
        entryDate: entryData.date,
        description: desc,
        referenceType: 'journal',
        lines: [
          { accountId: entryData.debitAccountId, debit: entryData.amount, credit: 0 },
          { accountId: entryData.creditAccountId, debit: 0, credit: entryData.amount },
        ],
        userId: user.id,
      };
      if (!navigator.onLine) {
        try {
          await addPending('journal_entry', payload, companyId, effectiveBranchId ?? '');
          setSuccessData({
            type: 'journal',
            title: 'Entry saved',
            transactionNo: null,
            amount: entryData.amount,
            partyName: `${entryData.debitAccountName} → ${entryData.creditAccountName}`,
            date: entryData.date,
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to save offline.');
        }
        return;
      }
      const { data, error: err } = await createJournalEntry({ ...payload, attachments });
      if (err) {
        setError(err);
        return;
      }
      setSuccessData({
        type: 'journal',
        title: 'Entry saved',
        transactionNo: data?.entry_no ?? null,
        amount: entryData.amount,
        partyName: `${entryData.debitAccountName} → ${entryData.creditAccountName}`,
        date: entryData.date,
      });
    });
  };

  const closeSuccess = () => {
    setSuccessData(null);
    onComplete();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return entryData.debitAccountId !== '';
      case 2:
        return entryData.creditAccountId !== '' && entryData.creditAccountId !== entryData.debitAccountId;
      case 3:
        return entryData.amount > 0;
      default:
        return false;
    }
  };

  const filteredAccounts = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const debitAccount = entryData.debitAccountId ? getAccount(entryData.debitAccountId) : undefined;
  const creditAccount = entryData.creditAccountId ? getAccount(entryData.creditAccountId) : undefined;
  const debitInOut = debitAccount
    ? accountInOutBadgeLabel(debitAccount, 'debit')
    : null;
  const creditInOut = creditAccount
    ? accountInOutBadgeLabel(creditAccount, 'credit')
    : null;
  const debitChip = debitInOut ? inOutSelectionClasses(debitInOut) : null;
  const creditChip = creditInOut ? inOutSelectionClasses(creditInOut) : null;
  const debitSummaryLabel = formatPostingFieldLabel('Debit Account', {
    drCr: 'Dr',
    inOut: debitInOut ?? 'IN',
  });
  const creditSummaryLabel = formatPostingFieldLabel('Credit Account', {
    drCr: 'Cr',
    inOut: creditInOut ?? 'OUT',
  });

  return (
    <>
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={step === 1 ? onBack : handlePreviousWithReset} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">General Entry</h1>
            <p className="text-xs text-white/80">Manual journal entry</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
        <p className="text-xs text-white/80 mt-2">Step {step} of 3</p>
      </div>

      <div className="p-4">
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">{POSTING_FIELD_TITLES.journalDebit}</h2>
              <p className="text-xs text-[#9CA3AF]">Which account should be debited?</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
              />
            </div>
            <div className="space-y-2">
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => {
                  const inOut = accountInOutBadgeLabel(account, 'debit');
                  const colors = inOutSelectionClasses(inOut);
                  const selected = entryData.debitAccountId === account.id;
                  return (
                  <button
                    key={account.id}
                    onClick={() => setEntryData({ ...entryData, debitAccountId: account.id, debitAccountName: account.name })}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? colors.selected
                        : `bg-[#1F2937] border-[#374151] ${colors.hover}`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{account.name}</p>
                        <p className="text-xs text-[#9CA3AF]">
                          {account.code} · {account.type} ·{' '}
                          <span className={colors.badgeText}>{inOut}</span>
                        </p>
                        {formatAccountBalanceInline(account.balance, canViewBalances) && (
                          <p className="text-xs text-[#6B7280] mt-1">{formatAccountBalanceInline(account.balance, canViewBalances)}</p>
                        )}
                      </div>
                      {selected && <Check className={colors.check} size={20} />}
                    </div>
                  </button>
                  );
                })
              ) : (
                <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">No accounts found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-2">{POSTING_FIELD_TITLES.journalCredit}</h2>
              <p className="text-xs text-[#9CA3AF]">Which account should be credited?</p>
              {entryData.debitAccountName && (
                <div className={`mt-3 p-2 border rounded-lg ${debitChip?.chip ?? 'bg-[#EF4444]/10 border-[#EF4444]/30'}`}>
                  <p className="text-xs text-[#9CA3AF]">Debit Account{debitInOut ? ` · ${debitInOut}` : ''}:</p>
                  <p className="text-sm text-white font-medium">{entryData.debitAccountName}</p>
                </div>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20"
              />
            </div>
            <div className="space-y-2">
              {filteredAccounts.filter((acc) => acc.id !== entryData.debitAccountId).length > 0 ? (
                filteredAccounts
                  .filter((acc) => acc.id !== entryData.debitAccountId)
                  .map((account) => {
                    const inOut = accountInOutBadgeLabel(account, 'credit');
                    const colors = inOutSelectionClasses(inOut);
                    const selected = entryData.creditAccountId === account.id;
                    return (
                    <button
                      key={account.id}
                      onClick={() => setEntryData({ ...entryData, creditAccountId: account.id, creditAccountName: account.name })}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? colors.selected
                          : `bg-[#1F2937] border-[#374151] ${colors.hover}`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{account.name}</p>
                          <p className="text-xs text-[#9CA3AF]">
                            {account.code} · {account.type} ·{' '}
                            <span className={colors.badgeText}>{inOut}</span>
                          </p>
                          {formatAccountBalanceInline(account.balance, canViewBalances) && (
                            <p className="text-xs text-[#6B7280] mt-1">{formatAccountBalanceInline(account.balance, canViewBalances)}</p>
                          )}
                        </div>
                        {selected && <Check className={colors.check} size={20} />}
                      </div>
                    </button>
                    );
                  })
              ) : (
                <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">No accounts found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {error && <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#EF4444]">{error}</div>}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Selected Accounts</h2>
              <div className="space-y-2">
                <div className={`p-3 border rounded-lg ${debitChip?.chip ?? 'bg-[#10B981]/10 border-[#10B981]/30'}`}>
                  <p className="text-xs text-[#9CA3AF] mb-1">{debitSummaryLabel}</p>
                  <p className="text-sm text-white font-semibold">{entryData.debitAccountName}</p>
                </div>
                <div className={`p-3 border rounded-lg ${creditChip?.chip ?? 'bg-[#EF4444]/10 border-[#EF4444]/30'}`}>
                  <p className="text-xs text-[#9CA3AF] mb-1">{creditSummaryLabel}</p>
                  <p className="text-sm text-white font-semibold">{entryData.creditAccountName}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Amount (Rs.) *</label>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9.]*"
                min="0"
                step="0.01"
                value={entryData.amount || ''}
                onChange={(e) => setEntryData({ ...entryData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full max-w-full min-w-0 px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white text-lg font-semibold placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6] box-border"
              />
            </div>

            <DateInputField label="Entry Date" value={entryData.date} onChange={(date) => setEntryData({ ...entryData, date })} pickerLabel="SELECT ENTRY DATE" />

            <JournalDescriptionFields
              autoDescription={autoDescription}
              userNotes={entryData.userNotes}
              onUserNotesChange={(userNotes) => setEntryData({ ...entryData, userNotes })}
              reference={entryData.reference}
              onReferenceChange={(reference) => setEntryData({ ...entryData, reference })}
              referenceLabel="Reference / Voucher # (Optional)"
              referencePlaceholder="e.g., Invoice #123, Receipt #456"
              focusBorderClass="focus:border-[#8B5CF6]"
            />

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="w-4 h-4 text-[#9CA3AF]" />
                <span className="block text-sm font-medium text-[#D1D5DB]">Attachment (Optional)</span>
              </div>
              <AttachmentFilePicker
                files={attachmentFiles}
                onChange={setAttachmentFiles}
                onError={(message) => setError(message)}
                ocrEnabled
                getExistingNotes={() => entryData.userNotes}
                onOcrApply={(patch) => {
                  setEntryData((prev) => ({
                    ...prev,
                    ...(patch.amount != null ? { amount: patch.amount } : {}),
                    ...(patch.date ? { date: patch.date } : {}),
                    ...(patch.reference ? { reference: patch.reference } : {}),
                    ...(patch.notes != null ? { userNotes: patch.notes } : {}),
                  }));
                }}
              />
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#8B5CF6] rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">{user.name.split(' ').map((n) => n[0]).join('')}</span>
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Added By</p>
                  <p className="text-sm text-white font-medium">{user.name}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60] fixed-bottom-above-nav">
        <button
          onClick={step === 3 ? handleSubmit : handleNextWithReset}
          disabled={!canProceed() || submitting}
          className={`w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all ${
            step === 3 ? 'bg-gradient-to-r from-[#10B981] to-[#059669]' : 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED]'
          }`}
        >
          {step === 3 ? (
            <>
              <Check size={18} />
              Save Entry
            </>
          ) : (
            <>
              Next
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
    <TransactionSuccessModal
      isOpen={!!successData}
      data={successData}
      onClose={closeSuccess}
      onOk={closeSuccess}
    />
    </>
  );
}
