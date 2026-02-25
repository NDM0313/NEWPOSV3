import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioService } from '@/app/services/studioService';
import { contactService } from '@/app/services/contactService';
import { saleService } from '@/app/services/saleService';
import { studioProductionService } from '@/app/services/studioProductionService';
import { branchService } from '@/app/services/branchService';
import { cn } from '../ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { UnifiedPaymentDialog } from '../shared/UnifiedPaymentDialog';

/** Avoid RangeError when date is missing or invalid */
function safeFormatDate(value: string | null | undefined, fmt: string): string {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : format(d, fmt);
}

type SaleStatus = 'Draft' | 'In Progress' | 'Completed';
type StepStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Completed';

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
  /** Backend stage_type for category-wise worker filtering (dyer | stitching | handwork) */
  stageType?: 'dyer' | 'stitching' | 'handwork';
  assignedWorker: string; // Legacy - for backward compatibility
  workerId?: string; // Legacy
  assignedWorkers?: AssignedWorker[]; // NEW: Multiple workers support
  assignedDate: string;
  expectedCompletionDate: string;
  actualCompletionDate?: string;
  workerCost: number; // Legacy - total cost
  workerPaymentStatus?: 'Payable' | 'Pending' | 'Partial' | 'Paid'; // ERP: Payment status (handled in Accounting)
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
  customerId?: string;
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
  /** 'sale' = from sales table (payment can be recorded); 'studio_order' = from studio_orders only */
  source?: 'sale' | 'studio_order';
}

// Mock data removed - data is loaded from Supabase via loadStudioOrder()

export const StudioSaleDetailNew = () => {
  const { setCurrentView, selectedStudioSaleId, setSelectedStudioSaleId, openDrawer } = useNavigation();
  const { companyId, branchId, user } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [saleDetail, setSaleDetail] = useState<StudioSaleDetail | null>(null);
  const [productionId, setProductionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [showAllWorkersInAssignModal, setShowAllWorkersInAssignModal] = useState(false);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showAccessoryModal, setShowAccessoryModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState<string | null>(null);
  const [showWorkerEditModal, setShowWorkerEditModal] = useState<string | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState<string | null>(null);
  const [receiveActualCost, setReceiveActualCost] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  /** After Confirm Receive: show "Worker Payment" modal (Pay Now / Pay Later) */
  const [payChoiceAfterReceive, setPayChoiceAfterReceive] = useState<{
    stageId: string;
    workerId: string;
    workerName: string;
    amount: number;
  } | null>(null);
  const [showWorkerPaymentDialog, setShowWorkerPaymentDialog] = useState(false);
  const [showCustomerPaymentDialog, setShowCustomerPaymentDialog] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState<string | null>(null);
  const [showTaskCustomizationModal, setShowTaskCustomizationModal] = useState(false);
  const [reopenStepId, setReopenStepId] = useState<string | null>(null);
  const [savingStage, setSavingStage] = useState(false);
  const [pendingLeaveTarget, setPendingLeaveTarget] = useState<'studio' | 'studio-sales-list-new' | null>(null);

  const savedSuccessfullyRef = useRef(false);
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

  // Convert Supabase StudioOrder to StudioSaleDetail interface
  const convertFromSupabaseOrder = useCallback((order: any): StudioSaleDetail => {
    const statusMap: Record<string, SaleStatus> = {
      'pending': 'Draft',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Draft'
    };

    const stepStatusMap: Record<string, StepStatus> = {
      'pending': 'Pending',
      'in_progress': 'In Progress',
      'completed': 'Completed'
    };

    // Get customer info
    const customer = order.customer || {};
    const customerName = customer.name || order.customer_name || 'Unknown';
    const customerPhone = customer.phone || '';

    // Get items
    const items = order.items || [];
    const fabricName = items.length > 0 ? items[0].item_description || 'N/A' : 'N/A';
    const meters = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
    const fabricCost = items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);

    // Get job cards and convert to production steps
    const jobCards = order.job_cards || [];
    const productionSteps: ProductionStep[] = jobCards.map((card: any, index: number) => ({
      id: card.id || `step-${index}`,
      name: card.task_type || 'Unknown Task',
      icon: Scissors, // Default icon
      order: index + 1,
      assignedWorker: card.worker?.name || '',
      workerId: card.assigned_worker_id,
      assignedWorkers: card.assigned_worker_id ? [{
        id: `aw-${index}`,
        workerId: card.assigned_worker_id,
        workerName: card.worker?.name || 'Unknown',
        role: card.task_type || 'Worker',
        cost: card.payment_amount || 0
      }] : [],
      assignedDate: card.start_date || '',
      expectedCompletionDate: card.end_date || '',
      actualCompletionDate: card.end_date || undefined,
      workerCost: card.payment_amount || 0,
      workerPaymentStatus: card.is_paid ? 'Paid' : 'Payable' as 'Payable' | 'Pending' | 'Paid',
      status: stepStatusMap[card.status] || 'Pending',
      notes: card.notes || ''
    }));

    return {
      id: order.id || '',
      invoiceNo: order.order_no || `ORD-${order.id?.slice(0, 8)}`,
      customerName,
      customerPhone,
      saleDate: order.order_date || new Date().toISOString().split('T')[0],
      expectedDeliveryDate: order.delivery_date || order.actual_delivery_date || '',
      saleStatus: statusMap[order.status] || 'Draft',
      fabricName,
      meters,
      fabricCost,
      productionSteps,
      accessories: [], // TODO: Add accessories support
      shipments: [], // TODO: Add shipments support
      payments: [], // TODO: Add payments support
      baseAmount: order.total_cost || 0,
      shipmentCharges: 0,
      totalAmount: order.total_cost || 0,
      paidAmount: order.advance_paid || 0,
      balanceDue: order.balance_due || 0,
      fabricPurchaseCost: fabricCost,
      source: 'studio_order'
    };
  }, []);

  // Map backend stage_type to display name and icon
  const stageTypeToStep = (stageType: string, index: number): { name: string; icon: any } => {
    const order = index + 1;
    if (stageType === 'dyer') return { name: 'Dyeing', icon: Palette };
    if (stageType === 'handwork') return { name: 'Handwork / Embroidery', icon: Sparkles };
    if (stageType === 'stitching') return { name: 'Stitching', icon: Scissors };
    return { name: stageType, icon: Scissors };
  };

  // Convert studio_production_stages to ProductionStep[] (so UI can show and persist edits)
  // ledgerStatusByStageId: optional map from stage id to 'unpaid'|'partial'|'paid' for Payable vs Partial vs Paid
  const stagesToProductionSteps = useCallback((
    stages: Array<{ id: string; stage_type: string; assigned_worker_id?: string | null; assigned_at?: string | null; cost?: number; expected_cost?: number | null; status?: string; expected_completion_date?: string | null; completed_at?: string | null; notes?: string | null; worker?: { id: string; name: string } }>,
    ledgerStatusByStageId?: Record<string, 'unpaid' | 'partial' | 'paid'>
  ): ProductionStep[] => {
    const stageTypeMap: Record<string, 'dyer' | 'stitching' | 'handwork'> = { dyer: 'dyer', dyeing: 'dyer', stitching: 'stitching', handwork: 'handwork' };
    return stages.map((s, i) => {
      const { name, icon } = stageTypeToStep(s.stage_type, i);
      const workerName = s.assigned_worker_id ? (s.worker?.name || '') : '';
      const stageType = stageTypeMap[s.stage_type] || undefined;
      const ledgerStatus = ledgerStatusByStageId?.[s.id];
      const workerPaymentStatus: 'Payable' | 'Pending' | 'Partial' | 'Paid' =
        ledgerStatus === 'paid' ? 'Paid' : ledgerStatus === 'partial' ? 'Partial' : (s.status === 'completed' ? 'Payable' : 'Pending');
      const isCompleted = (s.status || '').toLowerCase() === 'completed';
      const displayCost = isCompleted ? (s.cost ?? 0) : (s.expected_cost ?? s.cost ?? 0);
      // CRITICAL: Only show Assigned when worker exists. status=assigned/in_progress + worker null = invalid; force Pending.
      const rawStatus = (s.status || 'pending').toLowerCase();
      const hasWorker = !!s.assigned_worker_id;
      let status: StepStatus;
      if (isCompleted) status = 'Completed';
      else if (hasWorker && (rawStatus === 'assigned' || rawStatus === 'in_progress')) status = 'Assigned';
      else {
        if ((rawStatus === 'assigned' || rawStatus === 'in_progress') && !hasWorker) {
          console.warn('[StudioSaleDetail] Invalid state: stage', s.id, 'status=', rawStatus, 'but assigned_worker_id is null. Forcing Pending.');
        }
        status = 'Pending';
      }
      return {
        id: s.id,
        name,
        icon,
        order: i + 1,
        stageType,
        assignedWorker: workerName,
        workerId: s.assigned_worker_id || undefined,
        assignedWorkers: s.assigned_worker_id ? [{ id: `aw-${s.id}`, workerId: s.assigned_worker_id, workerName, role: 'Main', cost: displayCost }] : [],
        assignedDate: s.assigned_at || '',
        expectedCompletionDate: s.expected_completion_date || '',
        actualCompletionDate: s.completed_at || undefined,
        workerCost: displayCost,
        workerPaymentStatus,
        status,
        notes: s.notes || ''
      };
    });
  }, []);

  // Convert sale (from sales table, is_studio = true) to StudioSaleDetail for display
  const convertFromSale = useCallback((sale: any): StudioSaleDetail => {
    const customer = sale.customer || {};
    const items = sale.items || [];
    const fabricName = items.length > 0 ? (items[0].product_name || 'N/A') : 'N/A';
    const meters = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    const fabricCost = items.reduce((sum: number, item: any) => sum + (Number((item as any).total) || 0), 0);
    return {
      id: sale.id || '',
      invoiceNo: sale.invoice_no || sale.invoiceNo || `STD-${sale.id?.slice(0, 8)}`,
      customerId: sale.customer_id || undefined,
      customerName: sale.customer_name || customer.name || 'Unknown',
      customerPhone: customer.phone || '',
      saleDate: sale.invoice_date || sale.invoiceDate || new Date().toISOString().split('T')[0],
      expectedDeliveryDate: sale.notes || '',
      saleStatus: sale.status === 'final' ? 'Completed' : sale.status === 'in_progress' ? 'In Progress' : 'Draft',
      fabricName,
      meters,
      fabricCost,
      productionSteps: [],
      accessories: [],
      shipments: [],
      payments: [],
      baseAmount: Number(sale.total) || 0,
      shipmentCharges: 0,
      totalAmount: Number(sale.total) || 0,
      paidAmount: Number(sale.paid_amount) || 0,
      balanceDue: Number(sale.due_amount) || 0,
      fabricPurchaseCost: fabricCost,
      source: 'sale'
    };
  }, []);

  // Load by sale_id first (Option A: sale is source of truth). Load/create studio production + stages and merge into detail.
  const loadStudioOrder = useCallback(async () => {
    if (!selectedStudioSaleId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      try {
        const sale = await saleService.getSale(selectedStudioSaleId);
        if (sale && (sale as any).id) {
          const convertedDetail = convertFromSale(sale);
          try {
            const salePayments = await saleService.getSalePayments(sale.id);
            const payments: Payment[] = (salePayments || []).map((p: any) => ({
              id: p.id,
              date: p.date || '',
              amount: p.amount || 0,
              method: (p.method === 'bank' || p.method === 'bank_transfer' ? 'Bank Transfer' : p.method === 'card' ? 'Card' : p.method === 'cheque' ? 'Cheque' : 'Cash') as Payment['method'],
              reference: p.referenceNumber,
              notes: p.notes
            }));
            convertedDetail.payments = payments;
          } catch (_) { /* ignore */ }
          let productionSteps: ProductionStep[] = [];
          try {
            const productions = await studioProductionService.getProductionsBySaleId(sale.id);
            if (productions.length > 0) {
              const prodId = productions[0].id;
              setProductionId(prodId);
              await studioProductionService.syncWorkerLedgerEntriesForProduction(prodId);
              window.dispatchEvent(new CustomEvent('studio-production-saved'));
              const stages = await studioProductionService.getStagesByProductionId(prodId);
              productionSteps = stagesToProductionSteps(stages);
            } else {
              setProductionId(null);
            }
            if (productions.length === 0 && companyId) {
              let effectiveBranchId = branchId && branchId !== 'all' && /^[0-9a-f-]{36}$/i.test(branchId) ? branchId : null;
              if (!effectiveBranchId) {
                const branches = await branchService.getAllBranches(companyId).catch(() => []);
                effectiveBranchId = branches?.[0]?.id || null;
              }
              if (effectiveBranchId) {
                const items = (sale.items || []) as any[];
                const firstItem = items[0];
                if (firstItem?.product_id) {
                  const production = await studioProductionService.createProductionJob({
                    company_id: companyId,
                    branch_id: effectiveBranchId,
                    sale_id: sale.id,
                    production_no: `PRD-${(sale.invoice_no || sale.id?.slice(0, 8) || '')}`,
                    production_date: sale.invoice_date || new Date().toISOString().split('T')[0],
                    product_id: firstItem.product_id,
                    quantity: Number(firstItem.quantity) || 1,
                    unit: firstItem.unit || 'piece',
                    created_by: user?.id
                  });
                  setProductionId(production.id);
                  // No auto-stages: manager decides via Customize Tasks
                  const stages = await studioProductionService.getStagesByProductionId(production.id);
                  productionSteps = stagesToProductionSteps(stages);
                }
              }
            }
          } catch (e) {
            console.warn('[StudioSaleDetail] Production/stages load or create failed:', e);
          }
          setSaleDetail({ ...convertedDetail, productionSteps });
          return;
        }
      } catch (_) {
        // Not a sale id or sale not found; try studio_order
      }
      try {
        const order = await studioService.getStudioOrder(selectedStudioSaleId);
        const convertedDetail = convertFromSupabaseOrder(order);
        setSaleDetail(convertedDetail);
      } catch {
        setSaleDetail(null);
      }
    } catch (error) {
      console.error('Error loading studio order/sale:', error);
      setSaleDetail(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStudioSaleId, companyId, branchId, user?.id, convertFromSale, convertFromSupabaseOrder, stagesToProductionSteps]);

  /** Filter workers by task category: Dyeing → dyer/dyeing; Stitching → tailor/stitching-master/cutter; Handwork → hand-worker/helper/embroidery */
  const getWorkersForStageType = useCallback((stageType: 'dyer' | 'stitching' | 'handwork' | undefined, workerList: Worker[]): Worker[] => {
    if (!stageType) return workerList;
    const role = (r: string) => (r || '').toLowerCase();
    return workerList.filter(w => {
      const d = role(w.department);
      if (stageType === 'dyer') return d === 'dyer' || d === 'dyeing';
      if (stageType === 'stitching') return ['tailor', 'stitching-master', 'cutter', 'stitching'].includes(d);
      if (stageType === 'handwork') return ['hand-worker', 'helper', 'embroidery', 'handwork'].includes(d);
      return false;
    });
  }, []);

  // Workers = contacts (type=worker). Same ID (synced via workers_sync_from_contacts migration).
  const loadWorkers = useCallback(async () => {
    if (!companyId) return;
    try {
      const workerContacts = await contactService.getAllContacts(companyId, 'worker');
      const converted: Worker[] = (workerContacts || []).map((c: any) => ({
        id: c.id,
        name: c.name || '',
        department: c.worker_role || 'General',
        phone: c.phone || c.mobile || '',
        isActive: c.is_active !== false
      }));
      setWorkers(converted);
    } catch (error) {
      console.error('Error loading workers:', error);
      setWorkers([]);
    }
  }, [companyId]);

  useEffect(() => {
    loadStudioOrder();
    loadWorkers();
  }, [loadStudioOrder, loadWorkers]);

  /** Reload production steps from DB. Returns the loaded steps (with real server ids) for next-step auto-apply. */
  const reloadProductionSteps = useCallback(async (): Promise<ProductionStep[] | undefined> => {
    if (!productionId || !saleDetail) return undefined;
    try {
      await studioProductionService.syncWorkerLedgerEntriesForProduction(productionId);
      window.dispatchEvent(new CustomEvent('studio-production-saved'));
      const stages = await studioProductionService.getStagesByProductionId(productionId);
      const steps = stagesToProductionSteps(stages);
      setSaleDetail(prev => prev ? { ...prev, productionSteps: steps } : prev);
      return steps;
    } catch (e) {
      console.warn('[StudioSaleDetail] Reload stages failed:', e);
      return undefined;
    }
  }, [productionId, saleDetail, stagesToProductionSteps]);

  // Calculate costs
  const calculateInternalCosts = () => {
    if (!saleDetail) return { fabricCost: 0, productionCost: 0, accessoriesCost: 0, shippingCost: 0, totalCost: 0, profit: 0, margin: 0 };
    const fabricCost = saleDetail.fabricPurchaseCost;
    const productionCost = saleDetail.productionSteps.reduce((sum, step) => sum + step.workerCost, 0);
    const accessoriesCost = saleDetail.accessories.reduce((sum, acc) => sum + acc.totalCost, 0);
    const shippingCost = saleDetail.shipments.reduce((sum, ship) => sum + ship.actualCost, 0);
    
    const totalCost = fabricCost + productionCost + accessoriesCost + shippingCost;
    const effectiveTotal = saleDetail.baseAmount + saleDetail.shipmentCharges + productionCost;
    const profit = effectiveTotal - totalCost;
    const margin = totalCost > 0 ? ((profit / effectiveTotal) * 100).toFixed(1) : 0;
    
    return { fabricCost, productionCost, accessoriesCost, shippingCost, totalCost, profit, margin };
  };

  const costs = calculateInternalCosts();

  const studioCharges = saleDetail ? saleDetail.productionSteps.reduce((s, step) => s + step.workerCost, 0) : 0;
  const effectiveTotalAmount = saleDetail ? saleDetail.baseAmount + saleDetail.shipmentCharges + studioCharges : 0;
  const effectiveBalanceDue = saleDetail ? effectiveTotalAmount - saleDetail.paidAmount : 0;

  // Check if all production tasks are completed (normalize status so 'Completed'/'completed' both count)
  const isStepCompleted = (s: { status?: string }) => (s.status || '').toLowerCase() === 'completed';
  const allTasksCompleted = saleDetail
    ? saleDetail.productionSteps.length > 0 && saleDetail.productionSteps.every(isStepCompleted)
    : false;

  /** Header status: ONLY from production stages. Completed = all stages completed; else In Progress / Pending. */
  const headerStatus: SaleStatus = !saleDetail
    ? 'Draft'
    : saleDetail.productionSteps.length === 0
      ? 'Draft'
      : allTasksCompleted
        ? 'Completed'
        : saleDetail.productionSteps.some(s => s.status === 'Assigned' || s.status === 'In Progress' || isStepCompleted(s))
          ? 'In Progress'
          : 'Pending';

  const isStepLocked = (stepOrder: number): boolean => {
    if (!saleDetail || stepOrder === 1) return false;
    const previousStep = saleDetail.productionSteps.find(s => s.order === stepOrder - 1);
    return previousStep?.status !== 'Completed';
  };

  /** Centralized leave logic: if just saved, navigate; else if unsaved, show warning; else navigate */
  const handleAttemptLeave = useCallback((target: 'studio' | 'studio-sales-list-new') => {
    if (savedSuccessfullyRef.current) {
      savedSuccessfullyRef.current = false;
      setCurrentView(target);
      if (target === 'studio-sales-list-new' && selectedStudioSaleId) setSelectedStudioSaleId?.(selectedStudioSaleId);
      return;
    }
    if (hasUnsavedChanges) {
      setPendingLeaveTarget(target);
      setShowUnsavedWarning(true);
      return;
    }
    setCurrentView(target);
    if (target === 'studio-sales-list-new' && selectedStudioSaleId) setSelectedStudioSaleId?.(selectedStudioSaleId);
  }, [hasUnsavedChanges, selectedStudioSaleId, setSelectedStudioSaleId]);

  /** Reopen allowed only if no subsequent step is Completed (workflow integrity) */
  const canReopenStep = (step: { order: number; status: string }): boolean => {
    if (!saleDetail || step.status !== 'Completed') return false;
    const hasLaterCompleted = saleDetail.productionSteps.some(
      s => s.order > step.order && s.status === 'Completed'
    );
    return !hasLaterCompleted;
  };

  const updateStepStatus = async (stepId: string, newStatus: StepStatus) => {
    if (!saleDetail) return;
    const step = saleDetail.productionSteps.find((s) => s.id === stepId);
    const isServerUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stepId);
    const isReopen = (newStatus === 'Assigned' || newStatus === 'In Progress') && step?.status === 'Completed';
    if (isServerUuid && isReopen) {
      setSavingStage(true);
      try {
        await studioProductionService.reopenStage(stepId);
        toast.success('Task reopened. Journal reversed, status reset to Pending.');
        await reloadProductionSteps();
        setReopenStepId(null);
        window.dispatchEvent(new CustomEvent('studio-production-saved'));
      } catch (e: any) {
        toast.error(e?.message || 'Failed to reopen task');
      } finally {
        setSavingStage(false);
      }
      return;
    }
    setSaleDetail(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        productionSteps: prev.productionSteps.map(step =>
          step.id === stepId
            ? {
                ...step,
                status: newStatus,
                actualCompletionDate: newStatus === 'Completed' ? new Date().toISOString().split('T')[0] : undefined,
              }
            : step
        )
      };
    });
    savedSuccessfullyRef.current = false;
    setHasUnsavedChanges(true);
  };

  const handleReceiveConfirm = async () => {
    const stageId = showReceiveModal;
    if (!stageId) return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stageId);
    if (!isUuid) {
      toast.error('Save your changes first to create production stages, then try Receive again.');
      return;
    }
    const actual = parseFloat(receiveActualCost);
    if (isNaN(actual) || actual < 0) {
      toast.error('Enter valid actual cost (Rs)');
      return;
    }
    const step = saleDetail?.productionSteps.find(s => s.id === stageId);
    const workerId = step?.workerId || '';
    const workerName = step?.assignedWorker || 'Worker';
    setSavingStage(true);
    try {
      await studioProductionService.receiveStage(stageId, actual, receiveNotes.trim() || null, workerId || undefined);
      toast.success('Received from worker. Stage completed & worker ledger updated.');
      setShowReceiveModal(null);
      setReceiveActualCost('');
      setReceiveNotes('');
      savedSuccessfullyRef.current = false;
      setHasUnsavedChanges(true);
      const currentStep = saleDetail?.productionSteps.find((s) => s.id === stageId);
      const nextOrder = currentStep ? currentStep.order + 1 : 0;
      const stepsAfterReload = await reloadProductionSteps();
      const nextStep = stepsAfterReload?.find((s) => s.order === nextOrder);
      if (nextStep) {
        setExpandedSteps((prev) => new Set(prev).add(nextStep.id));
        if (nextStep.status === 'Pending') {
          setShowWorkerEditModal(nextStep.id);
          setEditingWorkerData({
            workers: [{ id: `aw-${nextStep.id}`, workerId: '', workerName: '', role: 'Main', cost: 0 }],
            expectedCompletionDate: '',
            notes: '',
          });
        }
      }
      window.dispatchEvent(new CustomEvent('studio-production-saved'));
      window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: workerId } }));
      setPayChoiceAfterReceive({ stageId, workerId, workerName, amount: actual });
    } catch (e: any) {
      toast.error(e?.message || 'Receive failed');
    } finally {
      setSavingStage(false);
    }
  };

  /** Try to ensure a studio production exists for the current sale (create if missing). Returns productionId or error reason. */
  const ensureProductionForSale = useCallback(async (): Promise<{ productionId: string | null; error?: 'NO_BRANCH' | 'NO_ITEMS' | 'CREATE_FAILED' }> => {
    if (!selectedStudioSaleId || !companyId) return { productionId: null, error: 'CREATE_FAILED' };
    try {
      const sale = await saleService.getSale(selectedStudioSaleId);
      if (!sale?.id) return { productionId: null, error: 'CREATE_FAILED' };
      const productions = await studioProductionService.getProductionsBySaleId(sale.id);
      if (productions.length > 0) return { productionId: productions[0].id };
      let effectiveBranchId = branchId && branchId !== 'all' && /^[0-9a-f-]{36}$/i.test(branchId) ? branchId : null;
      if (!effectiveBranchId) {
        const branches = await branchService.getAllBranches(companyId).catch(() => []);
        effectiveBranchId = branches?.[0]?.id || null;
      }
      if (!effectiveBranchId) return { productionId: null, error: 'NO_BRANCH' };
      const items = (sale.items || []) as any[];
      const firstItem = items[0];
      if (!firstItem?.product_id) return { productionId: null, error: 'NO_ITEMS' };
      const production = await studioProductionService.createProductionJob({
        company_id: companyId,
        branch_id: effectiveBranchId,
        sale_id: sale.id,
        production_no: `PRD-${(sale.invoice_no || sale.id?.slice(0, 8) || '')}`,
        production_date: sale.invoice_date || new Date().toISOString().split('T')[0],
        product_id: firstItem.product_id,
        quantity: Number(firstItem.quantity) || 1,
        unit: firstItem.unit || 'piece',
        created_by: user?.id
      });
      // No auto-stages: manager decides via Customize Tasks
      return { productionId: production.id };
    } catch (e) {
      console.warn('[StudioSaleDetail] ensureProductionForSale failed:', e);
      return { productionId: null, error: 'CREATE_FAILED' };
    }
  }, [selectedStudioSaleId, companyId, branchId, user?.id]);

  /** Persist all production steps to DB. Fetches server stage IDs by order so we never rely on local step.id. */
  const persistAllStagesToBackend = useCallback(async (opts?: { skipConfirmDialog?: boolean }) => {
    if (!saleDetail) {
      toast.error('No sale data. Refresh the page and try again.');
      return;
    }
    let currentProductionId = productionId;
    if (!currentProductionId) {
      const result = await ensureProductionForSale();
      if (result.error === 'NO_BRANCH') {
        toast.error('No branch selected. Select a branch in the app header (or add one in Settings), refresh the page, then try saving again.');
        return;
      }
      if (result.error === 'NO_ITEMS') {
        toast.error('This sale has no product line. Add at least one product to the sale, then try saving again.');
        return;
      }
      if (result.error || !result.productionId) {
        toast.error('Production could not be created. Select a branch and refresh the page, then try saving again.');
        return;
      }
      currentProductionId = result.productionId;
      setProductionId(result.productionId);
    }
    const localSteps = [...(saleDetail.productionSteps || [])].sort((a, b) => a.order - b.order);
    if (localSteps.length === 0) {
      toast.info('Add stages via Customize Tasks first.');
      return;
    }
    const validWorkerIds = new Set(workers.map(w => w.id));
    const resolveWorkerId = (id: string | undefined): string | null => {
      if (!id) return null;
      return validWorkerIds.has(id) ? id : null;
    };
    for (const step of localSteps) {
      if (step.status !== 'Completed') continue;
      const cost = step.workerCost ?? 0;
      if (cost <= 0) continue;
      const wid = resolveWorkerId(step.workerId || step.assignedWorkers?.[0]?.workerId);
      if (!wid) {
        toast.error('Completed tasks with cost must have a worker assigned. Please assign a worker to each completed task before saving.');
        return;
      }
    }
    setSavingStage(true);
    try {
      let serverStages = await studioProductionService.getStagesByProductionId(currentProductionId);
      if (serverStages.length === 0 && localSteps.length > 0) {
        // Create stages from manager's choices (localSteps), not default 3
        for (const step of localSteps) {
          const st = step.stageType || 'handwork';
          await studioProductionService.createStage(currentProductionId, { stage_type: st, cost: 0 });
        }
        serverStages = await studioProductionService.getStagesByProductionId(currentProductionId);
      }
      if (serverStages.length === 0) {
        toast.error('No stages to sync. Add stages via Customize Tasks first.');
        setSavingStage(false);
        return;
      }
      const serverStageById = new Map(serverStages.map((s: any) => [s.id, s]));
      const serverStagesByOrder = [...serverStages].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      const completedOrdersJustSaved: number[] = [];
      for (const step of localSteps) {
        const serverStageByOrder = serverStagesByOrder[step.order - 1];
        const serverStage = serverStageById.get(step.id) ?? serverStageByOrder;
        if (!serverStage) continue;
        const stageId = (serverStage as any).id;
        const serverIsCompleted = (serverStage as any).status === 'completed';
        const localIsCompleted = step.status === 'Completed';
        if (localIsCompleted && !serverIsCompleted) completedOrdersJustSaved.push(step.order);
        if (serverIsCompleted && localIsCompleted) continue;
        const backendStatus = step.status === 'Pending' ? 'pending' : step.status === 'Completed' ? 'completed' : 'assigned';
        const workerId = resolveWorkerId(step.workerId || step.assignedWorkers?.[0]?.workerId);
        await studioProductionService.updateStage(stageId, {
          assigned_worker_id: workerId,
          cost: step.workerCost ?? 0,
          expected_completion_date: step.expectedCompletionDate || null,
          notes: step.notes || null,
          status: backendStatus as 'pending' | 'assigned' | 'in_progress' | 'completed',
          completed_at: step.status === 'Completed' && step.actualCompletionDate
            ? new Date(step.actualCompletionDate).toISOString()
            : step.status === 'Completed'
            ? new Date().toISOString()
            : null
        });
      }
      const maxCompletedOrder = completedOrdersJustSaved.length ? Math.max(...completedOrdersJustSaved) : 0;
      const stepsAfterReload = await reloadProductionSteps();
      const nextStepAfterSave = stepsAfterReload?.find((s) => s.order === maxCompletedOrder + 1);
      if (nextStepAfterSave) {
        setExpandedSteps((prev) => new Set(prev).add(nextStepAfterSave.id));
        if (nextStepAfterSave.status === 'Pending') {
          setShowWorkerEditModal(nextStepAfterSave.id);
          setEditingWorkerData({
            workers: [{ id: `aw-${nextStepAfterSave.id}`, workerId: '', workerName: '', role: 'Main', cost: 0 }],
            expectedCompletionDate: '',
            notes: '',
          });
        }
      }
      setHasUnsavedChanges(false);
      savedSuccessfullyRef.current = true;
      toast.success('Changes saved to database.');
      window.dispatchEvent(new CustomEvent('studio-production-saved'));
      if (!opts?.skipConfirmDialog) setShowSaveConfirmDialog(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save changes');
    } finally {
      setSavingStage(false);
    }
  }, [saleDetail, productionId, ensureProductionForSale, reloadProductionSteps, workers]);

  const handleSaveAndLeave = useCallback(async () => {
    const target = pendingLeaveTarget;
    setShowUnsavedWarning(false);
    setPendingLeaveTarget(null);
    if (!target) return;
    try {
      await persistAllStagesToBackend({ skipConfirmDialog: true });
      setCurrentView(target);
      if (target === 'studio-sales-list-new' && selectedStudioSaleId) setSelectedStudioSaleId?.(selectedStudioSaleId);
    } catch {
      setPendingLeaveTarget(target);
      setShowUnsavedWarning(true);
    }
  }, [pendingLeaveTarget, selectedStudioSaleId, setSelectedStudioSaleId, persistAllStagesToBackend]);

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
      step => step.status === 'Assigned' || step.status === 'In Progress' || step.status === 'Completed'
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
    if (!saleDetail) return;
    const shipment = saleDetail.shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    // Confirm before deleting
    if (!confirm(`Delete shipment? This will reduce the total bill by ${formatCurrency(shipment.chargedToCustomer)}`)) {
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

  const handleSaveWorkerEdit = async (andStart: boolean = false) => {
    if (!showWorkerEditModal) return;

    const totalWorkerCost = editingWorkerData.workers.reduce((sum, w) => sum + w.cost, 0);
    const displayName = editingWorkerData.workers.length > 1
      ? `${editingWorkerData.workers[0].workerName} + ${editingWorkerData.workers.length - 1} more`
      : editingWorkerData.workers[0]?.workerName || '';

    const stepId = showWorkerEditModal;
    const isServerUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stepId);
    const oneWorker = editingWorkerData.workers.length === 1 && editingWorkerData.workers[0]?.workerId;

    if (isServerUuid && oneWorker && editingWorkerData.workers[0]) {
      setSavingStage(true);
      try {
        await studioProductionService.assignWorkerToStage(stepId, {
          worker_id: editingWorkerData.workers[0].workerId,
          expected_cost: totalWorkerCost,
          expected_completion_date: editingWorkerData.expectedCompletionDate?.trim() || null,
          notes: editingWorkerData.notes?.trim() || null,
        });
        toast.success('Worker assigned. Click Receive when job is done.');
        await reloadProductionSteps();
        setShowWorkerEditModal(null);
        window.dispatchEvent(new CustomEvent('studio-production-saved'));
      } catch (e: any) {
        toast.error(e?.message || 'Assign failed');
      } finally {
        setSavingStage(false);
      }
      return;
    }

    const setInProgress = editingWorkerData.workers.length > 0;
    setSaleDetail(prev => ({
      ...prev!,
      productionSteps: prev!.productionSteps.map(step =>
        step.id === stepId
          ? {
              ...step,
              assignedWorker: displayName,
              workerId: editingWorkerData.workers[0]?.workerId,
              assignedWorkers: editingWorkerData.workers,
              workerCost: totalWorkerCost,
              expectedCompletionDate: editingWorkerData.expectedCompletionDate,
              notes: editingWorkerData.notes,
              assignedDate: step.assignedDate || new Date().toISOString().split('T')[0],
              ...(setInProgress && step.status !== 'Completed' ? { status: 'Assigned' as StepStatus } : andStart ? { status: 'Assigned' as StepStatus } : {})
            }
          : step
      )
    }));
    savedSuccessfullyRef.current = false;
    setHasUnsavedChanges(true);
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

  // Map stageType to template id (for modal selection)
  const stageTypeToTemplateId: Record<string, string> = { dyer: 'dyeing', handwork: 'handwork', stitching: 'stitching' };

  // Apply task configuration – PRESERVE existing step data, then PERSIST to backend so it survives navigation
  const handleApplyTaskConfiguration = async (selectedTaskIds: string[]) => {
    const existingSteps = saleDetail.productionSteps;
    const newSteps: ProductionStep[] = [];
    let order = 1;

    const findExistingByStageType = (stageType: 'dyer' | 'handwork' | 'stitching') =>
      existingSteps.find(s => s.stageType === stageType);

    const findExistingById = (id: string) => existingSteps.find(s => s.id === id);

    selectedTaskIds.forEach(taskId => {
      if (taskId === 'dyeing') {
        const existing = findExistingByStageType('dyer');
        newSteps.push(existing ? {
          ...existing,
          order: order++,
          name: 'Dyeing',
          icon: Palette,
          stageType: 'dyer' as const,
        } : {
          id: 'dyeing',
          name: 'Dyeing',
          icon: Palette,
          order: order++,
          stageType: 'dyer',
          assignedWorker: '',
          assignedWorkers: [],
          assignedDate: '',
          expectedCompletionDate: '',
          workerCost: 0,
          status: 'Pending' as const,
          notes: ''
        });
      } else if (taskId === 'handwork') {
        const existing = findExistingByStageType('handwork');
        newSteps.push(existing ? {
          ...existing,
          order: order++,
          name: 'Handwork / Embroidery',
          icon: Sparkles,
          stageType: 'handwork' as const,
        } : {
          id: 'handwork',
          name: 'Handwork / Embroidery',
          icon: Sparkles,
          order: order++,
          stageType: 'handwork',
          assignedWorker: '',
          assignedWorkers: [],
          assignedDate: '',
          expectedCompletionDate: '',
          workerCost: 0,
          status: 'Pending' as const,
          notes: ''
        });
      } else if (taskId === 'stitching') {
        const existing = findExistingByStageType('stitching');
        newSteps.push(existing ? {
          ...existing,
          order: order++,
          name: 'Stitching',
          icon: Scissors,
          stageType: 'stitching' as const,
        } : {
          id: 'stitching',
          name: 'Stitching',
          icon: Scissors,
          order: order++,
          stageType: 'stitching',
          assignedWorker: '',
          assignedWorkers: [],
          assignedDate: '',
          expectedCompletionDate: '',
          workerCost: 0,
          status: 'Pending' as const,
          notes: ''
        });
      } else {
        // Custom task – preserve existing if same id
        const customTask = customTasks.find(t => t.id === taskId);
        const existing = findExistingById(taskId);
        if (customTask) {
          newSteps.push(existing ? {
            ...existing,
            order: order++,
            name: customTask.name,
            icon: MoreHorizontal,
          } : {
            id: customTask.id,
            name: customTask.name,
            icon: MoreHorizontal,
            order: order++,
            assignedWorker: '',
            assignedWorkers: [],
            assignedDate: '',
            expectedCompletionDate: '',
            workerCost: 0,
            status: 'Pending' as const,
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

    // Persist configuration so it survives back/forward navigation
    try {
      let currentProductionId = productionId;
      if (!currentProductionId) {
        const result = await ensureProductionForSale();
        if (result.productionId) {
          currentProductionId = result.productionId;
          setProductionId(result.productionId);
        }
      }
      if (currentProductionId) {
        const stages = await studioProductionService.getStagesByProductionId(currentProductionId);
        const taskIdToStageType: Record<string, 'dyer' | 'handwork' | 'stitching'> = {
          dyeing: 'dyer',
          handwork: 'handwork',
          stitching: 'stitching',
        };
        const selectedTypes = new Set(
          selectedTaskIds
            .map((tid) => taskIdToStageType[tid])
            .filter((t): t is 'dyer' | 'handwork' | 'stitching' => !!t)
        );
        const stagesArr = stages as any[];
        const existingTypes = new Set(stagesArr.map((s: any) => s.stage_type));
        const allPendingAndUnassigned = stagesArr.every((s) => s.status !== 'completed' && !s.assigned_worker_id);

        if (allPendingAndUnassigned && stagesArr.length > 0) {
          // Delete all and recreate in selected order so backend created_at matches selection order
          for (const s of stagesArr) {
            try {
              await studioProductionService.deleteStage(s.id);
            } catch {
              /* skip */
            }
          }
          existingTypes.clear();
        } else {
          // Delete only stages that are no longer selected
          for (const s of stagesArr) {
            const stageType = s.stage_type;
            if (!selectedTypes.has(stageType)) {
              try {
                await studioProductionService.deleteStage(s.id);
                existingTypes.delete(stageType);
              } catch (delErr: any) {
                toast.warning(delErr?.message || `Could not remove ${stageType}. It may have a worker assigned or be completed.`);
              }
            }
          }
        }

        // Create stages that are selected but not yet in backend (in selected order)
        for (const taskId of selectedTaskIds) {
          const stageType = taskIdToStageType[taskId];
          if (stageType && !existingTypes.has(stageType)) {
            await studioProductionService.createStage(currentProductionId, { stage_type: stageType, cost: 0 });
            existingTypes.add(stageType);
          }
        }

        // Update local step IDs with server UUIDs so Assign worker works (backend expects real stage ids)
        const stagesAfterSync = await studioProductionService.getStagesByProductionId(currentProductionId);
        const stageByType = new Map((stagesAfterSync as any[]).map((s: any) => [s.stage_type, s]));
        setSaleDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            productionSteps: prev.productionSteps.map((step) => {
              const st = step.stageType;
              if (st && stageByType.has(st)) {
                const serverStage = stageByType.get(st);
                return { ...step, id: serverStage.id };
              }
              return step;
            }),
          };
        });

        toast.success('Configuration saved.');
      }
    } catch (e: any) {
      console.warn('[StudioSaleDetail] Persist task config failed:', e?.message);
      toast.warning('Configuration applied locally. Save from the page to persist.');
    }
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
    if (!saleDetail) return false;
    if (allTasksCompleted) return false;
    return !saleDetail.productionSteps.some(step => step.status === 'Assigned' || step.status === 'In Progress' || step.status === 'Completed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!saleDetail) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Studio order not found</p>
          <Button onClick={() => setCurrentView('studio')} variant="outline">
            <ArrowLeft size={16} className="mr-2" />
            Back to Studio Sales
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#111827] text-white overflow-hidden">
      {/* Page is always editable (no Edit mode toggle). Save Changes appears when worker/stage/cost/time change. */}
      {/* ============ FIXED HEADER ============ */}
      <div className="shrink-0 bg-[#0B1019] border-b border-gray-800 z-20">
        {/* Top Bar */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-gray-800/50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleAttemptLeave('studio')}
              className="text-gray-400 hover:text-white h-9 w-9"
            >
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">{saleDetail.invoiceNo}</h1>
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-cyan-900/30 text-cyan-400 border-cyan-600/50">Studio</Badge>
                Studio Production Order
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedStudioSaleId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAttemptLeave('studio-sales-list-new')}
                className="border-cyan-600 text-cyan-400 hover:bg-cyan-900/30"
              >
                <Package size={14} className="mr-1.5" />
                Studio Sales
              </Button>
            )}
            <Badge 
              variant="outline" 
              title="Status from production stages (reactive)"
              className={cn(
                "text-xs px-3 py-1.5",
                headerStatus === 'Draft' && "bg-gray-500/20 text-gray-400 border-gray-700",
                headerStatus === 'Pending' && "bg-gray-500/20 text-gray-400 border-gray-700",
                headerStatus === 'In Progress' && "bg-blue-500/20 text-blue-400 border-blue-700",
                headerStatus === 'Completed' && "bg-green-500/20 text-green-400 border-green-700"
              )}
            >
              {headerStatus}
            </Badge>
            {hasUnsavedChanges && (
              <Button
                size="sm"
                disabled={savingStage}
                onClick={() => persistAllStagesToBackend()}
                className="bg-green-600 hover:bg-green-700"
              >
                {savingStage ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                Save Changes
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
              <p className="text-white">{safeFormatDate(saleDetail.saleDate, 'dd MMM yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Deadline</p>
              <p className="text-yellow-400 font-medium">{safeFormatDate(saleDetail.expectedDeliveryDate, 'dd MMM yyyy')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Bill</p>
              <p className="text-white font-bold text-lg">{formatCurrency(effectiveTotalAmount)}</p>
              {saleDetail.shipmentCharges > 0 && (
                <p className="text-xs text-blue-400">Inc. shipping {formatCurrency(saleDetail.shipmentCharges)}</p>
              )}
              {studioCharges > 0 && (
                <p className="text-xs text-orange-400">Inc. studio {formatCurrency(studioCharges)}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Balance Due</p>
              <p className={cn(
                "font-bold text-lg",
                effectiveBalanceDue === 0 ? "text-green-400" : "text-orange-400"
              )}>
                {formatCurrency(effectiveBalanceDue)}
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
                          (step.status === 'Assigned' || step.status === 'In Progress') && "bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/40",
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
                            (step.status === 'Assigned' || step.status === 'In Progress') && "text-blue-400",
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
            
            {/* Final Complete: only when all stages completed; visibility reactive from headerStatus */}
            {productionId && headerStatus !== 'Completed' && (
              <Button
                size="sm"
                disabled={!allTasksCompleted || savingStage}
                title={!allTasksCompleted ? 'Complete all production stages first' : undefined}
                onClick={async () => {
                  if (!allTasksCompleted || !productionId) return;
                  setSavingStage(true);
                  try {
                    await studioProductionService.changeProductionStatus(productionId, 'completed');
                    toast.success('Production completed. Sale finalized, worker ledger & inventory updated.');
                    await loadStudioOrder();
                  } catch (e: any) {
                    toast.error(e?.message || 'Final completion failed');
                  } finally {
                    setSavingStage(false);
                  }
                }}
                className={cn(
                  "bg-green-600 hover:bg-green-700 text-white",
                  (!allTasksCompleted || savingStage) && "opacity-50 cursor-not-allowed"
                )}
              >
                {savingStage ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />}
                Final Complete
              </Button>
            )}
            {allTasksCompleted && (
              <Badge className="bg-green-600 text-white px-4 py-2 text-sm font-semibold">
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
                      const templateIds: string[] = [];
                      const customToAdd: Array<{ id: string; name: string }> = [];
                      saleDetail.productionSteps.forEach(s => {
                        const tid = s.stageType ? stageTypeToTemplateId[s.stageType] : undefined;
                        if (tid) templateIds.push(tid);
                        else {
                          templateIds.push(s.id);
                          if (!customTasks.some(ct => ct.id === s.id)) {
                            customToAdd.push({ id: s.id, name: s.name });
                          }
                        }
                      });
                      if (customToAdd.length > 0) {
                        setCustomTasks(prev => [...prev, ...customToAdd]);
                      }
                      setSelectedTasksForModal([...new Set(templateIds)]);
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
                            (step.status === 'Assigned' || step.status === 'In Progress') && "border-blue-700/50 bg-blue-950/10",
                            step.status === 'Pending' && "border-gray-800"
                          )}
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-4">
                              {/* Icon */}
                              <div className={cn(
                                "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                                step.status === 'Completed' && "bg-green-500/20",
                                (step.status === 'Assigned' || step.status === 'In Progress') && "bg-blue-500/20",
                                step.status === 'Pending' && stepLocked && "bg-gray-800",
                                step.status === 'Pending' && !stepLocked && "bg-gray-700/30"
                              )}>
                                {stepLocked ? (
                                  <Lock size={20} className="text-gray-600" />
                                ) : (
                                  <StepIcon size={20} className={cn(
                                    step.status === 'Completed' && "text-green-400",
                                    (step.status === 'Assigned' || step.status === 'In Progress') && "text-blue-400",
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
                                          (step.status === 'Assigned' || step.status === 'In Progress') && "bg-blue-500/20 text-blue-400 border-blue-700",
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
                                          <span className="text-orange-400 font-medium">{formatCurrency(step.workerCost)}</span>
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
                                                step.workerPaymentStatus === 'Partial' && "bg-yellow-500/20 text-yellow-400 border-yellow-700",
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
                                    {/* Assign / Change worker (no Edit button) */}
                                    {!stepLocked && step.status !== 'Completed' && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleOpenWorkerEdit(step.id)}
                                        className={step.assignedWorker ? "text-xs h-8 bg-blue-600 hover:bg-blue-700" : "text-xs h-8 bg-green-600 hover:bg-green-700"}
                                      >
                                        <Plus size={14} className="mr-1" />
                                        {step.assignedWorker ? 'Change worker' : 'Assign'}
                                      </Button>
                                    )}
                                    
                                    {/* Assigned → Receive from Worker: job done? Enter actual cost & confirm to mark complete */}
                                    {!stepLocked && (step.status === 'Assigned' || step.status === 'In Progress') && step.assignedWorker && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(step.id)) {
                                            toast.error('Save your changes first to create production stages, then try Receive again.');
                                            return;
                                          }
                                          setReceiveActualCost(String(step.workerCost || ''));
                                          setReceiveNotes(step.notes || '');
                                          setShowReceiveModal(step.id);
                                        }}
                                        className="text-xs h-8 bg-green-600 hover:bg-green-700"
                                        title="Worker job done? Enter actual cost and confirm to mark this task complete"
                                      >
                                        Receive from Worker
                                      </Button>
                                    )}
                                    
                                    {step.status === 'Completed' && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleOpenWorkerEdit(step.id)}
                                          className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-900/20"
                                          title="View details"
                                        >
                                          <Eye size={16} />
                                        </Button>
                                        {!stepLocked && canReopenStep(step) && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setReopenStepId(step.id)}
                                            className="h-8 w-8 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                                            title="Mark In Progress (Reopen task)"
                                          >
                                            <RotateCcw size={16} />
                                          </Button>
                                        )}
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
                                      Assigned: {safeFormatDate(step.assignedDate, 'dd MMM yyyy')}
                                    </span>
                                  </div>
                                )}
                                {step.expectedCompletionDate && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock size={14} className="text-gray-500" />
                                    <span className="text-gray-400">
                                      Expected: {safeFormatDate(step.expectedCompletionDate, 'dd MMM yyyy')}
                                    </span>
                                  </div>
                                )}
                                {step.actualCompletionDate && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle size={14} className="text-green-400" />
                                    <span className="text-green-400">
                                      Completed: {safeFormatDate(step.actualCompletionDate, 'dd MMM yyyy')}
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
                        {formatCurrency(saleDetail.productionSteps.reduce((sum, step) => sum + step.workerCost, 0))}
                      </span>
                    </div>
                    
                    {/* Payment Status Breakdown */}
                    <div className="pt-2 border-t border-gray-800">
                      <p className="text-xs text-gray-500 mb-2">Payment Status:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-green-950/30 border border-green-800/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-green-400 mb-1">Paid</p>
                          <p className="text-sm font-bold text-green-400">
                            {formatCurrency(saleDetail.productionSteps
                              .filter(s => s.workerPaymentStatus === 'Paid')
                              .reduce((sum, s) => sum + s.workerCost, 0))}
                          </p>
                        </div>
                        <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-amber-400 mb-1">Partial</p>
                          <p className="text-sm font-bold text-amber-400">
                            {formatCurrency(saleDetail.productionSteps
                              .filter(s => s.workerPaymentStatus === 'Partial')
                              .reduce((sum, s) => sum + s.workerCost, 0))}
                          </p>
                        </div>
                        <div className="bg-yellow-950/30 border border-yellow-800/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-yellow-400 mb-1">Pending</p>
                          <p className="text-sm font-bold text-yellow-400">
                            {formatCurrency(saleDetail.productionSteps
                              .filter(s => s.workerPaymentStatus === 'Pending')
                              .reduce((sum, s) => sum + s.workerCost, 0))}
                          </p>
                        </div>
                        <div className="bg-orange-950/30 border border-orange-800/30 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-orange-400 mb-1">Payable</p>
                          <p className="text-sm font-bold text-orange-400">
                            {formatCurrency(saleDetail.productionSteps
                              .filter(s => s.workerPaymentStatus === 'Payable')
                              .reduce((sum, s) => sum + s.workerCost, 0))}
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
                            <span>Unit: {formatCurrency(acc.unitCost)}</span>
                            <span>•</span>
                            <span className="text-orange-400 font-medium">Total: {formatCurrency(acc.totalCost)}</span>
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
                                  <p className="text-white">{safeFormatDate(shipment.bookingDate, 'dd MMM yyyy')}</p>
                                </div>
                              )}
                              {shipment.expectedDeliveryDate && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Expected Delivery</p>
                                  <p className="text-yellow-400">{safeFormatDate(shipment.expectedDeliveryDate, 'dd MMM yyyy')}</p>
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
                                          {safeFormatDate(doc.uploadedAt, 'dd MMM yyyy HH:mm')}
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
                                    Rate: 1 USD = {shipment.usdToPkrRate} • {formatCurrency(shipment.chargedToCustomer * shipment.usdToPkrRate)}
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
                    effectiveBalanceDue === 0 && "bg-green-600",
                    effectiveBalanceDue > 0 && saleDetail.paidAmount > 0 && "bg-blue-600",
                    effectiveBalanceDue === effectiveTotalAmount && "bg-orange-600"
                  )}>
                    {effectiveBalanceDue === 0 ? 'Paid' : saleDetail.paidAmount > 0 ? 'Partial' : 'Pending'}
                  </Badge>
                </div>

                {/* Summary Card */}
                <div className={cn(
                  "border rounded-xl p-5 mb-4",
                  effectiveBalanceDue === 0 
                    ? "bg-gradient-to-br from-green-950/30 to-green-900/20 border-green-800/50"
                    : saleDetail.paidAmount > 0
                      ? "bg-gradient-to-br from-blue-950/30 to-blue-900/20 border-blue-800/50"
                      : "bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800"
                )}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Sale Amount</span>
                      <span className="text-xl font-bold text-white">{formatCurrency(saleDetail.baseAmount + saleDetail.shipmentCharges)}</span>
                    </div>
                    {saleDetail.shipmentCharges > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Base Amount</span>
                        <span className="text-gray-400">{formatCurrency(saleDetail.baseAmount)}</span>
                      </div>
                    )}
                    {saleDetail.shipmentCharges > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Shipping Charges</span>
                        <span className="text-blue-400">{formatCurrency(saleDetail.shipmentCharges)}</span>
                      </div>
                    )}
                    {studioCharges > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Studio Charges (worker cost)</span>
                        <span className="text-xl font-bold text-orange-400">{formatCurrency(studioCharges)}</span>
                      </div>
                    )}
                    {saleDetail.paidAmount > 0 && (
                      <>
                        <div className="h-px bg-gray-800"></div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Paid</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-green-400">{formatCurrency(saleDetail.paidAmount)}</span>
                            <span className="text-xs text-gray-500">
                              ({effectiveTotalAmount > 0 ? ((saleDetail.paidAmount / effectiveTotalAmount) * 100).toFixed(0) : 0}%)
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
                          effectiveBalanceDue === 0 ? "text-green-400" : "text-orange-400"
                        )}>
                          {formatCurrency(effectiveBalanceDue)}
                        </span>
                        {effectiveBalanceDue === 0 && (
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
                        Customer payments: <strong className="text-blue-400">Accounting → Customer Receipts</strong>. 
                        Worker payments are separate: <strong className="text-blue-400">Accounting → Worker Payments</strong>. 
                        Balance Due is driven by customer receipts only.
                      </p>
                      {effectiveBalanceDue > 0 && saleDetail.source === 'sale' && (
                        <Button
                          onClick={() => setShowCustomerPaymentDialog(true)}
                          className="bg-blue-600 hover:bg-blue-700 h-9 text-sm"
                        >
                          <CreditCard size={14} className="mr-2" />
                          Receive Payment
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
                            {formatCurrency(payment.amount)}
                          </span>
                          <Badge variant="outline" className="bg-gray-800 text-gray-300 border-gray-700 text-xs">
                            {payment.method}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar size={12} />
                          <span>{safeFormatDate(payment.date, 'dd MMM yyyy')}</span>
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

      {/* Assign Worker Modal – workers filtered by task category (Dyeing / Stitching / Handwork) */}
      {showWorkerEditModal && (() => {
        const currentStep = saleDetail?.productionSteps.find(s => s.id === showWorkerEditModal);
        const workersForCategory = getWorkersForStageType(currentStep?.stageType, workers);
        const workerList = showAllWorkersInAssignModal ? workers : workersForCategory;
        const categoryLabel = currentStep?.stageType === 'dyer' ? 'Dyeing' : currentStep?.stageType === 'stitching' ? 'Stitching' : currentStep?.stageType === 'handwork' ? 'Handwork / Embroidery' : 'this task';
        return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" style={{ zIndex: 9999 }}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users size={18} className="text-blue-400" />
                  Assign worker – {currentStep?.name || categoryLabel}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {showAllWorkersInAssignModal ? 'Showing all workers.' : `Only ${categoryLabel} workers shown.`} Click &quot;Save Changes&quot; at the top to persist.
                </p>
                {currentStep?.status === 'Pending' && (
                  <p className="text-xs text-gray-500 mt-0.5">Save & Start sets stage to In Progress. Next step unlocks after you Receive from Worker.</p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowWorkerEditModal(null); setShowAllWorkersInAssignModal(false); }}
                className="h-8 w-8 p-0"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="show-all-workers"
                checked={showAllWorkersInAssignModal}
                onChange={(e) => setShowAllWorkersInAssignModal(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              <label htmlFor="show-all-workers" className="text-sm text-gray-400 cursor-pointer">Show all workers</label>
            </div>

            {workerList.length === 0 && (
              <div className="mb-4 p-4 bg-amber-950/30 border border-amber-800/50 rounded-lg">
                <p className="text-sm text-amber-400 font-medium">Is category ka koi worker available nahi.</p>
                <p className="text-xs text-gray-400 mt-1">Add a worker with role &quot;{categoryLabel}&quot; from Contacts, or use the button below.</p>
                <Button
                  size="sm"
                  onClick={() => { setShowWorkerEditModal(null); openDrawer?.('addContact', undefined, { contactType: 'worker' }); }}
                  className="mt-3 bg-amber-600 hover:bg-amber-700"
                >
                  <Plus size={14} className="mr-2" />
                  Add Worker
                </Button>
              </div>
            )}

            <div className="space-y-4">
              {/* Workers List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Assigned Workers</label>
                  <Button
                    size="sm"
                    onClick={handleAddWorker}
                    className="bg-blue-600 hover:bg-blue-700 h-8"
                    disabled={workerList.length === 0}
                  >
                    <Plus size={14} className="mr-1" />
                    Add Worker
                  </Button>
                </div>

                {editingWorkerData.workers.length === 0 ? (
                  <div className="text-center py-8 bg-gray-950/50 rounded-lg border border-dashed border-gray-700">
                    <Users size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">No workers assigned</p>
                    <p className="text-xs text-gray-600 mt-1">Select a worker from the list below{showAllWorkersInAssignModal ? '' : ` (${categoryLabel} category)`}</p>
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
                                    const selectedWorker = workerList.find(w => w.id === e.target.value);
                                    handleUpdateWorker(worker.id, 'workerId', e.target.value);
                                    handleUpdateWorker(worker.id, 'workerName', selectedWorker?.name || '');
                                  }}
                                  className="w-full bg-gray-900 border border-gray-700 rounded-lg text-white text-sm h-9 px-2"
                                >
                                  <option value="">Select...</option>
                                  {workerList.map(w => (
                                    <option key={w.id} value={w.id}>{w.name} ({w.department})</option>
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
                          {formatCurrency(editingWorkerData.workers.reduce((sum, w) => sum + (w.cost || 0), 0))}
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
                  className="bg-gray-950 border-gray-700 w-[200px] min-w-0"
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

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  onClick={() => setShowWorkerEditModal(null)}
                  variant="outline"
                  className="border-gray-700"
                  disabled={savingStage}
                >
                  Cancel
                </Button>
                {(() => {
                  const currentStep = saleDetail?.productionSteps.find(s => s.id === showWorkerEditModal);
                  const isPending = currentStep?.status === 'Pending';
                  return isPending ? (
                    <Button
                      onClick={() => handleSaveWorkerEdit(true)}
                      disabled={editingWorkerData.workers.length === 0 || savingStage}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingStage ? <Loader2 size={16} className="animate-spin mr-2" /> : <ArrowRight size={16} className="mr-2" />}
                      Save & Start
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSaveWorkerEdit(false)}
                      disabled={editingWorkerData.workers.length === 0 || savingStage}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingStage ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                      Save
                    </Button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Receive from Worker Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" style={{ zIndex: 9999 }}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-1">Receive from Worker</h3>
            <p className="text-sm text-gray-400 mb-4">Enter actual cost (Rs) and remarks. On confirm: stage → Completed, ledger entry (unpaid) created. No payment until you choose Pay Now or Pay Later.</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Actual Cost (Rs) *</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={receiveActualCost}
                  onChange={(e) => setReceiveActualCost(e.target.value)}
                  placeholder="0"
                  className="bg-gray-950 border-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Remarks (optional)</label>
                <textarea
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="Issues, notes..."
                  rows={2}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1 border-gray-700" onClick={() => { setShowReceiveModal(null); setReceiveActualCost(''); setReceiveNotes(''); }} disabled={savingStage}>
                Cancel
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleReceiveConfirm} disabled={savingStage}>
                {savingStage ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Confirm Receive
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Worker Payment choice modal (after Receive): Pay Now / Pay Later */}
      {payChoiceAfterReceive && !showWorkerPaymentDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4" style={{ zIndex: 9999 }}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-1">Worker Payment</h3>
            <p className="text-sm text-gray-400 mb-4">
              Is stage ka kaam receive ho gaya hai. Kya aap abhi worker ko payment karna chahte hain?
            </p>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1 border-gray-700"
                onClick={() => {
                  setPayChoiceAfterReceive(null);
                  reloadProductionSteps();
                }}
              >
                No, Pay Later
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => setShowWorkerPaymentDialog(true)}
              >
                Yes, Pay Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Worker Payment dialog (Pay Now flow): records payment and marks ledger paid */}
      {payChoiceAfterReceive && (
        <UnifiedPaymentDialog
          isOpen={showWorkerPaymentDialog}
          onClose={() => {
            setShowWorkerPaymentDialog(false);
            setPayChoiceAfterReceive(null);
            reloadProductionSteps();
          }}
          context="worker"
          entityName={payChoiceAfterReceive.workerName}
          entityId={payChoiceAfterReceive.workerId}
          outstandingAmount={payChoiceAfterReceive.amount}
          referenceNo={saleDetail?.invoiceNo ? `STD-${payChoiceAfterReceive.stageId.slice(0, 8)}` : undefined}
          workerStageId={payChoiceAfterReceive.stageId}
          onSuccess={async (paymentRef) => {
            try {
              await studioProductionService.markStageLedgerPaid(
                payChoiceAfterReceive.stageId,
                paymentRef ?? undefined
              );
              toast.success('Worker payment recorded. Ledger updated.');
              window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: payChoiceAfterReceive.workerId } }));
            } catch (e: any) {
              toast.error(e?.message || 'Failed to update ledger');
            }
            setShowWorkerPaymentDialog(false);
            setPayChoiceAfterReceive(null);
            await reloadProductionSteps();
          }}
        />
      )}

      {/* Customer Receive Payment – records against this sale so it shows in customer ledger (only when source = sale) */}
      {saleDetail && saleDetail.source === 'sale' && (
        <UnifiedPaymentDialog
          isOpen={showCustomerPaymentDialog}
          onClose={() => setShowCustomerPaymentDialog(false)}
          context="customer"
          entityName={saleDetail.customerName}
          entityId={saleDetail.customerId}
          outstandingAmount={effectiveBalanceDue}
          totalAmount={effectiveTotalAmount}
          paidAmount={saleDetail.paidAmount}
          referenceNo={saleDetail.invoiceNo}
          referenceId={saleDetail.id}
          previousPayments={saleDetail.payments.map(p => ({
            id: p.id,
            date: p.date,
            amount: p.amount,
            method: p.method,
            accountName: undefined
          }))}
          onSuccess={() => {
            setShowCustomerPaymentDialog(false);
            toast.success('Payment recorded. Customer ledger and balance will update.');
            loadStudioOrder();
          }}
        />
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

      {/* Save confirmation: Yes → Studio Dashboard, No → stay on page */}
      <AlertDialog open={showSaveConfirmDialog} onOpenChange={setShowSaveConfirmDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Changes save ho gaye hain</AlertDialogTitle>
            <AlertDialogDescription>
              Kya aap dashboard par wapas jana chahte hain?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSaveConfirmDialog(false)} className="border-gray-700">
              No — stay on page
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowSaveConfirmDialog(false);
                setCurrentView('studio-dashboard-new');
              }}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              Yes — Studio Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved changes warning when leaving page */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={(open) => {
        if (!open) {
          setShowUnsavedWarning(false);
          setPendingLeaveTarget(null);
        }
      }}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Unsaved changes will be lost. Do you want to save first, or leave anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => { setShowUnsavedWarning(false); setPendingLeaveTarget(null); }} className="border-gray-700 order-3 sm:order-1">
              Stay
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setShowUnsavedWarning(false);
                const t = pendingLeaveTarget;
                setPendingLeaveTarget(null);
                if (t) {
                  setCurrentView(t);
                  if (t === 'studio-sales-list-new' && selectedStudioSaleId) setSelectedStudioSaleId?.(selectedStudioSaleId);
                }
              }}
              className="border-amber-600 text-amber-400 hover:bg-amber-900/30 order-2"
            >
              Leave (discard)
            </Button>
            <Button
              onClick={handleSaveAndLeave}
              disabled={savingStage}
              className="bg-green-600 hover:bg-green-700 order-1 sm:order-3"
            >
              {savingStage ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              Save and Leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen task: Mark completed step as In Progress */}
      <AlertDialog open={!!reopenStepId} onOpenChange={(open) => !open && setReopenStepId(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Task reopen karein?</AlertDialogTitle>
            <AlertDialogDescription>
              Ye task completed se In Progress par wapas aa jayega. Worker assignment aur notes preserve rahenge. Kya continue karein?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReopenStepId(null)} className="border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (reopenStepId) {
                  await updateStepStatus(reopenStepId, 'In Progress');
                  setReopenStepId(null);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Mark In Progress
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
