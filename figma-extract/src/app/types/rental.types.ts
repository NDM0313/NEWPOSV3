/**
 * RENTAL SYSTEM - TYPE DEFINITIONS
 * Complete type system for bridal rental management
 */

// ============================================
// RENTAL STATUS ENUM
// ============================================
export type RentalStatus = 
  | 'reserved'     // Booking done, pickup pending
  | 'picked_up'    // Product delivered to customer
  | 'returned'     // Product received back
  | 'closed'       // All settled
  | 'cancelled'    // Booking cancelled
  | 'overdue';     // Past return date

// ============================================
// SECURITY/GUARANTEE TYPES
// ============================================
export type SecurityType = 'id_card' | 'driving_license' | 'passport' | 'cash';

export interface SecurityDetails {
  type: SecurityType;
  reference: string; // Document number or cash amount
  photoFront?: string;
  photoBack?: string;
  heldByShop: boolean;
  returnedDate?: Date;
}

// ============================================
// RENTAL PRODUCT (Extended from Universal Product)
// ============================================
export interface RentalProduct {
  id: string;
  name: string;
  sku: string;
  image: string;
  category: string;
  brand: string;
  
  // Pricing
  sellingPrice: number;
  rentalPrice: number | null; // null = manual entry required
  securityDeposit: number | null;
  
  // Availability
  stock: number;
  availableForSale: boolean;
  availableForRent: boolean;
  reservedQuantity: number;
  rentedQuantity: number;
  
  // Module toggles
  isSellable: boolean;
  isRentable: boolean;
  
  // Status
  status: 'AVAILABLE' | 'RENTED_OUT' | 'RESERVED' | 'OUT_OF_STOCK';
}

// ============================================
// RENTAL BOOKING
// ============================================
export interface RentalBooking {
  id: string;
  invoiceNumber: string; // RENT-1001
  
  // Customer
  customerId: string;
  customerName: string;
  customerPhone?: string;
  
  // Dates
  bookingDate: Date;
  pickupDate: Date;
  returnDate: Date;
  actualReturnDate?: Date;
  totalDays: number;
  
  // Product
  productId: string;
  productName: string;
  productSku: string;
  productImage: string;
  
  // Pricing
  rentAmount: number;
  advancePaid: number;
  balanceDue: number;
  damageCharges: number;
  lateCharges: number;
  extraDays: number;
  
  // Security
  securityDetails: SecurityDetails;
  
  // Status
  status: RentalStatus;
  
  // Notes
  notes?: string;
  measurementNotes?: string;
  
  // Tracking
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Branch
  branchId: string;
  branchName: string;
}

// ============================================
// RENTAL CONFLICT CHECK
// ============================================
export interface DateConflict {
  hasConflict: boolean;
  conflictingBookingId?: string;
  conflictingDates?: {
    pickupDate: Date;
    returnDate: Date;
  };
  availableFrom?: Date;
  message?: string;
}

// ============================================
// RETURN ASSESSMENT
// ============================================
export interface ReturnAssessment {
  condition: 'perfect' | 'minor_damage' | 'major_damage' | 'lost';
  damageDescription?: string;
  damagePhotos?: string[];
  damageCharges: number;
  lateCharges: number;
  extraDays: number;
  totalCharges: number;
  securityAdjustment: number;
  finalPayable: number;
}

// ============================================
// RENTAL PAYMENT
// ============================================
export interface RentalPayment {
  id: string;
  bookingId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'other';
  paymentType: 'advance' | 'balance' | 'damage' | 'late_fee';
  paymentDate: Date;
  reference?: string;
  receivedBy: string;
}

// ============================================
// RENTAL NOTIFICATION
// ============================================
export interface RentalNotification {
  type: 'pickup_reminder' | 'return_reminder' | 'overdue_alert' | 'security_pending';
  bookingId: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  createdAt: Date;
  read: boolean;
}

// ============================================
// RENTAL STATISTICS
// ============================================
export interface RentalStats {
  totalBookings: number;
  activeRentals: number;
  overdueRentals: number;
  todayPickups: number;
  todayReturns: number;
  totalRevenue: number;
  pendingBalance: number;
  securityHeld: number;
}

// ============================================
// HELPER TYPES
// ============================================
export interface RentalFormData {
  customerId: string;
  productId: string;
  pickupDate: Date;
  returnDate: Date;
  rentAmount: number;
  advancePaid: number;
  securityDetails: SecurityDetails;
  notes?: string;
}

export interface RentalFilter {
  status?: RentalStatus[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  customerId?: string;
  productId?: string;
  branchId?: string;
}

// ============================================
// STATUS COLOR MAPPING
// ============================================
export const RENTAL_STATUS_COLORS: Record<RentalStatus, { bg: string; text: string; border: string }> = {
  reserved: {
    bg: 'bg-yellow-900/20',
    text: 'text-yellow-400',
    border: 'border-yellow-900/50'
  },
  picked_up: {
    bg: 'bg-blue-900/20',
    text: 'text-blue-400',
    border: 'border-blue-900/50'
  },
  returned: {
    bg: 'bg-green-900/20',
    text: 'text-green-400',
    border: 'border-green-900/50'
  },
  closed: {
    bg: 'bg-gray-900/20',
    text: 'text-gray-400',
    border: 'border-gray-800'
  },
  cancelled: {
    bg: 'bg-red-900/20',
    text: 'text-red-400',
    border: 'border-red-900/50'
  },
  overdue: {
    bg: 'bg-red-900/30',
    text: 'text-red-500',
    border: 'border-red-900/70'
  }
};

// ============================================
// STATUS LABELS
// ============================================
export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  reserved: 'Reserved',
  picked_up: 'Picked Up',
  returned: 'Returned',
  closed: 'Closed',
  cancelled: 'Cancelled',
  overdue: 'Overdue'
};
