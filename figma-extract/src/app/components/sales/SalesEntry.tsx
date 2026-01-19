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
        ...(newStatus === 'dispatched' && !sale.shippingDate ? { shippingDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } : {}),
        ...(newStatus === 'delivered' && !sale.deliveryDate ? { deliveryDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } : {})
      } : sale
    ));
  };

  const getShippingStatusConfig = (status: ShippingStatus) => {
    const configs = {
      pending: { label: 'Pending', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: Clock, iconColor: 'text-gray-400' },
      packed: { label: 'Packed', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Package, iconColor: 'text-blue-400' },
      dispatched: { label: 'Dispatched', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Truck, iconColor: 'text-purple-400' },
      'in-transit': { label: 'In Transit', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: ArrowRight, iconColor: 'text-orange-400' },
      delivered: { label: 'Delivered', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle, iconColor: 'text-green-400' },
      cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle, iconColor: 'text-red-400' }
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Transactions</h2>
          <p className="text-gray-500 dark:text-gray-400">Manage sales orders and shipping status</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200">
            <Filter size={16} />
            Filter
          </Button>
          <Button variant="outline" className="gap-2 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200">
            <Download size={16} />
            Export
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-500 text-white gap-2" onClick={() => openDrawer('addSale')}>
            <Plus size={18} />
            Create Sale
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-7 gap-3">
        <div 
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'all' 
              ? 'bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/10' 
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
          }`}
          onClick={() => setStatusFilter('all')}
        >
          <div className="text-2xl font-bold text-white">{stats.all}</div>
          <div className="text-xs text-gray-400 mt-1">Total Orders</div>
        </div>
        
        <div 
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'pending' 
              ? 'bg-gray-500/10 border-gray-500/30 shadow-lg shadow-gray-500/10' 
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
          }`}
          onClick={() => setStatusFilter('pending')}
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <div className="text-2xl font-bold text-white">{stats.pending}</div>
          </div>
          <div className="text-xs text-gray-400 mt-1">Pending</div>
        </div>

        <div 
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'packed' 
              ? 'bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/10' 
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
          }`}
          onClick={() => setStatusFilter('packed')}
        >
          <div className="flex items-center gap-2">
            <Package size={16} className="text-blue-400" />
            <div className="text-2xl font-bold text-white">{stats.packed}</div>
          </div>
          <div className="text-xs text-gray-400 mt-1">Packed</div>
        </div>

        <div 
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'dispatched' 
              ? 'bg-purple-500/10 border-purple-500/30 shadow-lg shadow-purple-500/10' 
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
          }`}
          onClick={() => setStatusFilter('dispatched')}
        >
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-purple-400" />
            <div className="text-2xl font-bold text-white">{stats.dispatched}</div>
          </div>
          <div className="text-xs text-gray-400 mt-1">Dispatched</div>
        </div>

        <div 
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'in-transit' 
              ? 'bg-orange-500/10 border-orange-500/30 shadow-lg shadow-orange-500/10' 
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
          }`}
          onClick={() => setStatusFilter('in-transit')}
        >
          <div className="flex items-center gap-2">
            <ArrowRight size={16} className="text-orange-400" />
            <div className="text-2xl font-bold text-white">{stats['in-transit']}</div>
          </div>
          <div className="text-xs text-gray-400 mt-1">In Transit</div>
        </div>

        <div 
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'delivered' 
              ? 'bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/10' 
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
          }`}
          onClick={() => setStatusFilter('delivered')}
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" />
            <div className="text-2xl font-bold text-white">{stats.delivered}</div>
          </div>
          <div className="text-xs text-gray-400 mt-1">Delivered</div>
        </div>

        <div 
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'cancelled' 
              ? 'bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/10' 
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
          }`}
          onClick={() => setStatusFilter('cancelled')}
        >
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-red-400" />
            <div className="text-2xl font-bold text-white">{stats.cancelled}</div>
          </div>
          <div className="text-xs text-gray-400 mt-1">Cancelled</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search by invoice, customer, or tracking number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-gray-900 border-gray-800 text-white placeholder:text-gray-500"
        />
        <Eye size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-200 w-8"></th>
                <th className="px-6 py-4 font-semibold text-gray-200">Invoice #</th>
                <th className="px-6 py-4 font-semibold text-gray-200">Date</th>
                <th className="px-6 py-4 font-semibold text-gray-200">Customer</th>
                <th className="px-6 py-4 font-semibold text-gray-200">Payment</th>
                <th className="px-6 py-4 font-semibold text-gray-200">Shipping Status</th>
                <th className="px-6 py-4 font-semibold text-gray-200">Tracking</th>
                <th className="px-6 py-4 font-semibold text-gray-200 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredSales.map(sale => {
                const shippingConfig = getShippingStatusConfig(sale.shippingStatus);
                const StatusIcon = shippingConfig.icon;
                const isExpanded = expandedRow === sale.id;
                
                return (
                  <React.Fragment key={sale.id}>
                    <tr className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : sale.id)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-medium text-blue-400">{sale.invoice}</td>
                      <td className="px-6 py-4 text-gray-400">{sale.date}</td>
                      <td className="px-6 py-4 text-white">{sale.customer}</td>
                      <td className="px-6 py-4">
                        <Badge className={`text-xs font-medium ${
                          sale.status === 'Completed' 
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : sale.status === 'Pending'
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {sale.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${shippingConfig.color} cursor-pointer hover:opacity-80 transition-all hover:scale-105`}>
                              <StatusIcon size={14} className={shippingConfig.iconColor} />
                              {shippingConfig.label}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="bg-gray-900 border-gray-700 text-white w-48">
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer focus:bg-gray-800"
                              onClick={() => updateShippingStatus(sale.id, 'pending')}
                            >
                              <Clock size={14} className="mr-2 text-gray-400" />
                              Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer focus:bg-gray-800"
                              onClick={() => updateShippingStatus(sale.id, 'packed')}
                            >
                              <Package size={14} className="mr-2 text-blue-400" />
                              Packed
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer focus:bg-gray-800"
                              onClick={() => updateShippingStatus(sale.id, 'dispatched')}
                            >
                              <Truck size={14} className="mr-2 text-purple-400" />
                              Dispatched
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer focus:bg-gray-800"
                              onClick={() => updateShippingStatus(sale.id, 'in-transit')}
                            >
                              <ArrowRight size={14} className="mr-2 text-orange-400" />
                              In Transit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer focus:bg-gray-800"
                              onClick={() => updateShippingStatus(sale.id, 'delivered')}
                            >
                              <CheckCircle size={14} className="mr-2 text-green-400" />
                              Delivered
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer focus:bg-gray-800"
                              onClick={() => updateShippingStatus(sale.id, 'cancelled')}
                            >
                              <XCircle size={14} className="mr-2 text-red-400" />
                              Cancelled
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="px-6 py-4">
                        {sale.trackingNumber ? (
                          <code className="text-xs bg-gray-800 px-2 py-1 rounded text-blue-400 border border-gray-700">
                            {sale.trackingNumber}
                          </code>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-white">{sale.amount}</td>
                    </tr>
                    
                    {/* Expanded Row - Shipping Details */}
                    {isExpanded && (
                      <tr className="bg-gray-800/20">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-800">
                            {/* Shipping Address */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-gray-400">
                                <MapPin size={14} />
                                <span className="text-xs font-semibold uppercase tracking-wide">Shipping Address</span>
                              </div>
                              <p className="text-sm text-white">{sale.shippingAddress || 'N/A'}</p>
                            </div>

                            {/* Contact & Method */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-gray-400">
                                <Phone size={14} />
                                <span className="text-xs font-semibold uppercase tracking-wide">Contact & Method</span>
                              </div>
                              <p className="text-sm text-white">{sale.phone || 'N/A'}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Truck size={14} className="text-purple-400" />
                                <span className="text-sm text-purple-400">{sale.shippingMethod || 'N/A'}</span>
                              </div>
                            </div>

                            {/* Dates */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-gray-400">
                                <Calendar size={14} />
                                <span className="text-xs font-semibold uppercase tracking-wide">Timeline</span>
                              </div>
                              {sale.shippingDate && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Shipped:</span>
                                  <span className="text-white">{sale.shippingDate}</span>
                                </div>
                              )}
                              {sale.deliveryDate && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Delivered:</span>
                                  <span className="text-green-400">{sale.deliveryDate}</span>
                                </div>
                              )}
                              {!sale.shippingDate && !sale.deliveryDate && (
                                <span className="text-sm text-gray-600">No dates recorded</span>
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
          <div className="text-center py-12 text-gray-500">
            <Truck size={48} className="mx-auto mb-4 text-gray-700" />
            <p className="text-lg">No sales found</p>
            <p className="text-sm mt-2">Try adjusting your filters or search term</p>
          </div>
        )}
      </div>
    </div>
  );
};
