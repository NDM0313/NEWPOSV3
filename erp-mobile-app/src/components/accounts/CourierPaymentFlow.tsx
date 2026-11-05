import { useEffect, useState } from 'react';
import { ArrowLeft, Search, Truck } from 'lucide-react';
import type { User } from '../../types';
import { getCouriersByCompany, recordCourierPayment, type CourierRow } from '../../api/couriers';
import { finalizePaymentAttachments } from '../../lib/finalizePaymentAttachments';
import {
  MobilePaymentSheet,
  type MobilePaymentSheetSubmitPayload,
  type MobilePaymentSheetSubmitResult,
} from '../shared/MobilePaymentSheet';
import type { ReceiptOcrRouteSeed } from '../../lib/ocr/receiptOcrRouteSeed';

interface CourierPaymentFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
  ocrSeed?: ReceiptOcrRouteSeed | null;
}

export function CourierPaymentFlow({
  onBack,
  onComplete,
  user,
  companyId,
  branchId,
  onViewLedger,
  ocrSeed,
}: CourierPaymentFlowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<CourierRow | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCouriersByCompany(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setCouriers(data || []);
      setLoadError(error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const filteredCouriers = couriers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelectCourier = (courier: CourierRow) => {
    setSelectError(null);
    if (!courier.contact_id?.trim()) {
      setSelectError(
        `"${courier.name}" has no linked contact. Link a contact on the courier master before paying.`,
      );
      return;
    }
    setSelectedCourier(courier);
  };

  const handleSubmit = async (
    payload: MobilePaymentSheetSubmitPayload,
  ): Promise<MobilePaymentSheetSubmitResult> => {
    if (!companyId || !selectedCourier) {
      return { success: false, error: 'Company and courier required.' };
    }
    const contactId = selectedCourier.contact_id?.trim();
    if (!contactId) {
      return {
        success: false,
        error: 'Courier payment requires a valid contact linked to the courier.',
      };
    }
    const methodForApi = payload.method === 'wallet' ? 'mobile_wallet' : payload.method;
    const { data, error } = await recordCourierPayment({
      companyId,
      branchId: payload.branchId ?? branchId ?? null,
      courierId: selectedCourier.id,
      courierName: selectedCourier.name,
      courierContactId: contactId,
      amount: payload.amount,
      paymentDate: payload.paymentDate,
      paymentAt: payload.paymentAt,
      paymentAccountId: payload.accountId,
      paymentMethod: methodForApi,
      notes: payload.notes || null,
      paymentReference: payload.reference?.trim() || null,
      userId: user.id ?? null,
    });
    let attachmentWarning: string | null = null;
    if (data?.paymentId && payload.attachments.length > 0) {
      const fin = await finalizePaymentAttachments({
        companyId,
        storageSegment: selectedCourier.id,
        paymentId: data.paymentId,
        files: payload.attachments,
      });
      attachmentWarning = fin.attachmentWarning;
    }
    return {
      success: !error && !!data,
      error: error ?? null,
      paymentId: data?.paymentId ?? null,
      referenceNumber: data?.referenceNumber ?? null,
      partyAccountName: `Courier Payable — ${selectedCourier.name}`,
      attachmentWarning,
    };
  };

  if (selectedCourier && companyId) {
    return (
      <MobilePaymentSheet
        mode="pay-supplier"
        companyId={companyId}
        branchId={branchId ?? null}
        userId={user.id}
        userRole={user.role}
        profileId={user.profileId ?? null}
        partyName={selectedCourier.name}
        title="Courier Payment"
        subtitle="Record payment made to courier company"
        partyKindLabel="COURIER"
        submitLabel="Pay Courier"
        allowOverpayment
        hidePayFull
        hideSummary
        initialAmount={ocrSeed?.amount && ocrSeed.amount > 0 ? ocrSeed.amount : undefined}
        defaultPaymentNotes={ocrSeed?.notes ?? null}
        initialReference={ocrSeed?.reference ?? null}
        initialPaymentDate={ocrSeed?.date ?? null}
        initialPaymentTime={ocrSeed?.time ?? null}
        initialAttachmentFiles={ocrSeed?.attachmentFiles?.length ? ocrSeed.attachmentFiles : null}
        onClose={() => setSelectedCourier(null)}
        onSuccess={onComplete}
        onSubmit={handleSubmit}
        onViewLedger={onViewLedger}
      />
    );
  }

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Courier Payment</h1>
            <p className="text-xs text-white/80">Select a courier company to pay</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
          <input
            type="text"
            placeholder="Search couriers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#6366F1]"
          />
        </div>
        {loadError && (
          <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/40 rounded-xl text-sm text-[#FCA5A5]">
            {loadError}
          </div>
        )}
        {selectError && (
          <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/40 rounded-xl text-sm text-[#FCD34D]">
            {selectError}
          </div>
        )}
        {loading ? (
          <div className="py-8 text-center text-[#9CA3AF] text-sm">Loading couriers…</div>
        ) : (
          <div className="space-y-2">
            {filteredCouriers.length === 0 ? (
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
                <Truck className="w-8 h-8 text-[#6B7280] mx-auto mb-2" />
                <p className="text-sm text-[#9CA3AF]">No couriers found</p>
              </div>
            ) : (
              filteredCouriers.map((courier) => {
                const hasContact = Boolean(courier.contact_id?.trim());
                return (
                  <button
                    key={courier.id}
                    type="button"
                    onClick={() => handleSelectCourier(courier)}
                    className="w-full p-4 rounded-xl border-2 text-left transition-all bg-[#1F2937] border-[#374151] hover:border-[#6366F1]/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#6366F1]/20 flex items-center justify-center shrink-0">
                        <Truck size={18} className="text-[#A5B4FC]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{courier.name}</p>
                        <p className={`text-xs mt-0.5 ${hasContact ? 'text-[#9CA3AF]' : 'text-[#F59E0B]'}`}>
                          {hasContact ? 'Ready to pay' : 'No linked contact'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
