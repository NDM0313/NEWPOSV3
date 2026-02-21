import { useState } from 'react';
import { Search, Calendar, Package, AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

export interface RentalBooking {
  id: string;
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  customerCnic: string;
  productName: string;
  productSize?: string;
  productColor?: string;
  bookingDate: string;
  deliveryDate: string;
  returnDate: string;
  totalRent: number;
  advancePaid: number;
  remainingAmount: number;
  securityDeposit: number;
  status: 'booked' | 'delivered' | 'returned' | 'completed' | 'cancelled';
  notes?: string;
}

interface RentalDashboardProps {
  bookings: RentalBooking[];
  onBookingClick: (booking: RentalBooking) => void;
  onDeliveryClick: (booking: RentalBooking) => void;
  onReturnClick: (booking: RentalBooking) => void;
}

export function RentalDashboard({ bookings, onBookingClick, onDeliveryClick, onReturnClick }: RentalDashboardProps) {
  const responsive = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'booked' | 'delivered' | 'returned'>('all');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if delivery is due (today or past)
  const isDeliveryDue = (booking: RentalBooking) => {
    const deliveryDate = new Date(booking.deliveryDate);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate <= today && booking.status === 'booked';
  };

  // Check if return is due (today or past)
  const isReturnDue = (booking: RentalBooking) => {
    const returnDate = new Date(booking.returnDate);
    returnDate.setHours(0, 0, 0, 0);
    return returnDate <= today && booking.status === 'delivered';
  };

  // Check if return is overdue
  const isReturnOverdue = (booking: RentalBooking) => {
    const returnDate = new Date(booking.returnDate);
    returnDate.setHours(0, 0, 0, 0);
    return returnDate < today && booking.status === 'delivered';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'booked':
        return 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30';
      case 'delivered':
        return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30';
      case 'returned':
        return 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30';
      case 'completed':
        return 'text-[#6B7280] bg-[#6B7280]/10 border-[#6B7280]/30';
      case 'cancelled':
        return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30';
      default:
        return 'text-[#9CA3AF] bg-[#9CA3AF]/10 border-[#9CA3AF]/30';
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.productName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      filterStatus === 'all' || booking.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  // Categorize bookings
  const deliveryDueBookings = filteredBookings.filter(isDeliveryDue);
  const returnDueBookings = filteredBookings.filter(b => isReturnDue(b) && !isReturnOverdue(b));
  const overdueBookings = filteredBookings.filter(isReturnOverdue);
  const upcomingBookings = filteredBookings.filter(
    b => !isDeliveryDue(b) && !isReturnDue(b) && (b.status === 'booked' || b.status === 'delivered')
  );
  const completedBookings = filteredBookings.filter(b => b.status === 'returned' || b.status === 'completed');

  // Stats
  const stats = {
    total: bookings.length,
    active: bookings.filter(b => b.status === 'booked' || b.status === 'delivered').length,
    deliveryDue: deliveryDueBookings.length,
    returnDue: returnDueBookings.length + overdueBookings.length,
    completed: bookings.filter(b => b.status === 'returned' || b.status === 'completed').length,
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search bookings, customers, products..."
          className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
        />
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'All', count: stats.total },
          { id: 'booked', label: 'Booked', count: bookings.filter(b => b.status === 'booked').length },
          { id: 'delivered', label: 'Delivered', count: bookings.filter(b => b.status === 'delivered').length },
          { id: 'returned', label: 'Completed', count: stats.completed },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setFilterStatus(filter.id as typeof filterStatus)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filterStatus === filter.id
                ? 'bg-[#8B5CF6] text-white'
                : 'bg-[#1F2937] border border-[#374151] text-[#9CA3AF] hover:border-[#8B5CF6]'
            }`}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-[#3B82F6]/10 to-[#3B82F6]/5 border border-[#3B82F6]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-[#3B82F6]" />
            <p className="text-xs text-[#9CA3AF]">Active Rentals</p>
          </div>
          <p className="text-2xl font-bold text-[#3B82F6]">{stats.active}</p>
        </div>
        <div className="bg-gradient-to-br from-[#10B981]/10 to-[#10B981]/5 border border-[#10B981]/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-[#10B981]" />
            <p className="text-xs text-[#9CA3AF]">Completed</p>
          </div>
          <p className="text-2xl font-bold text-[#10B981]">{stats.completed}</p>
        </div>
      </div>

      {/* OVERDUE RETURNS (Highest Priority - Red Alert) */}
      {overdueBookings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-[#EF4444]" />
            <h3 className="text-sm font-semibold text-[#EF4444]">OVERDUE RETURNS ({overdueBookings.length})</h3>
          </div>
          <div className="space-y-2">
            {overdueBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onClick={() => onBookingClick(booking)}
                actionButton={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReturnClick(booking);
                    }}
                    className="px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Process Return NOW
                  </button>
                }
                highlightColor="border-[#EF4444] bg-[#EF4444]/5"
              />
            ))}
          </div>
        </div>
      )}

      {/* DELIVERY DUE (High Priority - Blue) */}
      {deliveryDueBookings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package size={18} className="text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-white">Delivery Due Today ({deliveryDueBookings.length})</h3>
          </div>
          <div className="space-y-2">
            {deliveryDueBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onClick={() => onBookingClick(booking)}
                actionButton={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeliveryClick(booking);
                    }}
                    className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Start Delivery
                  </button>
                }
                highlightColor="border-[#3B82F6] bg-[#3B82F6]/5"
              />
            ))}
          </div>
        </div>
      )}

      {/* RETURN DUE (Medium Priority - Orange) */}
      {returnDueBookings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-[#F59E0B]" />
            <h3 className="text-sm font-semibold text-white">Return Due Today ({returnDueBookings.length})</h3>
          </div>
          <div className="space-y-2">
            {returnDueBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onClick={() => onBookingClick(booking)}
                actionButton={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReturnClick(booking);
                    }}
                    className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Process Return
                  </button>
                }
                highlightColor="border-[#F59E0B] bg-[#F59E0B]/5"
              />
            ))}
          </div>
        </div>
      )}

      {/* UPCOMING BOOKINGS */}
      {upcomingBookings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-[#9CA3AF]" />
            <h3 className="text-sm font-semibold text-white">Upcoming ({upcomingBookings.length})</h3>
          </div>
          <div className="space-y-2">
            {upcomingBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onClick={() => onBookingClick(booking)}
              />
            ))}
          </div>
        </div>
      )}

      {/* COMPLETED */}
      {completedBookings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-[#10B981]" />
            <h3 className="text-sm font-semibold text-white">Completed ({completedBookings.length})</h3>
          </div>
          <div className="space-y-2">
            {completedBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onClick={() => onBookingClick(booking)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredBookings.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
          <p className="text-[#9CA3AF]">No rental bookings found</p>
        </div>
      )}
    </div>
  );
}

// Booking Card Component
interface BookingCardProps {
  booking: RentalBooking;
  onClick: () => void;
  actionButton?: React.ReactNode;
  highlightColor?: string;
}

function BookingCard({ booking, onClick, actionButton, highlightColor }: BookingCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'booked':
        return 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/30';
      case 'delivered':
        return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30';
      case 'returned':
      case 'completed':
        return 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30';
      case 'cancelled':
        return 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/30';
      default:
        return 'text-[#9CA3AF] bg-[#9CA3AF]/10 border-[#9CA3AF]/30';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-[#1F2937] border rounded-xl p-4 hover:border-[#8B5CF6] transition-all cursor-pointer ${
        highlightColor || 'border-[#374151]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white text-sm">{booking.bookingNumber}</h3>
            <span className={`px-2 py-0.5 rounded border text-xs font-medium ${getStatusColor(booking.status)}`}>
              {booking.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-[#D1D5DB]">{booking.customerName}</p>
          <p className="text-xs text-[#6B7280]">{booking.customerPhone}</p>
        </div>
      </div>

      {/* Product */}
      <div className="mb-3 pb-3 border-b border-[#374151]">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-xl">👗</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{booking.productName}</p>
            {(booking.productSize || booking.productColor) && (
              <p className="text-xs text-[#6B7280]">
                {booking.productSize} {booking.productSize && booking.productColor && '•'} {booking.productColor}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dates Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div>
          <p className="text-[#6B7280] mb-1">Booked</p>
          <p className="text-white font-medium">{new Date(booking.bookingDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
        </div>
        <div>
          <p className="text-[#6B7280] mb-1">Delivery</p>
          <p className="text-[#10B981] font-medium">{new Date(booking.deliveryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
        </div>
        <div>
          <p className="text-[#6B7280] mb-1">Return</p>
          <p className="text-[#F59E0B] font-medium">{new Date(booking.returnDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="flex items-center justify-between text-sm mb-3">
        <div>
          <span className="text-[#6B7280]">Total: </span>
          <span className="font-semibold text-white">Rs. {booking.totalRent.toLocaleString()}</span>
        </div>
        {booking.remainingAmount > 0 && booking.status === 'booked' && (
          <div className="text-right">
            <div className="text-xs text-[#6B7280]">Remaining</div>
            <div className="font-semibold text-[#F59E0B]">
              Rs. {booking.remainingAmount.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      {actionButton && (
        <div className="pt-3 border-t border-[#374151]">
          {actionButton}
        </div>
      )}
    </div>
  );
}