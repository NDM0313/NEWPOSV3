import React, { useState } from 'react';
import { 
  Package,
  Grid3x3,
  List,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Box,
  Truck,
  MapPin,
  Calendar,
  Hash,
  Weight,
  Ruler,
  Tag,
  User,
  Phone,
  Mail,
  Download,
  QrCode,
  ChevronRight,
  Archive,
  Send,
  X,
  Check
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface PackingItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  weight: number;
  dimensions: string;
  condition: string;
}

interface PackingEntry {
  id: string;
  packingNumber: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  items: PackingItem[];
  totalItems: number;
  totalWeight: number;
  packingDate: Date;
  shippingDate?: Date;
  status: 'pending' | 'packed' | 'shipped' | 'delivered';
  packedBy?: string;
  notes?: string;
  trackingNumber?: string;
  courier?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
}

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'pending' | 'packed' | 'shipped' | 'delivered';

export const PackingEntryPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showNewPackingModal, setShowNewPackingModal] = useState(false);
  const [selectedPacking, setSelectedPacking] = useState<PackingEntry | null>(null);

  // Mock data
  const [packingEntries, setPackingEntries] = useState<PackingEntry[]>([
    {
      id: 'PKG001',
      packingNumber: 'PKG-2026-001',
      orderNumber: 'ORD-2026-0045',
      customerName: 'Ayesha Khan',
      customerPhone: '+92 300 1234567',
      customerEmail: 'ayesha@example.com',
      shippingAddress: 'House #123, Street 5, Gulberg III, Lahore, Punjab 54000',
      items: [
        { id: '1', productName: 'Bridal Lehenga - Red', sku: 'BRL-001', quantity: 1, weight: 2.5, dimensions: '60x40x15 cm', condition: 'New' },
        { id: '2', productName: 'Dupatta - Gold Embroidered', sku: 'DPT-023', quantity: 1, weight: 0.5, dimensions: '30x20x5 cm', condition: 'New' }
      ],
      totalItems: 2,
      totalWeight: 3.0,
      packingDate: new Date('2026-01-05'),
      shippingDate: new Date('2026-01-06'),
      status: 'packed',
      packedBy: 'Ahmed Ali',
      notes: 'Handle with care - delicate embroidery',
      trackingNumber: 'TRK123456789',
      courier: 'TCS Express',
      priority: 'high',
      createdAt: new Date('2026-01-05')
    },
    {
      id: 'PKG002',
      packingNumber: 'PKG-2026-002',
      orderNumber: 'ORD-2026-0048',
      customerName: 'Fatima Ahmed',
      customerPhone: '+92 301 9876543',
      customerEmail: 'fatima@example.com',
      shippingAddress: 'Flat 5B, Tower A, DHA Phase 6, Karachi, Sindh 75500',
      items: [
        { id: '3', productName: 'Wedding Dress - Ivory', sku: 'WD-045', quantity: 1, weight: 3.2, dimensions: '70x50x20 cm', condition: 'New' }
      ],
      totalItems: 1,
      totalWeight: 3.2,
      packingDate: new Date('2026-01-05'),
      status: 'shipped',
      packedBy: 'Hassan Raza',
      trackingNumber: 'TRK987654321',
      courier: 'Leopards Courier',
      priority: 'urgent',
      createdAt: new Date('2026-01-05')
    },
    {
      id: 'PKG003',
      packingNumber: 'PKG-2026-003',
      orderNumber: 'ORD-2026-0052',
      customerName: 'Zainab Ali',
      customerPhone: '+92 333 5551234',
      customerEmail: 'zainab@example.com',
      shippingAddress: 'Office 12, Main Boulevard, Bahria Town, Islamabad',
      items: [
        { id: '4', productName: 'Party Wear Gown - Blue', sku: 'PWG-078', quantity: 1, weight: 1.8, dimensions: '50x35x10 cm', condition: 'New' },
        { id: '5', productName: 'Clutch Bag - Silver', sku: 'CLT-012', quantity: 1, weight: 0.3, dimensions: '25x15x8 cm', condition: 'New' },
        { id: '6', productName: 'Jewelry Set - Pearl', sku: 'JWL-034', quantity: 1, weight: 0.2, dimensions: '15x10x5 cm', condition: 'New' }
      ],
      totalItems: 3,
      totalWeight: 2.3,
      packingDate: new Date('2026-01-06'),
      status: 'pending',
      priority: 'medium',
      createdAt: new Date('2026-01-06')
    },
    {
      id: 'PKG004',
      packingNumber: 'PKG-2026-004',
      orderNumber: 'ORD-2026-0055',
      customerName: 'Maria Hassan',
      customerPhone: '+92 321 7778888',
      customerEmail: 'maria@example.com',
      shippingAddress: 'Villa 23, Garden Town, Faisalabad, Punjab 38000',
      items: [
        { id: '7', productName: 'Bridal Sharara - Pink', sku: 'BRS-015', quantity: 1, weight: 2.1, dimensions: '55x40x12 cm', condition: 'New' }
      ],
      totalItems: 1,
      totalWeight: 2.1,
      packingDate: new Date('2026-01-04'),
      shippingDate: new Date('2026-01-05'),
      status: 'delivered',
      packedBy: 'Sana Malik',
      trackingNumber: 'TRK456789123',
      courier: 'TCS Express',
      priority: 'high',
      createdAt: new Date('2026-01-04')
    }
  ]);

  const getStatusColor = (status: PackingEntry['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'packed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'shipped': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'delivered': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
  };

  const getStatusIcon = (status: PackingEntry['status']) => {
    switch (status) {
      case 'pending': return <Clock size={14} />;
      case 'packed': return <Box size={14} />;
      case 'shipped': return <Truck size={14} />;
      case 'delivered': return <CheckCircle2 size={14} />;
    }
  };

  const getPriorityColor = (priority: PackingEntry['priority']) => {
    switch (priority) {
      case 'low': return 'bg-gray-700 text-gray-300 border-gray-600';
      case 'medium': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  const getPriorityIcon = (priority: PackingEntry['priority']) => {
    switch (priority) {
      case 'urgent': return '🔥';
      case 'high': return '⚡';
      case 'medium': return '📋';
      case 'low': return '📌';
    }
  };

  const filteredEntries = packingEntries.filter(entry => {
    const matchesSearch = 
      entry.packingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || entry.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: packingEntries.length,
    pending: packingEntries.filter(e => e.status === 'pending').length,
    packed: packingEntries.filter(e => e.status === 'packed').length,
    shipped: packingEntries.filter(e => e.status === 'shipped').length,
    delivered: packingEntries.filter(e => e.status === 'delivered').length
  };

  return (
    <div className="min-h-screen bg-[#111827] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Package className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Packing Management</h1>
            <p className="text-gray-400">Complete packing & shipping control center</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Archive className="text-gray-400" size={20} />
              <Badge className="bg-gray-700 text-gray-300 border-gray-600">All</Badge>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.total}</div>
            <div className="text-xs text-gray-400">Total Packages</div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="text-yellow-400" size={20} />
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.pending}</div>
            <div className="text-xs text-gray-400">To Pack</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Box className="text-blue-400" size={20} />
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Packed</Badge>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.packed}</div>
            <div className="text-xs text-gray-400">Ready to Ship</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Truck className="text-purple-400" size={20} />
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Shipped</Badge>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.shipped}</div>
            <div className="text-xs text-gray-400">In Transit</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="text-emerald-400" size={20} />
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Delivered</Badge>
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stats.delivered}</div>
            <div className="text-xs text-gray-400">Completed</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by packing #, order #, customer, or tracking..."
              className="pl-10 bg-gray-800 border-gray-700 text-white h-11"
            />
          </div>

          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white h-11"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="packed">Packed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-all ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Grid3x3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <List size={18} />
            </button>
          </div>

          {/* New Packing Button */}
          <Button 
            onClick={() => setShowNewPackingModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-11 shadow-lg shadow-blue-600/30"
          >
            <Plus size={18} className="mr-2" />
            New Packing
          </Button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-3 gap-4">
          {filteredEntries.map(entry => (
            <div 
              key={entry.id} 
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all group"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-gray-800 bg-gradient-to-r from-gray-800/50 to-gray-900/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white text-lg">{entry.packingNumber}</h3>
                      <Badge className={getPriorityColor(entry.priority)}>
                        <span className="mr-1">{getPriorityIcon(entry.priority)}</span>
                        {entry.priority}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">Order: {entry.orderNumber}</div>
                  </div>
                  <Badge className={getStatusColor(entry.status)}>
                    {getStatusIcon(entry.status)}
                    <span className="ml-1.5">{entry.status}</span>
                  </Badge>
                </div>

                {/* Customer Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="text-gray-500" size={14} />
                    <span className="text-white font-medium">{entry.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Phone size={12} className="text-gray-600" />
                    <span>{entry.customerPhone}</span>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-4">
                {/* Items Summary */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Package size={16} className="text-blue-400" />
                    <span className="font-medium text-white">{entry.totalItems}</span>
                    <span>items</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Weight size={16} className="text-purple-400" />
                    <span className="font-medium text-white">{entry.totalWeight}</span>
                    <span>kg</span>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-1">
                    <MapPin className="text-gray-500 mt-0.5" size={14} />
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">Shipping To:</div>
                      <div className="text-sm text-white line-clamp-2">
                        {entry.shippingAddress}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tracking Info */}
                {entry.trackingNumber && (
                  <div className="flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">Tracking Number</div>
                      <div className="text-sm font-mono text-blue-400 font-semibold">
                        {entry.trackingNumber}
                      </div>
                      {entry.courier && (
                        <div className="text-xs text-gray-500 mt-1">{entry.courier}</div>
                      )}
                    </div>
                    <QrCode className="text-blue-400" size={24} />
                  </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <Calendar size={12} />
                    <span>Packed: {entry.packingDate.toLocaleDateString()}</span>
                  </div>
                  {entry.shippingDate && (
                    <>
                      <ChevronRight size={12} className="text-gray-600" />
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Truck size={12} />
                        <span>{entry.shippingDate.toLocaleDateString()}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Packed By */}
                {entry.packedBy && (
                  <div className="text-xs text-gray-500">
                    Packed by: <span className="text-gray-400 font-medium">{entry.packedBy}</span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 border-t border-gray-800 bg-gray-800/30 flex gap-2">
                <Button 
                  onClick={() => {
                    setSelectedPacking(entry);
                    setShowDetailsModal(true);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm h-9"
                >
                  <Eye size={14} className="mr-1.5" />
                  View Details
                </Button>
                <Button 
                  variant="outline"
                  className="bg-gray-700 border-gray-600 hover:bg-gray-600 text-white text-sm h-9"
                >
                  <Printer size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="text-left p-4 text-gray-400 font-semibold text-sm">Packing #</th>
                <th className="text-left p-4 text-gray-400 font-semibold text-sm">Order #</th>
                <th className="text-left p-4 text-gray-400 font-semibold text-sm">Customer</th>
                <th className="text-left p-4 text-gray-400 font-semibold text-sm">Items</th>
                <th className="text-left p-4 text-gray-400 font-semibold text-sm">Weight</th>
                <th className="text-left p-4 text-gray-400 font-semibold text-sm">Tracking #</th>
                <th className="text-center p-4 text-gray-400 font-semibold text-sm">Priority</th>
                <th className="text-center p-4 text-gray-400 font-semibold text-sm">Status</th>
                <th className="text-center p-4 text-gray-400 font-semibold text-sm">Date</th>
                <th className="text-right p-4 text-gray-400 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => (
                <tr 
                  key={entry.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="p-4">
                    <div className="font-semibold text-white">{entry.packingNumber}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-gray-400">{entry.orderNumber}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-white">{entry.customerName}</div>
                    <div className="text-xs text-gray-500">{entry.customerPhone}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Package className="text-blue-400" size={14} />
                      <span className="text-white font-semibold">{entry.totalItems}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Weight className="text-purple-400" size={14} />
                      <span className="text-white">{entry.totalWeight} kg</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {entry.trackingNumber ? (
                      <div>
                        <div className="font-mono text-blue-400 text-sm">{entry.trackingNumber}</div>
                        <div className="text-xs text-gray-500">{entry.courier}</div>
                      </div>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <Badge className={getPriorityColor(entry.priority)}>
                      <span className="mr-1">{getPriorityIcon(entry.priority)}</span>
                      {entry.priority}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge className={getStatusColor(entry.status)}>
                      {getStatusIcon(entry.status)}
                      <span className="ml-1.5">{entry.status}</span>
                    </Badge>
                  </td>
                  <td className="p-4 text-center text-gray-400 text-sm">
                    {entry.packingDate.toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        onClick={() => {
                          setSelectedPacking(entry);
                          setShowDetailsModal(true);
                        }}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white h-8"
                      >
                        <Eye size={14} className="mr-1" />
                        View
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="bg-gray-700 border-gray-600 hover:bg-gray-600 text-white h-8"
                      >
                        <Printer size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedPacking && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Package className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedPacking.packingNumber}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getStatusColor(selectedPacking.status)}>
                      {getStatusIcon(selectedPacking.status)}
                      <span className="ml-1.5">{selectedPacking.status}</span>
                    </Badge>
                    <Badge className={getPriorityColor(selectedPacking.priority)}>
                      <span className="mr-1">{getPriorityIcon(selectedPacking.priority)}</span>
                      {selectedPacking.priority}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => setShowDetailsModal(false)}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X size={20} />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-sm text-gray-400 mb-2">Order Number</div>
                  <div className="text-lg font-semibold text-white">{selectedPacking.orderNumber}</div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="text-sm text-gray-400 mb-2">Packing Date</div>
                  <div className="text-lg font-semibold text-white">{selectedPacking.packingDate.toLocaleDateString()}</div>
                </div>
              </div>

              {/* Customer Details */}
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-5">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <User size={18} className="text-blue-400" />
                  Customer Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Name</div>
                    <div className="text-white font-medium">{selectedPacking.customerName}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Phone</div>
                    <div className="text-white font-medium">{selectedPacking.customerPhone}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm text-gray-400 mb-1">Email</div>
                    <div className="text-white font-medium">{selectedPacking.customerEmail}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm text-gray-400 mb-1">Shipping Address</div>
                    <div className="text-white font-medium">{selectedPacking.shippingAddress}</div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Package size={18} className="text-blue-400" />
                  Package Contents
                </h3>
                <div className="space-y-3">
                  {selectedPacking.items.map((item, index) => (
                    <div key={item.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-white mb-1">{item.productName}</div>
                          <div className="text-sm text-gray-400">SKU: {item.sku}</div>
                        </div>
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          Qty: {item.quantity}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Weight className="text-purple-400" size={14} />
                          <span className="text-gray-400">Weight:</span>
                          <span className="text-white font-medium">{item.weight} kg</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Ruler className="text-orange-400" size={14} />
                          <span className="text-gray-400">Size:</span>
                          <span className="text-white font-medium">{item.dimensions}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag className="text-green-400" size={14} />
                          <span className="text-gray-400">Condition:</span>
                          <span className="text-white font-medium">{item.condition}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between">
                  <div className="text-gray-400">
                    Total Items: <span className="text-white font-semibold">{selectedPacking.totalItems}</span>
                  </div>
                  <div className="text-gray-400">
                    Total Weight: <span className="text-white font-semibold">{selectedPacking.totalWeight} kg</span>
                  </div>
                </div>
              </div>

              {/* Shipping Info */}
              {selectedPacking.trackingNumber && (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-5">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Truck size={18} className="text-purple-400" />
                    Shipping Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Tracking Number</div>
                      <div className="text-white font-mono font-semibold">{selectedPacking.trackingNumber}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Courier Service</div>
                      <div className="text-white font-medium">{selectedPacking.courier}</div>
                    </div>
                    {selectedPacking.shippingDate && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Shipping Date</div>
                        <div className="text-white font-medium">{selectedPacking.shippingDate.toLocaleDateString()}</div>
                      </div>
                    )}
                    {selectedPacking.packedBy && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Packed By</div>
                        <div className="text-white font-medium">{selectedPacking.packedBy}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedPacking.notes && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                    <AlertCircle size={18} className="text-yellow-400" />
                    Special Notes
                  </h3>
                  <div className="text-gray-300">{selectedPacking.notes}</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 p-6 flex gap-3">
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer size={18} className="mr-2" />
                Print Packing Slip
              </Button>
              <Button 
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Download size={18} className="mr-2" />
                Download Label
              </Button>
              <Button 
                variant="outline"
                className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                <Edit size={18} className="mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Packing Modal */}
      {showNewPackingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-white">Create New Packing</h2>
              <Button 
                onClick={() => setShowNewPackingModal(false)}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X size={20} />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400 mb-2 block">Order Number *</Label>
                  <Input className="bg-gray-800 border-gray-700 text-white" placeholder="ORD-2026-XXXX" />
                </div>
                <div>
                  <Label className="text-gray-400 mb-2 block">Priority *</Label>
                  <select className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-gray-400 mb-2 block">Customer Name *</Label>
                <Input className="bg-gray-800 border-gray-700 text-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400 mb-2 block">Phone *</Label>
                  <Input className="bg-gray-800 border-gray-700 text-white" placeholder="+92 XXX XXXXXXX" />
                </div>
                <div>
                  <Label className="text-gray-400 mb-2 block">Email</Label>
                  <Input type="email" className="bg-gray-800 border-gray-700 text-white" />
                </div>
              </div>

              <div>
                <Label className="text-gray-400 mb-2 block">Shipping Address *</Label>
                <Textarea className="bg-gray-800 border-gray-700 text-white" rows={3} />
              </div>

              <div>
                <Label className="text-gray-400 mb-2 block">Special Notes</Label>
                <Textarea className="bg-gray-800 border-gray-700 text-white" rows={2} />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 p-6 flex gap-3">
              <Button 
                onClick={() => setShowNewPackingModal(false)}
                variant="outline"
                className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                <Check size={18} className="mr-2" />
                Create Packing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
