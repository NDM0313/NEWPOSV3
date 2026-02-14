import React, { useState } from 'react';
import { Plus, LayoutList, Calendar as CalendarIcon, Truck, CornerDownLeft, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { RentalBookingDrawer } from './RentalBookingDrawer';
import { RentalsPage } from './RentalsPage';
import { RentalCalendar } from './RentalCalendar';
import { PickupTodayTab } from './PickupTodayTab';
import { ReturnTodayTab } from './ReturnTodayTab';
import { RentalCollectionsTab } from './RentalCollectionsTab';
import { ViewRentalDetailsDrawer } from './ViewRentalDetailsDrawer';
import { PickupModal } from './PickupModal';
import { ReturnModal } from './ReturnModal';
import { UnifiedPaymentDialog } from '../shared/UnifiedPaymentDialog';
import { clsx } from 'clsx';
import { useRentals, type RentalUI } from '@/app/context/RentalContext';

export const RentalDashboard = () => {
  const { refreshRentals, markAsPickedUp, receiveReturn, getRentalById } = useRentals();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editRental, setEditRental] = useState<RentalUI | null>(null);
  const [viewRental, setViewRental] = useState<RentalUI | null>(null);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [rentalForPickup, setRentalForPickup] = useState<RentalUI | null>(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [rentalForReturn, setRentalForReturn] = useState<RentalUI | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [collectionRental, setCollectionRental] = useState<RentalUI | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'pickupToday' | 'returnToday' | 'collections'>('list');

  const handleAddRental = () => {
    setEditRental(null);
    setIsDrawerOpen(true);
  };

  const handleEditRental = (rental: RentalUI) => {
    setEditRental(rental);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditRental(null);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Rentals</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage rental orders and availability</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-gray-900/80 p-1 rounded-xl border border-gray-800 flex items-center flex-wrap">
              <button
                onClick={() => setActiveTab('list')}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'list' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                )}
                title="List View"
              >
                <LayoutList size={16} className="mr-1.5 inline" />
                List
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'calendar' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                )}
                title="Calendar / Availability"
              >
                <CalendarIcon size={16} className="mr-1.5 inline" />
                Calendar / Availability
              </button>
              <button
                onClick={() => setActiveTab('pickupToday')}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'pickupToday' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                )}
                title="Pickup Today"
              >
                <Truck size={16} className="mr-1.5 inline" />
                Pickup Today
              </button>
              <button
                onClick={() => setActiveTab('returnToday')}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'returnToday' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                )}
                title="Return Today"
              >
                <CornerDownLeft size={16} className="mr-1.5 inline" />
                Return Today
              </button>
              <button
                onClick={() => setActiveTab('collections')}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'collections' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                )}
                title="Collections / Outstanding"
              >
                <DollarSign size={16} className="mr-1.5 inline" />
                Collections
              </button>
            </div>
            <Button
              onClick={handleAddRental}
              className="bg-pink-600 hover:bg-pink-500 text-white rounded-lg shadow-lg shadow-pink-600/20 font-semibold"
            >
              <Plus size={18} className="mr-2" /> New Rental Booking
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'list' && (
          <RentalsPage onAddRental={handleAddRental} onEditRental={handleEditRental} embedded />
        )}
        {activeTab === 'calendar' && (
          <div className="h-full p-4 sm:p-6 overflow-auto">
            <RentalCalendar onViewRental={(r) => setViewRental(r)} />
          </div>
        )}
        {activeTab === 'pickupToday' && (
          <PickupTodayTab
            onProcessPickup={(r) => {
              setRentalForPickup(r);
              setPickupModalOpen(true);
            }}
          />
        )}
        {activeTab === 'returnToday' && (
          <ReturnTodayTab
            onProcessReturn={(r) => {
              setRentalForReturn(r);
              setReturnModalOpen(true);
            }}
          />
        )}
        {activeTab === 'collections' && (
          <RentalCollectionsTab
            onCollectPayment={(r) => {
              setCollectionRental(r);
              setPaymentDialogOpen(true);
            }}
          />
        )}
      </div>

      <RentalBookingDrawer isOpen={isDrawerOpen} onClose={handleCloseDrawer} editRental={editRental} />
      <ViewRentalDetailsDrawer
        isOpen={!!viewRental}
        onClose={() => setViewRental(null)}
        rental={viewRental}
        onRefresh={refreshRentals}
        onEdit={(r) => { setViewRental(null); handleEditRental(r); setIsDrawerOpen(true); }}
        onMarkAsPickedUp={markAsPickedUp}
        onAddPaymentForPickup={(r) => {
          setRentalForPickup(r);
          setViewRental(null);
          setPickupModalOpen(false);
          setPaymentDialogOpen(true);
        }}
        onAddPayment={() => {
          if (viewRental) {
            setRentalForPickup(viewRental);
            setViewRental(null);
            setPaymentDialogOpen(true);
          }
        }}
        onReceiveReturn={() => {
          if (viewRental) {
            setRentalForReturn(viewRental);
            setViewRental(null);
            setReturnModalOpen(true);
          }
        }}
      />

      <PickupModal
        open={pickupModalOpen}
        onOpenChange={(open) => {
          setPickupModalOpen(open);
          if (!open) setRentalForPickup(null);
        }}
        rental={rentalForPickup}
        onConfirm={async (id, payload) => {
          await markAsPickedUp(id, payload);
          await refreshRentals();
        }}
        onAddPayment={(r) => {
          setRentalForPickup(r);
          setPickupModalOpen(false);
          setPaymentDialogOpen(true);
        }}
      />

      {(rentalForPickup || collectionRental) && (
        <UnifiedPaymentDialog
          isOpen={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            if (collectionRental) setCollectionRental(null);
            else if (rentalForPickup) setPickupModalOpen(true);
          }}
          context="rental"
          entityName={(rentalForPickup || collectionRental)!.customerName}
          entityId={(rentalForPickup || collectionRental)!.customerId || (rentalForPickup || collectionRental)!.id}
          outstandingAmount={(rentalForPickup || collectionRental)!.dueAmount}
          totalAmount={(rentalForPickup || collectionRental)!.totalAmount}
          paidAmount={(rentalForPickup || collectionRental)!.paidAmount}
          referenceNo={(rentalForPickup || collectionRental)!.rentalNo}
          referenceId={(rentalForPickup || collectionRental)!.id}
          onSuccess={async () => {
            await refreshRentals();
            setPaymentDialogOpen(false);
            setCollectionRental(null);
            if (rentalForPickup) {
              const updated = getRentalById?.(rentalForPickup.id);
              if (updated) {
                setRentalForPickup(updated);
                setPickupModalOpen(true);
              } else {
                setRentalForPickup(null);
              }
            }
          }}
        />
      )}

      <ReturnModal
        open={returnModalOpen}
        onOpenChange={(open) => {
          setReturnModalOpen(open);
          if (!open) setRentalForReturn(null);
        }}
        rental={rentalForReturn}
        documentInfo={rentalForReturn ? { documentType: rentalForReturn.documentType, documentNumber: rentalForReturn.documentNumber } : undefined}
        onConfirm={async (id, payload) => {
          await receiveReturn(id, payload);
          await refreshRentals();
        }}
      />
    </div>
  );
};
