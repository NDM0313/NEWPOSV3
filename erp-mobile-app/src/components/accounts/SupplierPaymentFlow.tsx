import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import type { User } from '../../types';
import { getAllSuppliersWithPayable, type SupplierWithPayable } from '../../api/accounts';
import { MobilePaymentSheet, type MobilePaymentSheetSubmitPayload } from '../shared/MobilePaymentSheet';
import { useRecordOnAccountSupplierPayment } from '../../hooks/useRecordOnAccountSupplierPayment';
import { finalizePaymentAttachments } from '../../lib/finalizePaymentAttachments';
import type { ReceiptOcrRouteSeed } from '../../lib/ocr/receiptOcrRouteSeed';
import { fuzzyMatchSuppliers } from '../../lib/ocr/parsePakSupplierBill';

interface SupplierPaymentFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
  initialContactId?: string | null;
  ocrSeed?: ReceiptOcrRouteSeed | null;
}

export function SupplierPaymentFlow({
  onBack,
  onComplete,
  user,
  companyId,
  branchId,
  onViewLedger,
  initialContactId,
  ocrSeed,
}: SupplierPaymentFlowProps) {
  const [searchQuery, setSearchQuery] = useState(() => String(ocrSeed?.supplierHint ?? '').trim());
  const [suppliers, setSuppliers] = useState<SupplierWithPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithPayable | null>(null);
  const { submit } = useRecordOnAccountSupplierPayment();

  useEffect(() => {
    const hint = String(ocrSeed?.supplierHint ?? '').trim();
    if (hint) setSearchQuery((q) => q || hint);
  }, [ocrSeed?.supplierHint]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAllSuppliersWithPayable(companyId, branchId ?? null).then(({ data, error }) => {
      if (cancelled) return;
      const list = data ?? [];
      setSuppliers(list);
      setLoadError(error);
      setLoading(false);
      if (initialContactId) {
        const match = list.find((s) => s.id === initialContactId);
        if (match) setSelectedSupplier(match);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, initialContactId]);

  const ocrSuggestions = fuzzyMatchSuppliers(ocrSeed?.supplierHint, suppliers, 5);

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery),
  );

  const handleSubmit = async (payload: MobilePaymentSheetSubmitPayload) => {
    if (!selectedSupplier || !companyId) {
      return { success: false, error: 'Missing supplier.' };
    }
    const { success, error, paymentId, referenceNumber } = await submit({
      companyId,
      branchId: payload.branchId ?? branchId ?? null,
      supplierContactId: selectedSupplier.id,
      supplierName: selectedSupplier.name,
      amount: payload.amount,
      accountId: payload.accountId,
      paymentMethod: payload.method === 'wallet' ? 'wallet' : payload.method,
      paymentDate: payload.paymentDate,
      paymentAt: payload.paymentAt,
      notes: payload.notes || null,
      bankTraceId: payload.reference?.trim() || null,
      userId: user.id ?? null,
    });
    let attachmentWarning: string | null = null;
    if (success && paymentId && payload.attachments.length > 0) {
      const fin = await finalizePaymentAttachments({
        companyId,
        storageSegment: selectedSupplier.id,
        paymentId,
        files: payload.attachments,
      });
      attachmentWarning = fin.attachmentWarning;
    }
    return {
      success,
      error: error ?? null,
      paymentId: paymentId ?? null,
      referenceNumber: referenceNumber ?? null,
      partyAccountName: selectedSupplier.name ? `Payable — ${selectedSupplier.name}` : null,
      attachmentWarning,
    };
  };

  if (selectedSupplier && companyId) {
    const ocrAmount = ocrSeed?.amount && ocrSeed.amount > 0 ? ocrSeed.amount : undefined;
    const due = Math.max(0, selectedSupplier.totalPayable);
    return (
      <MobilePaymentSheet
        mode="pay-supplier"
        companyId={companyId}
        branchId={branchId ?? null}
        userId={user.id}
        userRole={user.role}
        profileId={user.profileId ?? null}
        partyName={selectedSupplier.name}
        partyPhone={selectedSupplier.phone || null}
        outstandingAmount={due}
        initialAmount={ocrAmount ?? (due || undefined)}
        allowOverpayment
        title="Pay Supplier"
        subtitle="On-account payment (updates supplier AP)"
        partyKindLabel="SUPPLIER"
        submitLabel="Pay Supplier"
        defaultPaymentNotes={ocrSeed?.notes ?? null}
        initialReference={ocrSeed?.reference ?? null}
        initialPaymentDate={ocrSeed?.date ?? null}
        initialPaymentTime={ocrSeed?.time ?? null}
        initialAttachmentFiles={ocrSeed?.attachmentFiles?.length ? ocrSeed.attachmentFiles : null}
        onClose={() => setSelectedSupplier(null)}
        onSuccess={onComplete}
        onSubmit={handleSubmit}
        onViewLedger={onViewLedger}
      />
    );
  }

  const renderSupplierButton = (supplier: SupplierWithPayable, suggested?: boolean) => (
    <button
      key={supplier.id}
      type="button"
      onClick={() => setSelectedSupplier(supplier)}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all bg-[#1F2937] ${
        suggested
          ? 'border-[#F59E0B]/60 hover:border-[#F59E0B]'
          : 'border-[#374151] hover:border-[#F59E0B]/50'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{supplier.name}</p>
          <p className="text-xs text-[#9CA3AF] truncate">{supplier.phone || '—'}</p>
          {suggested ? (
            <p className="text-[10px] text-[#FBBF24] mt-0.5">OCR name suggestion — confirm to select</p>
          ) : null}
        </div>
        <Check className="text-[#F59E0B] opacity-0" size={20} />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[#374151]">
        <span className="text-xs text-[#9CA3AF]">Outstanding Balance</span>
        <span
          className={`text-sm font-bold ${
            supplier.totalPayable > 0.01 ? 'text-[#EF4444]' : 'text-[#6B7280]'
          }`}
        >
          Rs. {supplier.totalPayable.toLocaleString()}
        </span>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Supplier Payment</h1>
            <p className="text-xs text-white/80">Select a supplier to pay</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        {loadError && (
          <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/40 rounded-xl text-sm text-[#FCA5A5]">
            {loadError}
          </div>
        )}

        {ocrSuggestions.length > 0 && String(ocrSeed?.supplierHint ?? '').trim() ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#FBBF24]">Suggested from OCR</p>
            {ocrSuggestions.map((s) => renderSupplierButton(s, true))}
          </div>
        ) : null}

        {loading ? (
          <div className="py-8 text-center text-[#9CA3AF] text-sm">Loading suppliers…</div>
        ) : (
          <div className="space-y-2">
            {filteredSuppliers.length === 0 && ocrSuggestions.length === 0 ? (
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
                <p className="text-sm text-[#9CA3AF]">No suppliers found</p>
              </div>
            ) : (
              filteredSuppliers
                .filter((s) => !ocrSuggestions.some((g) => g.id === s.id))
                .map((supplier) => renderSupplierButton(supplier))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
