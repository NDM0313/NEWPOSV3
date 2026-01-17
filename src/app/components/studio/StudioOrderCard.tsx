import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  User, 
  Phone, 
  Package,
  Droplet,
  Scissors,
  Hand,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Play,
  Check,
  ArrowRight
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { StudioOrder } from './StudioDashboard';
import { formatDate } from '../../../utils/dateFormat';

interface StudioOrderCardProps {
  order: StudioOrder;
  onViewTrace: () => void;
  onUpdate: (order: StudioOrder) => void;
}

const STATUS_CONFIG = {
  pending: { 
    style: {
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
      color: 'var(--color-warning)',
      borderColor: 'rgba(249, 115, 22, 0.2)'
    },
    label: 'Pending', 
    icon: Clock 
  },
  'in-progress': { 
    style: {
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      color: 'var(--color-primary)',
      borderColor: 'rgba(59, 130, 246, 0.2)'
    },
    label: 'In Progress', 
    icon: Play 
  },
  completed: { 
    style: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      color: 'var(--color-success)',
      borderColor: 'rgba(16, 185, 129, 0.2)'
    },
    label: 'Completed', 
    icon: CheckCircle 
  },
  delivered: { 
    style: {
      backgroundColor: 'rgba(147, 51, 234, 0.1)',
      color: 'var(--color-wholesale)',
      borderColor: 'rgba(147, 51, 234, 0.2)'
    },
    label: 'Delivered', 
    icon: Check 
  }
};

const WORKFLOW_STATUS_CONFIG = {
  pending: { 
    style: {
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
      color: 'var(--color-warning)',
      borderColor: 'rgba(249, 115, 22, 0.2)'
    },
    label: 'Pending', 
    icon: Clock 
  },
  'in-progress': { 
    style: {
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      color: 'var(--color-primary)',
      borderColor: 'rgba(59, 130, 246, 0.2)'
    },
    label: 'In Progress', 
    icon: Play 
  },
  completed: { 
    style: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      color: 'var(--color-success)',
      borderColor: 'rgba(16, 185, 129, 0.2)'
    },
    label: 'Completed', 
    icon: CheckCircle 
  }
};

export const StudioOrderCard: React.FC<StudioOrderCardProps> = ({ order, onViewTrace, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<{ dept: string; status: string } | null>(null);

  const statusConfig = STATUS_CONFIG[order.status];
  const StatusIcon = statusConfig.icon;

  const handleWorkflowUpdate = (dept: 'dyeing' | 'tailoring' | 'handcraft', status: 'pending' | 'in-progress' | 'completed', assignedTo?: string) => {
    const updatedOrder = {
      ...order,
      workflow: {
        ...order.workflow,
        [dept]: {
          ...order.workflow[dept],
          status,
          ...(assignedTo && { assignedTo }),
          ...(status === 'completed' && { completedAt: new Date().toISOString() })
        }
      },
      updatedAt: new Date().toISOString()
    };

    // Auto-update overall status
    const allCompleted = Object.values(updatedOrder.workflow).every(w => w?.status === 'completed');
    const anyInProgress = Object.values(updatedOrder.workflow).some(w => w?.status === 'in-progress');
    
    if (allCompleted) {
      updatedOrder.status = 'completed';
    } else if (anyInProgress || status === 'in-progress') {
      updatedOrder.status = 'in-progress';
    }

    onUpdate(updatedOrder);
    setShowAssignModal(null);
  };

  const getWorkflowProgress = () => {
    const steps = Object.values(order.workflow).filter(w => w !== undefined);
    const completed = steps.filter(w => w?.status === 'completed').length;
    return { completed, total: steps.length };
  };

  const progress = getWorkflowProgress();

  return (
    <div 
      className="border rounded-xl overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border-primary)',
        borderRadius: 'var(--radius-xl)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
      }}
    >
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 
                className="text-lg font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {order.invoiceNumber}
              </h3>
              <Badge 
                className="border"
                style={statusConfig.style}
              >
                <StatusIcon size={12} className="mr-1" />
                {statusConfig.label}
              </Badge>
              <Badge 
                className="text-xs"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-secondary)',
                  borderColor: 'var(--color-border-secondary)'
                }}
              >
                {progress.completed}/{progress.total} Steps
              </Badge>
            </div>
            <div 
              className="flex items-center gap-4 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <div className="flex items-center gap-2">
                <User size={14} />
                {order.customerName}
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} />
                {order.customerPhone}
              </div>
              <div className="flex items-center gap-2">
                <Package size={14} />
                {order.fabric.type} ({order.fabric.quantity}m)
              </div>
            </div>
          </div>
          <div className="text-right">
            <div 
              className="text-2xl font-bold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              ₹{order.totalAmount.toLocaleString()}
            </div>
            <div 
              className="text-xs"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {formatDate(new Date(order.date))}
            </div>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Dyeing */}
          {order.workflow.dyeing && (
            <WorkflowStep
              icon={Droplet}
              label="Dyeing Unit"
              status={order.workflow.dyeing.status}
              assignedTo={order.workflow.dyeing.assignedTo}
              onStart={() => handleWorkflowUpdate('dyeing', 'in-progress')}
              onComplete={() => handleWorkflowUpdate('dyeing', 'completed')}
              onAssign={() => setShowAssignModal({ dept: 'dyeing', status: order.workflow.dyeing?.status || 'pending' })}
            />
          )}

          {/* Tailoring */}
          {order.workflow.tailoring && (
            <WorkflowStep
              icon={Scissors}
              label="Tailor Unit"
              status={order.workflow.tailoring.status}
              assignedTo={order.workflow.tailoring.assignedTo}
              onStart={() => handleWorkflowUpdate('tailoring', 'in-progress')}
              onComplete={() => handleWorkflowUpdate('tailoring', 'completed')}
              onAssign={() => setShowAssignModal({ dept: 'tailoring', status: order.workflow.tailoring?.status || 'pending' })}
            />
          )}

          {/* Handcraft */}
          {order.workflow.handcraft && (
            <WorkflowStep
              icon={Hand}
              label="Handcraft Unit"
              status={order.workflow.handcraft.status}
              assignedTo={order.workflow.handcraft.assignedTo}
              onStart={() => handleWorkflowUpdate('handcraft', 'in-progress')}
              onComplete={() => handleWorkflowUpdate('handcraft', 'completed')}
              onAssign={() => setShowAssignModal({ dept: 'handcraft', status: order.workflow.handcraft?.status || 'pending' })}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
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
            {isExpanded ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
            {isExpanded ? 'Hide' : 'Show'} Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewTrace}
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
            <Eye size={14} className="mr-1" />
            View Trace
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div 
          className="border-t p-6"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(31, 41, 55, 0.5)'
          }}
        >
          <div className="grid grid-cols-3 gap-6">
            {/* Fabric Details */}
            <div>
              <h4 
                className="text-sm font-semibold mb-3"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Fabric Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Type:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{order.fabric.type}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Quantity:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{order.fabric.quantity} meters</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Price:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>₹{order.fabric.price.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Customization */}
            <div>
              <h4 
                className="text-sm font-semibold mb-3"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Customization
              </h4>
              <div className="space-y-2 text-sm">
                {order.customization.lace && (
                  <div className="flex items-center gap-2">
                    <Badge 
                      className="text-xs"
                      style={{
                        backgroundColor: 'rgba(147, 51, 234, 0.2)',
                        color: 'var(--color-wholesale)',
                        borderColor: 'rgba(147, 51, 234, 0.3)'
                      }}
                    >
                      Lace: {order.customization.lace.style}
                    </Badge>
                  </div>
                )}
                {order.customization.dyeing && (
                  <div className="flex items-center gap-2">
                    <Badge 
                      className="text-xs"
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        color: 'var(--color-primary)',
                        borderColor: 'rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      Dyeing: {order.customization.dyeing.type}
                    </Badge>
                  </div>
                )}
                <div className="flex gap-2">
                  {order.customization.colors.primary && (
                    <div
                      className="w-8 h-8 rounded border-2"
                      style={{ 
                        backgroundColor: order.customization.colors.primary,
                        borderColor: 'var(--color-border-secondary)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                      title="Primary Color"
                    />
                  )}
                  {order.customization.colors.secondary && (
                    <div
                      className="w-8 h-8 rounded border-2"
                      style={{ 
                        backgroundColor: order.customization.colors.secondary,
                        borderColor: 'var(--color-border-secondary)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                      title="Secondary Color"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 
                className="text-sm font-semibold mb-3"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Timeline
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Created:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{new Date(order.createdAt).toLocaleString('en-GB')}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-tertiary)' }}>Updated:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{new Date(order.updatedAt).toLocaleString('en-GB')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Worker Modal */}
      {showAssignModal && (
        <div 
          className="border-t p-4"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(31, 41, 55, 0.3)'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 
                className="text-sm font-semibold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Assign Worker - {showAssignModal.dept}
              </h4>
              <p 
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Select a worker to assign this task
              </p>
            </div>
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleWorkflowUpdate(showAssignModal.dept as any, 'in-progress', e.target.value);
                  }
                }}
                className="px-3 py-1.5 border rounded text-sm"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <option value="">Select Worker</option>
                <option value="Ali Hassan">Ali Hassan</option>
                <option value="Fatima Ahmed">Fatima Ahmed</option>
                <option value="Ahmad Raza">Ahmad Raza</option>
                <option value="Maryam Khan">Maryam Khan</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAssignModal(null)}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface WorkflowStepProps {
  icon: any;
  label: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo?: string;
  onStart: () => void;
  onComplete: () => void;
  onAssign: () => void;
}

const WorkflowStep: React.FC<WorkflowStepProps> = ({ icon: Icon, label, status, assignedTo, onStart, onComplete, onAssign }) => {
  const config = WORKFLOW_STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  return (
    <div 
      className="p-4 rounded-lg border-2 transition-all"
      style={{
        ...config.style,
        borderWidth: '2px',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} style={{ color: 'var(--color-text-primary)' }} />
        <span 
          className="font-semibold text-sm"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <StatusIcon size={14} style={{ color: config.style.color }} />
        <span 
          className="text-xs"
          style={{ color: config.style.color }}
        >
          {config.label}
        </span>
      </div>
      {assignedTo && (
        <div 
          className="text-xs mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Assigned: {assignedTo}
        </div>
      )}
      <div className="flex gap-1">
        {status === 'pending' && (
          <button
            onClick={onAssign}
            className="flex-1 px-2 py-1 rounded text-xs transition-all"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: 'var(--color-primary)',
              borderRadius: 'var(--radius-sm)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
            }}
          >
            Assign
          </button>
        )}
        {status === 'in-progress' && (
          <button
            onClick={onComplete}
            className="flex-1 px-2 py-1 rounded text-xs transition-all"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: 'var(--color-success)',
              borderRadius: 'var(--radius-sm)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            }}
          >
            Complete
          </button>
        )}
        {status === 'completed' && (
          <div 
            className="flex-1 px-2 py-1 rounded text-xs text-center"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: 'var(--color-success)',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            ✓ Done
          </div>
        )}
      </div>
    </div>
  );
};
