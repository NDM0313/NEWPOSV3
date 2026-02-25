/**
 * Full-screen rental details + actions (Return, Add Payment, Mark Picked Up, Delete, Cancel).
 * Mirrors web ViewRentalDetailsDrawer behavior for mobile.
 */

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Package,
  DollarSign,
  Calendar,
  User,
  Loader2,
  CornerDownLeft,
  CreditCard,
  Truck,
  Trash2,
  Ban,
  X,
} from 'lucide-react';
import type { RentalDetail } from '../../api/rentals';
import * as rentalsApi from '../../api/rentals';
import { RentalReturnModal } from './RentalReturnModal';
import { RentalAddPaymentModal } from './RentalAddPaymentModal';
import { RentalPickupModal } from './RentalPickupModal';

interface ViewRentalDetailsProps {
  rentalId: string;
  companyId: string | null;
  userId: string | null;
  onBack: () => void;
  onRefresh: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-[#6B7280] text-[#9CA3AF]',
  booked: 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
  rented: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  returned: 'bg-green-500/20 text-green-400 border border-green-500/30',
  overdue: 'bg-red-500/20 text-red-400 border border-red-500/30',
  cancelled: 'bg-[#6B7280]/30 text-[#9CA3AF]',
};

export function ViewRentalDetails({ rentalId, companyId, userId, onBack, onRefresh }: ViewRentalDetailsProps) {
  const [rental, setRental] = useState<RentalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    if (!rentalId) return;
    setLoading(true);
    setError(null);
    rentalsApi.getRentalById(rentalId).then(({ data, error: err }) => {
      setLoading(false);
      if (err) setError(err);
      else setRental(data ?? null);
    });
  };

  useEffect(() => load(), [rentalId]);

  const handleReturn = async (payload: {
    actualReturnDate: string;
    notes?: string;
    conditionType: string;
    damageNotes?: string;
    penaltyAmount: number;
    penaltyPaid: boolean;
    documentReturned: boolean;
    penaltyPaymentAccountId?: string | null;
  }) => {
    if (!companyId) return;
    setActionLoading(true);
    const { error: err } = await rentalsApi.receiveReturn(rentalId, companyId, payload, userId);
    setActionLoading(false);
    if (err) {
      alert(err);
      return;
    }
    setReturnOpen(false);
    load();
    onRefresh();
  };

  const handleAddPayment = async (amount: number, method: string, reference?: string) => {
    if (!companyId) return;
    setActionLoading(true);
    const { error: err } = await rentalsApi.addRentalPayment(rentalId, companyId, amount, method, reference, userId);
    setActionLoading(false);
    if (err) {
      alert(err);
      return;
    }
    setPaymentOpen(false);
    load();
    onRefresh();
  };

  const handlePickup = async (payload: {
    actualPickupDate: string;
    notes?: string;
    documentType: string;
    documentNumber: string;
    securityDocumentImageUrl?: string | null;
    documentReceived: boolean;
    remainingPaymentConfirmed: boolean;
  }) => {
    if (!companyId) return;
    setActionLoading(true);
    const { error: err } = await rentalsApi.markRentalPickedUp(rentalId, companyId, payload, userId);
    setActionLoading(false);
    if (err) {
      alert(err);
      return;
    }
    setPickupOpen(false);
    load();
    onRefresh();
  };

  const handleDelete = async () => {
    if (!companyId || !window.confirm('Delete this rental? This cannot be undone.')) return;
    setActionLoading(true);
    const { error: err } = await rentalsApi.deleteRental(rentalId, companyId);
    setActionLoading(false);
    if (err) {
      alert(err);
      return;
    }
    onBack();
    onRefresh();
  };

  const handleCancel = async () => {
    if (!companyId || !window.confirm('Cancel this rental?')) return;
    setActionLoading(true);
    const { error: err } = await rentalsApi.cancelRental(rentalId, companyId);
    setActionLoading(false);
    if (err) {
      alert(err);
      return;
    }
    load();
    onRefresh();
  };

  if (loading && !rental) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#8B5CF6] animate-spin" />
      </div>
    );
  }

  if (error || !rental) {
    return (
      <div className="min-h-screen bg-[#111827] p-4">
        <button onClick={onBack} className="p-2 text-[#9CA3AF] hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-red-400 mt-4">{error ?? 'Rental not found.'}</p>
      </div>
    );
  }

  const statusColor = STATUS_COLOR[rental.status] ?? 'bg-[#374151] text-[#9CA3AF]';
  const canReturn = ['rented', 'overdue'].includes(rental.status);
  const canPickup = rental.status === 'booked';
  const canDelete = ['draft', 'booked'].includes(rental.status);
  const canCancel = ['draft', 'booked'].includes(rental.status);

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      <div className="sticky top-0 z-10 bg-[#1F2937] border-b border-[#374151] px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="p-2 text-[#F9FAFB] hover:bg-[#374151] rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-white">{rental.bookingNo}</span>
          <div className="w-9" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${statusColor}`}>
              {rental.status}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#9CA3AF] mb-1">
            <User className="w-4 h-4" />
            <span className="text-white font-medium">{rental.customerName}</span>
          </div>
          {rental.customerPhone && (
            <p className="text-sm text-[#9CA3AF] ml-6">{rental.customerPhone}</p>
          )}
          <div className="flex gap-4 mt-3 text-sm text-[#9CA3AF]">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {rental.pickupDate} → {rental.returnDate}
            </span>
          </div>
          {rental.branchName && (
            <p className="text-xs text-[#6B7280] mt-1">{rental.branchName}</p>
          )}
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-2 flex items-center gap-2">
            <Package className="w-4 h-4" /> Items
          </h3>
          <ul className="space-y-2">
            {rental.items.map((i) => (
              <li key={i.id} className="flex justify-between text-sm">
                <span className="text-white">{i.productName} × {i.quantity}</span>
                <span className="text-[#10B981]">Rs. {i.total.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Amounts
          </h3>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[#9CA3AF]">Total</span>
            <span className="text-white">Rs. {rental.totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[#9CA3AF]">Paid</span>
            <span className="text-[#10B981]">Rs. {rental.paidAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9CA3AF]">Due</span>
            <span className="text-[#F59E0B]">Rs. {rental.dueAmount.toLocaleString()}</span>
          </div>
        </div>

        {rental.payments.length > 0 && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Payments
            </h3>
            <ul className="space-y-2">
              {rental.payments.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className="text-[#9CA3AF]">{p.paymentDate} · {p.method}</span>
                  <span className="text-white">Rs. {p.amount.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4">
          {canReturn && (
            <button
              onClick={() => setReturnOpen(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white rounded-lg font-medium"
            >
              <CornerDownLeft className="w-4 h-4" /> Receive Return
            </button>
          )}
          {canPickup && (
            <button
              onClick={() => setPickupOpen(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              <Truck className="w-4 h-4" /> Mark Picked Up
            </button>
          )}
          {!['returned', 'cancelled'].includes(rental.status) && rental.dueAmount > 0 && (
            <button
              onClick={() => setPaymentOpen(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white rounded-lg font-medium"
            >
              <CreditCard className="w-4 h-4" /> Add Payment
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10 rounded-lg font-medium"
            >
              <Ban className="w-4 h-4" /> Cancel
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 border border-red-500 text-red-400 hover:bg-red-500/10 rounded-lg font-medium"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {returnOpen && (
        <RentalReturnModal
          rental={rental}
          companyId={companyId}
          onClose={() => setReturnOpen(false)}
          onConfirm={handleReturn}
          loading={actionLoading}
        />
      )}
      {paymentOpen && (
        <RentalAddPaymentModal
          dueAmount={rental.dueAmount}
          onClose={() => setPaymentOpen(false)}
          onConfirm={handleAddPayment}
          loading={actionLoading}
        />
      )}
      {pickupOpen && (
        <RentalPickupModal
          rental={rental}
          onClose={() => setPickupOpen(false)}
          onConfirm={handlePickup}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
