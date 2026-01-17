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
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 
              className="text-2xl font-bold flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <MapPin 
                size={28}
                style={{ color: 'var(--color-wholesale)' }}
              />
              Fabric Journey Traceability
            </h2>
            <p 
              className="mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {order.invoiceNumber} - {order.customerName}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <X size={16} className="mr-2" />
            Close
          </Button>
        </div>

        {/* Order Summary Card */}
        <div 
          className="border rounded-xl p-6 mb-8"
          style={{
            background: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.3), rgba(59, 130, 246, 0.3))',
            borderColor: 'rgba(168, 85, 247, 0.3)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div 
                className="text-xs mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Invoice Number
              </div>
              <div 
                className="font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {order.invoiceNumber}
              </div>
            </div>
            <div>
              <div 
                className="text-xs mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Customer
              </div>
              <div 
                className="font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {order.customerName}
              </div>
            </div>
            <div>
              <div 
                className="text-xs mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Fabric
              </div>
              <div 
                className="font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {order.fabric.type}
              </div>
            </div>
            <div>
              <div 
                className="text-xs mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Total Amount
              </div>
              <div 
                className="font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                ₹{order.totalAmount.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical Line */}
          <div 
            className="absolute left-8 top-0 bottom-0 w-0.5"
            style={{ backgroundColor: 'var(--color-border-primary)' }}
          />

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
                  <div 
                    className="absolute left-0 w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: isCompleted
                        ? 'rgba(34, 197, 94, 0.2)'
                        : isInProgress
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'var(--color-bg-card)',
                      borderColor: isCompleted
                        ? 'var(--color-success)'
                        : isInProgress
                          ? 'var(--color-primary)'
                          : 'var(--color-border-secondary)',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    <Icon
                      size={24}
                      style={{
                        color: isCompleted
                          ? 'var(--color-success)'
                          : isInProgress
                            ? 'var(--color-primary)'
                            : 'var(--color-text-tertiary)'
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div 
                    className="border-2 rounded-xl p-6 transition-all"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: isCompleted
                        ? 'rgba(34, 197, 94, 0.3)'
                        : isInProgress
                          ? 'rgba(59, 130, 246, 0.3)'
                          : 'var(--color-border-primary)',
                      borderRadius: 'var(--radius-xl)'
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 
                          className="text-lg font-bold mb-1"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {item.stage}
                        </h3>
                        <p 
                          className="text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {item.details}
                        </p>
                      </div>
                      <Badge 
                        style={{
                          backgroundColor: isCompleted
                            ? 'rgba(34, 197, 94, 0.2)'
                            : isInProgress
                              ? 'rgba(59, 130, 246, 0.2)'
                              : 'var(--color-bg-card)',
                          color: isCompleted
                            ? 'var(--color-success)'
                            : isInProgress
                              ? 'var(--color-primary)'
                              : 'var(--color-text-tertiary)',
                          borderColor: isCompleted
                            ? 'rgba(34, 197, 94, 0.3)'
                            : isInProgress
                              ? 'rgba(59, 130, 246, 0.3)'
                              : 'var(--color-border-secondary)'
                        }}
                      >
                        {isCompleted ? '✓ Completed' : isInProgress ? '⏳ In Progress' : '○ Pending'}
                      </Badge>
                    </div>

                    {/* Metadata */}
                    <div 
                      className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t"
                      style={{ borderTopColor: 'var(--color-border-primary)' }}
                    >
                      {Object.entries(item.metadata).map(([key, value]) => (
                        <div key={key}>
                          <div 
                            className="text-xs capitalize mb-1"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            {key.replace(/([A-Z])/g, ' $1')}
                          </div>
                          <div 
                            className="text-sm font-medium"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Timestamp */}
                    <div 
                      className="flex items-center gap-2 mt-4 text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
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
                        className="transform rotate-90"
                        style={{
                          color: isCompleted ? 'var(--color-success)' : 'var(--color-border-secondary)'
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div 
          className="mt-8 border rounded-xl p-6"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <h3 
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Journey Summary
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-success)' }}
              >
                {timeline.filter(t => t.status === 'completed').length}
              </div>
              <div 
                className="text-xs mt-1"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Completed Stages
              </div>
            </div>
            <div className="text-center">
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                {timeline.filter(t => t.status === 'in-progress').length}
              </div>
              <div 
                className="text-xs mt-1"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                In Progress
              </div>
            </div>
            <div className="text-center">
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {timeline.filter(t => t.status === 'pending').length}
              </div>
              <div 
                className="text-xs mt-1"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Pending
              </div>
            </div>
            <div className="text-center">
              <div 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-wholesale)' }}
              >
                {Math.round((timeline.filter(t => t.status === 'completed').length / timeline.length) * 100)}%
              </div>
              <div 
                className="text-xs mt-1"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Completion
              </div>
            </div>
          </div>
        </div>

        {/* Customization Details */}
        {(order.customization.lace || order.customization.dyeing) && (
          <div 
            className="mt-6 border rounded-xl p-6"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <h3 
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Customization Details
            </h3>
            <div className="grid grid-cols-2 gap-6">
              {order.customization.lace && (
                <div>
                  <div 
                    className="text-sm mb-2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Lace
                  </div>
                  <div 
                    className="font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {order.customization.lace.style}
                  </div>
                  <div 
                    className="text-xs mt-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Width: {order.customization.lace.width}
                  </div>
                </div>
              )}
              {order.customization.dyeing && (
                <div>
                  <div 
                    className="text-sm mb-2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Dyeing
                  </div>
                  <div 
                    className="font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {order.customization.dyeing.type}
                  </div>
                  <div className="flex gap-2 mt-2">
                    {order.customization.dyeing.colors.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-8 h-8 rounded border-2"
                        style={{
                          backgroundColor: color,
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-sm)'
                        }}
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
