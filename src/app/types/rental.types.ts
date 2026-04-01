export type RentalStatus = 'reserved' | 'picked_up' | 'overdue' | 'returned' | 'closed' | 'cancelled';

export interface RentalSecurityDetails {
  type: 'cash' | 'document';
  reference: string;
}

export interface RentalBooking {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  pickupDate: Date;
  returnDate: Date;
  rentAmount: number;
  securityDetails: RentalSecurityDetails;
  status: RentalStatus;
  paidAmount: number;
  balanceDue: number;
}

export interface DateConflict {
  hasConflict: boolean;
  conflictingBookingId?: string;
  conflictingDates?: { pickupDate: Date; returnDate: Date };
  availableFrom?: Date;
  message?: string;
}

export interface ReturnAssessment {
  condition: 'good' | 'minor_damage' | 'major_damage' | 'lost';
  damageCharges: number;
  lateCharges: number;
  totalCharges: number;
}

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  reserved: 'Reserved',
  picked_up: 'Picked Up',
  overdue: 'Overdue',
  returned: 'Returned',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const RENTAL_STATUS_COLORS: Record<RentalStatus, string> = {
  reserved: 'bg-blue-100 text-blue-800',
  picked_up: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  returned: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-orange-100 text-orange-800',
};
