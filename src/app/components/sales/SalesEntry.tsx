import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Filter, 
  Download, 
  Truck, 
  Package, 
  CheckCircle, 
  Clock, 
  XCircle, 
  ArrowRight,
  MapPin,
  Phone,
  ChevronDown,
  ChevronRight,
  Hash,
  Calendar,
  Eye
} from 'lucide-react';
import { Button } from "../ui/button";
import { useNavigation } from '../../context/NavigationContext';
import { formatDate } from '../../../utils/dateFormat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

type ShippingStatus = 'pending' | 'packed' | 'dispatched' | 'in-transit' | 'delivered' | 'cancelled';

interface SaleItem {
  id: string;
  invoice: string;
  date: string;
  customer: string;
  status: string;
  shippingStatus: ShippingStatus;
  shippingAddress?: string;
  shippingMethod?: string;
  trackingNumber?: string;
  shippingDate?: string;
  deliveryDate?: string;
  amount: string;
  phone?: string;
}

export const SalesEntry = () => {
  const { openDrawer } = useNavigation();
  
  const [sales, setSales] = useState<SaleItem[]>([
    {
      id: '1',
      invoice: 'INV-2025-001',
      date: 'Jan 01, 2026',
      customer: 'John Doe',
      status: 'Completed',
      shippingStatus: 'delivered',
      shippingAddress: 'House #123, Street 45, Gulberg III, Lahore',
      shippingMethod: 'TCS Express',
      trackingNumber: 'TCS-9876543',
      shippingDate: 'Dec 30, 2025',
      deliveryDate: 'Jan 01, 2026',
      phone: '+92 300 1234567',
      amount: '$1,250.00'
    },
    {
      id: '2',
      invoice: 'INV-2025-002',
      date: 'Jan 01, 2026',
      customer: 'Sarah Ahmed',
      status: 'Pending',
      shippingStatus: 'in-transit',
      shippingAddress: 'Flat 5B, Tower A, DHA Phase 6, Karachi',
      shippingMethod: 'Leopards Courier',
      trackingNumber: 'LEO-5544332',
      shippingDate: 'Dec 31, 2025',
      phone: '+92 321 9876543',
      amount: '$450.00'
    },
    {
      id: '3',
      invoice: 'INV-2025-003',
      date: 'Dec 31, 2025',
      customer: 'Ayesha Khan',
      status: 'Completed',
      shippingStatus: 'packed',
      shippingAddress: 'Shop #7, Main Boulevard, Bahria Town, Islamabad',
      shippingMethod: 'M&P Courier',
      trackingNumber: 'MP-7788990',
      phone: '+92 333 4567890',
      amount: '$890.00'
    },
    {
      id: '4',
      invoice: 'INV-2025-004',
      date: 'Dec 30, 2025',
      customer: 'Fatima Malik',
      status: 'Pending',
      shippingStatus: 'pending',
      shippingAddress: 'Villa 12, Street 8, Johar Town, Lahore',
      shippingMethod: 'TCS Standard',
      phone: '+92 345 1122334',
      amount: '$2,100.00'
    },
    {
      id: '5',
      invoice: 'INV-2025-005',
      date: 'Dec 29, 2025',
      customer: 'Zainab Raza',
      status: 'Completed',
      shippingStatus: 'dispatched',
      shippingAddress: 'House #45, Street 12, Model Town, Faisalabad',
      shippingMethod: 'TCS Express',
      trackingNumber: 'TCS-1122334',
      shippingDate: 'Dec 30, 2025',
      phone: '+92 300 9988776',
      amount: '$650.00'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ShippingStatus>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const updateShippingStatus = (id: string, newStatus: ShippingStatus) => {
    setSales(sales.map(sale => 
      sale.id === id ? { 
        ...sale, 
        shippingStatus: newStatus,
        ...(newStatus === 'dispatched' && !sale.shippingDate ? { shippingDate: formatDate(new Date()) } : {}),
        ...(newStatus === 'delivered' && !sale.deliveryDate ? { deliveryDate: formatDate(new Date()) } : {})
      } : sale
    ));
  };

  const getShippingStatusConfig = (status: ShippingStatus) => {
    const configs = {
      pending: { label: 'Pending', bgColor: 'rgba(107, 114, 128, 0.1)', textColor: 'var(--color-text-secondary)', borderColor: 'rgba(107, 114, 128, 0.2)', icon: Clock, iconColor: 'var(--color-text-secondary)' },
      packed: { label: 'Packed', bgColor: 'rgba(59, 130, 246, 0.1)', textColor: 'var(--color-primary)', borderColor: 'rgba(59, 130, 246, 0.2)', icon: Package, iconColor: 'var(--color-primary)' },
      dispatched: { label: 'Dispatched', bgColor: 'rgba(147, 51, 234, 0.1)', textColor: 'var(--color-wholesale)', borderColor: 'rgba(147, 51, 234, 0.2)', icon: Truck, iconColor: 'var(--color-wholesale)' },
      'in-transit': { label: 'In Transit', bgColor: 'rgba(249, 115, 22, 0.1)', textColor: 'var(--color-warning)', borderColor: 'rgba(249, 115, 22, 0.2)', icon: ArrowRight, iconColor: 'var(--color-warning)' },
      delivered: { label: 'Delivered', bgColor: 'rgba(16, 185, 129, 0.1)', textColor: 'var(--color-success)', borderColor: 'rgba(16, 185, 129, 0.2)', icon: CheckCircle, iconColor: 'var(--color-success)' },
      cancelled: { label: 'Cancelled', bgColor: 'rgba(239, 68, 68, 0.1)', textColor: 'var(--color-error)', borderColor: 'rgba(239, 68, 68, 0.2)', icon: XCircle, iconColor: 'var(--color-error)' }
    };
    return configs[status];
  };

  // Filter and search logic
  const filteredSales = useMemo(() => {
    let filtered = sales;
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sale => sale.shippingStatus === statusFilter);
    }
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(sale => 
        sale.invoice.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [sales, statusFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    return {
      all: sales.length,
      pending: sales.filter(s => s.shippingStatus === 'pending').length,
      packed: sales.filter(s => s.shippingStatus === 'packed').length,
      dispatched: sales.filter(s => s.shippingStatus === 'dispatched').length,
      'in-transit': sales.filter(s => s.shippingStatus === 'in-transit').length,
      delivered: sales.filter(s => s.shippingStatus === 'delivered').length,
      cancelled: sales.filter(s => s.shippingStatus === 'cancelled').length,
    };
  }, [sales]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Sales Transactions
          </h2>
          <p 
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Manage sales orders and shipping status
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="gap-2"
            style={{
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <Filter size={16} />
            Filter
          </Button>
          <Button 
            variant="outline" 
            className="gap-2"
            style={{
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <Download size={16} />
            Export
          </Button>
          <Button 
            className="gap-2"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
            }}
            onClick={() => openDrawer('addSale')}
          >
            <Plus size={18} />
            Create Sale
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-7 gap-3">
        <div 
          className="p-4 rounded-lg border cursor-pointer transition-all"
          style={{
            backgroundColor: statusFilter === 'all' ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg-primary)',
            borderColor: statusFilter === 'all' ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: statusFilter === 'all' ? 'var(--shadow-lg) rgba(59, 130, 246, 0.1)' : 'none'
          }}
          onClick={() => setStatusFilter('all')}
          onMouseEnter={(e) => {
            if (statusFilter !== 'all') {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (statusFilter !== 'all') {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }
          }}
        >
          <div 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {stats.all}
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Total Orders
          </div>
        </div>
        
        <div 
          className="p-4 rounded-lg border cursor-pointer transition-all"
          style={{
            backgroundColor: statusFilter === 'pending' ? 'rgba(107, 114, 128, 0.1)' : 'var(--color-bg-primary)',
            borderColor: statusFilter === 'pending' ? 'rgba(107, 114, 128, 0.3)' : 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: statusFilter === 'pending' ? 'var(--shadow-lg) rgba(107, 114, 128, 0.1)' : 'none'
          }}
          onClick={() => setStatusFilter('pending')}
          onMouseEnter={(e) => {
            if (statusFilter !== 'pending') {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (statusFilter !== 'pending') {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <Clock size={16} style={{ color: 'var(--color-text-secondary)' }} />
            <div 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.pending}
            </div>
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Pending
          </div>
        </div>

        <div 
          className="p-4 rounded-lg border cursor-pointer transition-all"
          style={{
            backgroundColor: statusFilter === 'packed' ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg-primary)',
            borderColor: statusFilter === 'packed' ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: statusFilter === 'packed' ? 'var(--shadow-lg) rgba(59, 130, 246, 0.1)' : 'none'
          }}
          onClick={() => setStatusFilter('packed')}
          onMouseEnter={(e) => {
            if (statusFilter !== 'packed') {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (statusFilter !== 'packed') {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <Package size={16} style={{ color: 'var(--color-primary)' }} />
            <div 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.packed}
            </div>
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Packed
          </div>
        </div>

        <div 
          className="p-4 rounded-lg border cursor-pointer transition-all"
          style={{
            backgroundColor: statusFilter === 'dispatched' ? 'rgba(147, 51, 234, 0.1)' : 'var(--color-bg-primary)',
            borderColor: statusFilter === 'dispatched' ? 'rgba(147, 51, 234, 0.3)' : 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: statusFilter === 'dispatched' ? 'var(--shadow-lg) rgba(147, 51, 234, 0.1)' : 'none'
          }}
          onClick={() => setStatusFilter('dispatched')}
          onMouseEnter={(e) => {
            if (statusFilter !== 'dispatched') {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (statusFilter !== 'dispatched') {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <Truck size={16} style={{ color: 'var(--color-wholesale)' }} />
            <div 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.dispatched}
            </div>
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Dispatched
          </div>
        </div>

        <div 
          className="p-4 rounded-lg border cursor-pointer transition-all"
          style={{
            backgroundColor: statusFilter === 'in-transit' ? 'rgba(249, 115, 22, 0.1)' : 'var(--color-bg-primary)',
            borderColor: statusFilter === 'in-transit' ? 'rgba(249, 115, 22, 0.3)' : 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: statusFilter === 'in-transit' ? 'var(--shadow-lg) rgba(249, 115, 22, 0.1)' : 'none'
          }}
          onClick={() => setStatusFilter('in-transit')}
          onMouseEnter={(e) => {
            if (statusFilter !== 'in-transit') {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (statusFilter !== 'in-transit') {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <ArrowRight size={16} style={{ color: 'var(--color-warning)' }} />
            <div 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats['in-transit']}
            </div>
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            In Transit
          </div>
        </div>

        <div 
          className="p-4 rounded-lg border cursor-pointer transition-all"
          style={{
            backgroundColor: statusFilter === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg-primary)',
            borderColor: statusFilter === 'delivered' ? 'rgba(16, 185, 129, 0.3)' : 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: statusFilter === 'delivered' ? 'var(--shadow-lg) rgba(16, 185, 129, 0.1)' : 'none'
          }}
          onClick={() => setStatusFilter('delivered')}
          onMouseEnter={(e) => {
            if (statusFilter !== 'delivered') {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (statusFilter !== 'delivered') {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
            <div 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.delivered}
            </div>
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Delivered
          </div>
        </div>

        <div 
          className="p-4 rounded-lg border cursor-pointer transition-all"
          style={{
            backgroundColor: statusFilter === 'cancelled' ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg-primary)',
            borderColor: statusFilter === 'cancelled' ? 'rgba(239, 68, 68, 0.3)' : 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: statusFilter === 'cancelled' ? 'var(--shadow-lg) rgba(239, 68, 68, 0.1)' : 'none'
          }}
          onClick={() => setStatusFilter('cancelled')}
          onMouseEnter={(e) => {
            if (statusFilter !== 'cancelled') {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (statusFilter !== 'cancelled') {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }
          }}
        >
          <div className="flex items-center gap-2">
            <XCircle size={16} style={{ color: 'var(--color-error)' }} />
            <div 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.cancelled}
            </div>
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Cancelled
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search by invoice, customer, or tracking number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border-primary)',
            color: 'var(--color-text-primary)'
          }}
        />
        <Eye 
          size={16} 
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--color-text-tertiary)' }}
        />
      </div>

      {/* Table */}
      <div 
        className="border rounded-xl overflow-hidden shadow-sm"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead 
              className="border-b"
              style={{
                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                borderBottomColor: 'var(--color-border-primary)'
              }}
            >
              <tr>
                <th 
                  className="px-6 py-4 font-semibold w-8"
                  style={{ color: 'var(--color-text-secondary)' }}
                ></th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Invoice #
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Date
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Customer
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Payment
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Shipping Status
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Tracking
                </th>
                <th 
                  className="px-6 py-4 font-semibold text-right"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map(sale => {
                const shippingConfig = getShippingStatusConfig(sale.shippingStatus);
                const StatusIcon = shippingConfig.icon;
                const isExpanded = expandedRow === sale.id;
                
                return (
                  <React.Fragment key={sale.id}>
                    <tr 
                      className="transition-colors border-b"
                      style={{
                        borderBottomColor: 'var(--color-border-primary)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : sale.id)}
                          className="transition-colors"
                          style={{ color: 'var(--color-text-secondary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                          }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td 
                        className="px-6 py-4 font-medium"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {sale.invoice}
                      </td>
                      <td 
                        className="px-6 py-4"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {sale.date}
                      </td>
                      <td 
                        className="px-6 py-4"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {sale.customer}
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          className="text-xs font-medium"
                          style={{
                            backgroundColor: sale.status === 'Completed' 
                              ? 'rgba(16, 185, 129, 0.1)'
                              : sale.status === 'Pending'
                              ? 'rgba(234, 179, 8, 0.1)'
                              : 'rgba(59, 130, 246, 0.1)',
                            color: sale.status === 'Completed' 
                              ? 'var(--color-success)'
                              : sale.status === 'Pending'
                              ? 'var(--color-warning)'
                              : 'var(--color-primary)',
                            borderColor: sale.status === 'Completed' 
                              ? 'rgba(16, 185, 129, 0.2)'
                              : sale.status === 'Pending'
                              ? 'rgba(234, 179, 8, 0.2)'
                              : 'rgba(59, 130, 246, 0.2)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        >
                          {sale.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all hover:scale-105"
                              style={{
                                backgroundColor: shippingConfig.bgColor,
                                color: shippingConfig.textColor,
                                borderColor: shippingConfig.borderColor,
                                borderRadius: 'var(--radius-lg)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '0.8';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '1';
                              }}
                            >
                              <StatusIcon size={14} style={{ color: shippingConfig.iconColor }} />
                              {shippingConfig.label}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="start" 
                            className="w-48"
                            style={{
                              backgroundColor: 'var(--color-bg-primary)',
                              borderColor: 'var(--color-border-secondary)',
                              color: 'var(--color-text-primary)'
                            }}
                          >
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              style={{ color: 'var(--color-text-primary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => updateShippingStatus(sale.id, 'pending')}
                            >
                              <Clock size={14} className="mr-2" style={{ color: 'var(--color-text-secondary)' }} />
                              Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              style={{ color: 'var(--color-text-primary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => updateShippingStatus(sale.id, 'packed')}
                            >
                              <Package size={14} className="mr-2" style={{ color: 'var(--color-primary)' }} />
                              Packed
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              style={{ color: 'var(--color-text-primary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => updateShippingStatus(sale.id, 'dispatched')}
                            >
                              <Truck size={14} className="mr-2" style={{ color: 'var(--color-wholesale)' }} />
                              Dispatched
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              style={{ color: 'var(--color-text-primary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => updateShippingStatus(sale.id, 'in-transit')}
                            >
                              <ArrowRight size={14} className="mr-2" style={{ color: 'var(--color-warning)' }} />
                              In Transit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              style={{ color: 'var(--color-text-primary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => updateShippingStatus(sale.id, 'delivered')}
                            >
                              <CheckCircle size={14} className="mr-2" style={{ color: 'var(--color-success)' }} />
                              Delivered
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="cursor-pointer"
                              style={{ color: 'var(--color-text-primary)' }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => updateShippingStatus(sale.id, 'cancelled')}
                            >
                              <XCircle size={14} className="mr-2" style={{ color: 'var(--color-error)' }} />
                              Cancelled
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="px-6 py-4">
                        {sale.trackingNumber ? (
                          <code 
                            className="text-xs px-2 py-1 rounded border"
                            style={{
                              backgroundColor: 'var(--color-bg-card)',
                              color: 'var(--color-primary)',
                              borderColor: 'var(--color-border-secondary)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            {sale.trackingNumber}
                          </code>
                        ) : (
                          <span 
                            className="text-xs"
                            style={{ color: 'var(--color-text-disabled)' }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td 
                        className="px-6 py-4 text-right font-bold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {sale.amount}
                      </td>
                    </tr>
                    
                    {/* Expanded Row - Shipping Details */}
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(31, 41, 55, 0.2)' }}>
                        <td colSpan={8} className="px-6 py-4">
                          <div 
                            className="grid grid-cols-3 gap-4 p-4 rounded-lg border"
                            style={{
                              backgroundColor: 'rgba(17, 24, 39, 0.5)',
                              borderColor: 'var(--color-border-primary)',
                              borderRadius: 'var(--radius-lg)'
                            }}
                          >
                            {/* Shipping Address */}
                            <div className="space-y-2">
                              <div 
                                className="flex items-center gap-2"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                <MapPin size={14} />
                                <span className="text-xs font-semibold uppercase tracking-wide">Shipping Address</span>
                              </div>
                              <p 
                                className="text-sm"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                {sale.shippingAddress || 'N/A'}
                              </p>
                            </div>

                            {/* Contact & Method */}
                            <div className="space-y-2">
                              <div 
                                className="flex items-center gap-2"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                <Phone size={14} />
                                <span className="text-xs font-semibold uppercase tracking-wide">Contact & Method</span>
                              </div>
                              <p 
                                className="text-sm"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                {sale.phone || 'N/A'}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Truck size={14} style={{ color: 'var(--color-wholesale)' }} />
                                <span 
                                  className="text-sm"
                                  style={{ color: 'var(--color-wholesale)' }}
                                >
                                  {sale.shippingMethod || 'N/A'}
                                </span>
                              </div>
                            </div>

                            {/* Dates */}
                            <div className="space-y-2">
                              <div 
                                className="flex items-center gap-2"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                <Calendar size={14} />
                                <span className="text-xs font-semibold uppercase tracking-wide">Timeline</span>
                              </div>
                              {sale.shippingDate && (
                                <div className="flex justify-between text-sm">
                                  <span style={{ color: 'var(--color-text-secondary)' }}>Shipped:</span>
                                  <span style={{ color: 'var(--color-text-primary)' }}>{sale.shippingDate}</span>
                                </div>
                              )}
                              {sale.deliveryDate && (
                                <div className="flex justify-between text-sm">
                                  <span style={{ color: 'var(--color-text-secondary)' }}>Delivered:</span>
                                  <span style={{ color: 'var(--color-success)' }}>{sale.deliveryDate}</span>
                                </div>
                              )}
                              {!sale.shippingDate && !sale.deliveryDate && (
                                <span 
                                  className="text-sm"
                                  style={{ color: 'var(--color-text-disabled)' }}
                                >
                                  No dates recorded
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div 
            className="text-center py-12"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Truck 
              size={48} 
              className="mx-auto mb-4"
              style={{ color: 'var(--color-hover-bg)' }}
            />
            <p 
              className="text-lg"
              style={{ color: 'var(--color-text-primary)' }}
            >
              No sales found
            </p>
            <p 
              className="text-sm mt-2"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Try adjusting your filters or search term
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
