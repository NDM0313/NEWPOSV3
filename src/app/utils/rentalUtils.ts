/**
 * RENTAL SYSTEM - UTILITY FUNCTIONS
 * Helper functions for rental business logic
 */

import { differenceInDays, isAfter, isBefore, isWithinInterval, parseISO } from 'date-fns';
import { RentalBooking, DateConflict, RentalStatus, ReturnAssessment } from '../types/rental.types';

// ============================================
// DATE CONFLICT DETECTION
// ============================================

/**
 * Check if a product is available for the requested date range
 * @param productId Product to check
 * @param pickupDate Requested pickup date
 * @param returnDate Requested return date
 * @param existingBookings All existing bookings for this product
 * @param excludeBookingId Optional booking ID to exclude (for edits)
 */
export const checkDateConflict = (
  productId: string,
  pickupDate: Date,
  returnDate: Date,
  existingBookings: RentalBooking[],
  excludeBookingId?: string
): DateConflict => {
  // Filter bookings for this product that are active
  const activeBookings = existingBookings.filter(
    booking => 
      booking.productId === productId &&
      booking.id !== excludeBookingId &&
      (booking.status === 'reserved' || booking.status === 'picked_up')
  );

  // Check for date overlap
  for (const booking of activeBookings) {
    const hasOverlap = 
      (isAfter(pickupDate, booking.pickupDate) && isBefore(pickupDate, booking.returnDate)) ||
      (isAfter(returnDate, booking.pickupDate) && isBefore(returnDate, booking.returnDate)) ||
      (isBefore(pickupDate, booking.pickupDate) && isAfter(returnDate, booking.returnDate)) ||
      (pickupDate.getTime() === booking.pickupDate.getTime()) ||
      (returnDate.getTime() === booking.returnDate.getTime());

    if (hasOverlap) {
      return {
        hasConflict: true,
        conflictingBookingId: booking.id,
        conflictingDates: {
          pickupDate: booking.pickupDate,
          returnDate: booking.returnDate
        },
        availableFrom: booking.returnDate,
        message: `Already booked from ${booking.pickupDate.toLocaleDateString()} to ${booking.returnDate.toLocaleDateString()}`
      };
    }
  }

  return {
    hasConflict: false
  };
};

// ============================================
// RENTAL CALCULATIONS
// ============================================

/**
 * Calculate total rental days
 */
export const calculateRentalDays = (pickupDate: Date, returnDate: Date): number => {
  const days = differenceInDays(returnDate, pickupDate);
  return days > 0 ? days : 0;
};

/**
 * Calculate late charges
 * @param expectedReturnDate Original return date
 * @param actualReturnDate Actual return date
 * @param dailyRate Daily rental rate
 */
export const calculateLateCharges = (
  expectedReturnDate: Date,
  actualReturnDate: Date,
  dailyRate: number
): { extraDays: number; lateCharges: number } => {
  const extraDays = differenceInDays(actualReturnDate, expectedReturnDate);
  
  if (extraDays <= 0) {
    return { extraDays: 0, lateCharges: 0 };
  }

  // Late charges = extra days × daily rate × 1.5 (penalty)
  const lateCharges = extraDays * dailyRate * 1.5;
  
  return { extraDays, lateCharges };
};

/**
 * Calculate final payment on return
 */
export const calculateReturnPayment = (
  booking: RentalBooking,
  assessment: Partial<ReturnAssessment>
): number => {
  const damageCharges = assessment.damageCharges || 0;
  const lateCharges = assessment.lateCharges || 0;
  const balanceDue = booking.balanceDue;
  
  const totalDue = balanceDue + damageCharges + lateCharges;
  
  return totalDue;
};

// ============================================
// STOCK MANAGEMENT
// ============================================

/**
 * Update product stock when booking is created
 */
export const lockProductStock = (
  currentStock: number,
  currentReserved: number,
  status: RentalStatus
): { stock: number; reserved: number; rented: number } => {
  if (status === 'reserved') {
    return {
      stock: currentStock,
      reserved: currentReserved + 1,
      rented: 0
    };
  }
  
  if (status === 'picked_up') {
    return {
      stock: currentStock - 1,
      reserved: Math.max(0, currentReserved - 1),
      rented: 1
    };
  }
  
  return {
    stock: currentStock,
    reserved: currentReserved,
    rented: 0
  };
};

/**
 * Release product stock when returned
 */
export const releaseProductStock = (
  currentStock: number,
  currentReserved: number,
  currentRented: number
): { stock: number; reserved: number; rented: number } => {
  return {
    stock: currentStock + 1,
    reserved: currentReserved,
    rented: Math.max(0, currentRented - 1)
  };
};

// ============================================
// STATUS TRANSITIONS
// ============================================

/**
 * Get allowed status transitions
 */
export const getAllowedStatusTransitions = (currentStatus: RentalStatus): RentalStatus[] => {
  const transitions: Record<RentalStatus, RentalStatus[]> = {
    reserved: ['picked_up', 'cancelled'],
    picked_up: ['returned', 'overdue'],
    returned: ['closed'],
    closed: [],
    cancelled: [],
    overdue: ['returned']
  };
  
  return transitions[currentStatus] || [];
};

/**
 * Check if status transition is valid
 */
export const isValidStatusTransition = (from: RentalStatus, to: RentalStatus): boolean => {
  const allowed = getAllowedStatusTransitions(from);
  return allowed.includes(to);
};

// ============================================
// AUTO STATUS DETECTION
// ============================================

/**
 * Auto-detect if booking is overdue
 */
export const shouldMarkAsOverdue = (booking: RentalBooking): boolean => {
  const now = new Date();
  return (
    booking.status === 'picked_up' &&
    isAfter(now, booking.returnDate)
  );
};

/**
 * Update booking status based on dates
 */
export const autoUpdateBookingStatus = (booking: RentalBooking): RentalStatus => {
  if (booking.status === 'picked_up' && shouldMarkAsOverdue(booking)) {
    return 'overdue';
  }
  
  return booking.status;
};

// ============================================
// VALIDATION
// ============================================

/**
 * Validate rental booking data
 */
export const validateRentalBooking = (data: {
  customerId?: string;
  productId?: string;
  pickupDate?: Date;
  returnDate?: Date;
  rentAmount?: number;
  securityDetails?: any;
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data.customerId) errors.push('Customer is required');
  if (!data.productId) errors.push('Product is required');
  if (!data.pickupDate) errors.push('Pickup date is required');
  if (!data.returnDate) errors.push('Return date is required');
  if (!data.rentAmount || data.rentAmount <= 0) errors.push('Rent amount must be greater than 0');
  if (!data.securityDetails) errors.push('Security details are required');
  
  if (data.pickupDate && data.returnDate) {
    if (isAfter(data.pickupDate, data.returnDate)) {
      errors.push('Return date must be after pickup date');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// ============================================
// INVOICE GENERATION
// ============================================

/**
 * Generate rental invoice number
 */
export const generateRentalInvoice = (lastInvoiceNumber: number): string => {
  const nextNumber = lastInvoiceNumber + 1;
  return `RENT-${nextNumber.toString().padStart(4, '0')}`;
};

// ============================================
// NOTIFICATION LOGIC
// ============================================

/**
 * Get upcoming pickup/return reminders
 */
export const getUpcomingReminders = (bookings: RentalBooking[]): {
  pickupToday: RentalBooking[];
  returnToday: RentalBooking[];
  overdue: RentalBooking[];
} => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const pickupToday = bookings.filter(b => 
    b.status === 'reserved' &&
    b.pickupDate >= today &&
    b.pickupDate < tomorrow
  );
  
  const returnToday = bookings.filter(b =>
    b.status === 'picked_up' &&
    b.returnDate >= today &&
    b.returnDate < tomorrow
  );
  
  const overdue = bookings.filter(b => shouldMarkAsOverdue(b));
  
  return { pickupToday, returnToday, overdue };
};

// ============================================
// SECURITY MANAGEMENT
// ============================================

/**
 * Check if security can be returned
 */
export const canReturnSecurity = (booking: RentalBooking, assessment: ReturnAssessment): boolean => {
  // If cash security and charges exceed security amount
  if (booking.securityDetails.type === 'cash') {
    const securityAmount = parseFloat(booking.securityDetails.reference) || 0;
    return assessment.totalCharges <= securityAmount;
  }
  
  // For document security, can return if no major damage/loss
  return assessment.condition !== 'lost' && assessment.condition !== 'major_damage';
};

// ============================================
// DAILY RATE CALCULATION
// ============================================

/**
 * Calculate daily rental rate from total
 */
export const calculateDailyRate = (totalRent: number, totalDays: number): number => {
  if (totalDays <= 0) return totalRent;
  return totalRent / totalDays;
};

// ============================================
// EXPORT ALL UTILS
// ============================================
export default {
  checkDateConflict,
  calculateRentalDays,
  calculateLateCharges,
  calculateReturnPayment,
  lockProductStock,
  releaseProductStock,
  getAllowedStatusTransitions,
  isValidStatusTransition,
  shouldMarkAsOverdue,
  autoUpdateBookingStatus,
  validateRentalBooking,
  generateRentalInvoice,
  getUpcomingReminders,
  canReturnSecurity,
  calculateDailyRate
};
