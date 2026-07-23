import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import type { User } from '../../types';
import { getAllCustomersWithBalance, type CustomerWithBalance } from '../../api/customerLedger';
import { MobilePaymentSheet, type MobilePaymentSheetSubmitPayload } from '../shared/MobilePaymentSheet';
import { useRecordOnAccountCustomerPayment } from '../../hooks/useRecordOnAccountCustomerPayment';
import { finalizePaymentAttachments } from '../../lib/finalizePaymentAttachments';
import type { ReceiptOcrRouteSeed } from '../../lib/ocr/receiptOcrRouteSeed';

interface CustomerPaymentFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
  /** Prefill from Duplicate — select this customer when list loads. */
  initialContactId?: string | null;
  /** Prefill from Scan Receipt hub. */
  ocrSeed?: ReceiptOcrRouteSeed | null;
}

export function CustomerPaymentFlow({
  onBack,
  onComplete,
  user,
  companyId,
  branchId,
  onViewLedger,
  initialContactId,
  ocrSeed,
}: CustomerPaymentFlowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithBalance | null>(null);
  const { submit } = useRecordOnAccountCustomerPayment();

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAllCustomersWithBalance(companyId, branchId ?? null).then(({ data, error }) => {
      if (cancelled) return;
      const list = data || [];
      setCustomers(list);
      setLoadError(error);
      setLoading(false);
      if (initialContactId) {
        const match = list.find((c) => c.id === initialContactId);
        if (match) setSelectedCustomer(match);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, initialContactId]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone || '').includes(searchQuery),
  );

  const handleSubmit = async (payload: MobilePaymentSheetSubmitPayload) => {
    if (!selectedCustomer || !companyId) {
      return { success: false, error: 'Missing customer.' };
    }
    const { success, error, paymentId, referenceNumber } = await submit({
      companyId,
      branchId: payload.branchId ?? branchId ?? null,
      contactId: selectedCustomer.id,
      contactName: selectedCustomer.name,
      amount: payload.amount,
      accountId: payload.accountId,
      paymentMethod: payload.method === 'wallet' ? 'wallet' : payload.method,
      paymentDate: payload.paymentDate,
      paymentAt: payload.paymentAt,
      notes: payload.notes || null,
      bankTraceId: payload.reference?.trim() || null,
      paymentAccountName: payload.accountName || null,
      createdBy: user.id ?? null,
    });
    let attachmentWarning: string | null = null;
    if (success && paymentId && payload.attachments.length > 0) {
      const fin = await finalizePaymentAttachments({
        companyId,
        storageSegment: selectedCustomer.id,
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
      partyAccountName: selectedCustomer.name ? `Receivable — ${selectedCustomer.name}` : null,
      attachmentWarning,
    };
  };

  if (selectedCustomer && companyId) {
    const ocrAmount = ocrSeed?.amount && ocrSeed.amount > 0 ? ocrSeed.amount : undefined;
    const due = Math.max(0, selectedCustomer.balance);
    return (
      <MobilePaymentSheet
        mode="receive"
        companyId={companyId}
        branchId={branchId ?? null}
        userId={user.id}
        userRole={user.role}
        profileId={user.profileId ?? null}
        partyName={selectedCustomer.name}
        partyPhone={selectedCustomer.phone}
        outstandingAmount={due}
        initialAmount={ocrAmount ?? (due || undefined)}
        allowOverpayment
        title="Receive Payment from Customer"
        subtitle="On-account receipt (updates customer AR)"
        partyKindLabel="CUSTOMER"
        submitLabel="Receive Payment"
        defaultPaymentNotes={ocrSeed?.notes ?? null}
        initialReference={ocrSeed?.reference ?? null}
        initialPaymentDate={ocrSeed?.date ?? null}
        initialPaymentTime={ocrSeed?.time ?? null}
        initialAttachmentFiles={ocrSeed?.attachmentFiles?.length ? ocrSeed.attachmentFiles : null}
        onClose={() => setSelectedCustomer(null)}
        onSuccess={onComplete}
        onSubmit={handleSubmit}
        onViewLedger={onViewLedger}
      />
    );
  }

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#3B82F6] to-[#2563EB] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Client Payment</h1>
            <p className="text-xs text-white/80">Select a customer to receive payment</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        {loadError && (
          <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/40 rounded-xl text-sm text-[#FCA5A5]">
            {loadError}
          </div>
        )}
        {loading ? (
          <div className="py-8 text-center text-[#9CA3AF] text-sm">Loading customers…</div>
        ) : (
          <div className="space-y-2">
            {filteredCustomers.length === 0 ? (
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
                <p className="text-sm text-[#9CA3AF]">No customers found</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => setSelectedCustomer(customer)}
                  className="w-full p-4 rounded-xl border-2 text-left transition-all bg-[#1F2937] border-[#374151] hover:border-[#3B82F6]/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{customer.name}</p>
                      {customer.phone && <p className="text-xs text-[#9CA3AF] truncate">{customer.phone}</p>}
                    </div>
                    <Check className="text-[#3B82F6] opacity-0" size={20} />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#374151]">
                    <span className="text-xs text-[#9CA3AF]">Receivable</span>
                    <span
                      className={`text-sm font-bold ${customer.balance > 0 ? 'text-[#EF4444]' : 'text-[#6B7280]'}`}
                    >
                      Rs. {customer.balance.toLocaleString()}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
