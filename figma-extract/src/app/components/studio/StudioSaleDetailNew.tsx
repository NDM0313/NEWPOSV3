import React, { useState, useRef } from 'react';
import { 
  ArrowLeft,
  Calendar,
  User,
  Phone,
  DollarSign,
  Clock,
  CheckCircle2,
  Palette,
  Scissors,
  Sparkles,
  Save,
  Plus,
  Trash2,
  X,
  Eye,
  Package,
  Truck,
  ChevronDown,
  ChevronUp,
  Edit2,
  MoreVertical,
  History,
  RotateCcw,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle,
  Circle,
  ArrowRight,
  MapPin,
  ExternalLink,
  TrendingUp,
  CreditCard,
  Banknote,
  Users,
  FileText,
  AlertCircle,
  Upload,
  Camera,
  Paperclip,
  Image as ImageIcon,
  File,
  Undo2,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { useNavigation } from '@/app/context/NavigationContext';
import { cn } from '../ui/utils';

type SaleStatus = 'Draft' | 'In Progress' | 'Completed';
type StepStatus = 'Pending' | 'In Progress' | 'Completed';

interface Worker {
  id: string;
  name: string;
  department: string;
  phone: string;
  isActive: boolean;
}

interface AssignedWorker {
  id: string;
  workerId: string;
  workerName: string;
  role: string;
  cost: number;
}

interface ProductionStep {
  id: string;
  name: string;
  icon: any;
  order: number;
  assignedWorker: string; // Legacy - for backward compatibility
  workerId?: string; // Legacy
  assignedWorkers?: AssignedWorker[]; // NEW: Multiple workers support
  assignedDate: string;
  expectedCompletionDate: string;
  actualCompletionDate?: string;
  workerCost: number; // Legacy - total cost
  workerPaymentStatus?: 'Payable' | 'Pending' | 'Paid'; // ERP: Payment status (handled in Accounting)
  status: StepStatus;
  notes?: string;
}

interface AccessoryLineItem {
  id: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  dateAdded: string;
  inventoryItemId?: string;
}

interface WorkerPayment {
  workerId: string;
  workerName: string;
  department: string;
  invoiceReference: string;
  amount: number;
  dueDate: string;
  status: 'Pending' | 'Paid';
}

type ShipmentType = 'Local' | 'Courier';
type ShipmentStatus = 'Pending' | 'Booked' | 'Dispatched' | 'Delivered';
type Currency = 'PKR' | 'USD';

interface TrackingDocument {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'other';
  url: string;
  uploadedAt: string;
}

interface Shipment {
  id: string;
  shipmentType: ShipmentType;
  courierName?: string;
  shipmentStatus: ShipmentStatus;
  trackingId?: string;
  trackingUrl?: string;
  trackingDocuments?: TrackingDocument[];
  bookingDate?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  actualCost: number;
  chargedToCustomer: number;
  currency: Currency;
  usdToPkrRate?: number;
  riderPhone?: string;
  deliveryArea?: string;
  notes?: string;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  method: 'Cash' | 'Bank Transfer' | 'Card' | 'Cheque';
  reference?: string;
  notes?: string;
}

interface StudioSaleDetail {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  saleDate: string;
  expectedDeliveryDate: string;
  saleStatus: SaleStatus;
  
  fabricName: string;
  meters: number;
  fabricCost: number;
  
  productionSteps: ProductionStep[];
  accessories: AccessoryLineItem[];
  shipments: Shipment[];
  payments: Payment[];
  
  baseAmount: number; // Amount before shipment
  shipmentCharges: number; // Total shipment charges
  totalAmount: number; // Base + Shipment
  paidAmount: number;
  balanceDue: number;
  
  fabricPurchaseCost: number;
}

// Mock data
const mockSaleDetail: StudioSaleDetail = {
  id: "1",
  invoiceNo: "INV-2026-0015",
  customerName: "Ayesha Khan",
  customerPhone: "+92 300 1234567",
  saleDate: "2026-01-03",
  expectedDeliveryDate: "2026-01-20",
  saleStatus: "In Progress",
  
  fabricName: "Silk Lawn - Red",
  meters: 5,
  fabricCost: 2500,
  
  productionSteps: [
    {
      id: "dyeing",
      name: "Dyeing",
      icon: Palette,
      order: 1,
      assignedWorker: "Ali Raza + 1 more",
      workerId: "W001",
      assignedWorkers: [
        { id: "AW1", workerId: "W001", workerName: "Ali Raza", role: "Main Dyeing", cost: 2000 },
        { id: "AW2", workerId: "W004", workerName: "Hassan Ali", role: "Assistant", cost: 800 }
      ],
      assignedDate: "2026-01-04",
      expectedCompletionDate: "2026-01-08",
      actualCompletionDate: "2026-01-07",
      workerCost: 2800,
      workerPaymentStatus: "Paid",
      status: "Completed",
      notes: "Deep red color - customer approved sample"
    },
    {
      id: "handwork",
      name: "Handwork / Embroidery",
      icon: Sparkles,
      order: 2,
      assignedWorker: "Ahmed Hussain",
      workerId: "W002",
      assignedWorkers: [
        { id: "AW3", workerId: "W002", workerName: "Ahmed Hussain", role: "Embroidery Expert", cost: 3500 }
      ],
      assignedDate: "2026-01-09",
      expectedCompletionDate: "2026-01-15",
      workerCost: 3500,
      workerPaymentStatus: "Pending",
      status: "In Progress",
      notes: "Golden thread embroidery - border + dupatta"
    },
    {
      id: "stitching",
      name: "Stitching",
      icon: Scissors,
      order: 3,
      assignedWorker: "",
      assignedDate: "",
      expectedCompletionDate: "",
      workerCost: 0,
      assignedWorkers: [],
      status: "Pending",
      notes: ""
    },
    {
      id: "custom-1737158400000",
      name: "Quality Check",
      icon: MoreHorizontal,
      order: 4,
      assignedWorker: "",
      assignedDate: "",
      expectedCompletionDate: "",
      workerCost: 0,
      assignedWorkers: [],
      status: "Pending",
      notes: ""
    }
  ],
  
  accessories: [
    {
      id: "A1",
      itemName: "Golden Lace (Border)",
      quantity: 5,
      unitCost: 100,
      totalCost: 500,
      dateAdded: "2026-01-05",
      inventoryItemId: "INV-LACE-001"
    },
    {
      id: "A2",
      itemName: "Buttons - Pearl",
      quantity: 12,
      unitCost: 25,
      totalCost: 300,
      dateAdded: "2026-01-10",
      inventoryItemId: "INV-BTN-002"
    }
  ],
  
  shipments: [
    {
      id: 'SHP-001',
      shipmentType: 'Courier',
      courierName: 'DHL Express',
      shipmentStatus: 'Dispatched',
      trackingId: 'DHL-987654321',
      trackingUrl: 'https://www.dhl.com/pk-en/home/tracking.html?tracking-id=DHL-987654321',
      trackingDocuments: [
        {
          id: 'DOC-001',
          name: 'Shipping Label.pdf',
          type: 'pdf',
          url: '#',
          uploadedAt: '2026-01-15T10:30:00'
        }
      ],
      bookingDate: '2026-01-15',
      expectedDeliveryDate: '2026-01-20',
      actualCost: 1500,
      chargedToCustomer: 2000,
      currency: 'PKR',
      notes: 'International shipment - Final DHL charges pending'
    }
  ],
  
  payments: [
    {
      id: 'PAY-001',
      date: '2026-01-05',
      amount: 5000,
      method: 'Cash',
      notes: 'Advance payment'
    },
    {
      id: 'PAY-002',
      date: '2026-01-10',
      amount: 5000,
      method: 'Bank Transfer',
      reference: 'TXN-123456',
      notes: 'Second installment'
    }
  ],
  
  baseAmount: 13000, // Fabric + Production + Accessories
  shipmentCharges: 2000, // Customer charged for shipment
  totalAmount: 15000, // 13000 + 2000
  paidAmount: 10000,
  balanceDue: 5000,
  
  fabricPurchaseCost: 2000
};

const mockWorkers: Worker[] = [
  { id: 'W001', name: 'Ali Raza', department: 'Dyeing', phone: '+92 300 1111111', isActive: true },
  { id: 'W002', name: 'Ahmed Hussain', department: 'Handwork', phone: '+92 301 2222222', isActive: true },
  { id: 'W003', name: 'Fatima Bibi', department: 'Stitching', phone: '+92 302 3333333', isActive: true },
];

export const StudioSaleDetailNew = () => {
  const { setCurrentView } = useNavigation();
  const [saleDetail, setSaleDetail] = useState<StudioSaleDetail>({
    ...mockSaleDetail,
    shipments: mockSaleDetail.shipments || [],
    payments: mockSaleDetail.payments || []
  });
  const [editMode, setEditMode] = useState(false);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showAccessoryModal, setShowAccessoryModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState<string | null>(null);
  const [showWorkerEditModal, setShowWorkerEditModal] = useState<string | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState<string | null>(null);
  const [showTaskCustomizationModal, setShowTaskCustomizationModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const qrScannerRef = useRef<HTMLInputElement>(null);

  const [newAccessory, setNewAccessory] = useState({
    itemName: '',
    quantity: 0,
    unitCost: 0
  });

  const [newShipment, setNewShipment] = useState({
    shipmentType: 'Courier' as ShipmentType,
    courierName: '',
    chargedToCustomer: 0,
    actualCost: 0,
    trackingId: '',
    notes: ''
  });

  const [editingWorkerData, setEditingWorkerData] = useState({
    workers: [] as Array<{id: string; workerId: string; workerName: string; role: string; cost: number}>,
    expectedCompletionDate: '',
    notes: ''
  });

  const [trackingData, setTrackingData] = useState({
    trackingId: '',
    trackingUrl: ''
  });

  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Available task templates
  const [availableTaskTemplates] = useState([
    { id: 'dyeing', name: 'Dyeing', icon: Palette, enabled: true },
    { id: 'handwork', name: 'Handwork / Embroidery', icon: Sparkles, enabled: true },
    { id: 'stitching', name: 'Stitching', icon: Scissors, enabled: true }
  ]);

  const [customTasks, setCustomTasks] = useState<Array<{ id: string; name: string }>>([]);
  const [newCustomTaskName, setNewCustomTaskName] = useState('');
  const [selectedTasksForModal, setSelectedTasksForModal] = useState<string[]>([]);

  // Calculate costs
  const calculateInternalCosts = () => {
    const fabricCost = saleDetail.fabricPurchaseCost;
    const productionCost = saleDetail.productionSteps.reduce((sum, step) => sum + step.workerCost, 0);
    const accessoriesCost = saleDetail.accessories.reduce((sum, acc) => sum + acc.totalCost, 0);
    const shippingCost = saleDetail.shipments.reduce((sum, ship) => sum + ship.actualCost, 0);
    
    const totalCost = fabricCost + productionCost + accessoriesCost + shippingCost;
    const profit = saleDetail.totalAmount - totalCost;
    const margin = totalCost > 0 ? ((profit / saleDetail.totalAmount) * 100).toFixed(1) : 0;
    
    return { fabricCost, productionCost, accessoriesCost, shippingCost, totalCost, profit, margin };
  };

  const costs = calculateInternalCosts();

  // Check if all production tasks are completed
  const allTasksCompleted = saleDetail.productionSteps.length > 0 && 
    saleDetail.productionSteps.every(step => step.status === 'Completed');

  const isStepLocked = (stepOrder: number): boolean => {
    if (stepOrder === 1) return false;
    const previousStep = saleDetail.productionSteps.find(s => s.order === stepOrder - 1);
    return previousStep?.status !== 'Completed';
  };

  const updateStepStatus = (stepId: string, newStatus: StepStatus) => {
    setSaleDetail(prev => ({
      ...prev,
      productionSteps: prev.productionSteps.map(step => 
        step.id === stepId ? { 
          ...step, 
          status: newStatus,
          actualCompletionDate: newStatus === 'Completed' ? new Date().toISOString().split('T')[0] : step.actualCompletionDate,
          // ERP Rule: When task completed, worker payment becomes "Payable" (handled in Accounting)
          workerPaymentStatus: newStatus === 'Completed' && step.assignedWorker 
            ? (step.workerPaymentStatus || 'Payable') 
            : step.workerPaymentStatus
        } : step
      )
    }));
  };

  const handleAddAccessory = () => {
    if (!newAccessory.itemName.trim() || newAccessory.quantity <= 0) return;
    
    const accessory: AccessoryLineItem = {
      id: `A${Date.now()}`,
      itemName: newAccessory.itemName,
      quantity: newAccessory.quantity,
      unitCost: newAccessory.unitCost,
      totalCost: newAccessory.quantity * newAccessory.unitCost,
      dateAdded: new Date().toISOString().split('T')[0]
    };
    
    setSaleDetail(prev => ({ ...prev, accessories: [...prev.accessories, accessory] }));
    setNewAccessory({ itemName: '', quantity: 0, unitCost: 0 });
    setShowAccessoryModal(false);
  };

  const handleDeleteAccessory = (id: string) => {
    const productionStarted = saleDetail.productionSteps.some(
      step => step.status === 'In Progress' || step.status === 'Completed'
    );
    
    if (productionStarted) {
      alert('Cannot delete accessories after production has started');
      return;
    }
    
    setSaleDetail(prev => ({ ...prev, accessories: prev.accessories.filter(acc => acc.id !== id) }));
  };

  const handleAddShipment = () => {
    if (newShipment.chargedToCustomer <= 0) return;

    const shipment: Shipment = {
      id: `SHP-${Date.now()}`,
      shipmentType: newShipment.shipmentType,
      courierName: newShipment.courierName,
      shipmentStatus: 'Pending',
      trackingId: newShipment.trackingId,
      actualCost: newShipment.actualCost,
      chargedToCustomer: newShipment.chargedToCustomer,
      currency: 'PKR',
      notes: newShipment.notes,
      trackingDocuments: []
    };

    setSaleDetail(prev => ({
      ...prev,
      shipments: [...prev.shipments, shipment],
      shipmentCharges: prev.shipmentCharges + newShipment.chargedToCustomer,
      totalAmount: prev.totalAmount + newShipment.chargedToCustomer,
      balanceDue: prev.balanceDue + newShipment.chargedToCustomer
    }));

    setNewShipment({
      shipmentType: 'Courier',
      courierName: '',
      chargedToCustomer: 0,
      actualCost: 0,
      trackingId: '',
      notes: ''
    });
    setShowShipmentModal(false);
  };

  const handleDeleteShipment = (shipmentId: string) => {
    const shipment = saleDetail.shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    // Confirm before deleting
    if (!confirm(`Delete shipment? This will reduce the total bill by Rs ${shipment.chargedToCustomer.toLocaleString()}`)) {
      return;
    }

    setSaleDetail(prev => ({
      ...prev,
      shipments: prev.shipments.filter(s => s.id !== shipmentId),
      shipmentCharges: prev.shipmentCharges - shipment.chargedToCustomer,
      totalAmount: prev.totalAmount - shipment.chargedToCustomer,
      balanceDue: prev.balanceDue - shipment.chargedToCustomer
    }));
  };

  // Handle file upload
  const handleFileUpload = (shipmentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const document: TrackingDocument = {
      id: `DOC-${Date.now()}`,
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'other',
      url: URL.createObjectURL(file), // In real app, upload to server
      uploadedAt: new Date().toISOString()
    };

    setSaleDetail(prev => ({
      ...prev,
      shipments: prev.shipments.map(ship => 
        ship.id === shipmentId 
          ? { ...ship, trackingDocuments: [...(ship.trackingDocuments || []), document] }
          : ship
      )
    }));

    setShowDocumentUpload(null);
  };

  // Handle camera capture
  const handleCameraCapture = (shipmentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(shipmentId, event);
  };

  // Handle Worker Edit
  const handleOpenWorkerEdit = (stepId: string) => {
    const step = saleDetail.productionSteps.find(s => s.id === stepId);
    if (!step) return;
    
    // Load existing workers or create from legacy data
    const workers = step.assignedWorkers && step.assignedWorkers.length > 0
      ? step.assignedWorkers
      : step.assignedWorker
        ? [{
            id: 'W' + Date.now(),
            workerId: step.workerId || '',
            workerName: step.assignedWorker,
            role: 'Main',
            cost: step.workerCost
          }]
        : [];
    
    setEditingWorkerData({
      workers: workers,
      expectedCompletionDate: step.expectedCompletionDate,
      notes: step.notes || ''
    });
    setShowWorkerEditModal(stepId);
  };

  const handleSaveWorkerEdit = () => {
    if (!showWorkerEditModal) return;

    const totalWorkerCost = editingWorkerData.workers.reduce((sum, w) => sum + w.cost, 0);
    const workerNames = editingWorkerData.workers.map(w => w.workerName).join(', ');
    const displayName = editingWorkerData.workers.length > 1 
      ? `${editingWorkerData.workers[0].workerName} + ${editingWorkerData.workers.length - 1} more`
      : editingWorkerData.workers[0]?.workerName || '';

    setSaleDetail(prev => ({
      ...prev,
      productionSteps: prev.productionSteps.map(step =>
        step.id === showWorkerEditModal
          ? {
              ...step,
              assignedWorker: displayName,
              workerId: editingWorkerData.workers[0]?.workerId,
              assignedWorkers: editingWorkerData.workers,
              workerCost: totalWorkerCost,
              expectedCompletionDate: editingWorkerData.expectedCompletionDate,
              notes: editingWorkerData.notes,
              assignedDate: step.assignedDate || new Date().toISOString().split('T')[0]
            }
          : step
      )
    }));

    setShowWorkerEditModal(null);
  };

  // Add new worker
  const handleAddWorker = () => {
    const newWorker = {
      id: 'W' + Date.now(),
      workerId: '',
      workerName: '',
      role: '',
      cost: 0
    };
    setEditingWorkerData(prev => ({
      ...prev,
      workers: [...prev.workers, newWorker]
    }));
  };

  // Remove worker
  const handleRemoveWorker = (workerId: string) => {
    setEditingWorkerData(prev => ({
      ...prev,
      workers: prev.workers.filter(w => w.id !== workerId)
    }));
  };

  // Update worker data
  const handleUpdateWorker = (workerId: string, field: string, value: any) => {
    setEditingWorkerData(prev => ({
      ...prev,
      workers: prev.workers.map(w =>
        w.id === workerId ? { ...w, [field]: value } : w
      )
    }));
  };

  // Add custom task
  const handleAddCustomTask = () => {
    if (!newCustomTaskName.trim()) return;
    
    const newTask = {
      id: 'custom-' + Date.now(),
      name: newCustomTaskName.trim()
    };
    setCustomTasks(prev => [...prev, newTask]);
    setNewCustomTaskName('');
  };

  // Remove custom task
  const handleRemoveCustomTask = (taskId: string) => {
    setCustomTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Apply task configuration
  const handleApplyTaskConfiguration = (selectedTaskIds: string[]) => {
    const newSteps: ProductionStep[] = [];
    let order = 1;

    // Add standard tasks
    selectedTaskIds.forEach(taskId => {
      if (taskId === 'dyeing') {
        newSteps.push({
          id: 'dyeing',
          name: 'Dyeing',
          icon: Palette,
          order: order++,
          assignedWorker: '',
          assignedWorkers: [],
          assignedDate: '',
          expectedCompletionDate: '',
          workerCost: 0,
          status: 'Pending',
          notes: ''
        });
      } else if (taskId === 'handwork') {
        newSteps.push({
          id: 'handwork',
          name: 'Handwork / Embroidery',
          icon: Sparkles,
          order: order++,
          assignedWorker: '',
          assignedWorkers: [],
          assignedDate: '',
          expectedCompletionDate: '',
          workerCost: 0,
          status: 'Pending',
          notes: ''
        });
      } else if (taskId === 'stitching') {
        newSteps.push({
          id: 'stitching',
          name: 'Stitching',
          icon: Scissors,
          order: order++,
          assignedWorker: '',
          assignedWorkers: [],
          assignedDate: '',
          expectedCompletionDate: '',
          workerCost: 0,
          status: 'Pending',
          notes: ''
        });
      } else {
        // Custom task
        const customTask = customTasks.find(t => t.id === taskId);
        if (customTask) {
          newSteps.push({
            id: customTask.id,
            name: customTask.name,
            icon: MoreHorizontal,
            order: order++,
            assignedWorker: '',
            assignedWorkers: [],
            assignedDate: '',
            expectedCompletionDate: '',
            workerCost: 0,
            status: 'Pending',
            notes: ''
          });
        }
      }
    });

    setSaleDetail(prev => ({
      ...prev,
      productionSteps: newSteps
    }));

    setShowTaskCustomizationModal(false);
  };

  // Handle Tracking ID Update
  const handleOpenTrackingModal = (shipmentId: string) => {
    const shipment = saleDetail.shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    setTrackingData({
      trackingId: shipment.trackingId || '',
      trackingUrl: shipment.trackingUrl || ''
    });
    setShowTrackingModal(shipmentId);
  };

  const handleSaveTracking = () => {
    if (!showTrackingModal) return;

    setSaleDetail(prev => ({
      ...prev,
      shipments: prev.shipments.map(ship =>
        ship.id === showTrackingModal
          ? {
              ...ship,
              trackingId: trackingData.trackingId,
              trackingUrl: trackingData.trackingUrl
            }
          : ship
      )
    }));

    setShowTrackingModal(null);
  };

  // Handle QR Scanner for Tracking
  const handleQRScan = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // In a real app, this would use a QR scanner library
    // For now, we'll just simulate it
    alert('QR Scanner feature - Would scan and extract tracking ID');
  };

  const canDeleteAccessory = () => {
    if (saleDetail.saleStatus === 'Completed') return false;
    return !saleDetail.productionSteps.some(step => step.status === 'In Progress' || step.status === 'Completed');
  };

  return (
    <div className="flex flex-col h-screen bg-[#111827] text-white overflow-hidden">
      {/* ============ FIXED HEADER ============ */}
      <div className="shrink-0 bg-[#0B1019] border-b border-gray-800 z-20">
        {/* Top Bar */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-gray-800/50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentView('studio')}
              className="text-gray-400 hover:text-white h-9 w-9"
            >
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">{saleDetail.invoiceNo}</h1>
              <p className="text-xs text-gray-500">Studio Production Order</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs px-3 py-1.5",
                saleDetail.saleStatus === 'Draft' && "bg-gray-500/20 text-gray-400 border-gray-700",
                saleDetail.saleStatus === 'In Progress' && "bg-blue-500/20 text-blue-400 border-blue-700",
                saleDetail.saleStatus === 'Completed' && "bg-green-500/20 text-green-400 border-green-700"
              )}
            >
              {saleDetail.saleStatus}
            </Badge>
            {saleDetail.saleStatus !== 'Completed' && (
              <Button
                size="sm"
                onClick={() => setEditMode(!editMode)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save size={16} className="mr-2" />
                {editMode ? 'Save' : 'Edit'}
              </Button>
            )}
          </div>
        </div>

        {/* Info Bar */}
        <div className="px-6 py-3 bg-[#0F1419]">
          <div className="grid grid-cols-6 gap-6 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-1">Customer</p>
              <p className="text-white font-medium">{saleDetail.customerName}</p>
              <p className="text-xs text-gray-400">{saleDetail.customerPhone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fabric</p>
              <p className="text-white font-medium">{saleDetail.fabricName}</p>
              <p className="text-xs text-gray-400">{saleDetail.meters} meters</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Sale Date</p>
              <p className="text-white">{format(new Date(saleDetail.saleDate), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Deadline</p>
              <p className="text-yellow-400 font-medium">{format(new Date(saleDetail.expectedDeliveryDate), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Bill</p>
              <p className="text-white font-bold text-lg">Rs {saleDetail.totalAmount.toLocaleString()}</p>
              {saleDetail.shipmentCharges > 0 && (
                <p className="text-xs text-blue-400">Inc. shipping Rs {saleDetail.shipmentCharges.toLocaleString()}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Balance Due</p>
              <p className={cn(
                "font-bold text-lg",
                saleDetail.balanceDue === 0 ? "text-green-400" : "text-orange-400"
              )}>
                Rs {saleDetail.balanceDue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Production Progress Bar */}
        <div className="px-6 py-3 bg-[#0B1019] border-t border-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {saleDetail.productionSteps
                .sort((a, b) => a.order - b.order)
                .map((step, index) => {
                  const StepIcon = step.icon;
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                          step.status === 'Completed' && "bg-green-500/20 text-green-400",
                          step.status === 'In Progress' && "bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/40",
                          step.status === 'Pending' && "bg-gray-800 text-gray-600"
                        )}>
                          {step.status === 'Completed' ? (
                            <CheckCircle size={18} />
                          ) : (
                            <StepIcon size={18} />
                          )}
                        </div>
                        <div>
                          <p className={cn(
                            "text-xs font-medium",
                            step.status === 'Completed' && "text-green-400",
                            step.status === 'In Progress' && "text-blue-400",
                            step.status === 'Pending' && "text-gray-600"
                          )}>
                            {step.name}
                          </p>
                          {step.assignedWorker && (
                            <p className="text-[10px] text-gray-500">{step.assignedWorker}</p>
                          )}
                        </div>
                      </div>
                      {index < saleDetail.productionSteps.length - 1 && (
                        <ArrowRight size={16} className={cn(
                          step.status === 'Completed' ? "text-green-500" : "text-gray-800"
                        )} />
                      )}
                    </div>
                  );
                })}
            </div>
            
            {/* Production Complete Badge */}
            {allTasksCompleted && (
              <Badge className="bg-green-600 text-white px-4 py-2 text-sm font-semibold animate-pulse">
                <CheckCircle2 size={16} className="mr-2" />
                Production Complete ✓
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ============ SCROLLABLE 2-COLUMN LAYOUT ============ */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_420px]">
          
          {/* LEFT COLUMN - Worker & Project Details */}
          <div className="flex flex-col h-full overflow-y-auto bg-[#111827] border-r border-gray-800">
            <div className="p-6 space-y-6">
              
              {/* Production Workflow */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users size={18} className="text-blue-400" />
                    Production Workflow
                  </h2>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedTasksForModal(saleDetail.productionSteps.map(s => s.id));
                      setShowTaskCustomizationModal(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 h-8"
                  >
                    <Edit2 size={14} className="mr-1" />
                    Customize Tasks
                  </Button>
                </div>

                {saleDetail.productionSteps.length === 0 ? (
                  <div className="text-center py-12 bg-gray-900/50 rounded-lg border border-dashed border-gray-700">
                    <Scissors size={40} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-sm text-gray-400 mb-1">No production tasks configured</p>
                    <p className="text-xs text-gray-600 mb-4">Click "Customize Tasks" to add tasks for this sale</p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTasksForModal([]);
                        setShowTaskCustomizationModal(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Plus size={14} className="mr-1" />
                      Configure Tasks
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {saleDetail.productionSteps
                      .sort((a, b) => a.order - b.order)
                      .map((step) => {
                        const StepIcon = step.icon;
                        const stepLocked = isStepLocked(step.order);
                        const isExpanded = expandedSteps.has(step.id);
                      
                      return (
                        <div 
                          key={step.id}
                          className={cn(
                            "bg-gray-900/50 border rounded-lg transition-all",
                            step.status === 'Completed' && "border-green-700/30",
                            step.status === 'In Progress' && "border-blue-700/50 bg-blue-950/10",
                            step.status === 'Pending' && "border-gray-800"
                          )}
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-4">
                              {/* Icon */}
                              <div className={cn(
                                "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                                step.status === 'Completed' && "bg-green-500/20",
                                step.status === 'In Progress' && "bg-blue-500/20",
                                step.status === 'Pending' && stepLocked && "bg-gray-800",
                                step.status === 'Pending' && !stepLocked && "bg-gray-700/30"
                              )}>
                                {stepLocked ? (
                                  <Lock size={20} className="text-gray-600" />
                                ) : (
                                  <StepIcon size={20} className={cn(
                                    step.status === 'Completed' && "text-green-400",
                                    step.status === 'In Progress' && "text-blue-400",
                                    step.status === 'Pending' && "text-gray-400"
                                  )} />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="text-sm font-semibold text-white">{step.name}</h3>
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          "text-xs",
                                          step.status === 'Completed' && "bg-green-500/20 text-green-400 border-green-700",
                                          step.status === 'In Progress' && "bg-blue-500/20 text-blue-400 border-blue-700",
                                          step.status === 'Pending' && "bg-gray-500/20 text-gray-400 border-gray-700"
                                        )}
                                      >
                                        {step.status}
                                      </Badge>
                                    </div>
                                    
                                    {step.assignedWorker ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm">
                                          <Users size={14} className="text-gray-500" />
                                          <span className="text-gray-300">{step.assignedWorker}</span>
                                          {step.assignedWorkers && step.assignedWorkers.length > 1 && (
                                            <span className="text-xs text-blue-400">({step.assignedWorkers.length} workers)</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                          <DollarSign size={14} className="text-orange-500" />
                                          <span className="text-orange-400 font-medium">Rs {step.workerCost.toLocaleString()}</span>
                                          {step.assignedWorkers && step.assignedWorkers.length > 1 && (
                                            <span className="text-xs text-gray-500">(total)</span>
                                          )}
                                          {/* ERP: Worker Payment Status */}
                                          {step.workerPaymentStatus && (
                                            <Badge 
                                              variant="outline"
                                              className={cn(
                                                "text-[10px] px-1.5 py-0",
                                                step.workerPaymentStatus === 'Paid' && "bg-green-500/20 text-green-400 border-green-700",
                                                step.workerPaymentStatus === 'Pending' && "bg-yellow-500/20 text-yellow-400 border-yellow-700",
                                                step.workerPaymentStatus === 'Payable' && "bg-orange-500/20 text-orange-400 border-orange-700"
                                              )}
                                            >
                                              {step.workerPaymentStatus}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-600">
                                        {stepLocked ? "🔒 Locked - Complete previous step" : "Not assigned"}
                                      </p>
                                    )}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-2">
                                    {/* Assign/Edit Worker Button */}
                                    {!stepLocked && step.status !== 'Completed' && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleOpenWorkerEdit(step.id)}
                                        className={cn(
                                          "text-xs h-8",
                                          step.assignedWorker 
                                            ? "bg-blue-600 hover:bg-blue-700" 
                                            : "bg-green-600 hover:bg-green-700"
                                        )}
                                      >
                                        {step.assignedWorker ? (
                                          <>
                                            <Edit2 size={14} className="mr-1" />
                                            Edit
                                          </>
                                        ) : (
                                          <>
                                            <Plus size={14} className="mr-1" />
                                            Assign
                                          </>
                                        )}
                                      </Button>
                                    )}
                                    
                                    {/* Recall Task Status - Only for completed tasks */}
                                    {step.status === 'Completed' && !stepLocked && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          if (confirm(`Recall "${step.name}" task to Pending status?`)) {
                                            updateStepStatus(step.id, 'Pending');
                                          }
                                        }}
                                        className="h-8 w-8 p-0 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                                        title="Recall to Pending"
                                      >
                                        <Undo2 size={16} />
                                      </Button>
                                    )}
                                    
                                    {/* Start/Complete Button - Only show when worker is assigned */}
                                    {!stepLocked && step.status !== 'Completed' && step.assignedWorker && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          const newStatus: StepStatus = step.status === 'Pending' ? 'In Progress' : 'Completed';
                                          updateStepStatus(step.id, newStatus);
                                        }}
                                        className={cn(
                                          "text-xs h-8",
                                          step.status === 'Pending' && "bg-blue-600 hover:bg-blue-700",
                                          step.status === 'In Progress' && "bg-green-600 hover:bg-green-700"
                                        )}
                                      >
                                        {step.status === 'Pending' ? 'Start' : 'Complete'}
                                      </Button>
                                    )}
                                    
                                    {step.status === 'Completed' && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleOpenWorkerEdit(step.id)}
                                          className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-900/20"
                                          title="View/Edit Details"
                                        >
                                          <Eye size={16} />
                                        </Button>
                                        <CheckCircle className="text-green-400" size={20} />
                                      </>
                                    )}
                                    
                                    {(step.notes || step.expectedCompletionDate || step.assignedDate) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          const newSet = new Set(expandedSteps);
                                          if (isExpanded) newSet.delete(step.id);
                                          else newSet.add(step.id);
                                          setExpandedSteps(newSet);
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t border-gray-800 space-y-2 ml-16">
                                {step.assignedDate && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar size={14} className="text-gray-500" />
                                    <span className="text-gray-400">
                                      Assigned: {format(new Date(step.assignedDate), 'dd MMM yyyy')}
                                    </span>
                                  </div>
                                )}
                                {step.expectedCompletionDate && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock size={14} className="text-gray-500" />
                                    <span className="text-gray-400">
                                      Expected: {format(new Date(step.expectedCompletionDate), 'dd MMM yyyy')}
                                    </span>
                                  </div>
                                )}
                                {step.actualCompletionDate && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle size={14} className="text-green-400" />
                                    <span className="text-green-400">
                                      Completed: {format(new Date(step.actualCompletionDate), 'dd MMM yyyy')}
                                    </span>
                                  </div>
                                )}
                                {step.notes && (
                                  <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-300">
                                    {step.notes}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Production Cost Summary - ERP Style */}
              {saleDetail.productionSteps.length > 0 && (
                <div className="bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <FileText size={16} className="text-blue-400" />
                    Production Cost Summary
                  </h3>
                  
                  <div className="space-y-3">
                    {/* Total Worker Cost */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Total Worker Cost</span>
                      <span className="text-lg font-bold text-orange-400">
                        Rs {saleDetail.productionSteps.reduce((sum, step) => sum + step.workerCost, 0).toLocaleString()}
                      </span>
                    </div>
                    
                    {/* Payment Status Breakdown */}
                    <div className="pt-2 border-t border-gray-800">
                      <p className="text-xs text-gray-500 mb-2">Payment Status:</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-green-950/30 border border-green-800/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-green-400 mb-1">Paid</p>
                          <p className="text-sm font-bold text-green-400">
                            Rs {saleDetail.productionSteps
                              .filter(s => s.workerPaymentStatus === 'Paid')
                              .reduce((sum, s) => sum + s.workerCost, 0)
                              .toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-yellow-950/30 border border-yellow-800/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-yellow-400 mb-1">Pending</p>
                          <p className="text-sm font-bold text-yellow-400">
                            Rs {saleDetail.productionSteps
                              .filter(s => s.workerPaymentStatus === 'Pending')
                              .reduce((sum, s) => sum + s.workerCost, 0)
                              .toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-orange-950/30 border border-orange-800/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-orange-400 mb-1">Payable</p>
                          <p className="text-sm font-bold text-orange-400">
                            Rs {saleDetail.productionSteps
                              .filter(s => s.workerPaymentStatus === 'Payable')
                              .reduce((sum, s) => sum + s.workerCost, 0)
                              .toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="pt-2 border-t border-blue-800/30">
                      <p className="text-[10px] text-blue-400">
                        💡 Worker payments managed in <strong>Accounting → Worker Payments</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Accessories */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Package size={18} className="text-purple-400" />
                    Accessories
                  </h2>
                  {canDeleteAccessory() && (
                    <Button
                      size="sm"
                      onClick={() => setShowAccessoryModal(true)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Plus size={16} className="mr-2" />
                      Add Item
                    </Button>
                  )}
                </div>

                {saleDetail.accessories.length === 0 ? (
                  <div className="bg-gray-900/30 border border-gray-800 border-dashed rounded-lg p-8 text-center">
                    <Package size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">No accessories added</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {saleDetail.accessories.map(acc => (
                      <div 
                        key={acc.id}
                        className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 flex items-center justify-between hover:border-gray-700 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white mb-1">{acc.itemName}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>Qty: {acc.quantity}</span>
                            <span>•</span>
                            <span>Unit: Rs {acc.unitCost.toLocaleString()}</span>
                            <span>•</span>
                            <span className="text-orange-400 font-medium">Total: Rs {acc.totalCost.toLocaleString()}</span>
                          </div>
                        </div>
                        {canDeleteAccessory() && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteAccessory(acc.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Shipment (TOP) & Payment (BOTTOM) */}
          <div className="flex flex-col h-full overflow-y-auto bg-[#0F1419]">
            <div className="p-6 space-y-6">
              
              {/* SHIPMENT SECTION - NOW AT TOP */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Truck size={18} className={allTasksCompleted ? "text-blue-400" : "text-gray-600"} />
                    Shipment
                    {!allTasksCompleted && (
                      <Lock size={14} className="text-gray-600" />
                    )}
                  </h2>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!allTasksCompleted) {
                        alert('⚠️ Please complete all production tasks before adding shipment');
                        return;
                      }
                      setShowShipmentModal(true);
                    }}
                    disabled={!allTasksCompleted}
                    className={cn(
                      "bg-blue-600 hover:bg-blue-700",
                      !allTasksCompleted && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Plus size={16} className="mr-2" />
                    Add
                  </Button>
                </div>

                {(!saleDetail.shipments || saleDetail.shipments.length === 0) ? (
                  <div className={cn(
                    "border border-dashed rounded-lg p-8 text-center",
                    allTasksCompleted 
                      ? "bg-gray-900/30 border-gray-800" 
                      : "bg-gray-950/50 border-gray-900"
                  )}>
                    <Truck size={32} className={cn(
                      "mx-auto mb-2",
                      allTasksCompleted ? "text-gray-600" : "text-gray-800"
                    )} />
                    {!allTasksCompleted ? (
                      <>
                        <p className="text-sm text-gray-600 mb-1">🔒 Shipment Locked</p>
                        <p className="text-xs text-gray-700">Complete all production tasks to unlock</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 mb-1">No shipment details</p>
                        <p className="text-xs text-gray-600">Add when ready to dispatch</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {saleDetail.shipments.map((shipment) => {
                      const profit = shipment.chargedToCustomer - shipment.actualCost;
                      
                      return (
                        <div 
                          key={shipment.id}
                          className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                        >
                          {/* Header */}
                          <div className="bg-gray-950 border-b border-gray-800 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-10 w-10 rounded-lg flex items-center justify-center",
                                shipment.shipmentType === 'Courier' ? "bg-blue-500/20" : "bg-green-500/20"
                              )}>
                                {shipment.shipmentType === 'Courier' ? (
                                  <Package size={20} className="text-blue-400" />
                                ) : (
                                  <MapPin size={20} className="text-green-400" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {shipment.shipmentType === 'Courier' ? shipment.courierName : 'Local Delivery'}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      shipment.shipmentStatus === 'Pending' && "bg-gray-500/20 text-gray-400 border-gray-700",
                                      shipment.shipmentStatus === 'Booked' && "bg-yellow-500/20 text-yellow-400 border-yellow-700",
                                      shipment.shipmentStatus === 'Dispatched' && "bg-blue-500/20 text-blue-400 border-blue-700",
                                      shipment.shipmentStatus === 'Delivered' && "bg-green-500/20 text-green-400 border-green-700"
                                    )}
                                  >
                                    {shipment.shipmentStatus}
                                  </Badge>
                                  <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-700 text-xs">
                                    Added to Bill
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {shipment.trackingUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(shipment.trackingUrl, '_blank')}
                                  className="border-blue-700 text-blue-300 hover:bg-blue-900/30"
                                >
                                  <ExternalLink size={14} className="mr-1" />
                                  Track
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteShipment(shipment.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0"
                                title="Delete Shipment"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="p-4 space-y-4">
                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {shipment.bookingDate && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Booking Date</p>
                                  <p className="text-white">{format(new Date(shipment.bookingDate), 'dd MMM yyyy')}</p>
                                </div>
                              )}
                              {shipment.expectedDeliveryDate && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Expected Delivery</p>
                                  <p className="text-yellow-400">{format(new Date(shipment.expectedDeliveryDate), 'dd MMM yyyy')}</p>
                                </div>
                              )}
                            </div>

                            {/* Local Shipment Details */}
                            {shipment.shipmentType === 'Local' && (
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {shipment.riderPhone && (
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Rider Phone</p>
                                    <p className="text-white">{shipment.riderPhone}</p>
                                  </div>
                                )}
                                {shipment.deliveryArea && (
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Area</p>
                                    <p className="text-white">{shipment.deliveryArea}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Tracking ID */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-gray-500 uppercase font-medium">Tracking ID</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenTrackingModal(shipment.id)}
                                  className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                >
                                  <Edit2 size={12} className="mr-1" />
                                  Edit
                                </Button>
                              </div>
                              {shipment.trackingId ? (
                                <div className="bg-gray-950 border border-blue-700/30 rounded-lg p-3">
                                  <p className="text-blue-400 font-mono font-semibold">{shipment.trackingId}</p>
                                  {shipment.trackingUrl && (
                                    <p className="text-xs text-gray-500 mt-1 truncate">{shipment.trackingUrl}</p>
                                  )}
                                </div>
                              ) : (
                                <div className="bg-gray-950 border border-gray-800 border-dashed rounded-lg p-3 text-center">
                                  <p className="text-xs text-gray-500">No tracking ID added</p>
                                </div>
                              )}
                            </div>

                            {/* Tracking Documents */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-gray-500 uppercase font-medium">Tracking Documents</p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setShowDocumentUpload(shipment.id);
                                      setTimeout(() => fileInputRef.current?.click(), 100);
                                    }}
                                    className="border-gray-700 text-gray-300 h-7 text-xs"
                                  >
                                    <Upload size={12} className="mr-1" />
                                    Upload
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setShowDocumentUpload(shipment.id);
                                      setTimeout(() => cameraInputRef.current?.click(), 100);
                                    }}
                                    className="border-gray-700 text-gray-300 h-7 text-xs"
                                  >
                                    <Camera size={12} className="mr-1" />
                                    Camera
                                  </Button>
                                </div>
                              </div>

                              {/* Hidden File Inputs */}
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => handleFileUpload(shipment.id, e)}
                              />
                              <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => handleCameraCapture(shipment.id, e)}
                              />

                              {/* Documents List */}
                              {shipment.trackingDocuments && shipment.trackingDocuments.length > 0 ? (
                                <div className="space-y-2">
                                  {shipment.trackingDocuments.map(doc => (
                                    <div
                                      key={doc.id}
                                      className="bg-gray-950 border border-gray-800 rounded-lg p-2 flex items-center gap-3"
                                    >
                                      <div className={cn(
                                        "h-8 w-8 rounded flex items-center justify-center shrink-0",
                                        doc.type === 'image' && "bg-blue-500/20 text-blue-400",
                                        doc.type === 'pdf' && "bg-red-500/20 text-red-400",
                                        doc.type === 'other' && "bg-gray-700 text-gray-400"
                                      )}>
                                        {doc.type === 'image' ? <ImageIcon size={16} /> : 
                                         doc.type === 'pdf' ? <FileText size={16} /> : 
                                         <File size={16} />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-white truncate">{doc.name}</p>
                                        <p className="text-[10px] text-gray-500">
                                          {format(new Date(doc.uploadedAt), 'dd MMM yyyy HH:mm')}
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => window.open(doc.url, '_blank')}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Eye size={14} />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="bg-gray-950 border border-gray-800 border-dashed rounded-lg p-4 text-center">
                                  <Paperclip size={20} className="mx-auto text-gray-600 mb-1" />
                                  <p className="text-xs text-gray-500">No documents uploaded</p>
                                </div>
                              )}
                            </div>

                            {/* Financial */}
                            <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                              <p className="text-xs text-gray-500 uppercase font-medium mb-3">Financial Details (Reference)</p>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400">Charged to Customer</span>
                                  <span className="text-white font-semibold">
                                    {shipment.currency} {shipment.chargedToCustomer.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400">Actual Cost</span>
                                  <span className="text-orange-400 font-semibold">
                                    {shipment.currency} {shipment.actualCost.toLocaleString()}
                                  </span>
                                </div>
                                <div className="h-px bg-gray-800"></div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-300 font-medium">Profit/Loss</span>
                                  <div className="flex items-center gap-1.5">
                                    <TrendingUp size={16} className={profit >= 0 ? "text-green-400" : "text-red-400"} />
                                    <span className={cn(
                                      "font-bold text-base",
                                      profit >= 0 ? "text-green-400" : "text-red-400"
                                    )}>
                                      {profit >= 0 ? '+' : ''}{shipment.currency} {profit.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {shipment.currency === 'USD' && shipment.usdToPkrRate && (
                                <div className="mt-3 pt-3 border-t border-gray-800">
                                  <p className="text-xs text-gray-500">
                                    Rate: 1 USD = Rs {shipment.usdToPkrRate} • PKR: Rs {(shipment.chargedToCustomer * shipment.usdToPkrRate).toLocaleString()}
                                  </p>
                                </div>
                              )}
                              
                              {/* ERP Info */}
                              <div className="mt-3 pt-3 border-t border-blue-800/30">
                                <p className="text-[10px] text-blue-400">
                                  📊 Accounting entries auto-created in Expense & Income ledgers
                                </p>
                              </div>
                            </div>

                            {/* Notes */}
                            {shipment.notes && (
                              <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-3">
                                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Notes</p>
                                <p className="text-sm text-gray-300">{shipment.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PAYMENT SECTION - NOW AT BOTTOM */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <CreditCard size={18} className="text-green-400" />
                    Payment
                  </h2>
                  <Badge className={cn(
                    "text-xs",
                    saleDetail.balanceDue === 0 && "bg-green-600",
                    saleDetail.balanceDue > 0 && saleDetail.paidAmount > 0 && "bg-blue-600",
                    saleDetail.balanceDue === saleDetail.totalAmount && "bg-orange-600"
                  )}>
                    {saleDetail.balanceDue === 0 ? 'Paid' : saleDetail.paidAmount > 0 ? 'Partial' : 'Pending'}
                  </Badge>
                </div>

                {/* Summary Card */}
                <div className={cn(
                  "border rounded-xl p-5 mb-4",
                  saleDetail.balanceDue === 0 
                    ? "bg-gradient-to-br from-green-950/30 to-green-900/20 border-green-800/50"
                    : saleDetail.paidAmount > 0
                      ? "bg-gradient-to-br from-blue-950/30 to-blue-900/20 border-blue-800/50"
                      : "bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800"
                )}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Total Bill</span>
                      <span className="text-xl font-bold text-white">Rs {saleDetail.totalAmount.toLocaleString()}</span>
                    </div>
                    {saleDetail.shipmentCharges > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Base Amount</span>
                        <span className="text-gray-400">Rs {saleDetail.baseAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {saleDetail.shipmentCharges > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Shipping Charges</span>
                        <span className="text-blue-400">Rs {saleDetail.shipmentCharges.toLocaleString()}</span>
                      </div>
                    )}
                    {saleDetail.paidAmount > 0 && (
                      <>
                        <div className="h-px bg-gray-800"></div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Paid</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-green-400">Rs {saleDetail.paidAmount.toLocaleString()}</span>
                            <span className="text-xs text-gray-500">
                              ({((saleDetail.paidAmount / saleDetail.totalAmount) * 100).toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="h-px bg-gray-800"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-300">Balance Due</span>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-2xl font-bold",
                          saleDetail.balanceDue === 0 ? "text-green-400" : "text-orange-400"
                        )}>
                          Rs {saleDetail.balanceDue.toLocaleString()}
                        </span>
                        {saleDetail.balanceDue === 0 && (
                          <CheckCircle2 size={24} className="text-green-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ERP Info - Accounting Integration */}
                <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-400 mb-1">💡 Payment Handling</p>
                      <p className="text-xs text-gray-400 mb-3">
                        All payments are managed in <strong className="text-blue-400">Accounting → Customer Receipts</strong> module. 
                        Payments automatically sync with this order.
                      </p>
                      {saleDetail.balanceDue > 0 && (
                        <Button
                          onClick={() => {
                            alert('🔄 Redirecting to Accounting Module...\n\nPayment will be recorded in:\nAccounting → Customer Receipts → New Entry\n\nAuto-filled:\n• Invoice: ' + saleDetail.invoiceNo + '\n• Customer: ' + saleDetail.customerName + '\n• Balance: Rs ' + saleDetail.balanceDue.toLocaleString());
                          }}
                          className="bg-blue-600 hover:bg-blue-700 h-9 text-sm"
                        >
                          <CreditCard size={14} className="mr-2" />
                          Receive Payment in Accounting
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment History */}
                {saleDetail.payments && saleDetail.payments.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500 uppercase font-medium">Payment History (Synced from Accounting)</p>
                      <Badge variant="outline" className="text-[10px] bg-green-500/20 text-green-400 border-green-700">
                        Auto-synced
                      </Badge>
                    </div>
                    {saleDetail.payments.map(payment => (
                      <div 
                        key={payment.id}
                        className="bg-gray-900 border border-gray-800 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-semibold text-green-400">
                            Rs {payment.amount.toLocaleString()}
                          </span>
                          <Badge variant="outline" className="bg-gray-800 text-gray-300 border-gray-700 text-xs">
                            {payment.method}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar size={12} />
                          <span>{format(new Date(payment.date), 'dd MMM yyyy')}</span>
                          {payment.reference && (
                            <>
                              <span>•</span>
                              <span>{payment.reference}</span>
                            </>
                          )}
                        </div>
                        {payment.notes && (
                          <p className="text-xs text-gray-400 mt-2">{payment.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ MODALS ============ */}
      
      {/* Add Accessory Modal */}
      {showAccessoryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Add Accessory</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAccessoryModal(false)}
                className="h-8 w-8 p-0"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Item Name</label>
                <Input
                  value={newAccessory.itemName}
                  onChange={(e) => setNewAccessory(prev => ({ ...prev, itemName: e.target.value }))}
                  placeholder="e.g., Golden Lace, Buttons"
                  className="bg-gray-950 border-gray-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Quantity</label>
                  <Input
                    type="number"
                    value={newAccessory.quantity || ''}
                    onChange={(e) => setNewAccessory(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    placeholder="0"
                    className="bg-gray-950 border-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Unit Cost (Rs)</label>
                  <Input
                    type="number"
                    value={newAccessory.unitCost || ''}
                    onChange={(e) => setNewAccessory(prev => ({ ...prev, unitCost: Number(e.target.value) }))}
                    placeholder="0"
                    className="bg-gray-950 border-gray-700"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowAccessoryModal(false)}
                  variant="outline"
                  className="flex-1 border-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddAccessory}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Add Item
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Shipment Modal */}
      {showShipmentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Add Shipment</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowShipmentModal(false)}
                className="h-8 w-8 p-0"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Shipment Type</label>
                <select
                  value={newShipment.shipmentType}
                  onChange={(e) => setNewShipment(prev => ({ ...prev, shipmentType: e.target.value as ShipmentType }))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg text-white h-10 px-3"
                >
                  <option value="Courier">Courier (DHL, TCS, etc.)</option>
                  <option value="Local">Local Delivery</option>
                </select>
              </div>

              {newShipment.shipmentType === 'Courier' && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Courier Name</label>
                  <Input
                    value={newShipment.courierName}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, courierName: e.target.value }))}
                    placeholder="e.g., DHL, TCS, Leopard"
                    className="bg-gray-950 border-gray-700"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Charged to Customer (Rs)</label>
                  <Input
                    type="number"
                    value={newShipment.chargedToCustomer || ''}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, chargedToCustomer: Number(e.target.value) }))}
                    placeholder="0"
                    className="bg-gray-950 border-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Actual Cost (Rs)</label>
                  <Input
                    type="number"
                    value={newShipment.actualCost || ''}
                    onChange={(e) => setNewShipment(prev => ({ ...prev, actualCost: Number(e.target.value) }))}
                    placeholder="0"
                    className="bg-gray-950 border-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Tracking ID (Optional)</label>
                <Input
                  value={newShipment.trackingId}
                  onChange={(e) => setNewShipment(prev => ({ ...prev, trackingId: e.target.value }))}
                  placeholder="e.g., DHL-123456789"
                  className="bg-gray-950 border-gray-700"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Notes (Optional)</label>
                <Input
                  value={newShipment.notes}
                  onChange={(e) => setNewShipment(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  className="bg-gray-950 border-gray-700"
                />
              </div>

              <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-3">
                <p className="text-xs text-blue-400 font-medium mb-1">Note:</p>
                <p className="text-xs text-gray-400">
                  This amount will be added to the total bill. You can upload tracking documents after creating the shipment.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowShipmentModal(false)}
                  variant="outline"
                  className="flex-1 border-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddShipment}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Add Shipment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Worker Modal */}
      {showWorkerEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" style={{ zIndex: 9999 }}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-blue-400" />
                Manage Workers
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowWorkerEditModal(null)}
                className="h-8 w-8 p-0"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Workers List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Assigned Workers</label>
                  <Button
                    size="sm"
                    onClick={handleAddWorker}
                    className="bg-blue-600 hover:bg-blue-700 h-8"
                  >
                    <Plus size={14} className="mr-1" />
                    Add Worker
                  </Button>
                </div>

                {editingWorkerData.workers.length === 0 ? (
                  <div className="text-center py-8 bg-gray-950/50 rounded-lg border border-dashed border-gray-700">
                    <Users size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">No workers assigned</p>
                    <p className="text-xs text-gray-600 mt-1">Click "Add Worker" to assign</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editingWorkerData.workers.map((worker, index) => (
                      <div key={worker.id} className="bg-gray-950/50 border border-gray-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                            <User size={16} className="text-blue-400" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">Worker Name</label>
                                <select
                                  value={worker.workerId}
                                  onChange={(e) => {
                                    const selectedWorker = mockWorkers.find(w => w.id === e.target.value);
                                    handleUpdateWorker(worker.id, 'workerId', e.target.value);
                                    handleUpdateWorker(worker.id, 'workerName', selectedWorker?.name || '');
                                  }}
                                  className="w-full bg-gray-900 border border-gray-700 rounded-lg text-white text-sm h-9 px-2"
                                >
                                  <option value="">Select...</option>
                                  {mockWorkers.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">Role / Task</label>
                                <Input
                                  value={worker.role}
                                  onChange={(e) => handleUpdateWorker(worker.id, 'role', e.target.value)}
                                  placeholder="e.g., Main, Assistant"
                                  className="bg-gray-900 border-gray-700 text-sm h-9"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-1 block">Worker Cost (Rs)</label>
                                <Input
                                  type="number"
                                  value={worker.cost || ''}
                                  onChange={(e) => handleUpdateWorker(worker.id, 'cost', Number(e.target.value))}
                                  placeholder="0"
                                  className="bg-gray-900 border-gray-700 text-sm h-9"
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveWorker(worker.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-9 w-9 p-0 mt-5"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Total Cost */}
                    <div className="bg-orange-950/30 border border-orange-800/30 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-orange-400">Total Worker Cost:</span>
                        <span className="text-lg font-bold text-orange-400">
                          Rs {editingWorkerData.workers.reduce((sum, w) => sum + (w.cost || 0), 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Expected Completion Date */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Expected Completion Date</label>
                <Input
                  type="date"
                  value={editingWorkerData.expectedCompletionDate}
                  onChange={(e) => setEditingWorkerData(prev => ({ ...prev, expectedCompletionDate: e.target.value }))}
                  className="bg-gray-950 border-gray-700"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Notes (Optional)</label>
                <textarea
                  value={editingWorkerData.notes}
                  onChange={(e) => setEditingWorkerData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any special instructions..."
                  rows={3}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* ERP Info Message */}
              <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-3">
                <p className="text-xs text-blue-400 font-medium mb-1">💡 Worker Payment Handling</p>
                <p className="text-xs text-gray-400">
                  Worker costs are recorded here. When task is completed, payment status becomes "Payable". 
                  Actual payments are handled in <strong className="text-blue-400">Accounting → Worker Payments</strong> module.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowWorkerEditModal(null)}
                  variant="outline"
                  className="flex-1 border-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveWorkerEdit}
                  disabled={editingWorkerData.workers.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={16} className="mr-2" />
                  Save Workers
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Customization Modal */}
      {showTaskCustomizationModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" style={{ zIndex: 9999 }}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 size={18} className="text-purple-400" />
                Customize Production Tasks
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowTaskCustomizationModal(false)}
                className="h-8 w-8 p-0"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Standard Tasks */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Standard Production Tasks</h4>
                <div className="space-y-2">
                  {availableTaskTemplates.map(task => {
                    const TaskIcon = task.icon;
                    const isSelected = selectedTasksForModal.includes(task.id);
                        
                        return (
                          <div
                            key={task.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTasksForModal(selectedTasksForModal.filter(id => id !== task.id));
                              } else {
                                setSelectedTasksForModal([...selectedTasksForModal, task.id]);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                              isSelected 
                                ? "bg-blue-950/30 border-blue-600 ring-2 ring-blue-600/30" 
                                : "bg-gray-950/50 border-gray-800 hover:border-gray-700"
                            )}
                          >
                            <div className={cn(
                              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                              isSelected ? "bg-blue-500/20" : "bg-gray-800"
                            )}>
                              <TaskIcon size={18} className={isSelected ? "text-blue-400" : "text-gray-500"} />
                            </div>
                            <div className="flex-1">
                              <p className={cn(
                                "text-sm font-medium",
                                isSelected ? "text-white" : "text-gray-400"
                              )}>
                                {task.name}
                              </p>
                            </div>
                            <div className={cn(
                              "h-5 w-5 rounded border-2 flex items-center justify-center",
                              isSelected ? "bg-blue-600 border-blue-600" : "border-gray-700"
                            )}>
                              {isSelected && <CheckCircle size={14} className="text-white" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Tasks */}
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-3">Custom Tasks / Others</h4>
                    
                    {/* Add Custom Task Input */}
                    <div className="flex gap-2 mb-3">
                      <Input
                        value={newCustomTaskName}
                        onChange={(e) => setNewCustomTaskName(e.target.value)}
                        placeholder="e.g., Quality Check, Packaging, Ironing..."
                        className="flex-1 bg-gray-950 border-gray-700"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddCustomTask();
                            if (customTasks.length > 0) {
                              const lastTask = customTasks[customTasks.length - 1];
                              setSelectedTasksForModal([...selectedTasksForModal, lastTask.id]);
                            }
                          }
                        }}
                      />
                      <Button
                        onClick={() => {
                          handleAddCustomTask();
                          setTimeout(() => {
                            if (customTasks.length > 0) {
                              const lastTask = customTasks[customTasks.length - 1];
                              setSelectedTasksForModal([...selectedTasksForModal, lastTask.id]);
                            }
                          }, 100);
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus size={16} className="mr-1" />
                        Add
                      </Button>
                    </div>

                    {/* Custom Tasks List */}
                    {customTasks.length > 0 ? (
                      <div className="space-y-2">
                        {customTasks.map(task => {
                          const isSelected = selectedTasksForModal.includes(task.id);
                          
                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border",
                                isSelected 
                                  ? "bg-purple-950/30 border-purple-600" 
                                  : "bg-gray-950/50 border-gray-800"
                              )}
                            >
                              <div className={cn(
                                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                                isSelected ? "bg-purple-500/20" : "bg-gray-800"
                              )}>
                                <MoreHorizontal size={18} className={isSelected ? "text-purple-400" : "text-gray-500"} />
                              </div>
                              <div className="flex-1">
                                <p className={cn(
                                  "text-sm font-medium",
                                  isSelected ? "text-white" : "text-gray-400"
                                )}>
                                  {task.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedTasksForModal(selectedTasksForModal.filter(id => id !== task.id));
                                    } else {
                                      setSelectedTasksForModal([...selectedTasksForModal, task.id]);
                                    }
                                  }}
                                  className={cn(
                                    "h-5 w-5 rounded border-2 flex items-center justify-center",
                                    isSelected ? "bg-purple-600 border-purple-600" : "border-gray-700"
                                  )}
                                >
                                  {isSelected && <CheckCircle size={14} className="text-white" />}
                                </button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    handleRemoveCustomTask(task.id);
                                    setSelectedTasksForModal(selectedTasksForModal.filter(id => id !== task.id));
                                  }}
                                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-950/50 rounded-lg border border-dashed border-gray-700">
                        <MoreHorizontal size={24} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-xs text-gray-500">No custom tasks added</p>
                      </div>
                    )}
                  </div>

                  {/* Selected Summary */}
                  <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-400">Selected Tasks:</span>
                      <span className="text-lg font-bold text-blue-400">{selectedTasksForModal.length}</span>
                    </div>
                    {selectedTasksForModal.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {selectedTasksForModal.map((taskId, index) => {
                          const standardTask = availableTaskTemplates.find(t => t.id === taskId);
                          const customTask = customTasks.find(t => t.id === taskId);
                          const taskName = standardTask?.name || customTask?.name || taskId;
                          
                          return (
                            <Badge key={taskId} className="bg-blue-600/20 text-blue-300 border-blue-600">
                              {index + 1}. {taskName}
                            </Badge>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-2">No tasks selected. Select at least one task to continue.</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => setShowTaskCustomizationModal(false)}
                      variant="outline"
                      className="flex-1 border-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleApplyTaskConfiguration(selectedTasksForModal)}
                      disabled={selectedTasksForModal.length === 0}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                    >
                      <Save size={16} className="mr-2" />
                      Apply Configuration
                    </Button>
                  </div>
                </div>
          </div>
        </div>
      )}

      {/* Shipment Tracking Modal */}
      {/* Edit Tracking ID Modal */}
      {showTrackingModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package size={18} className="text-blue-400" />
                Update Tracking Details
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowTrackingModal(null)}
                className="h-8 w-8 p-0"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4">
              {/* QR Scanner Option */}
              <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
                <p className="text-sm text-blue-300 font-medium mb-3 flex items-center gap-2">
                  <Camera size={16} />
                  Scan Tracking Code
                </p>
                <Button
                  onClick={() => qrScannerRef.current?.click()}
                  variant="outline"
                  className="w-full border-blue-700 text-blue-400 hover:bg-blue-900/20"
                >
                  <Camera size={16} className="mr-2" />
                  Open QR/Barcode Scanner
                </Button>
                <input
                  ref={qrScannerRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleQRScan}
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-gray-900 px-2 text-gray-500">OR ENTER MANUALLY</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Tracking ID</label>
                <Input
                  value={trackingData.trackingId}
                  onChange={(e) => setTrackingData(prev => ({ ...prev, trackingId: e.target.value }))}
                  placeholder="e.g., DHL-987654321"
                  className="bg-gray-950 border-gray-700"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Tracking URL (Optional)</label>
                <Input
                  value={trackingData.trackingUrl}
                  onChange={(e) => setTrackingData(prev => ({ ...prev, trackingUrl: e.target.value }))}
                  placeholder="https://www.courier.com/track?id=..."
                  className="bg-gray-950 border-gray-700"
                />
              </div>

              <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500">
                  <strong className="text-gray-400">Tip:</strong> Use the scanner for quick entry, or paste the tracking link from your courier's email.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowTrackingModal(null)}
                  variant="outline"
                  className="flex-1 border-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTracking}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Save size={16} className="mr-2" />
                  Update Tracking
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
