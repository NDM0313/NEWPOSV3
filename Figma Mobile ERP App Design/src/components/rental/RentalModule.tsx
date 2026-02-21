import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { User } from '../../App';
import { useResponsive } from '../../hooks/useResponsive';
import { RentalBookingFlow } from './RentalBookingFlow';
import { RentalDeliveryFlow } from './RentalDeliveryFlow';
import { RentalReturnFlow } from './RentalReturnFlow';
import { RentalDashboard, type RentalBooking } from './RentalDashboard';

interface RentalModuleProps {
  onBack: () => void;
  user: User;
}

type View = 'dashboard' | 'create' | 'delivery' | 'return' | 'details';

export function RentalModule({ onBack, user }: RentalModuleProps) {
  const responsive = useResponsive();
  const [view, setView] = useState<View>('dashboard');
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null);

  // Mock rental bookings
  const mockBookings: RentalBooking[] = [
    {
      id: '1',
      bookingNumber: 'RNT-0001',
      customerName: 'Sana Ahmed',
      customerPhone: '+92 300 1234567',
      customerCnic: '42101-1234567-8',
      productName: 'Bridal Lehenga - Red & Gold Premium',
      productSize: 'Medium',
      productColor: 'Red & Gold',
      bookingDate: '2026-01-15',
      deliveryDate: '2026-01-19', // Today - delivery due
      returnDate: '2026-01-22',
      totalRent: 50000,
      advancePaid: 25000,
      remainingAmount: 25000,
      securityDeposit: 15000,
      status: 'booked',
    },
    {
      id: '2',
      bookingNumber: 'RNT-0002',
      customerName: 'Ayesha Khan',
      customerPhone: '+92 321 9876543',
      customerCnic: '42201-9876543-2',
      productName: 'Wedding Dress - Cream & Silver Luxury',
      productSize: 'Large',
      productColor: 'Cream & Silver',
      bookingDate: '2026-01-12',
      deliveryDate: '2026-01-16',
      returnDate: '2026-01-19', // Today - return due
      totalRent: 60000,
      advancePaid: 60000,
      remainingAmount: 0,
      securityDeposit: 20000,
      status: 'delivered',
    },
    {
      id: '3',
      bookingNumber: 'RNT-0003',
      customerName: 'Fatima Ali',
      customerPhone: '+92 333 4567890',
      customerCnic: '42301-4567890-1',
      productName: 'Bridal Lehenga - Pink Elegance',
      productSize: 'Small',
      productColor: 'Pink & Gold',
      bookingDate: '2026-01-10',
      deliveryDate: '2026-01-14',
      returnDate: '2026-01-17', // Overdue
      totalRent: 45000,
      advancePaid: 45000,
      remainingAmount: 0,
      securityDeposit: 12000,
      status: 'delivered',
    },
    {
      id: '4',
      bookingNumber: 'RNT-0004',
      customerName: 'Zara Malik',
      customerPhone: '+92 345 1122334',
      customerCnic: '42401-1122334-4',
      productName: 'Royal Wedding Dress - Golden Heritage',
      productSize: 'Medium',
      productColor: 'Golden',
      bookingDate: '2026-01-18',
      deliveryDate: '2026-01-22', // Upcoming
      returnDate: '2026-01-26',
      totalRent: 75000,
      advancePaid: 40000,
      remainingAmount: 35000,
      securityDeposit: 25000,
      status: 'booked',
    },
    {
      id: '5',
      bookingNumber: 'RNT-0005',
      customerName: 'Hina Raza',
      customerPhone: '+92 312 9988776',
      customerCnic: '42501-9988776-5',
      productName: 'Evening Gown - Emerald Green',
      productSize: 'Medium',
      productColor: 'Emerald',
      bookingDate: '2026-01-05',
      deliveryDate: '2026-01-08',
      returnDate: '2026-01-11',
      totalRent: 35000,
      advancePaid: 35000,
      remainingAmount: 0,
      securityDeposit: 10000,
      status: 'returned',
    },
  ];

  // Create Booking Flow
  if (view === 'create') {
    return (
      <RentalBookingFlow 
        onBack={() => setView('dashboard')}
        onComplete={() => setView('dashboard')}
      />
    );
  }

  // Delivery Flow
  if (view === 'delivery' && selectedBooking) {
    return (
      <RentalDeliveryFlow
        booking={{
          id: selectedBooking.id,
          bookingNumber: selectedBooking.bookingNumber,
          customerName: selectedBooking.customerName,
          customerCnic: selectedBooking.customerCnic,
          productName: selectedBooking.productName,
          totalRent: selectedBooking.totalRent,
          advancePaid: selectedBooking.advancePaid,
          remainingAmount: selectedBooking.remainingAmount,
          deliveryDate: selectedBooking.deliveryDate,
          returnDate: selectedBooking.returnDate,
        }}
        onBack={() => {
          setView('dashboard');
          setSelectedBooking(null);
        }}
        onComplete={() => {
          setView('dashboard');
          setSelectedBooking(null);
        }}
      />
    );
  }

  // Return Flow
  if (view === 'return' && selectedBooking) {
    return (
      <RentalReturnFlow
        booking={{
          id: selectedBooking.id,
          bookingNumber: selectedBooking.bookingNumber,
          customerName: selectedBooking.customerName,
          customerCnic: selectedBooking.customerCnic,
          productName: selectedBooking.productName,
          deliveryDate: selectedBooking.deliveryDate,
          returnDate: selectedBooking.returnDate,
          expectedReturnDate: selectedBooking.returnDate,
        }}
        onBack={() => {
          setView('dashboard');
          setSelectedBooking(null);
        }}
        onComplete={() => {
          setView('dashboard');
          setSelectedBooking(null);
        }}
      />
    );
  }

  // Main Dashboard View
  return (
    <div className="min-h-screen pb-24 bg-[#111827]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold">Rental Dashboard</h1>
            <p className="text-xs text-white/80">Manage bookings & returns</p>
          </div>
          <button
            onClick={() => setView('create')}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-4">
        <RentalDashboard
          bookings={mockBookings}
          onBookingClick={(booking) => {
            setSelectedBooking(booking);
            // For now, just show details - you can implement details view later
            // setView('details');
          }}
          onDeliveryClick={(booking) => {
            setSelectedBooking(booking);
            setView('delivery');
          }}
          onReturnClick={(booking) => {
            setSelectedBooking(booking);
            setView('return');
          }}
        />
      </div>
    </div>
  );
}