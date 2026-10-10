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

interface StudioOrderCardProps {
  order: StudioOrder;
  onViewTrace: () => void;
  onUpdate: (order: StudioOrder) => void;
}

const STATUS_CONFIG = {
  pending: { color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', label: 'Pending', icon: Clock },
  'in-progress': { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'In Progress', icon: Play },
  completed: { color: 'bg-green-500/10 text-[var(--erp-money-positive)] border-green-500/20', label: 'Completed', icon: CheckCircle },
  delivered: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Delivered', icon: Check }
};

const WORKFLOW_STATUS_CONFIG = {
  pending: { color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', label: 'Pending', icon: Clock },
  'in-progress': { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'In Progress', icon: Play },
  completed: { color: 'bg-green-500/10 text-[var(--erp-money-positive)] border-green-500/20', label: 'Completed', icon: CheckCircle }
};

export const StudioOrderCard: React.FC<StudioOrderCardProps> = ({ order, onViewTrace, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<{ dept: string; status: string } | null>(null);

  const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
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
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-border transition-all">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold text-foreground">{order.invoiceNumber}</h3>
              <Badge className={`${statusConfig.color} border`}>
                <StatusIcon size={12} className="mr-1" />
                {statusConfig.label}
              </Badge>
              <Badge className="bg-muted text-muted-foreground border-border text-xs">
                {progress.completed}/{progress.total} Steps
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
            <div className="text-2xl font-bold text-foreground mb-1">₹{order.totalAmount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{new Date(order.date).toLocaleDateString('en-GB')}</div>
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
            className="bg-muted border-border text-muted-foreground hover:bg-gray-750"
          >
            {isExpanded ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
            {isExpanded ? 'Hide' : 'Show'} Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewTrace}
            className="bg-muted border-border text-muted-foreground hover:bg-gray-750"
          >
            <Eye size={14} className="mr-1" />
            View Trace
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/50 p-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Fabric Details */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Fabric Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="text-foreground">{order.fabric.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="text-foreground">{order.fabric.quantity} meters</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="text-foreground">₹{order.fabric.price.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Customization */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Customization</h4>
              <div className="space-y-2 text-sm">
                {order.customization.lace && (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                      Lace: {order.customization.lace.style}
                    </Badge>
                  </div>
                )}
                {order.customization.dyeing && (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                      Dyeing: {order.customization.dyeing.type}
                    </Badge>
                  </div>
                )}
                <div className="flex gap-2">
                  {order.customization.colors.primary && (
                    <div
                      className="w-8 h-8 rounded border-2 border-border"
                      style={{ backgroundColor: order.customization.colors.primary }}
                      title="Primary Color"
                    />
                  )}
                  {order.customization.colors.secondary && (
                    <div
                      className="w-8 h-8 rounded border-2 border-border"
                      style={{ backgroundColor: order.customization.colors.secondary }}
                      title="Secondary Color"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Timeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="text-foreground">{new Date(order.createdAt).toLocaleString('en-GB')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated:</span>
                  <span className="text-foreground">{new Date(order.updatedAt).toLocaleString('en-GB')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Worker Modal */}
      {showAssignModal && (
        <div className="border-t border-border bg-accent/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Assign Worker - {showAssignModal.dept}</h4>
              <p className="text-xs text-muted-foreground">Select a worker to assign this task</p>
            </div>
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleWorkflowUpdate(showAssignModal.dept as any, 'in-progress', e.target.value);
                  }
                }}
                className="px-3 py-1.5 bg-card border border-border rounded text-foreground text-sm"
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
                className="bg-card border-border text-muted-foreground"
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
  const config = WORKFLOW_STATUS_CONFIG[status as keyof typeof WORKFLOW_STATUS_CONFIG] ?? WORKFLOW_STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  return (
    <div className={`p-4 rounded-lg border-2 ${config.color} transition-all`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} />
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <StatusIcon size={14} />
        <span className="text-xs">{config.label}</span>
      </div>
      {assignedTo && (
        <div className="text-xs text-muted-foreground mb-2">
          Assigned: {assignedTo}
        </div>
      )}
      <div className="flex gap-1">
        {status === 'pending' && (
          <button
            onClick={onAssign}
            className="flex-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-xs text-blue-400 transition-all"
          >
            Assign
          </button>
        )}
        {status === 'in-progress' && (
          <button
            onClick={onComplete}
            className="flex-1 px-2 py-1 bg-green-500/20 hover:bg-green-500/30 rounded text-xs text-[var(--erp-money-positive)] transition-all"
          >
            Complete
          </button>
        )}
        {status === 'completed' && (
          <div className="flex-1 px-2 py-1 bg-green-500/20 rounded text-xs text-[var(--erp-money-positive)] text-center">
            ✓ Done
          </div>
        )}
      </div>
    </div>
  );
};
