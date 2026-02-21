import { useState } from 'react';
import { Search, Plus, AlertCircle, Clock, CheckCircle, Package } from 'lucide-react';

export interface StudioOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  productName: string;
  totalAmount: number;
  createdDate: string;
  status: 'pending' | 'in-progress' | 'ready' | 'completed' | 'shipped';
  currentStage?: string;
  stages: StudioStage[];
  completedStages: number;
  totalStages: number;
}

export interface StudioStage {
  id: string;
  name: string;
  type: 'dyeing' | 'stitching' | 'handwork' | 'embroidery' | 'finishing' | 'quality-check';
  assignedTo: string;
  internalCost: number;
  customerCharge: number;
  expectedDate: string;
  status: 'pending' | 'in-progress' | 'completed';
  startedDate?: string;
  completedDate?: string;
}

interface StudioDashboardProps {
  orders: StudioOrder[];
  onOrderClick: (order: StudioOrder) => void;
  // onCreateNew removed - Studio orders come from Sales module
}

export function StudioDashboard({ orders, onOrderClick }: StudioDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | StudioOrder['status']>('all');

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status: StudioOrder['status']) => {
    switch (status) {
      case 'pending':
        return { color: '#F59E0B', bg: 'bg-[#F59E0B]/10', text: 'Pending', icon: Clock };
      case 'in-progress':
        return { color: '#3B82F6', bg: 'bg-[#3B82F6]/10', text: 'In Progress', icon: Package };
      case 'ready':
        return { color: '#8B5CF6', bg: 'bg-[#8B5CF6]/10', text: 'Ready', icon: CheckCircle };
      case 'completed':
        return { color: '#10B981', bg: 'bg-[#10B981]/10', text: 'Completed', icon: CheckCircle };
      case 'shipped':
        return { color: '#6B7280', bg: 'bg-[#6B7280]/10', text: 'Shipped', icon: Package };
    }
  };

  const getStageIcon = (type: StudioStage['type']) => {
    const icons = {
      'dyeing': '🎨',
      'stitching': '🧵',
      'handwork': '✋',
      'embroidery': '🌸',
      'finishing': '✨',
      'quality-check': '✓',
    };
    return icons[type] || '📦';
  };

  const stats = [
    { label: 'Total Orders', value: orders.length, color: '#8B5CF6' },
    { label: 'In Progress', value: orders.filter(o => o.status === 'in-progress').length, color: '#3B82F6' },
    { label: 'Ready', value: orders.filter(o => o.status === 'ready').length, color: '#10B981' },
    { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: '#F59E0B' },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">{stat.label}</p>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'in-progress', label: 'In Progress' },
          { id: 'ready', label: 'Ready' },
          { id: 'completed', label: 'Completed' },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setFilterStatus(filter.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filterStatus === filter.id
                ? 'bg-[#8B5CF6] text-white'
                : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-3">
            <Package className="w-8 h-8 text-[#6B7280]" />
          </div>
          <p className="text-[#9CA3AF] mb-1">No studio orders found</p>
          <p className="text-xs text-[#6B7280]">Create your first studio order to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            const StatusIcon = statusConfig.icon;
            const progressPercent = order.totalStages > 0 
              ? (order.completedStages / order.totalStages) * 100 
              : 0;

            return (
              <button
                key={order.id}
                onClick={() => onOrderClick(order)}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#8B5CF6] transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-white">{order.orderNumber}</p>
                      <span className={`px-2 py-0.5 ${statusConfig.bg} rounded-full text-xs font-medium flex items-center gap-1`} style={{ color: statusConfig.color }}>
                        <StatusIcon size={12} />
                        {statusConfig.text}
                      </span>
                    </div>
                    <p className="text-sm text-[#9CA3AF]">{order.customerName}</p>
                  </div>
                  <p className="text-sm font-semibold text-white">Rs. {order.totalAmount.toLocaleString()}</p>
                </div>

                {/* Product */}
                <div className="mb-3 pb-3 border-b border-[#374151]">
                  <p className="text-sm text-white">{order.productName}</p>
                  <p className="text-xs text-[#6B7280] mt-1">Created: {order.createdDate}</p>
                </div>

                {/* Stages Progress */}
                {order.stages.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-[#9CA3AF]">Pipeline Progress</p>
                      <p className="text-xs font-medium text-[#8B5CF6]">
                        {order.completedStages}/{order.totalStages} stages
                      </p>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="h-2 bg-[#374151] rounded-full overflow-hidden mb-3">
                      <div 
                        className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* Stage Icons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.stages.map((stage) => (
                        <div
                          key={stage.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                            stage.status === 'completed'
                              ? 'bg-[#10B981]/10 text-[#10B981]'
                              : stage.status === 'in-progress'
                              ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                              : 'bg-[#374151] text-[#6B7280]'
                          }`}
                        >
                          <span>{getStageIcon(stage.type)}</span>
                          <span>{stage.name}</span>
                          {stage.status === 'completed' && <CheckCircle size={12} />}
                          {stage.status === 'in-progress' && <Clock size={12} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Stage */}
                {order.currentStage && (
                  <div className="bg-[#374151] rounded-lg p-2">
                    <p className="text-xs text-[#9CA3AF]">Current Stage:</p>
                    <p className="text-sm font-medium text-white">{order.currentStage}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}