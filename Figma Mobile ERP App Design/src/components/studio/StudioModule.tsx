import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { User } from '../../App';
import { StudioDashboard, type StudioOrder, type StudioStage } from './StudioDashboard';
import { StudioOrderDetail } from './StudioOrderDetail';
import { StudioStageAssignment } from './StudioStageAssignment';

interface StudioModuleProps {
  onBack: () => void;
  user: User;
}

type View = 'dashboard' | 'order-detail' | 'add-stage' | 'edit-stage' | 'update-status' | 'invoice' | 'shipment';

export function StudioModule({ onBack, user }: StudioModuleProps) {
  const [view, setView] = useState<View>('dashboard');
  const [selectedOrder, setSelectedOrder] = useState<StudioOrder | null>(null);
  const [selectedStage, setSelectedStage] = useState<StudioStage | null>(null);

  // Mock Studio Orders
  const [orders, setOrders] = useState<StudioOrder[]>([
    {
      id: '1',
      orderNumber: 'STD-0001',
      customerName: 'Ayesha Khan',
      productName: 'Bridal Lehenga - Custom Embroidery',
      totalAmount: 85000,
      createdDate: '2026-01-15',
      status: 'in-progress',
      currentStage: 'Dyeing',
      completedStages: 1,
      totalStages: 4,
      stages: [
        {
          id: 's1',
          name: 'Premium Dyeing',
          type: 'dyeing',
          assignedTo: 'Master Ali (Dyeing)',
          internalCost: 3000,
          customerCharge: 5000,
          expectedDate: '2026-01-18',
          status: 'completed',
          startedDate: '2026-01-15',
          completedDate: '2026-01-17',
        },
        {
          id: 's2',
          name: 'Expert Stitching',
          type: 'stitching',
          assignedTo: 'Faisal Ahmed (Stitching)',
          internalCost: 8000,
          customerCharge: 15000,
          expectedDate: '2026-01-22',
          status: 'in-progress',
          startedDate: '2026-01-18',
        },
        {
          id: 's3',
          name: 'Handwork & Adda',
          type: 'handwork',
          assignedTo: 'Sana Bibi (Handwork)',
          internalCost: 5000,
          customerCharge: 10000,
          expectedDate: '2026-01-25',
          status: 'pending',
        },
        {
          id: 's4',
          name: 'Final Finishing',
          type: 'finishing',
          assignedTo: 'Usman Tailor (Finishing)',
          internalCost: 2000,
          customerCharge: 3000,
          expectedDate: '2026-01-27',
          status: 'pending',
        },
      ],
    },
    {
      id: '2',
      orderNumber: 'STD-0002',
      customerName: 'Fatima Ali',
      productName: 'Wedding Dress - Luxury Collection',
      totalAmount: 120000,
      createdDate: '2026-01-10',
      status: 'ready',
      currentStage: 'Ready for Invoice',
      completedStages: 5,
      totalStages: 5,
      stages: [
        {
          id: 's5',
          name: 'Dyeing Work',
          type: 'dyeing',
          assignedTo: 'Master Ali (Dyeing)',
          internalCost: 4000,
          customerCharge: 7000,
          expectedDate: '2026-01-12',
          status: 'completed',
          startedDate: '2026-01-10',
          completedDate: '2026-01-11',
        },
        {
          id: 's6',
          name: 'Premium Stitching',
          type: 'stitching',
          assignedTo: 'Faisal Ahmed (Stitching)',
          internalCost: 12000,
          customerCharge: 20000,
          expectedDate: '2026-01-15',
          status: 'completed',
          startedDate: '2026-01-12',
          completedDate: '2026-01-14',
        },
        {
          id: 's7',
          name: 'Premium Embroidery',
          type: 'embroidery',
          assignedTo: 'Ayesha Khan (Embroidery)',
          internalCost: 15000,
          customerCharge: 30000,
          expectedDate: '2026-01-18',
          status: 'completed',
          startedDate: '2026-01-15',
          completedDate: '2026-01-17',
        },
        {
          id: 's8',
          name: 'Handwork Details',
          type: 'handwork',
          assignedTo: 'Sana Bibi (Handwork)',
          internalCost: 8000,
          customerCharge: 15000,
          expectedDate: '2026-01-20',
          status: 'completed',
          startedDate: '2026-01-18',
          completedDate: '2026-01-19',
        },
        {
          id: 's9',
          name: 'Quality Check & Finishing',
          type: 'quality-check',
          assignedTo: 'QA Team',
          internalCost: 2000,
          customerCharge: 3000,
          expectedDate: '2026-01-21',
          status: 'completed',
          startedDate: '2026-01-20',
          completedDate: '2026-01-21',
        },
      ],
    },
    {
      id: '3',
      orderNumber: 'STD-0003',
      customerName: 'Zara Malik',
      productName: 'Party Dress - Custom Design',
      totalAmount: 45000,
      createdDate: '2026-01-18',
      status: 'pending',
      currentStage: 'Not Started',
      completedStages: 0,
      totalStages: 0,
      stages: [],
    },
  ]);

  // Dashboard View
  if (view === 'dashboard') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">Studio Production</h1>
              <p className="text-xs text-white/80">Production pipeline management</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <StudioDashboard
            orders={orders}
            onOrderClick={(order) => {
              setSelectedOrder(order);
              setView('order-detail');
            }}
          />
        </div>
      </div>
    );
  }

  // Order Detail View
  if (view === 'order-detail' && selectedOrder) {
    return (
      <StudioOrderDetail
        order={selectedOrder}
        onBack={() => {
          setView('dashboard');
          setSelectedOrder(null);
        }}
        onAddStage={() => {
          setSelectedStage(null);
          setView('add-stage');
        }}
        onEditStage={(stage) => {
          setSelectedStage(stage);
          setView('edit-stage');
        }}
        onUpdateStatus={(stage) => {
          setSelectedStage(stage);
          setView('update-status');
        }}
        onGenerateInvoice={() => {
          setView('invoice');
        }}
        onShipment={() => {
          setView('shipment');
        }}
      />
    );
  }

  // Add/Edit Stage View
  if ((view === 'add-stage' || view === 'edit-stage') && selectedOrder) {
    return (
      <StudioStageAssignment
        onBack={() => setView('order-detail')}
        onComplete={(stageData) => {
          // In real app, save to backend
          console.log('Stage data:', stageData);
          
          // Update local state
          if (view === 'add-stage') {
            const newStage: StudioStage = {
              id: `s${Date.now()}`,
              ...stageData as StudioStage,
            };
            
            setOrders(orders.map(o => 
              o.id === selectedOrder.id
                ? {
                    ...o,
                    stages: [...o.stages, newStage],
                    totalStages: o.totalStages + 1,
                    status: o.status === 'pending' ? 'in-progress' : o.status,
                  }
                : o
            ));
          }
          
          setView('order-detail');
        }}
        existingStage={selectedStage || undefined}
      />
    );
  }

  // Update Status View
  if (view === 'update-status' && selectedOrder && selectedStage) {
    const handleStatusUpdate = (newStatus: 'in-progress' | 'completed') => {
      const now = new Date().toISOString().split('T')[0];
      
      setOrders(orders.map(o => {
        if (o.id === selectedOrder.id) {
          const updatedStages = o.stages.map(s => 
            s.id === selectedStage.id
              ? {
                  ...s,
                  status: newStatus,
                  startedDate: newStatus === 'in-progress' && !s.startedDate ? now : s.startedDate,
                  completedDate: newStatus === 'completed' ? now : undefined,
                }
              : s
          );
          
          const completedCount = updatedStages.filter(s => s.status === 'completed').length;
          const allCompleted = updatedStages.every(s => s.status === 'completed');
          
          return {
            ...o,
            stages: updatedStages,
            completedStages: completedCount,
            status: allCompleted ? 'ready' : 'in-progress',
            currentStage: allCompleted 
              ? 'Ready for Invoice'
              : updatedStages.find(s => s.status === 'in-progress')?.name || 'Pending',
          };
        }
        return o;
      }));
      
      setView('order-detail');
    };

    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('order-detail')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">Update Stage Status</h1>
              <p className="text-xs text-white/80">{selectedStage.name}</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-white mb-3">{selectedStage.name}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Assigned to</span>
                <span className="text-white">{selectedStage.assignedTo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Expected Date</span>
                <span className="text-white">{selectedStage.expectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Current Status</span>
                <span className="text-[#F59E0B] capitalize">{selectedStage.status}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {selectedStage.status === 'pending' && (
              <button
                onClick={() => handleStatusUpdate('in-progress')}
                className="w-full py-4 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] rounded-xl font-semibold"
              >
                Start Stage
              </button>
            )}
            
            {selectedStage.status === 'in-progress' && (
              <button
                onClick={() => handleStatusUpdate('completed')}
                className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl font-semibold"
              >
                Mark as Completed
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Invoice View (Placeholder)
  if (view === 'invoice' && selectedOrder) {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#10B981] to-[#059669] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('order-detail')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">Generate Invoice</h1>
              <p className="text-xs text-white/80">{selectedOrder.orderNumber}</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 mb-4">
            <h2 className="text-lg font-bold text-white mb-4">Studio Invoice</h2>
            
            <div className="space-y-3 mb-4 pb-4 border-b border-[#374151]">
              <p className="text-sm"><span className="text-[#9CA3AF]">Customer:</span> <span className="text-white font-medium">{selectedOrder.customerName}</span></p>
              <p className="text-sm"><span className="text-[#9CA3AF]">Product:</span> <span className="text-white">{selectedOrder.productName}</span></p>
            </div>

            <div className="space-y-2 mb-4">
              <h3 className="text-sm font-semibold text-[#8B5CF6] mb-2">Service Charges:</h3>
              {selectedOrder.stages.map(stage => (
                <div key={stage.id} className="flex justify-between text-sm">
                  <span className="text-[#9CA3AF]">{stage.name}</span>
                  <span className="text-white font-medium">Rs. {stage.customerCharge.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#374151]">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-white">Total Amount</span>
                <span className="text-2xl font-bold text-[#10B981]">
                  Rs. {selectedOrder.stages.reduce((sum, s) => sum + s.customerCharge, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              // Mark order as completed
              setOrders(orders.map(o => 
                o.id === selectedOrder.id ? { ...o, status: 'completed' } : o
              ));
              alert('Invoice generated successfully!');
              setView('order-detail');
            }}
            className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#059669] rounded-xl font-semibold"
          >
            Confirm & Generate Invoice
          </button>
        </div>
      </div>
    );
  }

  // Shipment View (Placeholder)
  if (view === 'shipment' && selectedOrder) {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('order-detail')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">Process Shipment</h1>
              <p className="text-xs text-white/80">{selectedOrder.orderNumber}</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-4">
            <p className="text-center text-[#9CA3AF] py-8">
              Shipment flow coming soon...
            </p>
          </div>

          <button
            onClick={() => {
              setOrders(orders.map(o => 
                o.id === selectedOrder.id ? { ...o, status: 'shipped' } : o
              ));
              alert('Order marked as shipped!');
              setView('dashboard');
              setSelectedOrder(null);
            }}
            className="w-full py-4 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] rounded-xl font-semibold"
          >
            Mark as Shipped
          </button>
        </div>
      </div>
    );
  }

  return null;
}