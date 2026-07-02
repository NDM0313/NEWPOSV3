import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Mail, MapPin, DollarSign, Edit2, User as UserIcon, Clock, Briefcase, UserCheck, Loader2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  approvePublicLead,
  getContactDisplayPhone,
  getContactDisplayRef,
  getContactPhoneLabel,
  isPendingPublicLead,
  type Contact,
  type ContactRole,
} from '../../api/contacts';
import { getPurchasesBySupplier, recordSupplierPayment } from '../../api/accounts';
import { useRecordOnAccountCustomerPayment } from '../../hooks/useRecordOnAccountCustomerPayment';
import { MobilePaymentSheet, type MobilePaymentSheetSubmitPayload } from '../shared/MobilePaymentSheet';
import type { User } from '../../types';

interface ContactDetailViewProps {
  contact: Contact;
  onBack: () => void;
  onEdit: (contact: Contact) => void;
  onApproved?: (contact: Contact) => void;
  onBalanceChanged?: () => void;
  user: User;
  companyId: string | null;
  branchId?: string | null;
}

type PaymentSheetKind = 'receive' | 'pay-supplier' | null;

export function ContactDetailView({
  contact,
  onBack,
  onEdit,
  onApproved,
  onBalanceChanged,
  user,
  companyId,
  branchId,
}: ContactDetailViewProps) {
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');
  const [paymentSheet, setPaymentSheet] = useState<PaymentSheetKind>(null);
  const [supplierPurchaseId, setSupplierPurchaseId] = useState<string | null>(null);
  const [supplierPayable, setSupplierPayable] = useState(0);
  const [paymentPrepError, setPaymentPrepError] = useState('');
  const [paymentPrepLoading, setPaymentPrepLoading] = useState(false);
  const { submit: submitOnAccount } = useRecordOnAccountCustomerPayment();
  const getRoleBadgeColor = (role: ContactRole) => {
    switch (role) {
      case 'customer':
        return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30';
      case 'supplier':
        return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30';
      case 'worker':
        return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30';
      default:
        return 'bg-[#6B7280]/10 text-[#6B7280] border-[#6B7280]/30';
    }
  };

  const getRoleLabel = (role: ContactRole) => role.charAt(0).toUpperCase() + role.slice(1);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const canEdit = user.role === 'admin' || user.role === 'manager';
  const canApprove =
    (user.role === 'admin' || user.role === 'manager' || user.role === 'owner') &&
    isPendingPublicLead(contact);
  const displayRef = getContactDisplayRef(contact);
  const isCustomer = contact.roles.includes('customer');
  const isSupplier = contact.roles.includes('supplier');
  const customerReceivable = isCustomer ? Math.max(0, contact.balance) : 0;
  const supplierPayableDisplay = isSupplier ? Math.max(0, contact.balance < 0 ? Math.abs(contact.balance) : 0) : 0;

  useEffect(() => {
    if (paymentSheet !== 'pay-supplier' || !companyId || !isSupplier) return;
    let cancelled = false;
    setPaymentPrepLoading(true);
    setPaymentPrepError('');
    getPurchasesBySupplier(companyId, contact.id).then(({ data, error }) => {
      if (cancelled) return;
      setPaymentPrepLoading(false);
      if (error) {
        setPaymentPrepError(error);
        setSupplierPurchaseId(null);
        return;
      }
      const first = data?.[0];
      if (!first) {
        setPaymentPrepError('No outstanding purchase for this supplier.');
        setSupplierPurchaseId(null);
        setSupplierPayable(0);
        return;
      }
      setSupplierPurchaseId(first.id);
      setSupplierPayable(first.due_amount);
    });
    return () => {
      cancelled = true;
    };
  }, [paymentSheet, companyId, contact.id, isSupplier]);

  const openReceivePayment = () => {
    if (!companyId) {
      setPaymentPrepError('Company not selected.');
      return;
    }
    setPaymentPrepError('');
    setPaymentSheet('receive');
  };

  const openMakePayment = () => {
    if (!companyId) {
      setPaymentPrepError('Company not selected.');
      return;
    }
    setPaymentPrepError('');
    setPaymentSheet('pay-supplier');
  };

  const handleReceiveSubmit = async (payload: MobilePaymentSheetSubmitPayload) => {
    if (!companyId) return { success: false, error: 'Company not selected.' };
    const { success, error, paymentId, referenceNumber } = await submitOnAccount({
      companyId,
      branchId: payload.branchId ?? branchId ?? null,
      contactId: contact.id,
      contactName: contact.name,
      amount: payload.amount,
      accountId: payload.accountId,
      paymentMethod: payload.method === 'wallet' ? 'wallet' : payload.method,
      paymentDate: payload.paymentDate,
      paymentAt: payload.paymentAt,
      notes: payload.notes || null,
      bankTraceId: payload.reference?.trim() || null,
      createdBy: user.id ?? null,
    });
    return {
      success,
      error: error ?? null,
      paymentId: paymentId ?? null,
      referenceNumber: referenceNumber ?? null,
      partyAccountName: contact.name ? `Receivable — ${contact.name}` : null,
    };
  };

  const handleSupplierSubmit = async (payload: MobilePaymentSheetSubmitPayload) => {
    const payBranchId = payload.branchId ?? branchId;
    if (!companyId || !payBranchId || !supplierPurchaseId) {
      return { success: false, error: paymentPrepError || 'No purchase to pay against.' };
    }
    const methodForRpc: 'cash' | 'bank' | 'card' | 'other' =
      payload.method === 'wallet' ? 'other' : payload.method;
    const { data, error } = await recordSupplierPayment({
      companyId,
      branchId: payBranchId,
      purchaseId: supplierPurchaseId,
      amount: payload.amount,
      paymentDate: payload.paymentDate,
      paymentAt: payload.paymentAt,
      paymentAccountId: payload.accountId,
      paymentMethod: methodForRpc,
      reference: payload.reference || undefined,
      notes: payload.notes || undefined,
      userId: user.id,
    });
    return {
      success: !error && !!data?.payment_id,
      error: error ?? null,
      paymentId: data?.payment_id ?? null,
      referenceNumber: data?.reference_number ?? null,
      partyAccountName: contact.name ? `Payable — ${contact.name}` : null,
    };
  };

  const closePaymentSheet = () => {
    setPaymentSheet(null);
    setSupplierPurchaseId(null);
    setPaymentPrepError('');
  };

  const handlePaymentSuccess = () => {
    closePaymentSheet();
    onBalanceChanged?.();
  };

  const handleApprove = async () => {
    setApproveError('');
    setApproving(true);
    const result = await approvePublicLead(contact.id);
    setApproving(false);
    if (!result.success) {
      setApproveError(result.error || 'Approval failed');
      return;
    }
    onApproved?.({
      ...contact,
      code: result.code ?? contact.code,
      leadStatus: 'Approved',
    });
  };

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40 flow-screen-header">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white font-semibold text-base">Contact Details</h1>
          </div>
          {canEdit && (
            <button onClick={() => onEdit(contact)} className="p-2 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg transition-colors">
              <Edit2 size={18} className="text-white" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-full flex items-center justify-center flex-shrink-0">
              <UserIcon size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-white text-xl font-bold mb-2">{contact.name}</h2>
              {displayRef ? (
                <p className="text-xs text-[#9CA3AF] font-mono mb-2">{displayRef}</p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {contact.roles.map((role) => (
                  <span key={role} className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getRoleBadgeColor(role)}`}>
                    {getRoleLabel(role)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${contact.status === 'active' ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
            <span className={`text-sm font-medium ${contact.status === 'active' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {contact.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {contact.createdFrom === 'public_form' && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">Registration info</h3>
            <div className="space-y-2 text-sm">
              <p className="text-[#9CA3AF]">
                Source: <span className="text-white">{contact.leadSource || '—'}</span>
              </p>
              <p className="text-[#9CA3AF] font-mono text-xs">
                Referral: <span className="text-white">{contact.referralCode || '—'}</span>
              </p>
              <p className="text-[#9CA3AF]">
                Status: <span className="text-white">{contact.leadStatus || '—'}</span>
              </p>
            </div>
            {canApprove && (
              <button
                type="button"
                disabled={approving}
                onClick={() => void handleApprove()}
                className="mt-4 w-full h-11 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                Approve lead
              </button>
            )}
            {approveError ? <p className="text-xs text-red-400 mt-2">{approveError}</p> : null}
          </div>
        )}

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Phone size={18} className="text-[#8B5CF6]" />
            Contact Information
          </h3>
          <div className="space-y-4">
            {getContactDisplayPhone(contact) ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone size={18} className="text-[#6B7280]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">{getContactPhoneLabel(contact)}</p>
                  <p className="text-white font-medium">{getContactDisplayPhone(contact)}</p>
                </div>
              </div>
            ) : null}
            {contact.email && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail size={18} className="text-[#6B7280]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Email</p>
                  <p className="text-white font-medium">{contact.email}</p>
                </div>
              </div>
            )}
            {(contact.city || contact.address) && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin size={18} className="text-[#6B7280]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Location</p>
                  <p className="text-white font-medium">
                    {contact.address && <span>{contact.address}<br /></span>}
                    {contact.city}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {contact.roles.includes('worker') && contact.workerType && (
          <div className="bg-[#1F2937] border border-[#F59E0B]/30 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Briefcase size={18} className="text-[#F59E0B]" />
              Worker Details
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#9CA3AF] mb-1">Worker Type</p>
                <p className="text-white font-medium capitalize">{contact.workerType}</p>
              </div>
              {contact.workerRate && (
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-1">Rate</p>
                  <p className="text-white font-medium">Rs. {contact.workerRate} per piece/day</p>
                </div>
              )}
            </div>
          </div>
        )}

        {(contact.roles.includes('customer') || contact.roles.includes('supplier')) && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <DollarSign size={18} className="text-[#8B5CF6]" />
              Account Balance
            </h3>
            <div className="bg-[#111827] rounded-xl p-6 text-center">
              <div className="text-sm text-[#9CA3AF] mb-2">
                {contact.balance > 0 ? 'Amount Receivable' : contact.balance < 0 ? 'Amount Payable' : 'Settled'}
              </div>
              <div className={`text-3xl font-bold mb-2 ${contact.balance > 0 ? 'text-[#EF4444]' : contact.balance < 0 ? 'text-[#10B981]' : 'text-[#6B7280]'}`}>
                Rs. {Math.abs(contact.balance).toLocaleString()}
              </div>
              {contact.creditLimit && contact.roles.includes('customer') && (
                <div className="text-xs text-[#6B7280] mt-2 pt-2 border-t border-[#374151]">
                  Credit Limit: Rs. {contact.creditLimit.toLocaleString()}
                </div>
              )}
            </div>
            {(isCustomer || isSupplier) && companyId && (
              <div className="mt-4 flex flex-col gap-2">
                {isCustomer && (
                  <button
                    type="button"
                    onClick={openReceivePayment}
                    className="w-full h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium inline-flex items-center justify-center gap-2"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    Receive Payment
                  </button>
                )}
                {isSupplier && (
                  <button
                    type="button"
                    onClick={openMakePayment}
                    className="w-full h-11 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-white font-medium inline-flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Make Payment
                  </button>
                )}
                {paymentPrepError && !paymentSheet && (
                  <p className="text-xs text-red-400 text-center">{paymentPrepError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {(contact.createdAt || contact.updatedAt) && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} className="text-[#8B5CF6]" />
              Activity
            </h3>
            <div className="space-y-3">
              {contact.createdAt && (
                <div className="bg-[#111827] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <UserIcon size={14} className="text-[#10B981]" />
                    <span className="text-sm font-medium text-white">Contact Created</span>
                  </div>
                  <div className="text-xs text-[#6B7280]">{formatDateTime(contact.createdAt)}</div>
                </div>
              )}
              {contact.updatedAt && contact.updatedAt !== contact.createdAt && (
                <div className="bg-[#111827] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Edit2 size={14} className="text-[#3B82F6]" />
                    <span className="text-sm font-medium text-white">Last Updated</span>
                  </div>
                  <div className="text-xs text-[#6B7280]">{formatDateTime(contact.updatedAt)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {paymentSheet === 'receive' && companyId && (
        <MobilePaymentSheet
          mode="receive"
          companyId={companyId}
          branchId={branchId ?? null}
          userId={user.id}
          userRole={user.role}
          profileId={user.profileId ?? null}
          partyName={contact.name}
          partyPhone={getContactDisplayPhone(contact) || null}
          outstandingAmount={customerReceivable}
          initialAmount={customerReceivable || undefined}
          allowOverpayment
          title="Receive Payment from Customer"
          subtitle="On-account receipt (updates customer AR)"
          partyKindLabel="CUSTOMER"
          submitLabel="Receive Payment"
          onClose={closePaymentSheet}
          onSuccess={handlePaymentSuccess}
          onSubmit={handleReceiveSubmit}
        />
      )}

      {paymentSheet === 'pay-supplier' && companyId && (
        paymentPrepLoading ? (
          <div className="fixed inset-0 z-50 bg-[#111827]/90 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
          </div>
        ) : paymentPrepError || !supplierPurchaseId ? (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
            <div className="w-full bg-[#1F2937] border-t border-[#374151] rounded-t-2xl p-6">
              <p className="text-sm text-[#FCA5A5] mb-4">{paymentPrepError || 'Cannot pay supplier.'}</p>
              <button
                type="button"
                onClick={closePaymentSheet}
                className="w-full h-11 rounded-lg bg-[#374151] text-white font-medium"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <MobilePaymentSheet
            mode="pay-supplier"
            companyId={companyId}
            branchId={branchId ?? null}
            userId={user.id}
            userRole={user.role}
            profileId={user.profileId ?? null}
            partyName={contact.name}
            partyPhone={getContactDisplayPhone(contact) || null}
            outstandingAmount={supplierPayable || supplierPayableDisplay}
            initialAmount={supplierPayable || supplierPayableDisplay || undefined}
            title="Pay Supplier"
            partyKindLabel="SUPPLIER"
            submitLabel="Pay Supplier"
            onClose={closePaymentSheet}
            onSuccess={handlePaymentSuccess}
            onSubmit={handleSupplierSubmit}
          />
        )
      )}
    </div>
  );
}
