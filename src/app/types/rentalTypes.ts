import type { RentalStatus } from '@/app/services/rentalService';

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
  createdAt?: string;
  salesmanId?: string | null;
  salesmanName?: string;
  createdBy?: string;
  createdByName?: string;
  notes?: string | null;
  documentType?: string;
  documentNumber?: string;
  securityDocumentType?: string | null;
  securityDocumentNumber?: string | null;
  pickupDocumentType?: string | null;
  pickupDocumentNumber?: string | null;
  damageCharges?: number;
  conditionType?: string | null;
  damageNotes?: string | null;
  penaltyPaid?: boolean;
  refundAmount?: number;
}
