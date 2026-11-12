import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, LayoutList, Calendar as CalendarIcon, Truck, CornerDownLeft, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { RentalBookingDrawer } from './RentalBookingDrawer';
import { RentalsPage } from './RentalsPage';
import { RentalCalendar } from './RentalCalendar';
import { PickupTodayTab } from './PickupTodayTab';
import { ReturnTodayTab } from './ReturnTodayTab';
import { RentalCollectionsTab } from './RentalCollectionsTab';
import { RentalReportsTab } from './RentalReportsTab';
import { ViewRentalDetailsDrawer } from './ViewRentalDetailsDrawer';
import { PickupModal } from './PickupModal';
import { ReturnModal } from './ReturnModal';
import { UnifiedPaymentDialog } from '../shared/UnifiedPaymentDialog';
import { clsx } from 'clsx';
import { useRentals, type RentalUI } from '@/app/context/RentalContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { rentalService } from '@/app/services/rentalService';
import { supabase } from '@/lib/supabase';
import { safeSessionStorageGetItem, safeSessionStorageRemoveItem } from '@/app/lib/safeBrowserStorage';

export const RentalDashboard = () => {
  const { refreshRentals, markAsPickedUp, receiveReturn, getRentalById, rentals } = useRentals();
  const { companyId, branchId } = useSupabase();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editRental, setEditRental] = useState<RentalUI | null>(null);
  const [viewRental, setViewRental] = useState<RentalUI | null>(null);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [rentalForPickup, setRentalForPickup] = useState<RentalUI | null>(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [rentalForReturn, setRentalForReturn] = useState<RentalUI | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [collectionRental, setCollectionRental] = useState<RentalUI | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'pickupToday' | 'returnToday' | 'collections' | 'reports'>('list');
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const [tabCounts, setTabCounts] = useState({ pickup: 0, return: 0, collections: 0 });

  const activeCount = useMemo(
    () => rentals.filter((r) => ['booked', 'active', 'rented', 'picked_up', 'overdue'].includes(r.status)).length,
    [rentals]
  );

  const bumpQueueRefresh = useCallback(async () => {
    setQueueRefreshKey((k) => k + 1);
    await refreshRentals();
  }, [refreshRentals]);

  const loadTabCounts = useCallback(async () => {
    if (!companyId) return;
    const b = branchId === 'all' || !branchId ? undefined : branchId;
    try {
      const [pickups, returns, outstanding] = await Promise.all([
        rentalService.getPickupsDue(companyId, b),
        rentalService.getReturnsDue(companyId, b),
        rentalService.getOutstandingForCollections(companyId, b),
      ]);
      setTabCounts({ pickup: pickups.length, return: returns.length, collections: outstanding.length });
    } catch (e) {
      console.error('[RentalDashboard] tab counts', e);
      toast.error('Failed to load rental queue counts');
      setTabCounts({ pickup: 0, return: 0, collections: 0 });
    }
  }, [companyId, branchId]);

  useEffect(() => {
    void loadTabCounts();
  }, [loadTabCounts, queueRefreshKey]);

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

  /** Deep-link from accounting unified edit (rental JE): open booking drawer after navigating to Rentals. */
  useEffect(() => {
    const initialTab = safeSessionStorageGetItem('rentalsInitialTab');
    if (initialTab === 'reports') {
      safeSessionStorageRemoveItem('rentalsInitialTab');
      setActiveTab('reports');
    }
  }, []);

  useEffect(() => {
    const pending = safeSessionStorageGetItem('pendingRentalDetailsId');
    if (!pending) return;
    safeSessionStorageRemoveItem('pendingRentalDetailsId');
    void (async () => {
      try {
        await refreshRentals();
      } catch {
        /* non-fatal */
      }
      const r = getRentalById(pending);
      if (r) {
        setActiveTab('list');
        setViewRental(r);
      } else {
        toast.message('Rental not in the loaded list yet — open it from the Rentals list, or refresh.');
      }
    })();
  }, [refreshRentals, getRentalById]);

  return (
    <div className="h-screen flex flex-col bg-secondary">
      <div className="shrink-0 px-6 py-4 border-b border-border">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Rentals</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage rental orders and availability</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-card p-1 rounded-lg border border-border flex items-center">
              <button
                onClick={() => setActiveTab('list')}
                className={clsx(
                  'px-3 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'list' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="List View"
              >
                <LayoutList size={16} className="mr-1.5 inline" />
                List
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={clsx(
                  'px-3 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'calendar' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Calendar / Availability"
              >
                <CalendarIcon size={16} className="mr-1.5 inline" />
                Calendar / Availability
              </button>
              <button
                onClick={() => setActiveTab('pickupToday')}
                className={clsx(
                  'px-3 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'pickupToday' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Pickup Today"
              >
                <Truck size={16} className="mr-1.5 inline" />
                Pickup Today
                {tabCounts.pickup > 0 && (
                  <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                    {tabCounts.pickup}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('returnToday')}
                className={clsx(
                  'px-3 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'returnToday' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Return Today"
              >
                <CornerDownLeft size={16} className="mr-1.5 inline" />
                Return Today
                {tabCounts.return > 0 && (
                  <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-[var(--erp-money-positive)]">
                    {tabCounts.return}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('collections')}
                className={clsx(
                  'px-3 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'collections' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Collections / Outstanding"
              >
                <DollarSign size={16} className="mr-1.5 inline" />
                Collections
                {tabCounts.collections > 0 && (
                  <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                    {tabCounts.collections}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={clsx(
                  'px-3 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'reports' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Rental Reports"
              >
                <LayoutList size={16} className="mr-1.5 inline" />
                Reports
              </button>
            </div>
            <Button
              onClick={handleAddRental}
              className="bg-pink-600 hover:bg-pink-500 text-foreground shadow-lg shadow-pink-600/20 font-semibold"
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
          <div className="h-full p-4">
            <RentalCalendar onViewRental={(r) => setViewRental(r)} />
          </div>
        )}
        {activeTab === 'pickupToday' && (
          <PickupTodayTab
            refreshKey={queueRefreshKey}
            activeCount={activeCount}
            onViewAllRentals={() => setActiveTab('list')}
            onProcessPickup={(r) => {
              setRentalForPickup(r);
              setPickupModalOpen(true);
            }}
          />
        )}
        {activeTab === 'returnToday' && (
          <ReturnTodayTab
            refreshKey={queueRefreshKey}
            activeCount={activeCount}
            onViewAllRentals={() => setActiveTab('list')}
            onProcessReturn={(r) => {
              setRentalForReturn(r);
              setReturnModalOpen(true);
            }}
          />
        )}
        {activeTab === 'collections' && (
          <RentalCollectionsTab
            refreshKey={queueRefreshKey}
            onCollectPayment={(r) => {
              setCollectionRental(r);
              setPaymentDialogOpen(true);
            }}
          />
        )}
        {activeTab === 'reports' && (
          <RentalReportsTab />
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
          await bumpQueueRefresh();
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
            setPaymentDialogOpen(false);
            setCollectionRental(null);
            if (rentalForPickup) {
              // Fetch fresh rental data BEFORE re-opening modal (prevents flicker)
              try {
                const { data: freshRow } = await supabase
                  .from('rentals')
                  .select('id, paid_amount, due_amount, total_amount')
                  .eq('id', rentalForPickup.id)
                  .maybeSingle();
                if (freshRow) {
                  setRentalForPickup({
                    ...rentalForPickup,
                    paidAmount: Number((freshRow as any).paid_amount) || 0,
                    dueAmount: Number((freshRow as any).due_amount) || 0,
                    totalAmount: Number((freshRow as any).total_amount) || rentalForPickup.totalAmount,
                  });
                }
              } catch {
                // Fallback: context data
              }
              setPickupModalOpen(true);
            }
            // Refresh context AFTER modal is re-opened with fresh data
            await bumpQueueRefresh();
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
        documentInfo={rentalForReturn ? { documentType: rentalForReturn.pickupDocumentType || rentalForReturn.documentType, documentNumber: rentalForReturn.pickupDocumentNumber || undefined } : undefined}
        onConfirm={async (id, payload) => {
          await receiveReturn(id, payload);
          await bumpQueueRefresh();
        }}
      />
    </div>
  );
};
