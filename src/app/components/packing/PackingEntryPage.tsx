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
import { formatDate } from '../../../utils/dateFormat';

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
      case 'pending': return {
        backgroundColor: 'rgba(234, 179, 8, 0.2)',
        color: 'rgba(234, 179, 8, 1)',
        borderColor: 'rgba(234, 179, 8, 0.3)'
      };
      case 'packed': return {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: 'var(--color-primary)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      };
      case 'shipped': return {
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        color: 'var(--color-wholesale)',
        borderColor: 'rgba(147, 51, 234, 0.3)'
      };
      case 'delivered': return {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        color: 'rgba(16, 185, 129, 1)',
        borderColor: 'rgba(16, 185, 129, 0.3)'
      };
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
      case 'low': return {
        backgroundColor: 'var(--color-bg-card)',
        color: 'var(--color-text-secondary)',
        borderColor: 'var(--color-border-secondary)'
      };
      case 'medium': return {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        color: 'var(--color-primary)',
        borderColor: 'rgba(59, 130, 246, 0.3)'
      };
      case 'high': return {
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        color: 'var(--color-warning)',
        borderColor: 'rgba(249, 115, 22, 0.3)'
      };
      case 'urgent': return {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        color: 'var(--color-error)',
        borderColor: 'rgba(239, 68, 68, 0.3)'
      };
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
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Package 
              size={28}
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <div>
            <h1 
              className="text-3xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Packing Management
            </h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Complete packing & shipping control center
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div 
            className="border rounded-xl p-4"
            style={{
              background: 'linear-gradient(to bottom right, var(--color-bg-card), var(--color-bg-primary))',
              borderColor: 'var(--color-border-secondary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <Archive 
                size={20}
                style={{ color: 'var(--color-text-secondary)' }}
              />
              <Badge 
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-secondary)',
                  borderColor: 'var(--color-border-secondary)'
                }}
              >
                All
              </Badge>
            </div>
            <div 
              className="text-2xl font-bold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.total}
            </div>
            <div 
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Total Packages
            </div>
          </div>

          <div 
            className="border rounded-xl p-4"
            style={{
              background: 'linear-gradient(to bottom right, rgba(234, 179, 8, 0.1), rgba(234, 179, 8, 0.05))',
              borderColor: 'rgba(234, 179, 8, 0.3)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <Clock 
                size={20}
                style={{ color: 'rgba(234, 179, 8, 1)' }}
              />
              <Badge 
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  color: 'rgba(234, 179, 8, 1)',
                  borderColor: 'rgba(234, 179, 8, 0.3)'
                }}
              >
                Pending
              </Badge>
            </div>
            <div 
              className="text-2xl font-bold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.pending}
            </div>
            <div 
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              To Pack
            </div>
          </div>

          <div 
            className="border rounded-xl p-4"
            style={{
              background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <Box 
                size={20}
                style={{ color: 'var(--color-primary)' }}
              />
              <Badge 
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  color: 'var(--color-primary)',
                  borderColor: 'rgba(59, 130, 246, 0.3)'
                }}
              >
                Packed
              </Badge>
            </div>
            <div 
              className="text-2xl font-bold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.packed}
            </div>
            <div 
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Ready to Ship
            </div>
          </div>

          <div 
            className="border rounded-xl p-4"
            style={{
              background: 'linear-gradient(to bottom right, rgba(147, 51, 234, 0.1), rgba(147, 51, 234, 0.05))',
              borderColor: 'rgba(147, 51, 234, 0.3)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <Truck 
                size={20}
                style={{ color: 'var(--color-wholesale)' }}
              />
              <Badge 
                style={{
                  backgroundColor: 'rgba(147, 51, 234, 0.2)',
                  color: 'var(--color-wholesale)',
                  borderColor: 'rgba(147, 51, 234, 0.3)'
                }}
              >
                Shipped
              </Badge>
            </div>
            <div 
              className="text-2xl font-bold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.shipped}
            </div>
            <div 
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              In Transit
            </div>
          </div>

          <div 
            className="border rounded-xl p-4"
            style={{
              background: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
              borderColor: 'rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 
                size={20}
                style={{ color: 'rgba(16, 185, 129, 1)' }}
              />
              <Badge 
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: 'rgba(16, 185, 129, 1)',
                  borderColor: 'rgba(16, 185, 129, 0.3)'
                }}
              >
                Delivered
              </Badge>
            </div>
            <div 
              className="text-2xl font-bold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.delivered}
            </div>
            <div 
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Completed
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2" 
              size={20}
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by packing #, order #, customer, or tracking..."
              className="pl-10 h-11"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-4 py-2.5 rounded-lg h-11"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-primary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="packed">Packed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>

          {/* View Mode Toggle */}
          <div 
            className="flex gap-1 border rounded-lg p-1"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-secondary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <button
              onClick={() => setViewMode('grid')}
              className="p-2 rounded transition-all"
              style={viewMode === 'grid' ? {
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-primary)',
                boxShadow: '0 10px 15px rgba(37, 99, 235, 0.3)',
                borderRadius: 'var(--radius-md)'
              } : {
                color: 'var(--color-text-secondary)'
              }}
              onMouseEnter={(e) => {
                if (viewMode !== 'grid') {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }
              }}
              onMouseLeave={(e) => {
                if (viewMode !== 'grid') {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Grid3x3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="p-2 rounded transition-all"
              style={viewMode === 'list' ? {
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-primary)',
                boxShadow: '0 10px 15px rgba(37, 99, 235, 0.3)',
                borderRadius: 'var(--radius-md)'
              } : {
                color: 'var(--color-text-secondary)'
              }}
              onMouseEnter={(e) => {
                if (viewMode !== 'list') {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }
              }}
              onMouseLeave={(e) => {
                if (viewMode !== 'list') {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <List size={18} />
            </button>
          </div>

          {/* New Packing Button */}
          <Button 
            onClick={() => setShowNewPackingModal(true)}
            className="h-11 shadow-lg"
            style={{
              background: 'linear-gradient(to right, var(--color-primary), var(--color-wholesale))',
              color: 'var(--color-text-primary)',
              boxShadow: '0 10px 15px rgba(37, 99, 235, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, rgba(37, 99, 235, 1), rgba(126, 34, 206, 1))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, var(--color-primary), var(--color-wholesale))';
            }}
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
              className="border rounded-xl overflow-hidden transition-all group"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            >
              {/* Card Header */}
              <div 
                className="p-5 border-b"
                style={{
                  borderBottomColor: 'var(--color-border-primary)',
                  background: 'linear-gradient(to right, rgba(31, 41, 55, 0.5), rgba(17, 24, 39, 0.5))'
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 
                        className="font-bold text-lg"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {entry.packingNumber}
                      </h3>
                      <Badge style={getPriorityColor(entry.priority)}>
                        <span className="mr-1">{getPriorityIcon(entry.priority)}</span>
                        {entry.priority}
                      </Badge>
                    </div>
                    <div 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Order: {entry.orderNumber}
                    </div>
                  </div>
                  <Badge style={getStatusColor(entry.status)}>
                    {getStatusIcon(entry.status)}
                    <span className="ml-1.5">{entry.status}</span>
                  </Badge>
                </div>

                {/* Customer Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <User 
                      size={14}
                      style={{ color: 'var(--color-text-tertiary)' }}
                    />
                    <span 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {entry.customerName}
                    </span>
                  </div>
                  <div 
                    className="flex items-center gap-2 text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <Phone 
                      size={12}
                      style={{ color: 'var(--color-text-disabled)' }}
                    />
                    <span>{entry.customerPhone}</span>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-4">
                {/* Items Summary */}
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <Package 
                      size={16}
                      style={{ color: 'var(--color-primary)' }}
                    />
                    <span 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {entry.totalItems}
                    </span>
                    <span>items</span>
                  </div>
                  <div 
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <Weight 
                      size={16}
                      style={{ color: 'var(--color-wholesale)' }}
                    />
                    <span 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {entry.totalWeight}
                    </span>
                    <span>kg</span>
                  </div>
                </div>

                {/* Shipping Address */}
                <div 
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: 'rgba(31, 41, 55, 0.5)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <MapPin 
                      className="mt-0.5" 
                      size={14}
                      style={{ color: 'var(--color-text-tertiary)' }}
                    />
                    <div className="flex-1">
                      <div 
                        className="text-xs mb-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Shipping To:
                      </div>
                      <div 
                        className="text-sm line-clamp-2"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {entry.shippingAddress}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tracking Info */}
                {entry.trackingNumber && (
                  <div 
                    className="flex items-center justify-between border rounded-lg p-3"
                    style={{
                      background: 'linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))',
                      borderColor: 'rgba(59, 130, 246, 0.2)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <div className="flex-1">
                      <div 
                        className="text-xs mb-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Tracking Number
                      </div>
                      <div 
                        className="text-sm font-mono font-semibold"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {entry.trackingNumber}
                      </div>
                      {entry.courier && (
                        <div 
                          className="text-xs mt-1"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          {entry.courier}
                        </div>
                      )}
                    </div>
                    <QrCode 
                      size={24}
                      style={{ color: 'var(--color-primary)' }}
                    />
                  </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-3 text-xs">
                  <div 
                    className="flex items-center gap-1.5 text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <Calendar size={12} />
                    <span>Packed: {formatDate(entry.packingDate)}</span>
                  </div>
                  {entry.shippingDate && (
                    <>
                      <ChevronRight 
                        size={12}
                        style={{ color: 'var(--color-text-disabled)' }}
                      />
                      <div 
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <Truck size={12} />
                        <span>{formatDate(entry.shippingDate)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Packed By */}
                {entry.packedBy && (
                  <div 
                    className="text-xs"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Packed by: <span 
                      className="font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {entry.packedBy}
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div 
                className="px-5 py-3 border-t flex gap-2"
                style={{
                  borderTopColor: 'var(--color-border-primary)',
                  backgroundColor: 'rgba(31, 41, 55, 0.3)'
                }}
              >
                <Button 
                  onClick={() => {
                    setSelectedPacking(entry);
                    setShowDetailsModal(true);
                  }}
                  className="flex-1 text-sm h-9"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)'; // blue-700
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                  }}
                >
                  <Eye size={14} className="mr-1.5" />
                  View Details
                </Button>
                <Button 
                  variant="outline"
                  className="text-sm h-9"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                  }}
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
        <div 
          className="border rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <table className="w-full">
            <thead 
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderBottomColor: 'var(--color-border-secondary)'
              }}
            >
              <tr>
                <th 
                  className="text-left p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Packing #
                </th>
                <th 
                  className="text-left p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Order #
                </th>
                <th 
                  className="text-left p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Customer
                </th>
                <th 
                  className="text-left p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Items
                </th>
                <th 
                  className="text-left p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Weight
                </th>
                <th 
                  className="text-left p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Tracking #
                </th>
                <th 
                  className="text-center p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Priority
                </th>
                <th 
                  className="text-center p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Status
                </th>
                <th 
                  className="text-center p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Date
                </th>
                <th 
                  className="text-right p-4 font-semibold text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => (
                <tr 
                  key={entry.id}
                  className="border-b transition-colors"
                  style={{ borderBottomColor: 'var(--color-border-primary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="p-4">
                    <div 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {entry.packingNumber}
                    </div>
                  </td>
                  <td className="p-4">
                    <div style={{ color: 'var(--color-text-secondary)' }}>
                      {entry.orderNumber}
                    </div>
                  </td>
                  <td className="p-4">
                    <div 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {entry.customerName}
                    </div>
                    <div 
                      className="text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {entry.customerPhone}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Package 
                        size={14}
                        style={{ color: 'var(--color-primary)' }}
                      />
                      <span 
                        className="font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {entry.totalItems}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Weight 
                        size={14}
                        style={{ color: 'var(--color-wholesale)' }}
                      />
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        {entry.totalWeight} kg
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    {entry.trackingNumber ? (
                      <div>
                        <div 
                          className="font-mono text-sm"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          {entry.trackingNumber}
                        </div>
                        <div 
                          className="text-xs"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          {entry.courier}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-disabled)' }}>—</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <Badge style={getPriorityColor(entry.priority)}>
                      <span className="mr-1">{getPriorityIcon(entry.priority)}</span>
                      {entry.priority}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <Badge style={getStatusColor(entry.status)}>
                      {getStatusIcon(entry.status)}
                      <span className="ml-1.5">{entry.status}</span>
                    </Badge>
                  </td>
                  <td 
                    className="p-4 text-center text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {formatDate(entry.packingDate)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        onClick={() => {
                          setSelectedPacking(entry);
                          setShowDetailsModal(true);
                        }}
                        size="sm"
                        className="h-8"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-text-primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)'; // blue-700
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                        }}
                      >
                        <Eye size={14} className="mr-1" />
                        View
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="h-8"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border-secondary)',
                          color: 'var(--color-text-primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                        }}
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
          <div 
            className="border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-2xl)'
            }}
          >
            {/* Modal Header */}
            <div 
              className="sticky top-0 border-b p-6 flex items-center justify-between z-10"
              style={{
                background: 'linear-gradient(to right, var(--color-bg-primary), var(--color-bg-card))',
                borderBottomColor: 'var(--color-border-secondary)'
              }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(to bottom right, var(--color-primary), var(--color-wholesale))',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                  <Package 
                    size={24}
                    style={{ color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div>
                  <h2 
                    className="text-2xl font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {selectedPacking.packingNumber}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge style={getStatusColor(selectedPacking.status)}>
                      {getStatusIcon(selectedPacking.status)}
                      <span className="ml-1.5">{selectedPacking.status}</span>
                    </Badge>
                    <Badge style={getPriorityColor(selectedPacking.priority)}>
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
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={20} />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className="border rounded-xl p-4"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                  <div 
                    className="text-sm mb-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Order Number
                  </div>
                  <div 
                    className="text-lg font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {selectedPacking.orderNumber}
                  </div>
                </div>
                <div 
                  className="border rounded-xl p-4"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                  <div 
                    className="text-sm mb-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Packing Date
                  </div>
                  <div 
                    className="text-lg font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {formatDate(selectedPacking.packingDate)}
                  </div>
                </div>
              </div>

              {/* Customer Details */}
              <div 
                className="border rounded-xl p-5"
                style={{
                  background: 'linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  borderRadius: 'var(--radius-xl)'
                }}
              >
                <h3 
                  className="font-bold mb-4 flex items-center gap-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <User 
                    size={18}
                    style={{ color: 'var(--color-primary)' }}
                  />
                  Customer Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div 
                      className="text-sm mb-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Name
                    </div>
                    <div 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selectedPacking.customerName}
                    </div>
                  </div>
                  <div>
                    <div 
                      className="text-sm mb-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Phone
                    </div>
                    <div 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selectedPacking.customerPhone}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div 
                      className="text-sm mb-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Email
                    </div>
                    <div 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selectedPacking.customerEmail}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div 
                      className="text-sm mb-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Shipping Address
                    </div>
                    <div 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selectedPacking.shippingAddress}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div 
                className="border rounded-xl p-5"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  borderRadius: 'var(--radius-xl)'
                }}
              >
                <h3 
                  className="font-bold mb-4 flex items-center gap-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <Package 
                    size={18}
                    style={{ color: 'var(--color-primary)' }}
                  />
                  Package Contents
                </h3>
                <div className="space-y-3">
                  {selectedPacking.items.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="border rounded-lg p-4"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        borderColor: 'var(--color-border-secondary)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div 
                            className="font-semibold mb-1"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {item.productName}
                          </div>
                          <div 
                            className="text-sm"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            SKU: {item.sku}
                          </div>
                        </div>
                        <Badge 
                          style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            color: 'var(--color-primary)',
                            borderColor: 'rgba(59, 130, 246, 0.3)'
                          }}
                        >
                          Qty: {item.quantity}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Weight 
                            size={14}
                            style={{ color: 'var(--color-wholesale)' }}
                          />
                          <span style={{ color: 'var(--color-text-secondary)' }}>Weight:</span>
                          <span 
                            className="font-medium"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {item.weight} kg
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Ruler 
                            size={14}
                            style={{ color: 'var(--color-warning)' }}
                          />
                          <span style={{ color: 'var(--color-text-secondary)' }}>Size:</span>
                          <span 
                            className="font-medium"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {item.dimensions}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag 
                            size={14}
                            style={{ color: 'var(--color-success)' }}
                          />
                          <span style={{ color: 'var(--color-text-secondary)' }}>Condition:</span>
                          <span 
                            className="font-medium"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {item.condition}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Totals */}
                <div 
                  className="mt-4 pt-4 border-t flex justify-between"
                  style={{ borderTopColor: 'var(--color-border-secondary)' }}
                >
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    Total Items: <span 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selectedPacking.totalItems}
                    </span>
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    Total Weight: <span 
                      className="font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {selectedPacking.totalWeight} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Shipping Info */}
              {selectedPacking.trackingNumber && (
                <div 
                  className="border rounded-xl p-5"
                  style={{
                    background: 'linear-gradient(to right, rgba(147, 51, 234, 0.1), rgba(236, 72, 153, 0.1))',
                    borderColor: 'rgba(147, 51, 234, 0.3)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                  <h3 
                    className="font-bold mb-4 flex items-center gap-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <Truck 
                      size={18}
                      style={{ color: 'var(--color-wholesale)' }}
                    />
                    Shipping Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div 
                        className="text-sm mb-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Tracking Number
                      </div>
                      <div 
                        className="font-mono font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {selectedPacking.trackingNumber}
                      </div>
                    </div>
                    <div>
                      <div 
                        className="text-sm mb-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Courier Service
                      </div>
                      <div 
                        className="font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {selectedPacking.courier}
                      </div>
                    </div>
                    {selectedPacking.shippingDate && (
                      <div>
                        <div 
                          className="text-sm mb-1"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Shipping Date
                        </div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {formatDate(selectedPacking.shippingDate)}
                        </div>
                      </div>
                    )}
                    {selectedPacking.packedBy && (
                      <div>
                        <div 
                          className="text-sm mb-1"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Packed By
                        </div>
                        <div 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {selectedPacking.packedBy}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedPacking.notes && (
                <div 
                  className="border rounded-xl p-5"
                  style={{
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    borderColor: 'rgba(234, 179, 8, 0.3)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                  <h3 
                    className="font-bold mb-2 flex items-center gap-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <AlertCircle 
                      size={18}
                      style={{ color: 'rgba(234, 179, 8, 1)' }}
                    />
                    Special Notes
                  </h3>
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    {selectedPacking.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div 
              className="sticky bottom-0 border-t p-6 flex gap-3"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderTopColor: 'var(--color-border-primary)'
              }}
            >
              <Button 
                className="flex-1"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)'; // blue-700
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                }}
              >
                <Printer size={18} className="mr-2" />
                Print Packing Slip
              </Button>
              <Button 
                className="flex-1"
                style={{
                  backgroundColor: 'var(--color-wholesale)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(126, 34, 206, 1)'; // purple-700
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
                }}
              >
                <Download size={18} className="mr-2" />
                Download Label
              </Button>
              <Button 
                variant="outline"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                }}
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
          <div 
            className="border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-2xl)'
            }}
          >
            <div 
              className="sticky top-0 border-b p-6 flex items-center justify-between z-10"
              style={{
                background: 'linear-gradient(to right, var(--color-bg-primary), var(--color-bg-card))',
                borderBottomColor: 'var(--color-border-secondary)'
              }}
            >
              <h2 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Create New Packing
              </h2>
              <Button 
                onClick={() => setShowNewPackingModal(false)}
                variant="ghost"
                size="icon"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={20} />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label 
                    className="mb-2 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Order Number *
                  </Label>
                  <Input 
                    placeholder="ORD-2026-XXXX"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                </div>
                <div>
                  <Label 
                    className="mb-2 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Priority *
                  </Label>
                  <select 
                    className="w-full px-4 py-2 rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <Label 
                  className="mb-2 block"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Customer Name *
                </Label>
                <Input 
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label 
                    className="mb-2 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Phone *
                  </Label>
                  <Input 
                    placeholder="+92 XXX XXXXXXX"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                </div>
                <div>
                  <Label 
                    className="mb-2 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Email
                  </Label>
                  <Input 
                    type="email"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                </div>
              </div>

              <div>
                <Label 
                  className="mb-2 block"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Shipping Address *
                </Label>
                <Textarea 
                  rows={3}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <div>
                <Label 
                  className="mb-2 block"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Special Notes
                </Label>
                <Textarea 
                  rows={2}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>

            <div 
              className="sticky bottom-0 border-t p-6 flex gap-3"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                borderTopColor: 'var(--color-border-primary)'
              }}
            >
              <Button 
                onClick={() => setShowNewPackingModal(false)}
                variant="outline"
                className="flex-1"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                style={{
                  background: 'linear-gradient(to right, var(--color-primary), var(--color-wholesale))',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, rgba(37, 99, 235, 1), rgba(126, 34, 206, 1))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, var(--color-primary), var(--color-wholesale))';
                }}
              >
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
