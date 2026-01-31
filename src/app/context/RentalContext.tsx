// ============================================
// RENTAL CONTEXT – Full ERP (Sale/Purchase standard)
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { rentalService, RentalStatus } from '@/app/services/rentalService';
import { toast } from 'sonner';

export interface RentalItemUI {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  boxes?: number | null;
  pieces?: number | null;
}

export interface RentalUI {
  id: string;
  rentalNo: string;
  customerId: string | null;
  customerName: string;
  customerContact?: string;
  branchId: string;
  location: string;
  startDate: string;
  expectedReturnDate: string;
  actualReturnDate: string | null;
  status: RentalStatus;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  itemsCount: number;
  items?: RentalItemUI[];
  createdBy?: string;
  createdByName?: string;
  notes?: string | null;
}

// Map old DB status (booked, picked_up, returned, closed, cancelled, overdue) to new (draft, rented, returned, overdue, cancelled)
function mapStatus(status: string): RentalStatus {
  const map: Record<string, RentalStatus> = {
    draft: 'draft',
    rented: 'rented',
    returned: 'returned',
    overdue: 'overdue',
    cancelled: 'cancelled',
    booked: 'draft',
    picked_up: 'rented',
    closed: 'returned',
  };
  return (map[status] || 'draft') as RentalStatus;
}

function convertFromSupabaseRental(row: any): RentalUI {
  let location = '';
  if (row.branch) {
    location = row.branch.name || row.branch.code || '';
  }
  if (location && row.branch?.code) location = `${row.branch.code} | ${location}`.trim();
  if (!location && row.branch_id) location = row.branch_id;

  // Support both new schema (start_date, expected_return_date, rental_no) and old (pickup_date, return_date, booking_no)
  const startDate = row.start_date || row.pickup_date || row.booking_date || '';
  const expectedReturnDate = row.expected_return_date || row.return_date || '';
  const actualReturnDate = row.actual_return_date ?? null;
  const rentalNo = row.rental_no || row.booking_no || '';

  const items = row.items || [];
  return {
    id: row.id,
    rentalNo,
    customerId: row.customer_id || null,
    customerName: row.customer_name || row.customer?.name || 'Unknown',
    customerContact: row.customer?.phone,
    branchId: row.branch_id || '',
    location,
    startDate,
    expectedReturnDate,
    actualReturnDate,
    status: mapStatus(row.status || 'draft'),
    totalAmount: Number(row.total_amount ?? row.rental_charges ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    dueAmount: Number(row.due_amount ?? 0),
    itemsCount: items.length,
    items: items.map((i: any) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name || i.product?.name || '',
      sku: i.sku || i.product?.sku || '',
      quantity: Number(i.quantity ?? 0),
      unit: i.unit || 'piece',
      rate: Number(i.rate ?? i.rate_per_day ?? 0),
      total: Number(i.total ?? 0),
      boxes: i.boxes,
      pieces: i.pieces,
    })),
    createdBy: row.created_by,
    createdByName: row.created_by_user?.full_name || row.created_by_user?.email,
    notes: row.notes,
  };
}

interface RentalContextType {
  rentals: RentalUI[];
  loading: boolean;
  getRentalById: (id: string) => RentalUI | undefined;
  refreshRentals: () => Promise<void>;
  createRental: (rental: Omit<RentalUI, 'id' | 'rentalNo' | 'itemsCount'> & { items: RentalItemUI[] }) => Promise<RentalUI>;
  updateRental: (id: string, updates: Partial<RentalUI>, items: RentalItemUI[] | null) => Promise<void>;
  finalizeRental: (id: string) => Promise<void>;
  receiveReturn: (id: string, actualReturnDate: string) => Promise<void>;
  cancelRental: (id: string) => Promise<void>;
  addPayment: (rentalId: string, amount: number, method: string, reference?: string) => Promise<void>;
  deletePayment: (rentalId: string, paymentId: string) => Promise<void>;
  deleteRental: (id: string) => Promise<void>;
}

const RentalContext = createContext<RentalContextType | undefined>(undefined);

export const useRentals = () => {
  const ctx = useContext(RentalContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      return {
        rentals: [],
        loading: false,
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
      } as RentalContextType;
    }
    throw new Error('useRentals must be used within RentalProvider');
  }
  return ctx;
};

export const RentalProvider = ({ children }: { children: ReactNode }) => {
  const [rentals, setRentals] = useState<RentalUI[]>([]);
  const [loading, setLoading] = useState(true);
  const { companyId, branchId, user } = useSupabase();

  const loadRentals = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const data = await rentalService.getAllRentals(
        companyId,
        branchId === 'all' ? undefined : branchId || undefined
      );
      setRentals((data || []).map(convertFromSupabaseRental));
    } catch (e) {
      console.error('[RENTAL CONTEXT]', e);
      toast.error('Failed to load rentals');
      setRentals([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    if (companyId) loadRentals();
    else setLoading(false);
  }, [companyId, loadRentals]);

  const getRentalById = (id: string) => rentals.find((r) => r.id === id);

  const createRental = async (
    data: Omit<RentalUI, 'id' | 'rentalNo' | 'itemsCount'> & { items: RentalItemUI[] }
  ): Promise<RentalUI> => {
    if (!companyId || !user) throw new Error('Company and user required');
    if (!data.branchId) throw new Error('Branch is required');
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
    await rentalService.updateRental(id, companyId, payload, itemPayload);
    await loadRentals();
    toast.success('Rental updated');
  };

  const finalizeRental = async (id: string) => {
    if (!companyId) return;
    await rentalService.finalizeRental(id, companyId, user?.id);
    await loadRentals();
    toast.success('Rental finalized – stock out');
  };

  const receiveReturn = async (id: string, actualReturnDate: string) => {
    if (!companyId) return;
    await rentalService.receiveReturn(id, companyId, actualReturnDate, user?.id);
    await loadRentals();
    toast.success('Return received – stock in');
  };

  const cancelRental = async (id: string) => {
    if (!companyId) return;
    await rentalService.cancelRental(id, companyId, user?.id);
    await loadRentals();
    toast.success('Rental cancelled');
  };

  const addPayment = async (rentalId: string, amount: number, method: string, reference?: string) => {
    if (!companyId) return;
    await rentalService.addPayment(rentalId, companyId, amount, method, reference, user?.id);
    await loadRentals();
    toast.success('Payment recorded');
  };

  const deletePayment = async (rentalId: string, paymentId: string) => {
    if (!companyId) return;
    await rentalService.deletePayment(paymentId, rentalId, companyId, user?.id);
    await loadRentals();
    toast.success('Payment deleted');
  };

  const deleteRental = async (id: string) => {
    if (!companyId) return;
    await rentalService.deleteRental(id, companyId, user?.id);
    await loadRentals();
    toast.success('Rental deleted');
  };

  const value: RentalContextType = {
    rentals,
    loading,
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
  };

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
};
