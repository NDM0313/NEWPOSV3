import React, { useState } from 'react';
import { 
  Search, 
  Calendar, 
  Filter, 
  MoreVertical, 
  Shirt, 
  ArrowRight, 
  CornerDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { clsx } from 'clsx';
import { ReturnDressModal } from './ReturnDressModal';

type RentalStatus = 'Booked' | 'Dispatched' | 'Returned' | 'Overdue';

interface RentalOrder {
  id: string;
  customer: string;
  item: string;
  image: string;
  pickupDate: string;
  returnDate: string;
  status: RentalStatus;
  amount: number;
}

const mockOrders: RentalOrder[] = [
  { 
    id: "ORD-1001", 
    customer: "Sarah Khan", 
    item: "Royal Red Bridal Lehenga", 
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80",
    pickupDate: "2024-02-01", 
    returnDate: "2024-02-05", 
    status: "Booked", 
    amount: 25000 
  },
  { 
    id: "ORD-1002", 
    customer: "Fatima Ali", 
    item: "Emerald Green Sharara", 
    image: "https://images.unsplash.com/photo-1583391725988-e3eefa84d0f7?w=800&q=80",
    pickupDate: "2024-01-28", 
    returnDate: "2024-02-02", 
    status: "Dispatched", 
    amount: 18000 
  },
  { 
    id: "ORD-1003", 
    customer: "Zara Ahmed", 
    item: "Ivory Gold Gown", 
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80",
    pickupDate: "2024-01-25", 
    returnDate: new Date().toISOString().split('T')[0], // Today
    status: "Dispatched", 
    amount: 30000 
  },
  { 
    id: "ORD-1004", 
    customer: "Ayesha Malik", 
    item: "Peach Walima Dress", 
    image: "https://images.unsplash.com/photo-1518049362260-00ac5bf47086?w=800&q=80",
    pickupDate: "2024-01-20", 
    returnDate: "2024-01-25", 
    status: "Overdue", 
    amount: 22000 
  },
];

export const RentalOrdersList = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'due' | 'overdue'>('all');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RentalOrder | null>(null);

  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'upcoming': return mockOrders.filter(o => o.status === 'Booked');
      case 'due': return mockOrders.filter(o => o.status === 'Dispatched' && o.returnDate === new Date().toISOString().split('T')[0]);
      case 'overdue': return mockOrders.filter(o => o.status === 'Overdue');
      default: return mockOrders;
    }
  };

  const handleAction = (order: RentalOrder) => {
    if (order.status === 'Dispatched' || order.status === 'Overdue') {
      setSelectedOrder(order);
      setReturnModalOpen(true);
    } else {
      // Handle Dispatch logic (mock)
      console.log("Dispatching:", order.id);
    }
  };

  const dueCount = mockOrders.filter(o => o.status === 'Dispatched' && o.returnDate === new Date().toISOString().split('T')[0]).length;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        
        {/* Quick Filter Tabs */}
        <div 
          className="flex p-1 rounded-lg border overflow-x-auto"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          {[
            { id: 'all', label: 'All Bookings' },
            { id: 'upcoming', label: 'Upcoming Pickups' },
            { id: 'due', label: 'Returns Due Today', badge: dueCount > 0 ? dueCount : null },
            { id: 'overdue', label: 'Overdue' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap"
              style={{
                backgroundColor: activeTab === tab.id 
                  ? 'var(--color-bg-card)' 
                  : 'transparent',
                color: activeTab === tab.id 
                  ? 'var(--color-text-primary)' 
                  : 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {tab.label}
              {tab.badge && (
                <span 
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: 'var(--color-error)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-2 w-full md:w-auto">
           <div className="relative flex-1 md:w-64">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2" 
                size={14}
                style={{ color: 'var(--color-text-tertiary)' }}
              />
              <Input 
                placeholder="Search order ID, customer..." 
                className="pl-9 h-10"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border-primary)';
                }}
              />
           </div>
           <Button 
             variant="outline" 
             size="icon"
             style={{
               borderColor: 'var(--color-border-primary)',
               color: 'var(--color-text-secondary)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = 'transparent';
             }}
           >
             <Filter size={16} />
           </Button>
        </div>
      </div>

      {/* Table */}
      <div 
        className="border rounded-xl overflow-hidden"
        style={{
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'rgba(17, 24, 39, 0.5)'
        }}
      >
        <table className="w-full text-sm text-left">
            <thead
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderBottomColor: 'var(--color-border-primary)'
              }}
              className="font-medium border-b"
            >
                <tr>
                    <th 
                      className="p-4 font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Product Name
                    </th>
                    <th 
                      className="p-4 font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Customer
                    </th>
                    <th 
                      className="p-4 font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Pickup Date
                    </th>
                    <th 
                      className="p-4 font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Return Date
                    </th>
                    <th 
                      className="p-4 font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Status
                    </th>
                    <th 
                      className="p-4 font-medium text-right"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Action
                    </th>
                </tr>
            </thead>
            <tbody
              style={{
                borderColor: 'var(--color-border-primary)'
              }}
              className="divide-y"
            >
                {getFilteredOrders().length === 0 ? (
                  <tr>
                    <td 
                      colSpan={6} 
                      className="p-8 text-center"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      No orders found for this filter.
                    </td>
                  </tr>
                ) : getFilteredOrders().map((order) => (
                    <tr 
                      key={order.id}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                        <td className="p-4">
                            <div className="flex items-center gap-3">
                                <div 
                                  className="h-10 w-10 rounded overflow-hidden shrink-0 border"
                                  style={{
                                    backgroundColor: 'var(--color-bg-card)',
                                    borderColor: 'var(--color-border-secondary)',
                                    borderRadius: 'var(--radius-sm)'
                                  }}
                                >
                                    <img src={order.image} alt="" className="h-full w-full object-cover" />
                                </div>
                                <div>
                                    <p 
                                      className="font-medium"
                                      style={{ color: 'var(--color-text-primary)' }}
                                    >
                                      {order.item}
                                    </p>
                                    <p 
                                      className="text-xs"
                                      style={{ color: 'var(--color-text-tertiary)' }}
                                    >
                                      {order.id}
                                    </p>
                                </div>
                            </div>
                        </td>
                        <td className="p-4">
                            <div className="flex items-center gap-2">
                                <div 
                                  className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                                  style={{
                                    background: 'linear-gradient(to top right, var(--color-wholesale), var(--color-primary))',
                                    color: 'var(--color-text-primary)',
                                    borderRadius: 'var(--radius-full)'
                                  }}
                                >
                                    {order.customer.charAt(0)}
                                </div>
                                <span style={{ color: 'var(--color-text-primary)' }}>
                                  {order.customer}
                                </span>
                            </div>
                        </td>
                        <td 
                          className="p-4 font-mono text-xs"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                           {order.pickupDate}
                        </td>
                        <td className="p-4">
                           <div 
                             className="font-mono text-xs flex items-center gap-2"
                             style={{
                               color: order.status === 'Overdue' 
                                 ? 'var(--color-error)' 
                                 : order.status === 'Dispatched' && order.returnDate === new Date().toISOString().split('T')[0] 
                                   ? 'var(--color-warning)' 
                                   : 'var(--color-text-secondary)',
                               fontWeight: (order.status === 'Overdue' || (order.status === 'Dispatched' && order.returnDate === new Date().toISOString().split('T')[0])) 
                                 ? 'bold' 
                                 : 'normal'
                             }}
                           >
                             {order.returnDate}
                             {order.status === 'Overdue' && <AlertCircle size={12} />}
                           </div>
                        </td>
                        <td className="p-4">
                            <Badge 
                              variant="outline" 
                              className="capitalize border font-normal"
                              style={{
                                backgroundColor: order.status === 'Booked' 
                                  ? 'rgba(59, 130, 246, 0.2)' 
                                  : order.status === 'Dispatched' 
                                    ? 'rgba(249, 115, 22, 0.2)' 
                                    : order.status === 'Returned' 
                                      ? 'rgba(5, 150, 105, 0.2)' 
                                      : 'rgba(127, 29, 29, 0.2)',
                                color: order.status === 'Booked' 
                                  ? 'var(--color-primary)' 
                                  : order.status === 'Dispatched' 
                                    ? 'var(--color-warning)' 
                                    : order.status === 'Returned' 
                                      ? 'var(--color-success)' 
                                      : 'var(--color-error)',
                                borderColor: order.status === 'Booked' 
                                  ? 'rgba(59, 130, 246, 0.5)' 
                                  : order.status === 'Dispatched' 
                                    ? 'rgba(249, 115, 22, 0.5)' 
                                    : order.status === 'Returned' 
                                      ? 'rgba(5, 150, 105, 0.5)' 
                                      : 'rgba(127, 29, 29, 0.5)'
                              }}
                            >
                                {order.status}
                            </Badge>
                        </td>
                        <td className="p-4 text-right">
                           {order.status === 'Booked' && (
                             <Button 
                               size="sm" 
                               className="h-8 text-xs font-medium"
                               style={{
                                 backgroundColor: 'var(--color-primary)',
                                 color: 'var(--color-text-primary)'
                               }}
                               onMouseEnter={(e) => {
                                 e.currentTarget.style.opacity = '0.9';
                               }}
                               onMouseLeave={(e) => {
                                 e.currentTarget.style.opacity = '1';
                               }}
                               onClick={() => handleAction(order)}
                             >
                               Dispatch <ArrowRight size={12} className="ml-2" />
                             </Button>
                           )}
                           {(order.status === 'Dispatched' || order.status === 'Overdue') && (
                             <Button 
                               size="sm" 
                               variant="outline" 
                               className="h-8 text-xs font-medium"
                               style={{
                                 borderColor: 'rgba(5, 150, 105, 0.5)',
                                 color: 'var(--color-success)'
                               }}
                               onMouseEnter={(e) => {
                                 e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.2)';
                               }}
                               onMouseLeave={(e) => {
                                 e.currentTarget.style.backgroundColor = 'transparent';
                               }}
                               onClick={() => handleAction(order)}
                             >
                               <CornerDownLeft size={12} className="mr-2" /> Process Return
                             </Button>
                           )}
                           {order.status === 'Returned' && (
                             <span 
                               className="text-xs flex items-center justify-end gap-1"
                               style={{ color: 'var(--color-success)' }}
                             >
                               <CheckCircle2 size={12} /> Complete
                             </span>
                           )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Return Modal Integration */}
      {returnModalOpen && selectedOrder && (
        <ReturnDressModal 
            isOpen={returnModalOpen}
            onClose={() => setReturnModalOpen(false)}
            customerName={selectedOrder.customer}
            returnDate={new Date()}
            securityType="id_card" // Mock
            securityValue={0}      // Mock
        />
      )}
    </div>
  );
};
