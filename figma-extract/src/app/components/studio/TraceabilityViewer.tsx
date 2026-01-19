import React from 'react';
import { X, MapPin, Clock, User, CheckCircle, ArrowRight, Package, Droplet, Scissors, Hand, Truck, Home } from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { StudioOrder } from './StudioDashboard';

interface TraceabilityViewerProps {
  order: StudioOrder;
  onClose: () => void;
}

export const TraceabilityViewer: React.FC<TraceabilityViewerProps> = ({ order, onClose }) => {
  const timeline = [
    {
      stage: 'Sale Created',
      icon: Package,
      timestamp: order.createdAt,
      status: 'completed',
      details: `Invoice ${order.invoiceNumber} created for ${order.customerName}`,
      metadata: {
        fabric: order.fabric.type,
        quantity: `${order.fabric.quantity} meters`,
        amount: `₹${order.totalAmount.toLocaleString()}`
      }
    },
    ...(order.workflow.dyeing ? [{
      stage: 'Dyeing Unit',
      icon: Droplet,
      timestamp: order.workflow.dyeing.completedAt || order.createdAt,
      status: order.workflow.dyeing.status,
      details: order.customization.dyeing 
        ? `${order.customization.dyeing.type} dyeing process` 
        : 'Dyeing required',
      metadata: {
        assignedTo: order.workflow.dyeing.assignedTo || 'Not assigned',
        colors: order.customization.dyeing?.colors.join(' → ') || 'N/A',
        status: order.workflow.dyeing.status
      }
    }] : []),
    ...(order.workflow.tailoring ? [{
      stage: 'Tailoring Unit',
      icon: Scissors,
      timestamp: order.workflow.tailoring.completedAt || order.createdAt,
      status: order.workflow.tailoring.status,
      details: 'Tailoring and stitching process',
      metadata: {
        assignedTo: order.workflow.tailoring.assignedTo || 'Not assigned',
        type: order.customization.readyMade || 'Custom',
        status: order.workflow.tailoring.status
      }
    }] : []),
    ...(order.workflow.handcraft ? [{
      stage: 'Handcraft Unit',
      icon: Hand,
      timestamp: order.workflow.handcraft.completedAt || order.createdAt,
      status: order.workflow.handcraft.status,
      details: 'Handwork and embellishments',
      metadata: {
        assignedTo: order.workflow.handcraft.assignedTo || 'Not assigned',
        status: order.workflow.handcraft.status
      }
    }] : []),
    {
      stage: order.status === 'delivered' ? 'Delivered' : 'Ready for Delivery',
      icon: order.status === 'delivered' ? Home : Truck,
      timestamp: order.updatedAt,
      status: order.status === 'delivered' ? 'completed' : order.status === 'completed' ? 'in-progress' : 'pending',
      details: order.status === 'delivered' 
        ? 'Product delivered to customer' 
        : order.status === 'completed'
          ? 'Ready for delivery'
          : 'Awaiting completion',
      metadata: {
        status: order.status
      }
    }
  ];

  return (
    <div className="min-h-screen bg-[#111827] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <MapPin className="text-purple-400" size={28} />
              Fabric Journey Traceability
            </h2>
            <p className="text-gray-400 mt-1">{order.invoiceNumber} - {order.customerName}</p>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-900 border-gray-800 text-gray-300"
          >
            <X size={16} className="mr-2" />
            Close
          </Button>
        </div>

        {/* Order Summary Card */}
        <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-6 mb-8">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-gray-400 mb-1">Invoice Number</div>
              <div className="text-white font-semibold">{order.invoiceNumber}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Customer</div>
              <div className="text-white font-semibold">{order.customerName}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Fabric</div>
              <div className="text-white font-semibold">{order.fabric.type}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Total Amount</div>
              <div className="text-white font-semibold">₹{order.totalAmount.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-800" />

          {/* Timeline Items */}
          <div className="space-y-6">
            {timeline.map((item, index) => {
              const Icon = item.icon;
              const isCompleted = item.status === 'completed';
              const isInProgress = item.status === 'in-progress';
              const isPending = item.status === 'pending';

              return (
                <div key={index} className="relative pl-20">
                  {/* Icon */}
                  <div className={`absolute left-0 w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-green-500/20 border-green-500'
                      : isInProgress
                        ? 'bg-blue-500/20 border-blue-500'
                        : 'bg-gray-800 border-gray-700'
                  }`}>
                    <Icon
                      size={24}
                      className={
                        isCompleted
                          ? 'text-green-400'
                          : isInProgress
                            ? 'text-blue-400'
                            : 'text-gray-600'
                      }
                    />
                  </div>

                  {/* Content */}
                  <div className={`bg-gray-900 border-2 rounded-xl p-6 transition-all ${
                    isCompleted
                      ? 'border-green-500/30'
                      : isInProgress
                        ? 'border-blue-500/30'
                        : 'border-gray-800'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{item.stage}</h3>
                        <p className="text-sm text-gray-400">{item.details}</p>
                      </div>
                      <Badge className={
                        isCompleted
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : isInProgress
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            : 'bg-gray-800 text-gray-500 border-gray-700'
                      }>
                        {isCompleted ? '✓ Completed' : isInProgress ? '⏳ In Progress' : '○ Pending'}
                      </Badge>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-800">
                      {Object.entries(item.metadata).map(([key, value]) => (
                        <div key={key}>
                          <div className="text-xs text-gray-500 capitalize mb-1">{key.replace(/([A-Z])/g, ' $1')}</div>
                          <div className="text-sm text-white font-medium">{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                      <Clock size={12} />
                      {new Date(item.timestamp).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>

                  {/* Connector Arrow */}
                  {index < timeline.length - 1 && (
                    <div className="absolute left-8 -bottom-3 flex items-center justify-center">
                      <ArrowRight
                        size={20}
                        className={`transform rotate-90 ${
                          isCompleted ? 'text-green-500' : 'text-gray-700'
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Journey Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {timeline.filter(t => t.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-500 mt-1">Completed Stages</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {timeline.filter(t => t.status === 'in-progress').length}
              </div>
              <div className="text-xs text-gray-500 mt-1">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">
                {timeline.filter(t => t.status === 'pending').length}
              </div>
              <div className="text-xs text-gray-500 mt-1">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {Math.round((timeline.filter(t => t.status === 'completed').length / timeline.length) * 100)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Completion</div>
            </div>
          </div>
        </div>

        {/* Customization Details */}
        {(order.customization.lace || order.customization.dyeing) && (
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Customization Details</h3>
            <div className="grid grid-cols-2 gap-6">
              {order.customization.lace && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Lace</div>
                  <div className="text-white font-medium">{order.customization.lace.style}</div>
                  <div className="text-xs text-gray-400 mt-1">Width: {order.customization.lace.width}</div>
                </div>
              )}
              {order.customization.dyeing && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Dyeing</div>
                  <div className="text-white font-medium">{order.customization.dyeing.type}</div>
                  <div className="flex gap-2 mt-2">
                    {order.customization.dyeing.colors.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-8 h-8 rounded border-2 border-gray-700"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
