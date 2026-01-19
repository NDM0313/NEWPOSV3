import React, { useState } from 'react';
import { 
  ArrowLeft,
  Calendar,
  User,
  Phone,
  Package,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Palette,
  Scissors,
  Package2,
  Sparkles,
  Truck,
  Plus,
  Save,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { useNavigation } from '@/app/context/NavigationContext';
import { cn } from '../ui/utils';

type StepStatus = 'Pending' | 'Given' | 'Received';

interface ProductionStep {
  id: string;
  name: string;
  icon: any;
  assignedWorker: string;
  cost: number;
  givenDate: string;
  expectedReturnDate: string;
  status: StepStatus;
  notes?: string;
}

interface Accessory {
  id: string;
  name: string;
  internalCost: number;
  customerCharge: number;
  includeInBill: boolean;
}

interface StudioSaleDetail {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerMobile: string;
  productName: string;
  fabricType: string;
  meters: number;
  saleDate: string;
  deadline: string;
  totalCustomerPrice: number;
  productionSteps: ProductionStep[];
  accessories: Accessory[];
  shippingMethod?: string;
  shippingCost?: number;
}

// Mock data - Replace with real API call
const mockSaleDetail: StudioSaleDetail = {
  id: "1",
  invoiceNo: "INV-2026-0015",
  customerName: "Ayesha Khan",
  customerMobile: "+92 300 1234567",
  productName: "Bridal Lehenga",
  fabricType: "Silk Lawn - Red",
  meters: 5,
  saleDate: "2026-01-03",
  deadline: "2026-01-20",
  totalCustomerPrice: 15000,
  productionSteps: [
    {
      id: "1",
      name: "Dyeing",
      icon: Palette,
      assignedWorker: "Ali Dyer",
      cost: 2000,
      givenDate: "2026-01-04",
      expectedReturnDate: "2026-01-08",
      status: "Received",
      notes: "Deep red color required"
    },
    {
      id: "2",
      name: "Handwork",
      icon: Sparkles,
      assignedWorker: "Ahmed Handwork",
      cost: 3500,
      givenDate: "2026-01-09",
      expectedReturnDate: "2026-01-15",
      status: "Given",
      notes: "Golden thread embroidery"
    },
    {
      id: "3",
      name: "Stitching",
      icon: Scissors,
      assignedWorker: "",
      cost: 0,
      givenDate: "",
      expectedReturnDate: "",
      status: "Pending",
      notes: ""
    }
  ],
  accessories: [
    {
      id: "1",
      name: "Golden Lace (5m)",
      internalCost: 500,
      customerCharge: 800,
      includeInBill: true
    },
    {
      id: "2",
      name: "Buttons Set",
      internalCost: 200,
      customerCharge: 350,
      includeInBill: true
    }
  ],
  shippingMethod: "Local Delivery",
  shippingCost: 500
};

export const StudioSaleDetail = () => {
  const { setCurrentView } = useNavigation();
  const [saleDetail, setSaleDetail] = useState<StudioSaleDetail>(mockSaleDetail);
  const [editMode, setEditMode] = useState(false);
  
  // Accessory Modal States
  const [showAccessoryModal, setShowAccessoryModal] = useState(false);
  const [newAccessory, setNewAccessory] = useState({
    name: '',
    internalCost: 0,
    customerCharge: 0,
    includeInBill: true
  });
  
  // Shipping States
  const [showShippingForm, setShowShippingForm] = useState(!!saleDetail.shippingMethod);
  const [shippingData, setShippingData] = useState({
    method: saleDetail.shippingMethod || '',
    cost: saleDetail.shippingCost || 0
  });

  const getDeadlineStatus = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(saleDetail.deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'overdue', color: 'text-red-400', bgColor: 'bg-red-500/20' };
    if (diffDays === 0) return { status: 'today', color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
    if (diffDays <= 3) return { status: 'near', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    return { status: 'normal', color: 'text-green-400', bgColor: 'bg-green-500/20' };
  };

  const deadlineInfo = getDeadlineStatus();

  const getStatusBadge = (status: StepStatus) => {
    switch (status) {
      case 'Pending': return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-700' };
      case 'Given': return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-700' };
      case 'Received': return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-700' };
    }
  };

  const updateStepStatus = (stepId: string, newStatus: StepStatus) => {
    setSaleDetail(prev => ({
      ...prev,
      productionSteps: prev.productionSteps.map(step => 
        step.id === stepId ? { ...step, status: newStatus } : step
      )
    }));
  };

  const updateStepWorker = (stepId: string, worker: string) => {
    setSaleDetail(prev => ({
      ...prev,
      productionSteps: prev.productionSteps.map(step => 
        step.id === stepId ? { ...step, assignedWorker: worker } : step
      )
    }));
  };

  const updateStepCost = (stepId: string, cost: number) => {
    setSaleDetail(prev => ({
      ...prev,
      productionSteps: prev.productionSteps.map(step => 
        step.id === stepId ? { ...step, cost } : step
      )
    }));
  };

  const calculateTotalInternalCost = () => {
    const stepsCost = saleDetail.productionSteps.reduce((sum, step) => sum + step.cost, 0);
    const accessoriesCost = saleDetail.accessories.reduce((sum, acc) => sum + acc.internalCost, 0);
    const shippingCost = saleDetail.shippingCost || 0;
    return stepsCost + accessoriesCost + shippingCost;
  };

  const calculateProfit = () => {
    return saleDetail.totalCustomerPrice - calculateTotalInternalCost();
  };

  // Add Accessory
  const handleAddAccessory = () => {
    if (!newAccessory.name.trim()) {
      alert('Please enter accessory name');
      return;
    }
    
    const accessory: Accessory = {
      id: Date.now().toString(),
      name: newAccessory.name,
      internalCost: newAccessory.internalCost,
      customerCharge: newAccessory.customerCharge,
      includeInBill: newAccessory.includeInBill
    };
    
    setSaleDetail(prev => ({
      ...prev,
      accessories: [...prev.accessories, accessory]
    }));
    
    // Reset form
    setNewAccessory({
      name: '',
      internalCost: 0,
      customerCharge: 0,
      includeInBill: true
    });
    setShowAccessoryModal(false);
  };

  // Delete Accessory
  const handleDeleteAccessory = (id: string) => {
    setSaleDetail(prev => ({
      ...prev,
      accessories: prev.accessories.filter(acc => acc.id !== id)
    }));
  };

  // Update Shipping
  const handleUpdateShipping = () => {
    setSaleDetail(prev => ({
      ...prev,
      shippingMethod: shippingData.method,
      shippingCost: shippingData.cost
    }));
  };

  // Remove Shipping
  const handleRemoveShipping = () => {
    setSaleDetail(prev => ({
      ...prev,
      shippingMethod: undefined,
      shippingCost: undefined
    }));
    setShowShippingForm(false);
    setShippingData({ method: '', cost: 0 });
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView('studio')}
            className="border-gray-700 text-gray-300"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to List
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">{saleDetail.invoiceNo}</h1>
            <p className="text-sm text-gray-400 mt-1">Studio Sale Detail</p>
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => setEditMode(!editMode)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save size={16} className="mr-2" />
          {editMode ? 'Save Changes' : 'Edit'}
        </Button>
      </div>

      {/* MAIN INFO CARD */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="grid grid-cols-4 gap-6">
          {/* Customer Info */}
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Customer</p>
            <div className="flex items-center gap-2 mb-1">
              <User size={16} className="text-gray-400" />
              <p className="text-white font-medium">{saleDetail.customerName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-gray-500" />
              <p className="text-sm text-gray-400">{saleDetail.customerMobile}</p>
            </div>
          </div>

          {/* Product Info */}
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Product / Fabric</p>
            <div className="flex items-center gap-2 mb-1">
              <Package size={16} className="text-gray-400" />
              <p className="text-white font-medium">{saleDetail.productName}</p>
            </div>
            <p className="text-sm text-gray-400">{saleDetail.fabricType} ({saleDetail.meters}m)</p>
          </div>

          {/* Dates */}
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Sale Date</p>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-gray-400" />
              <p className="text-white">{format(new Date(saleDetail.saleDate), 'dd MMM yyyy')}</p>
            </div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Deadline</p>
            <div className="flex items-center gap-2">
              <Clock size={16} className={deadlineInfo.color} />
              <p className={cn("font-medium", deadlineInfo.color)}>
                {format(new Date(saleDetail.deadline), 'dd MMM yyyy')}
              </p>
            </div>
          </div>

          {/* Financial Summary */}
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Financial Summary</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Customer Price</p>
                <p className="text-white font-semibold">Rs {saleDetail.totalCustomerPrice.toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Internal Cost</p>
                <p className="text-orange-400 font-semibold">Rs {calculateTotalInternalCost().toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                <p className="text-xs text-gray-400">Profit</p>
                <p className={cn("font-bold", calculateProfit() >= 0 ? "text-green-400" : "text-red-400")}>
                  Rs {calculateProfit().toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRODUCTION TIMELINE */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Production Timeline</h2>
        <div className="space-y-4">
          {saleDetail.productionSteps.map((step, index) => {
            const statusBadge = getStatusBadge(step.status);
            const StepIcon = step.icon;
            
            return (
              <div 
                key={step.id} 
                className={cn(
                  "bg-gray-900 border rounded-xl p-5 transition-all",
                  step.status === 'Pending' ? "border-gray-800" : 
                  step.status === 'Given' ? "border-blue-700/50 bg-blue-900/5" : 
                  "border-green-700/50 bg-green-900/5"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center",
                      step.status === 'Pending' ? "bg-gray-700/30" :
                      step.status === 'Given' ? "bg-blue-500/20" :
                      "bg-green-500/20"
                    )}>
                      <StepIcon size={20} className={
                        step.status === 'Pending' ? "text-gray-400" :
                        step.status === 'Given' ? "text-blue-400" :
                        "text-green-400"
                      } />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{step.name}</h3>
                      <p className="text-xs text-gray-500">Step {index + 1}</p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn("text-[11px] px-3 py-1", statusBadge.bg, statusBadge.text, statusBadge.border)}
                  >
                    {step.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {/* Assigned Worker */}
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Assigned Worker</label>
                    {editMode || step.status === 'Pending' ? (
                      <Input
                        type="text"
                        value={step.assignedWorker}
                        onChange={(e) => updateStepWorker(step.id, e.target.value)}
                        placeholder="Select worker..."
                        className="bg-gray-950 border-gray-700 text-white h-9 text-sm"
                      />
                    ) : (
                      <p className="text-white font-medium">{step.assignedWorker || '—'}</p>
                    )}
                  </div>

                  {/* Cost */}
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Cost (Rs)</label>
                    {editMode || step.status === 'Pending' ? (
                      <Input
                        type="number"
                        value={step.cost || ''}
                        onChange={(e) => updateStepCost(step.id, Number(e.target.value))}
                        placeholder="0"
                        className="bg-gray-950 border-gray-700 text-white h-9 text-sm"
                      />
                    ) : (
                      <p className="text-white font-medium">Rs {step.cost.toLocaleString()}</p>
                    )}
                  </div>

                  {/* Given Date */}
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Given Date</label>
                    <p className="text-white text-sm">
                      {step.givenDate ? format(new Date(step.givenDate), 'dd MMM yyyy') : '—'}
                    </p>
                  </div>

                  {/* Expected Return */}
                  <div>
                    <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Expected Return</label>
                    <p className="text-white text-sm">
                      {step.expectedReturnDate ? format(new Date(step.expectedReturnDate), 'dd MMM yyyy') : '—'}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {step.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 uppercase font-medium mb-1">Notes</p>
                    <p className="text-sm text-gray-400">{step.notes}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4 flex items-center gap-2">
                  {step.status === 'Pending' && step.assignedWorker && (
                    <Button
                      size="sm"
                      onClick={() => updateStepStatus(step.id, 'Given')}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Mark as Given
                    </Button>
                  )}
                  {step.status === 'Given' && (
                    <Button
                      size="sm"
                      onClick={() => updateStepStatus(step.id, 'Received')}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 size={14} className="mr-2" />
                      Mark as Received
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ACCESSORIES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Accessories & Extra Charges</h2>
          <Button 
            size="sm" 
            variant="outline" 
            className="border-gray-700 text-gray-300"
            onClick={() => setShowAccessoryModal(true)}
          >
            <Plus size={14} className="mr-2" />
            Add Accessory
          </Button>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-950 border-b border-gray-800">
              <tr>
                <th className="p-4 text-left text-gray-400 font-medium">Item Name</th>
                <th className="p-4 text-right text-gray-400 font-medium">Internal Cost</th>
                <th className="p-4 text-right text-gray-400 font-medium">Customer Charge</th>
                <th className="p-4 text-center text-gray-400 font-medium">Include in Bill</th>
                <th className="p-4 text-center text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {saleDetail.accessories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No accessories added yet
                  </td>
                </tr>
              ) : saleDetail.accessories.map(acc => (
                <tr key={acc.id} className="hover:bg-gray-800/50">
                  <td className="p-4 text-white">{acc.name}</td>
                  <td className="p-4 text-right text-orange-400">Rs {acc.internalCost.toLocaleString()}</td>
                  <td className="p-4 text-right text-green-400">Rs {acc.customerCharge.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    {acc.includeInBill ? (
                      <CheckCircle2 size={16} className="text-green-400 mx-auto" />
                    ) : (
                      <X size={16} className="text-gray-600 mx-auto" />
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteAccessory(acc.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SHIPPING (OPTIONAL) */}
      {saleDetail.shippingMethod && (
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Shipping</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Truck size={20} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{saleDetail.shippingMethod}</p>
                <p className="text-xs text-gray-500">Delivery method</p>
              </div>
              <div className="text-right">
                <p className="text-white font-semibold">Rs {saleDetail.shippingCost?.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Shipping cost</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemoveShipping}
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SHIPPING BUTTON */}
      {!saleDetail.shippingMethod && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShippingForm(true)}
            className="border-gray-700 text-gray-300"
          >
            <Plus size={14} className="mr-2" />
            Add Shipping
          </Button>
        </div>
      )}

      {/* ACCESSORY MODAL */}
      {showAccessoryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Add Accessory</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAccessoryModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Item Name</label>
                <Input
                  type="text"
                  value={newAccessory.name}
                  onChange={(e) => setNewAccessory(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Golden Lace (5m)"
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Internal Cost (Rs)</label>
                <Input
                  type="number"
                  value={newAccessory.internalCost || ''}
                  onChange={(e) => setNewAccessory(prev => ({ ...prev, internalCost: Number(e.target.value) }))}
                  placeholder="0"
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Customer Charge (Rs)</label>
                <Input
                  type="number"
                  value={newAccessory.customerCharge || ''}
                  onChange={(e) => setNewAccessory(prev => ({ ...prev, customerCharge: Number(e.target.value) }))}
                  placeholder="0"
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeInBill"
                  checked={newAccessory.includeInBill}
                  onChange={(e) => setNewAccessory(prev => ({ ...prev, includeInBill: e.target.checked }))}
                  className="w-4 h-4 bg-gray-950 border-gray-700 rounded"
                />
                <label htmlFor="includeInBill" className="text-sm text-gray-300">Include in customer bill</label>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAccessoryModal(false)}
                className="flex-1 border-gray-700 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddAccessory}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus size={14} className="mr-2" />
                Add Accessory
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SHIPPING MODAL */}
      {showShippingForm && !saleDetail.shippingMethod && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Add Shipping</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowShippingForm(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Delivery Method</label>
                <Input
                  type="text"
                  value={shippingData.method}
                  onChange={(e) => setShippingData(prev => ({ ...prev, method: e.target.value }))}
                  placeholder="e.g., Local Delivery, TCS, Courier"
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Shipping Cost (Rs)</label>
                <Input
                  type="number"
                  value={shippingData.cost || ''}
                  onChange={(e) => setShippingData(prev => ({ ...prev, cost: Number(e.target.value) }))}
                  placeholder="0"
                  className="bg-gray-950 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowShippingForm(false)}
                className="flex-1 border-gray-700 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleUpdateShipping();
                  setShowShippingForm(false);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save size={14} className="mr-2" />
                Save Shipping
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};