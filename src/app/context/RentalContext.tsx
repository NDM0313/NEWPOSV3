// ============================================
// RENTAL CONTEXT – Full ERP (Sale/Purchase standard)
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useAccountingOptional } from '@/app/context/AccountingContext';
import { rentalService, RentalStatus } from '@/app/services/rentalService';
import { userService } from '@/app/services/userService';
import { toast } from 'sonner';
import {
  DATA_INVALIDATED_EVENT,
  dispatchRentalLifecycleInvalidated,
  shouldAcceptInvalidation,
  type DataInvalidationDetail,
} from '@/app/lib/dataInvalidationBus';
import { mapRentalRowToUI, mapRentalRowsSafe } from '@/app/lib/rentalUiMapper';
import type { RentalUI, RentalItemUI } from '@/app/types/rentalTypes';

export type { RentalUI, RentalItemUI } from '@/app/types/rentalTypes';

interface RentalContextType {
  rentals: RentalUI[];
  loading: boolean;
  loadFailed: boolean;
  rentalsTotal: number;
  rentalsPage: number;
  rentalsPageSize: number;
  setRentalsPage: (page: number) => void;
  getRentalById: (id: string) => RentalUI | undefined;
  refreshRentals: () => Promise<void>;
  createRental: (rental: Omit<RentalUI, 'id' | 'rentalNo' | 'itemsCount'> & { items: RentalItemUI[] }) => Promise<RentalUI>;
  updateRental: (id: string, updates: Partial<RentalUI>, items: RentalItemUI[] | null) => Promise<void>;
  finalizeRental: (id: string) => Promise<void>;
  receiveReturn: (id: string, payload: { actualReturnDate: string; notes?: string; conditionType: string; damageNotes?: string; penaltyAmount: number; penaltyPaid: boolean; penaltyPaymentMethod?: string; documentReturned: boolean; penaltyPaymentPreRecorded?: boolean }) => Promise<void>;
  cancelRental: (id: string) => Promise<void>;
  addPayment: (rentalId: string, amount: number, method: string, reference?: string) => Promise<void>;
  deletePayment: (rentalId: string, paymentId: string) => Promise<void>;
  deleteRental: (id: string) => Promise<void>;
  markAsPickedUp: (rentalId: string, payload: { actualPickupDate: string; notes?: string; documentType: string; documentNumber: string; documentExpiry?: string; documentReceived: boolean; remainingPaymentConfirmed: boolean; deliverOnCredit?: boolean; documentFrontImage?: string; documentBackImage?: string; customerPhoto?: string }) => Promise<void>;
}

const RentalContext = createContext<RentalContextType | undefined>(undefined);

export const useRentals = () => {
  const ctx = useContext(RentalContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      return {
        rentals: [],
        loading: false,
        loadFailed: false,
        rentalsTotal: 0,
        rentalsPage: 0,
        rentalsPageSize: 100,
        setRentalsPage: () => {},
        getRentalById: () => undefined,
        refreshRentals: async () => {},
        createRental: async () => ({} as RentalUI),
        updateRental: async () => {},
        finalizeRental: async () => {},
        receiveReturn: async () => {},
        cancelRental: async () => {},
        addPayment: async () => {},
        deletePayment: async () => {},
        deleteRental: async () => {},
        markAsPickedUp: async () => { /* no-op */ },
      } as RentalContextType;
    }
    throw new Error('useRentals must be used within RentalProvider');
  }
  return ctx;
};

export const RentalProvider = ({ children }: { children: ReactNode }) => {
  const RENTALS_PAGE_SIZE = 100;
  const [rentals, setRentals] = useState<RentalUI[]>([]);
  const [rentalsTotal, setRentalsTotal] = useState(0);
  const [rentalsPage, setRentalsPageState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const { companyId, branchId, user, requiresBranchSelection } = useSupabase();
  const accounting = useAccountingOptional();

  const loadSeqRef = React.useRef(0);
  const hasLoadedOnceRef = React.useRef(false);

  const loadRentals = useCallback(async () => {
    if (!companyId) return;
    const seq = ++loadSeqRef.current;
    const showBlockingLoader = !hasLoadedOnceRef.current;
    try {
      if (showBlockingLoader) setLoading(true);
      setLoadFailed(false);
      // Non-blocking: overdue marking must not delay the list fetch
      void rentalService.markOverdueRentals(companyId).catch((e) => {
        console.warn('[RENTAL CONTEXT] markOverdueRentals:', e);
      });
      const { rows, total } = await rentalService.fetchRentalsForList(
        companyId,
        branchId === 'all' ? undefined : branchId || undefined,
        { limit: RENTALS_PAGE_SIZE, offset: rentalsPage * RENTALS_PAGE_SIZE }
      );
      if (rows.length === 0 && rentalsPage > 0 && total > 0) {
        setRentalsPageState(0);
        return;
      }
      setRentalsTotal(total);
      const mapped = mapRentalRowsSafe(rows);
      if (mapped.length === 0 && rows.length > 0) {
        console.warn('[RENTAL CONTEXT] all rows failed to map', rows.length);
      }
      const salesmen = await userService.getSalesmen(companyId).catch(() => []);
      const salesmanNameById = new Map(
        (salesmen || []).map((s: { id: string; full_name?: string; name?: string }) => [
          s.id,
          s.full_name || s.name || '',
        ])
      );
      if (seq !== loadSeqRef.current) return;
      setRentals(
        mapped.map((rental) => {
          if (rental.salesmanId) {
            rental.salesmanName = salesmanNameById.get(rental.salesmanId) || '';
          }
          return rental;
        })
      );
      hasLoadedOnceRef.current = true;
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      console.error('[RENTAL CONTEXT]', e);
      toast.error('Failed to load rentals');
      setLoadFailed(true);
      if (!hasLoadedOnceRef.current) setRentals([]);
      setRentalsTotal(0);
    } finally {
      if (seq === loadSeqRef.current && showBlockingLoader) setLoading(false);
    }
  }, [companyId, branchId, rentalsPage]);

  const setRentalsPage = useCallback((p: number) => {
    setRentalsPageState(Math.max(0, p));
  }, []);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    hasLoadedOnceRef.current = false;
    setRentalsPageState(0);
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId) return;
    void loadRentals();
  }, [companyId, branchId, rentalsPage, loadRentals]);

  // Realtime: WebRealtimeBridge only (avoids duplicate channels with this provider).
  useEffect(() => {
    if (!companyId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const queue = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void loadRentals();
      }, 220);
    };
    const onDataInvalidated = (ev: Event) => {
      const detail = (ev as CustomEvent<DataInvalidationDetail>).detail;
      const reason = String(detail?.reason ?? '');
      if (reason.includes('fallback-poll')) return;
      if (
        !shouldAcceptInvalidation(detail, {
          domain: ['rentals'],
          companyId,
          branchId: branchId === 'all' ? null : branchId ?? null,
        })
      ) {
        return;
      }
      queue();
    };
    window.addEventListener(DATA_INVALIDATED_EVENT, onDataInvalidated as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(DATA_INVALIDATED_EVENT, onDataInvalidated as EventListener);
    };
  }, [branchId, companyId, loadRentals]);

  const getRentalById = (id: string) => rentals.find((r) => r.id === id);

  const createRental = async (
    data: Omit<RentalUI, 'id' | 'rentalNo' | 'itemsCount'> & { items: RentalItemUI[] }
  ): Promise<RentalUI> => {
    if (!companyId || !user) throw new Error('Company and user required');
    if (!data.branchId) {
      if (requiresBranchSelection) throw new Error('Branch is required');
      throw new Error('No branch available. Please try again.');
    }
    if (!data.items?.length) throw new Error('At least one item required');
    const total = data.items.reduce((s, i) => s + i.total, 0);
    const paid = data.paidAmount ?? 0;
    const due = total - paid;
    const created = await rentalService.createRental(
      companyId,
      user.id,
      {
        company_id: companyId,
        branch_id: data.branchId,
        customer_id: data.customerId || null,
        customer_name: data.customerName,
        start_date: data.startDate,
        expected_return_date: data.expectedReturnDate,
        status: 'draft',
        total_amount: total,
        paid_amount: paid,
        due_amount: due,
        notes: data.notes || null,
        created_by: user.id,
      },
      data.items.map((i) => ({
        product_id: i.productId,
        product_name: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        unit: i.unit,
        rate: i.rate,
        total: i.total,
        boxes: i.boxes ?? null,
        pieces: i.pieces ?? null,
      }))
    );
    await loadRentals();
    dispatchRentalLifecycleInvalidated({
      companyId,
      branchId: data.branchId,
      customerId: data.customerId || null,
      rentalId: (created as any).id as string,
      reason: 'rental-created',
    });
    toast.success(`Rental ${(created as any).rental_no} created`);
    return convertFromSupabaseRental(created as any);
  };

  const updateRental = async (
    id: string,
    updates: Partial<RentalUI>,
    items: RentalItemUI[] | null
  ) => {
    if (!companyId) return;
    const payload: any = {};
    if (updates.customerId !== undefined) payload.customer_id = updates.customerId;
    if (updates.customerName !== undefined) payload.customer_name = updates.customerName;
    if (updates.startDate !== undefined) payload.start_date = updates.startDate;
    if (updates.expectedReturnDate !== undefined) payload.expected_return_date = updates.expectedReturnDate;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    const itemPayload = items
      ? items.map((i) => ({
          product_id: i.productId,
          product_name: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          unit: i.unit,
          rate: i.rate,
          total: i.total,
          boxes: i.boxes ?? null,
          pieces: i.pieces ?? null,
        }))
      : null;
    const before = getRentalById(id);
    await rentalService.updateRental(id, companyId, payload, itemPayload);
    await loadRentals();
    dispatchRentalLifecycleInvalidated({
      companyId,
      branchId: before?.branchId ?? null,
      customerId: (updates.customerId !== undefined ? updates.customerId : before?.customerId) ?? null,
      rentalId: id,
      reason: 'rental-updated',
    });
    toast.success('Rental updated');
  };

  const finalizeRental = async (id: string) => {
    if (!companyId) return;
    const before = getRentalById(id);
    await rentalService.finalizeRental(id, companyId, user?.id);
    await loadRentals();
    dispatchRentalLifecycleInvalidated({
      companyId,
      branchId: before?.branchId ?? null,
      customerId: before?.customerId ?? null,
      rentalId: id,
      reason: 'rental-finalized',
    });
    toast.success('Rental finalized – stock out');
  };

  const receiveReturn = async (id: string, payload: { actualReturnDate: string; notes?: string; conditionType: string; damageNotes?: string; penaltyAmount: number; penaltyPaid: boolean; penaltyPaymentMethod?: string; documentReturned: boolean; penaltyPaymentPreRecorded?: boolean }) => {
    if (!companyId) return;
    const rental = getRentalById(id) || rentals.find((r) => r.id === id);
    await rentalService.receiveReturn(id, companyId, payload, user?.id);
    if (payload.penaltyAmount > 0 && rental) {
      if (payload.penaltyPaid) {
        // Party AR: Dr AR / Cr Income (charge) + Dr Cash / Cr AR (receipt). Skip if UnifiedPaymentDialog already posted.
        if (!payload.penaltyPaymentPreRecorded) {
          let penaltyPaymentId: string | undefined;
          try {
            const { supabase } = await import('@/lib/supabase');
            const { data: penRow } = await supabase
              .from('rental_payments')
              .select('id')
              .eq('rental_id', id)
              .eq('payment_type', 'penalty')
              .order('payment_date', { ascending: false })
              .limit(1)
              .maybeSingle();
            penaltyPaymentId = (penRow as { id?: string } | null)?.id;
          } catch {
            penaltyPaymentId = undefined;
          }
          accounting
            ?.recordRentalReturn({
              bookingId: id,
              customerName: rental.customerName,
              customerId: rental.customerId || '',
              securityDepositAmount: 0,
              damageCharge: payload.penaltyAmount,
              paymentMethod: (payload.penaltyPaymentMethod || 'Cash') as any,
              rentalPaymentId: penaltyPaymentId,
              branchId: rental.branchId || branchId,
            })
            ?.catch((err) => console.warn('[RentalContext] Ledger penalty posting:', err));
        }
      } else {
        // Credit mode: Dr AR (customer owes), Cr Rental Income
        accounting?.recordRentalCreditDelivery({
          bookingId: id,
          customerName: rental.customerName,
          customerId: rental.customerId || '',
          remainingAmount: payload.penaltyAmount,
          paymentMethod: 'Cash',
        })?.catch((err) => console.warn('[RentalContext] Penalty credit posting:', err));
      }
    }
    // Always recognize any unreleased advance as income on return (handles fully advance-paid rentals)
    if (rental) {
      accounting?.recognizeRentalAdvance({
        bookingId: id,
        customerName: rental.customerName,
        customerId: rental.customerId || '',
      })?.catch((err) => console.warn('[RentalContext] Advance recognition on return:', err));
    }
    await loadRentals();
    dispatchRentalLifecycleInvalidated({
      companyId,
      branchId: rental?.branchId ?? null,
      customerId: rental?.customerId ?? null,
      rentalId: id,
      reason: 'rental-return',
    });
    toast.success(payload.penaltyPaid ? 'Return received – penalty collected' : 'Return received – penalty added to customer credit');
  };

  const cancelRental = async (id: string) => {
    if (!companyId) return;
    const r = getRentalById(id);
    await rentalService.cancelRental(id, companyId, user?.id);
    await loadRentals();
    dispatchRentalLifecycleInvalidated({
      companyId,
      branchId: r?.branchId ?? null,
      customerId: r?.customerId ?? null,
      rentalId: id,
      reason: 'rental-cancelled',
    });
    toast.success('Rental cancelled');
  };

  const addPayment = async (rentalId: string, amount: number, method: string, reference?: string) => {
    if (!companyId) return;
    const payRow = await rentalService.addPayment(rentalId, companyId, amount, method, reference, user?.id);
    // Issue 11: Post rental payment to accounting so reports/ledger reconcile with rental_payments
    const rental = getRentalById(rentalId);
    if (rental && amount > 0) {
      const paymentMethod = method === 'bank' ? 'Bank' : method === 'other' ? 'Mobile Wallet' : 'Cash';
      accounting?.recordRentalDelivery({
        bookingId: rentalId,
        customerName: rental.customerName,
        customerId: rental.customerId || '',
        remainingAmount: amount,
        paymentMethod,
        rentalPaymentId: payRow?.id,
      })?.catch((err) => {
        console.warn('[RentalContext] Ledger posting failed (payment already recorded):', err);
      });
    }
    await loadRentals();
    dispatchRentalLifecycleInvalidated({
      companyId,
      branchId: rental?.branchId ?? null,
      customerId: rental?.customerId ?? null,
      rentalId,
      reason: 'rental-payment',
    });
    toast.success('Payment recorded');
  };

  const deletePayment = async (rentalId: string, paymentId: string) => {
    if (!companyId) return;
    const rental = getRentalById(rentalId);
    await rentalService.deletePayment(paymentId, rentalId, companyId, user?.id);
    await loadRentals();
    dispatchRentalLifecycleInvalidated({
      companyId,
      branchId: rental?.branchId ?? null,
      customerId: rental?.customerId ?? null,
      rentalId,
      reason: 'rental-payment-deleted',
    });
    toast.success('Payment deleted');
  };

  const deleteRental = async (id: string) => {
    if (!companyId) return;
    const r = getRentalById(id);
    await rentalService.deleteRental(id, companyId, user?.id);
    await loadRentals();
    dispatchRentalLifecycleInvalidated({
      companyId,
      branchId: r?.branchId ?? null,
      customerId: r?.customerId ?? null,
      rentalId: id,
      reason: 'rental-deleted',
    });
    toast.success('Rental deleted');
  };

  const markAsPickedUp = async (rentalId: string, payload: { actualPickupDate: string; notes?: string; documentType: string; documentNumber: string; documentExpiry?: string; documentReceived: boolean; remainingPaymentConfirmed: boolean; deliverOnCredit?: boolean; documentFrontImage?: string; documentBackImage?: string; customerPhoto?: string }) => {
    if (!companyId) return;
    const rental = getRentalById(rentalId);
    const pickupDay = (payload.actualPickupDate || '').toString().slice(0, 10) || new Date().toISOString().split('T')[0];
    if (rental?.customerId) {
      try {
        const {
          fetchRentalArAmounts,
          postRentalPartyRevenueIfNeeded,
          postRentalPartyDiscountIfNeeded,
        } = await import('@/app/services/rentalPartyArAccounting');
        const am = await fetchRentalArAmounts(rentalId);
        if (am) {
          await postRentalPartyRevenueIfNeeded({
            companyId,
            branchId: rental.branchId || null,
            rentalId,
            customerId: rental.customerId,
            customerName: rental.customerName,
            rentalCharges: am.rentalCharges,
            entryDate: pickupDay,
            createdBy: user?.id ?? null,
          });
          if (am.discountAmount > 0) {
            await postRentalPartyDiscountIfNeeded({
              companyId,
              branchId: rental.branchId || null,
              rentalId,
              customerId: rental.customerId,
              customerName: rental.customerName,
              discountAmount: am.discountAmount,
              entryDate: pickupDay,
              createdBy: user?.id ?? null,
            });
          }
        }
      } catch (e) {
        console.warn('[RentalContext] Party AR revenue at pickup skipped:', e);
      }
    }
    // Deliver on credit: party AR already shows unpaid balance from Dr AR / Cr Income (no second income JE).
    await rentalService.markAsPickedUp(rentalId, companyId, payload, user?.id);
    // Legacy 2020 → 4200 recognition (no-op when party AR model used)
    if (rental) {
      accounting?.recognizeRentalAdvance({
        bookingId: rentalId,
        customerName: rental.customerName,
        customerId: rental.customerId || '',
      })?.catch((err) => console.warn('[RentalContext] Advance recognition on pickup:', err));
    }
    await loadRentals();
    dispatchRentalLifecycleInvalidated({
      companyId,
      branchId: rental?.branchId ?? null,
      customerId: rental?.customerId ?? null,
      rentalId,
      reason: 'rental-picked-up',
    });
    toast.success(payload.deliverOnCredit ? 'Rental delivered on credit' : 'Rental marked as picked up');
  };

  const value = useMemo<RentalContextType>(() => ({
    rentals,
    loading,
    loadFailed,
    rentalsTotal,
    rentalsPage,
    rentalsPageSize: RENTALS_PAGE_SIZE,
    setRentalsPage,
    getRentalById,
    refreshRentals: loadRentals,
    createRental,
    updateRental,
    finalizeRental,
    receiveReturn,
    cancelRental,
    addPayment,
    deletePayment,
    deleteRental,
    markAsPickedUp,
  }), [
    rentals, loading, loadFailed, rentalsTotal, rentalsPage, setRentalsPage, getRentalById, loadRentals, createRental, updateRental,
    finalizeRental, receiveReturn, cancelRental, addPayment, deletePayment,
    deleteRental, markAsPickedUp,
  ]);

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
};
