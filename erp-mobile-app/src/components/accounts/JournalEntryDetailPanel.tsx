import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import {
  allowsDayBookUnifiedEdit,
  getMobileSalePurchaseOpenTarget,
} from '../../lib/journalEntryEditPolicy';
import { getJournalEntryById, type JournalEntryRow } from '../../api/accounts';
import {
  getAccountEntryDisplayConfig,
  type AccountEntry,
} from './AccountsDashboard';
import { EditTransactionSheet } from './reports/_shared/EditTransactionSheet';
import { dispatchMobileAccountingInvalidated } from '../../lib/dataInvalidationBus';

interface Props {
  entry: AccountEntry;
  companyId: string;
  branchId: string | null | undefined;
  onBack: () => void;
  onNavigateToDocumentEdit?: (kind: 'sale' | 'purchase', documentId: string) => void;
}

export function JournalEntryDetailPanel({
  entry,
  companyId,
  branchId,
  onBack,
  onNavigateToDocumentEdit,
}: Props) {
  const [detail, setDetail] = useState<JournalEntryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [showEditEntry, setShowEditEntry] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadErr(null);
      const { data, error } = await getJournalEntryById(companyId, entry.id);
      if (cancelled) return;
      if (error) setLoadErr(error);
      setDetail(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, entry.id]);

  const typeConfig = getAccountEntryDisplayConfig(entry);
  const canEditFromAccounts = allowsDayBookUnifiedEdit(entry.referenceType, entry.paymentId ?? null);
  const salePurchaseTarget = getMobileSalePurchaseOpenTarget(
    entry.referenceType,
    entry.referenceId ?? null,
    entry.paymentId ?? null,
  );

  const postedStr =
    detail?.posted_at || detail?.created_at
      ? new Date(detail.posted_at || detail.created_at || '').toLocaleString('en-PK', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

  const lineLabel = (l: NonNullable<JournalEntryRow['lines']>[0]) => {
    const name = l.account?.name?.trim();
    const code = (l.account as { code?: string } | undefined)?.code;
    if (name && code) return `${name} (${code})`;
    return name || code || 'Account';
  };

  return (
    <>
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-white truncate">{entry.entryNumber}</h1>
              <p className="text-xs text-white/80 truncate">{typeConfig.label}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Entry Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between pb-3 border-b border-[#374151] gap-2">
                <span className="text-sm text-[#9CA3AF] shrink-0">Source</span>
                <span className="text-sm text-white font-medium text-right">{typeConfig.label}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#374151] gap-2">
                <span className="text-sm text-[#9CA3AF] shrink-0">Reference</span>
                <span className="text-sm text-white font-mono text-right break-all">
                  {(entry.referenceType || '—').replace(/_/g, ' ')}
                  {entry.referenceId ? ` · ${entry.referenceId.slice(0, 8)}…` : ''}
                </span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#374151]">
                <span className="text-sm text-[#9CA3AF]">Entry date</span>
                <span className="text-sm text-white">{entry.date}</span>
              </div>
              {postedStr ? (
                <div className="flex justify-between pb-3 border-b border-[#374151]">
                  <span className="text-sm text-[#9CA3AF]">Posted</span>
                  <span className="text-sm text-white">{postedStr}</span>
                </div>
              ) : null}
              <div className="pb-3 border-b border-[#374151]">
                <p className="text-sm text-[#9CA3AF] mb-1">Description</p>
                <p className="text-sm text-white">{entry.description}</p>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#374151]">
                <span className="text-sm text-[#9CA3AF]">Total</span>
                <span className="text-lg text-white font-bold">
                  Rs. {(detail?.total_debit || entry.amount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#9CA3AF]">Status</span>
                <span className="px-2 py-1 bg-[#10B981]/20 text-[#10B981] rounded text-xs font-medium capitalize">
                  {entry.status}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-white mb-3">Journal lines (double entry)</h2>
            {loading ? (
              <div className="flex items-center gap-2 text-[#9CA3AF] py-6 justify-center">
                <Loader2 className="animate-spin w-5 h-5" />
                Loading lines…
              </div>
            ) : loadErr ? (
              <p className="text-sm text-red-400">{loadErr}</p>
            ) : !detail?.lines?.length ? (
              <p className="text-sm text-[#9CA3AF]">No lines found.</p>
            ) : (
              <table className="w-full text-xs min-w-[280px]">
                <thead>
                  <tr className="text-left text-[#9CA3AF] border-b border-[#374151]">
                    <th className="pb-2 pr-2 font-medium">Account</th>
                    <th className="pb-2 pr-2 font-medium text-right">Debit</th>
                    <th className="pb-2 font-medium text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l, idx) => (
                    <tr key={`${l.account_id}-${idx}`} className="border-b border-[#374151]/60">
                      <td className="py-2 pr-2 text-white align-top">
                        <span className="break-words">{lineLabel(l)}</span>
                        {l.description ? (
                          <span className="block text-[10px] text-[#6B7280] mt-0.5">{l.description}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 text-right text-[#FCA5A5] whitespace-nowrap">
                        {Number(l.debit || 0) > 0 ? Number(l.debit).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 text-right text-[#86EFAC] whitespace-nowrap">
                        {Number(l.credit || 0) > 0 ? Number(l.credit).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Audit Trail</h2>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-full flex items-center justify-center">
                <span className="text-white font-bold">{entry.addedBy.split(' ').map((n) => n[0]).join('')}</span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#9CA3AF]">Added By</p>
                <p className="text-sm font-semibold text-white">{entry.addedBy}</p>
                <p className="text-xs text-[#6B7280]">{entry.addedByRole}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#9CA3AF]">Created At</p>
                <p className="text-sm text-white">{entry.createdAt}</p>
              </div>
            </div>
          </div>

          {canEditFromAccounts ? (
            <button
              type="button"
              onClick={() => setShowEditEntry(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#4B5563] hover:bg-[#374151] rounded-lg text-white font-semibold text-sm"
            >
              Edit Entry
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="text-sm text-white font-medium mb-1">
                  {salePurchaseTarget
                    ? 'Invoices and purchases cannot be edited here — open Sales or Purchases to change the document.'
                    : 'This entry is controlled by its source module (inventory, opening balance, rental, returns, etc.). Edit it there, not from Accounts.'}
                </p>
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  {salePurchaseTarget
                    ? 'سیل یا پرچیز یہاں سے ایڈٹ نہیں ہو سکتے — براہ کرم سیلز یا پرچیز سیکشن میں جا کر ڈاکیومنٹ ایڈٹ کریں۔'
                    : 'یہ واؤچر سورس ماڈیول سے کنٹرول ہوتا ہے۔ اسے Accounts سے نہیں، متعلقہ جگہ (سٹاک، اوپننگ، رینٹل، وغیرہ) میں جا کر درست کریں۔'}
                </p>
              </div>
              {salePurchaseTarget && onNavigateToDocumentEdit ? (
                <button
                  type="button"
                  onClick={() => onNavigateToDocumentEdit(salePurchaseTarget.kind, salePurchaseTarget.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg text-white font-semibold text-sm"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  {salePurchaseTarget.kind === 'sale' ? 'Open in Sales' : 'Open in Purchase'}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {showEditEntry && (
        <EditTransactionSheet
          open={true}
          companyId={companyId}
          mode="journal"
          targetId={entry.id}
          onClose={() => setShowEditEntry(false)}
          onSaved={() => {
            setShowEditEntry(false);
            dispatchMobileAccountingInvalidated({
              companyId,
              branchId: branchId ?? null,
              reason: 'transaction-edited',
            });
            onBack();
          }}
        />
      )}
    </>
  );
}
