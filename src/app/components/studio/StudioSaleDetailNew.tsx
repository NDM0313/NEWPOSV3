import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  MoreHorizontal,
  Info,
  ChevronRight,
  Printer,
  Share2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { DatePicker } from '../ui/DatePicker';
import { format } from 'date-fns';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { contactService } from '@/app/services/contactService';
import { saleService } from '@/app/services/saleService';
import { studioProductionService } from '@/app/services/studioProductionService';
import { syncInvoiceWithProductionPricing, type SyncInvoiceResult } from '@/app/services/studioProductionInvoiceSyncService';
import { branchService } from '@/app/services/branchService';
import { shipmentService, mapShipmentRowsToUi } from '@/app/services/shipmentService';
import { productService } from '@/app/services/productService';
import { documentNumberService } from '@/app/services/documentNumberService';
import { productCategoryService } from '@/app/services/productCategoryService';
import { getStudioDeadlineFromNotes } from '@/app/utils/studioDeadlineNotes';
import { uploadProductImages } from '@/app/utils/productImageUpload';
import { supabase } from '@/lib/supabase';
import { useDropzone } from 'react-dropzone';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

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
  /** Sale line items (when source is sale). Used to check if studio product line exists (invoice generated). */
  items?: Array<{ id: string; productId?: string; productName?: string; isStudioProduct?: boolean }>;
}

// Mock data removed - data is loaded from Supabase via loadStudioOrder()

export const StudioSaleDetailNew = () => {
  const { setCurrentView, selectedStudioSaleId, setSelectedStudioSaleId, openDrawer, setOpenSaleIdForView } = useNavigation();
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
  const [savingShipment, setSavingShipment] = useState(false);
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
  const [showCreateProductInvoiceModal, setShowCreateProductInvoiceModal] = useState(false);
  const [createProductInvoiceForm, setCreateProductInvoiceForm] = useState({
    productName: '',
    categoryId: '',
    salePrice: '',
    description: '',
  });
  const [createProductInvoiceImageFiles, setCreateProductInvoiceImageFiles] = useState<File[]>([]);
  const [createProductInvoiceCategories, setCreateProductInvoiceCategories] = useState<{ id: string; name: string }[]>([]);
  const [creatingProductAndInvoice, setCreatingProductAndInvoice] = useState(false);
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

  /** After sync, show "Invoice Synced With Production Pricing" until next change. */
  const [lastInvoiceSyncResult, setLastInvoiceSyncResult] = useState<SyncInvoiceResult | null>(null);
  /** Stage id -> 'unpaid' | 'partial' | 'paid'. When paid, lock stage cost editing. */
  const [workerStagePaymentStatus, setWorkerStagePaymentStatus] = useState<Record<string, 'unpaid' | 'partial' | 'paid'>>({});

  const createProductInvoiceOnDrop = useCallback((acceptedFiles: File[]) => {
    setCreateProductInvoiceImageFiles(prev => [...prev, ...acceptedFiles]);
  }, []);
  const createProductInvoiceDropzone = useDropzone({
    onDrop: createProductInvoiceOnDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
    maxSize: 5 * 1024 * 1024,
    disabled: !showCreateProductInvoiceModal,
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

  // Pricing Calculator (Figma) – right panel
  const [profitMarginMode, setProfitMarginMode] = useState<'percentage' | 'fixed'>('percentage');
  const [profitMarginValue, setProfitMarginValue] = useState<string>('30');
  const [showProfitDistributionModal, setShowProfitDistributionModal] = useState(false);
  /** Per-stage profit share. Only completed stages. isManual = user edited this stage. */
  const [profitDistributionRows, setProfitDistributionRows] = useState<Array<{ stepId: string; name: string; workerName: string; amount: number; isManual: boolean }>>([]);

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
      expectedDeliveryDate: sale.deadline || getStudioDeadlineFromNotes(sale.notes) || '',
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
      source: 'sale',
      items: items.map((i: any) => ({ id: i.id || '', productId: i.product_id, productName: i.product_name, isStudioProduct: i.isStudioProduct === true || i.is_studio_product === true })),
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
          } catch (e: unknown) {
            const err = e as { message?: string; code?: string; details?: string };
            const msg = err?.message ?? String(e);
            const code = err?.code ?? '';
            console.warn('[StudioSaleDetail] Production/stages load or create failed:', msg, code || undefined, err?.details || undefined);
          }
          // Load shipments from DB when sale is source (backend-linked)
          try {
            const rows = await shipmentService.getBySaleId(sale.id);
            const shipments = mapShipmentRowsToUi(rows);
            const shipmentCharges = shipments.reduce((sum, s) => sum + s.chargedToCustomer, 0);
            convertedDetail.shipments = shipments;
            convertedDetail.shipmentCharges = shipmentCharges;
            convertedDetail.totalAmount = (convertedDetail.baseAmount || 0) + shipmentCharges;
            convertedDetail.balanceDue = Math.max(0, convertedDetail.totalAmount - (convertedDetail.paidAmount || 0));
          } catch (_) { /* ignore */ }
          setSaleDetail({ ...convertedDetail, productionSteps });
          return;
        }
      } catch (_) {
        // Sale not found – do not fall back to legacy studio_orders (table dropped)
      }
      setSaleDetail(null);
    } catch (error) {
      console.error('Error loading studio order/sale:', error);
      setSaleDetail(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStudioSaleId, companyId, branchId, user?.id, convertFromSale, stagesToProductionSteps]);

  // Refetch studio sale detail when this sale was updated (e.g. after editing in SaleForm drawer)
  useEffect(() => {
    const handler = (e: CustomEvent<{ saleId: string }>) => {
      if (e.detail?.saleId && selectedStudioSaleId && e.detail.saleId === selectedStudioSaleId) {
        loadStudioOrder();
      }
    };
    window.addEventListener('saleUpdated', handler as EventListener);
    return () => window.removeEventListener('saleUpdated', handler as EventListener);
  }, [selectedStudioSaleId, loadStudioOrder]);

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

  // Pricing Calculator: production cost from completed stages only (read-only)
  const completedProductionSteps = saleDetail
    ? saleDetail.productionSteps.filter((s) => (s.status || '').toLowerCase() === 'completed')
    : [];
  const productionCostFromStages = completedProductionSteps.reduce((sum, s) => sum + s.workerCost, 0);
  const profitMarginNum = parseFloat(profitMarginValue) || 0;
  const profitAmount =
    profitMarginMode === 'percentage'
      ? (productionCostFromStages * profitMarginNum) / 100
      : profitMarginNum;
  const finalSalePriceFromCalculator = productionCostFromStages + profitAmount;
  const marginPercent =
    productionCostFromStages > 0 ? ((profitAmount / productionCostFromStages) * 100).toFixed(1) : '0';
  /** Unified Payment panel: use pricing calculator total so Profit Margin updates Grand Total & Balance Due live */
  const displayFinalSalePrice = finalSalePriceFromCalculator;
  /** Grand Total = cost + profit + shipment (used in Payment card) */
  const grandTotalForCard = displayFinalSalePrice + (saleDetail?.shipmentCharges ?? 0);
  const displayBalanceDue = saleDetail ? Math.max(0, grandTotalForCard - saleDetail.paidAmount) : 0;

  const roundInt = (n: number) => Math.round(n);
  const completedStepKey = completedProductionSteps.map((s) => s.id).join(',');
  // Sync profit distribution: round figures only (no decimals)
  useEffect(() => {
    if (completedProductionSteps.length === 0) {
      setProfitDistributionRows([]);
      return;
    }
    const totalProfit = roundInt(Math.max(0, profitAmount));
    const n = completedProductionSteps.length;
    const equalShareRaw = totalProfit / n;
    const equalShares = Array.from({ length: n }, () => roundInt(equalShareRaw));
    const diff = totalProfit - equalShares.reduce((s, x) => s + x, 0);
    if (diff !== 0) equalShares[n - 1] = roundInt(equalShares[n - 1] + diff);
    setProfitDistributionRows((prev) => {
      const prevKey = prev.map((r) => r.stepId).join(',');
      if (prevKey !== completedStepKey || prev.length !== completedProductionSteps.length) {
        return completedProductionSteps.map((step, i) => ({
          stepId: step.id,
          name: step.name,
          workerName: step.assignedWorker || (step.assignedWorkers?.[0]?.workerName ?? '—'),
          amount: equalShares[i] ?? roundInt(equalShareRaw),
          isManual: false,
        }));
      }
      const manualSum = roundInt(prev.filter((r) => r.isManual).reduce((s, r) => s + r.amount, 0));
      const autoRows = prev.filter((r) => !r.isManual);
      const autoCount = autoRows.length;
      const remainder = roundInt(totalProfit - manualSum);
      const autoShareRaw = autoCount > 0 ? remainder / autoCount : 0;
      const autoAmounts = Array.from({ length: autoCount }, () => roundInt(autoShareRaw));
      const autoDiff = remainder - autoAmounts.reduce((s, x) => s + x, 0);
      if (autoDiff !== 0 && autoAmounts.length > 0) autoAmounts[autoAmounts.length - 1] = roundInt(autoAmounts[autoAmounts.length - 1]! + autoDiff);
      let idx = 0;
      return prev.map((r) => (r.isManual ? r : { ...r, amount: autoAmounts[idx++] ?? 0 }));
    });
  }, [completedStepKey, completedProductionSteps.length, profitAmount]);
  const totalDistributed = profitDistributionRows.reduce((s, r) => s + r.amount, 0);
  const updateProfitShare = useCallback(
    (stepId: string, value: number) => {
      const totalProfit = roundInt(Math.max(0, profitAmount));
      const valueRounded = roundInt(value);
      setProfitDistributionRows((prev) => {
        const next = prev.map((r) => (r.stepId === stepId ? { ...r, amount: valueRounded, isManual: true } : r));
        const manualSum = next.filter((r) => r.isManual).reduce((s, r) => s + r.amount, 0);
        const autoCount = next.filter((r) => !r.isManual).length;
        const remainder = roundInt(totalProfit - manualSum);
        const autoShareRaw = autoCount > 0 ? remainder / autoCount : 0;
        const autoAmounts = Array.from({ length: autoCount }, () => roundInt(autoShareRaw));
        const autoDiff = remainder - autoAmounts.reduce((s, x) => s + x, 0);
        if (autoDiff !== 0 && autoAmounts.length > 0) autoAmounts[autoAmounts.length - 1] = roundInt(autoAmounts[autoAmounts.length - 1]! + autoDiff);
        let idx = 0;
        return next.map((r) => {
          if (r.stepId === stepId) return { ...r, amount: valueRounded, isManual: true };
          if (r.isManual) return r; // keep other manual stages unchanged (allow multiple manuals)
          return { ...r, amount: autoAmounts[idx++] ?? 0, isManual: false };
        });
      });
    },
    [profitAmount]
  );
  const resetProfitDistribution = useCallback(() => {
    const totalProfit = roundInt(Math.max(0, profitAmount));
    const n = completedProductionSteps.length;
    const equalShareRaw = n > 0 ? totalProfit / n : 0;
    const equalShares = Array.from({ length: n }, () => roundInt(equalShareRaw));
    const diff = totalProfit - equalShares.reduce((s, x) => s + x, 0);
    if (diff !== 0 && equalShares.length > 0) equalShares[equalShares.length - 1] = roundInt(equalShares[equalShares.length - 1]! + diff);
    setProfitDistributionRows(
      completedProductionSteps.map((step, i) => ({
        stepId: step.id,
        name: step.name,
        workerName: step.assignedWorker || (step.assignedWorkers?.[0]?.workerName ?? '—'),
        amount: equalShares[i] ?? roundInt(equalShareRaw),
        isManual: false,
      }))
    );
  }, [completedProductionSteps, profitAmount]);

  // Check if all production tasks are completed (normalize status so 'Completed'/'completed' both count)
  const isStepCompleted = (s: { status?: string }) => (s.status || '').toLowerCase() === 'completed';
  const allTasksCompleted = saleDetail
    ? saleDetail.productionSteps.length > 0 && saleDetail.productionSteps.every(isStepCompleted)
    : false;

  /** Invoice is generated when studio product line exists (Create Product + Add to Sale). Shipment Add requires this. */
  const hasInvoiceGenerated = (saleDetail?.items ?? []).some((i) => i.isStudioProduct === true);

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
        // Do not auto-open Assign worker dialog – user opens it by clicking Assign
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

  /** Try to ensure a studio production exists for the current sale (create if missing). Returns productionId or error reason. One sale = one production; no duplicates. */
  const ensureProductionForSale = useCallback(async (): Promise<{ productionId: string | null; error?: 'NO_BRANCH' | 'NO_ITEMS' | 'CREATE_FAILED' }> => {
    if (!selectedStudioSaleId || !companyId) return { productionId: null, error: 'CREATE_FAILED' };
    try {
      const sale = await saleService.getSale(selectedStudioSaleId);
      if (!sale?.id) return { productionId: null, error: 'CREATE_FAILED' };
      const productions = await studioProductionService.getProductionsBySaleId(sale.id);
      if (productions.length > 0) {
        if (import.meta.env?.DEV) console.log('[StudioSaleDetail] ensureProductionForSale: existing production', { saleId: sale.id, productionId: productions[0].id });
        return { productionId: productions[0].id };
      }
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
      if (import.meta.env?.DEV) console.log('[StudioSaleDetail] ensureProductionForSale: created production', { saleId: sale.id, productionId: production.id });
      // No auto-stages: manager decides via Customize Tasks
      return { productionId: production.id };
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string; details?: string };
      const msg = err?.message ?? String(e);
      const code = err?.code ?? '';
      console.warn('[StudioSaleDetail] ensureProductionForSale failed:', msg, code || undefined, err?.details || undefined);
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
    if (import.meta.env?.DEV) {
      console.log('[StudioSaleDetail] persistAllStagesToBackend', { saleId: saleDetail?.id, productionId: currentProductionId, localStepsCount: localSteps.length });
    }
    try {
      let serverStages = await studioProductionService.getStagesByProductionId(currentProductionId);
      if (serverStages.length === 0 && localSteps.length > 0) {
        // Create stages from manager's choices (localSteps) with correct position so all save (stage_order)
        for (let i = 0; i < localSteps.length; i++) {
          const step = localSteps[i];
          const st = step.stageType || 'handwork';
          await studioProductionService.createStage(currentProductionId, { stage_type: st, cost: 0 }, step.order ?? i + 1);
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
        // Step B: Assigned steps must have worker and expected completion date
        if (backendStatus === 'assigned') {
          if (!workerId) {
            toast.error(`Step ${step.order} (${step.stageType || 'stage'}): Select a worker before saving.`);
            setSavingStage(false);
            return;
          }
          if (!step.expectedCompletionDate?.trim()) {
            toast.error(`Step ${step.order} (${step.stageType || 'stage'}): Expected completion date is required.`);
            setSavingStage(false);
            return;
          }
        }
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
      const stepsAfterReload = await reloadProductionSteps();
      const nextStepAfterSave = stepsAfterReload?.find((s) => s.order === (completedOrdersJustSaved.length ? Math.max(...completedOrdersJustSaved) : 0) + 1);
      if (nextStepAfterSave) {
        setExpandedSteps((prev) => new Set(prev).add(nextStepAfterSave.id));
        // Do not auto-open Assign worker dialog – user opens it by clicking Assign
      }
      setHasUnsavedChanges(false);
      savedSuccessfullyRef.current = true;
      toast.success('Changes saved to database.');
      window.dispatchEvent(new CustomEvent('studio-production-saved'));
      if (saleDetail?.id) {
        try {
          const marginVal = parseFloat(profitMarginValue) || 0;
          const syncParams = profitMarginMode === 'fixed'
            ? { profitAmount: marginVal }
            : { profitMarginPercent: marginVal };
          const syncResult = await syncInvoiceWithProductionPricing(saleDetail.id, syncParams);
          setLastInvoiceSyncResult(syncResult);
          if (syncResult.success) {
            window.dispatchEvent(new CustomEvent('saleUpdated', { detail: { saleId: saleDetail.id } }));
            toast.success('Studio invoice item synced with production pricing.');
          } else if (syncResult.error) {
            toast.error(syncResult.error);
          }
        } catch (syncErr) {
          console.warn('[StudioSaleDetailNew] Invoice sync failed:', syncErr);
          toast.error((syncErr as Error)?.message || 'Invoice sync failed');
        }
      }
      if (!opts?.skipConfirmDialog) setShowSaveConfirmDialog(true);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (import.meta.env?.DEV) console.warn('[StudioSaleDetail] persistAllStagesToBackend failed:', { message: msg, error: e });
      const isStudioOrders = /relation\s+["']?studio_orders["']?\s+does not exist/i.test(msg);
      const isStagesMissing = /relation\s+["']?studio_production_stages["']?\s+does not exist/i.test(msg) || e?.code === 'PGRST116' || e?.status === 404;
      if (isStudioOrders) {
        toast.error('Database still references studio_orders. Run the FULL fix_after_drop_studio_orders.sql from line 1 in Supabase (all statements).');
      } else if (isStagesMissing) {
        toast.error('Production stages table missing. Run migrations/fix_after_drop_studio_orders.sql in Supabase SQL Editor.');
      } else if (/production.*not.*created|ensure.*sale/i.test(msg)) {
        toast.error('Production record could not be created for this studio sale.');
      } else {
        toast.error(msg ? msg.slice(0, 120) : 'Failed to save stages to database.');
      }
    } finally {
      setSavingStage(false);
    }
  }, [saleDetail, productionId, ensureProductionForSale, reloadProductionSteps, workers, profitMarginValue, profitMarginMode]);

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

  const handleAddShipment = async () => {
    if (newShipment.chargedToCustomer <= 0) return;
    if (!saleDetail) return;

    const charged = newShipment.chargedToCustomer;
    const payload = {
      shipmentType: newShipment.shipmentType,
      courierName: newShipment.courierName || undefined,
      shipmentStatus: 'Pending' as const,
      trackingId: newShipment.trackingId || undefined,
      actualCost: newShipment.actualCost ?? 0,
      chargedToCustomer: charged,
      currency: 'PKR' as const,
      notes: newShipment.notes || undefined,
    };

    if (saleDetail.source === 'sale' && saleDetail.id && companyId && branchId) {
      setSavingShipment(true);
      try {
        const created = await shipmentService.create(
          saleDetail.id,
          companyId,
          branchId,
          payload,
          user?.id
        );
        const mapped = mapShipmentRowsToUi([created])[0];
        const shipment: Shipment = { ...mapped, id: created.id };
        setSaleDetail(prev => prev ? {
          ...prev,
          shipments: [...prev.shipments, shipment],
          shipmentCharges: prev.shipmentCharges + charged,
          totalAmount: prev.totalAmount + charged,
          balanceDue: prev.balanceDue + charged,
        } : prev);
        toast.success('Shipment added and saved.');
      } catch (e: any) {
        const isTableMissing = e?.status === 404 || e?.code === '42P01' || (typeof e?.message === 'string' && (e.message.includes('sale_shipments') || e.message.includes('does not exist') || e.message.includes('404')));
        if (isTableMissing) {
          const shipment: Shipment = {
            id: `SHP-${Date.now()}`,
            ...payload,
            trackingDocuments: [],
          };
          setSaleDetail(prev => prev ? {
            ...prev,
            shipments: [...prev.shipments, shipment],
            shipmentCharges: prev.shipmentCharges + charged,
            totalAmount: prev.totalAmount + charged,
            balanceDue: prev.balanceDue + charged,
          } : prev);
          toast.warning('Shipments table not created yet. Added locally. Run migration "sale_shipments_table.sql" in Supabase to save to database.');
        } else {
          console.error('Failed to save shipment:', e);
          toast.error(e instanceof Error ? e.message : 'Failed to save shipment');
          return;
        }
      } finally {
        setSavingShipment(false);
      }
    } else {
      const shipment: Shipment = {
        id: `SHP-${Date.now()}`,
        ...payload,
        trackingDocuments: [],
      };
      setSaleDetail(prev => ({
        ...prev,
        shipments: [...prev.shipments, shipment],
        shipmentCharges: prev.shipmentCharges + charged,
        totalAmount: prev.totalAmount + charged,
        balanceDue: prev.balanceDue + charged,
      }));
    }

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

  const handleDeleteShipment = async (shipmentId: string) => {
    if (!saleDetail) return;
    const shipment = saleDetail.shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    if (!confirm(`Delete shipment? This will reduce the total bill by ${formatCurrency(shipment.chargedToCustomer)}`)) {
      return;
    }

    const isDbId = /^[0-9a-f-]{36}$/i.test(shipmentId);
    if (isDbId) {
      try {
        await shipmentService.delete(shipmentId);
        toast.success('Shipment removed.');
      } catch (e) {
        console.error('Failed to delete shipment:', e);
        toast.error(e instanceof Error ? e.message : 'Failed to delete shipment');
        return;
      }
    }

    setSaleDetail(prev => prev ? {
      ...prev,
      shipments: prev.shipments.filter(s => s.id !== shipmentId),
      shipmentCharges: prev.shipmentCharges - shipment.chargedToCustomer,
      totalAmount: prev.totalAmount - shipment.chargedToCustomer,
      balanceDue: prev.balanceDue - shipment.chargedToCustomer
    } : prev);
  };

  const handleCreateProductAndInvoice = async () => {
    if (!saleDetail || saleDetail.source !== 'sale' || !saleDetail.id || !companyId || !branchId) {
      toast.error('Sale or company context missing.');
      return;
    }
    const name = (createProductInvoiceForm.productName || '').trim() || `Studio – ${saleDetail.invoiceNo}`;
    const salePriceNum = parseFloat(createProductInvoiceForm.salePrice) || 0;
    if (salePriceNum <= 0) {
      toast.error('Enter a valid sale price.');
      return;
    }
    setCreatingProductAndInvoice(true);
    try {
      const sku = await documentNumberService.getNextProductSKU(companyId, null).catch(() => `STUDIO-${saleDetail.invoiceNo}-${Date.now().toString(36)}`);
      const product = await productService.createProduct({
        company_id: companyId,
        name,
        sku,
        category_id: createProductInvoiceForm.categoryId || (null as any),
        cost_price: 0,
        retail_price: salePriceNum,
        wholesale_price: salePriceNum,
        current_stock: 0,
        min_stock: 0,
        max_stock: 1000,
        has_variations: false,
        is_rentable: false,
        is_sellable: true,
        track_stock: false,
        is_active: true,
        description: createProductInvoiceForm.description || undefined,
      }) as { id: string; name: string; sku: string };
      const itemRow = {
        sale_id: saleDetail.id,
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: 1,
        unit_price: salePriceNum,
        total: salePriceNum,
        is_studio_product: true,
      };
      let insertedItemId: string | null = null;
      const { data: insertedItem, error: itemErr } = await supabase
        .from('sales_items')
        .insert(itemRow)
        .select('id')
        .single();
      if (itemErr) {
        const fallbackPayload: Record<string, unknown> = {
          sale_id: saleDetail.id,
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          quantity: 1,
          price: salePriceNum,
          total: salePriceNum,
        };
        let { data: fallbackData, error: fallbackErr } = await supabase
          .from('sale_items')
          .insert({ ...fallbackPayload, is_studio_product: true })
          .select('id')
          .single();
        if (fallbackErr && (fallbackErr.code === '42703' || String(fallbackErr.message || '').includes('is_studio_product'))) {
          ({ data: fallbackData, error: fallbackErr } = await supabase
            .from('sale_items')
            .insert(fallbackPayload)
            .select('id')
            .single());
        }
        if (fallbackErr) throw new Error(fallbackErr.message || 'Failed to add item to invoice');
        insertedItemId = (fallbackData as any)?.id ?? null;
      } else {
        insertedItemId = (insertedItem as any)?.id ?? null;
      }
      if (productionId && insertedItemId) {
        try {
          await studioProductionService.setGeneratedInvoiceItem(productionId, product.id, insertedItemId);
        } catch (linkErr: any) {
          console.warn('[StudioSaleDetailNew] Link studio production to invoice item:', linkErr?.message);
        }
      }
      const { data: saleRow } = await supabase.from('sales').select('total, paid_amount').eq('id', saleDetail.id).single();
      const currentTotal = Number((saleRow as any)?.total) || 0;
      const paid = Number((saleRow as any)?.paid_amount) || 0;
      const newTotal = currentTotal + salePriceNum;
      const newDue = Math.max(0, newTotal - paid);
      await supabase.from('sales').update({
        total: newTotal,
        due_amount: newDue,
        updated_at: new Date().toISOString(),
      }).eq('id', saleDetail.id);
      if (createProductInvoiceImageFiles.length > 0 && product?.id) {
        try {
          const imageUrls = await uploadProductImages(companyId, product.id, createProductInvoiceImageFiles);
          await productService.updateProduct(product.id, { image_urls: imageUrls });
        } catch (uploadErr: any) {
          console.error('[StudioSaleDetailNew] Product image upload failed:', uploadErr);
          toast.error(uploadErr?.message || 'Product and invoice saved but image upload failed.');
        }
      }
      setCreateProductInvoiceImageFiles([]);
      setShowCreateProductInvoiceModal(false);
      setSaleDetail((prev) => prev && insertedItemId ? { ...prev, items: [...(prev.items || []), { id: insertedItemId, productId: product.id, productName: product.name, isStudioProduct: true }] } : prev);
      toast.success('Product created and invoice updated.');
      if (setOpenSaleIdForView) setOpenSaleIdForView(saleDetail.id);
      setCurrentView('sales');
    } catch (e: any) {
      console.error('Create product & invoice:', e);
      toast.error(e?.message || 'Failed to create product or update invoice');
    } finally {
      setCreatingProductAndInvoice(false);
    }
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
    const isServerUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stepId);
    if (isServerUuid) {
      studioProductionService.getLedgerStatusForStages([stepId]).then((statusMap) => {
        setWorkerStagePaymentStatus(prev => ({ ...prev, ...statusMap }));
      }).catch(() => {});
    }
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
    const currentStep = saleDetail?.productionSteps.find((s) => s.id === stepId);
    const isServerUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stepId);
    const oneWorker = editingWorkerData.workers.length === 1 && editingWorkerData.workers[0]?.workerId;

    if (isServerUuid && currentStep?.status === 'Completed') {
      setSavingStage(true);
      try {
        await studioProductionService.updateStage(stepId, {
          cost: totalWorkerCost,
          ...(editingWorkerData.notes != null ? { notes: editingWorkerData.notes?.trim() || null } : {}),
        });
        toast.success('Cost updated.');
        await reloadProductionSteps();
        setShowWorkerEditModal(null);
        window.dispatchEvent(new CustomEvent('studio-production-saved'));
      } catch (e: any) {
        toast.error(e?.message || 'Update failed');
      } finally {
        setSavingStage(false);
      }
      return;
    }

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
        if (selectedTaskIds.length === 0) {
          toast.error('Select at least one task.');
          return;
        }
        const taskIdToStageType: Record<string, 'dyer' | 'handwork' | 'stitching'> = {
          dyeing: 'dyer',
          handwork: 'handwork',
          stitching: 'stitching',
        };
        const stagesToSave = selectedTaskIds
          .map((tid) => taskIdToStageType[tid])
          .filter((t): t is 'dyer' | 'handwork' | 'stitching' => !!t);
        if (stagesToSave.length === 0) {
          toast.error('Select at least one standard task (Dyeing, Handwork, or Stitching).');
          return;
        }
        if (import.meta.env?.DEV) {
          console.log('[StudioSaleDetail] Saving production stages:', stagesToSave.map((t, i) => ({ stage_type: t, position: i + 1 })));
        }
        const stages = await studioProductionService.getStagesByProductionId(currentProductionId);
        const stagesArr = stages as any[];
        const noStagesYet = stagesArr.length === 0;
        const allPendingAndUnassigned = stagesArr.length > 0 && stagesArr.every((s) => s.status !== 'completed' && !s.assigned_worker_id);

        // When no stages exist yet, or all existing are pending/unassigned: replace full set in one go (single bulk write)
        if (noStagesYet || (allPendingAndUnassigned && stagesArr.length > 0)) {
          if (import.meta.env?.DEV) {
            console.log('[StudioSaleDetail] Apply config: replaceStages', { productionId: currentProductionId, stagesToSave, noStagesYet });
          }
          await studioProductionService.replaceStages(
            currentProductionId,
            stagesToSave.map((stage_type, i) => ({ stage_type, position: i + 1 }))
          );
        } else {
          // Some stages have workers or are completed: only remove unselected, add missing with correct position
          const selectedTypes = new Set(stagesToSave);
          const keptStages = stagesArr.filter((s: any) => selectedTypes.has(s.stage_type));
          for (const s of stagesArr) {
            const stageType = s.stage_type;
            if (!selectedTypes.has(stageType)) {
              try {
                await studioProductionService.deleteStage(s.id);
              } catch (delErr: any) {
                toast.warning(delErr?.message || `Could not remove ${stageType}. It may have a worker assigned or be completed.`);
              }
            }
          }
          const existingTypes = new Set(keptStages.map((s: any) => s.stage_type));
          const maxOrder = keptStages.length > 0
            ? Math.max(...(keptStages.map((s: any) => (s.stage_order != null ? s.stage_order : 1)) as number[]))
            : 0;
          let nextPosition = maxOrder + 1;
          for (const taskId of selectedTaskIds) {
            const stageType = taskIdToStageType[taskId];
            if (stageType && !existingTypes.has(stageType)) {
              await studioProductionService.createStage(currentProductionId, { stage_type: stageType, cost: 0 }, nextPosition);
              existingTypes.add(stageType);
              nextPosition += 1;
            }
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
      const msg = e?.message ?? String(e);
      const code = e?.code ?? e?.status;
      if (import.meta.env?.DEV) {
        console.warn('[StudioSaleDetail] Apply task config failed:', { message: msg, code, error: e });
      }
      const isStudioOrders = /relation\s+["']?studio_orders["']?\s+does not exist/i.test(msg);
      const isStagesMissing = /relation\s+["']?studio_production_stages["']?\s+does not exist/i.test(msg) || e?.code === 'PGRST116' || e?.status === 404;
      if (isStudioOrders) {
        toast.error(
          'Database still references dropped table studio_orders. Run the FULL migrations/fix_after_drop_studio_orders.sql from line 1 in Supabase SQL Editor (all statements, including the two functions at the top).',
          { duration: 10000 }
        );
      } else if (isStagesMissing) {
        toast.error(
          'Production stages table missing. Run migrations/fix_after_drop_studio_orders.sql in Supabase SQL Editor, then try again.',
          { duration: 8000 }
        );
      } else if (/production|ensure.*sale/i.test(msg) || code === 'CREATE_FAILED') {
        toast.error('Production record could not be created for this studio sale. Check branch and sale items.');
      } else {
        toast.error('Failed to persist selected stages to studio_production_stages. ' + (msg ? msg.slice(0, 80) : ''));
      }
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
            <Button
              size="sm"
              disabled={savingStage}
              onClick={() => persistAllStagesToBackend()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {savingStage ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />}
              Save
            </Button>
            {/* Assign flow: explicit Save/Done in header (top-right) – save only on this button, not on dropdown change */}
            {showWorkerEditModal && (() => {
              const currentStep = saleDetail?.productionSteps.find(s => s.id === showWorkerEditModal);
              const isPending = currentStep?.status === 'Pending';
              const hasWorker = editingWorkerData.workers.length > 0 && editingWorkerData.workers[0]?.workerId;
              const hasExpectedDate = !!editingWorkerData.expectedCompletionDate?.trim();
              const canSave = hasWorker && hasExpectedDate && !savingStage;
              return (
                <Button
                  size="sm"
                  disabled={!canSave}
                  title={!hasWorker ? 'Select a worker to save assignment' : !hasExpectedDate ? 'Select expected completion date' : isPending ? 'Save assignment and start stage' : 'Save and close'}
                  onClick={() => {
                    if (!canSave) return;
                    if (editingWorkerData.workers.length === 0 || !editingWorkerData.workers[0]?.workerId) {
                      toast.error('Select a worker to assign.');
                      return;
                    }
                    if (!editingWorkerData.expectedCompletionDate?.trim()) {
                      toast.error('Expected completion date is required.');
                      return;
                    }
                    handleSaveWorkerEdit(!!isPending);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                >
                  {savingStage ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                  {isPending ? 'Save & Start' : 'Save'}
                </Button>
              );
            })()}
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
            {hasUnsavedChanges && !showWorkerEditModal && (
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
              <p className="text-white font-bold text-lg">{formatCurrency(grandTotalForCard)}</p>
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
                displayBalanceDue === 0 ? "text-green-400" : "text-orange-400"
              )}>
                {formatCurrency(displayBalanceDue)}
              </p>
            </div>
          </div>
          {lastInvoiceSyncResult?.success && (
            <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400 shrink-0" />
              <span className="text-sm text-green-400 font-medium">Studio invoice item synced with production pricing.</span>
            </div>
          )}
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
            {/* Invoice actions – when production completed: one blue button, options in dropdown */}
            {allTasksCompleted && saleDetail && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                  >
                    <FileText size={14} className="mr-2" />
                    Invoice
                    <ChevronDown size={14} className="ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 min-w-[180px]">
                  <DropdownMenuItem
                    className="text-gray-200 focus:bg-blue-600 focus:text-white focus:outline-none cursor-pointer"
                    onSelect={() => {
                      setCreateProductInvoiceForm(prev => ({
                        ...prev,
                        productName: '',
                        categoryId: '',
                        salePrice: grandTotalForCard > 0 ? String(Math.round(grandTotalForCard)) : '',
                        description: '',
                      }));
                      if (companyId) {
                        productCategoryService.getAllCategoriesFlat(companyId)
                          .then(cats => setCreateProductInvoiceCategories(cats.map(c => ({ id: c.id, name: c.name }))))
                          .catch(() => setCreateProductInvoiceCategories([]));
                      }
                      setShowCreateProductInvoiceModal(true);
                    }}
                  >
                    <FileText size={14} className="mr-2" />
                    Generate Bill
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-gray-200 focus:bg-blue-600 focus:text-white focus:outline-none cursor-pointer"
                    onSelect={() => window.print()}
                  >
                    <Printer size={14} className="mr-2" />
                    Print
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-gray-200 focus:bg-blue-600 focus:text-white focus:outline-none cursor-pointer"
                    onSelect={() => {
                      toast.info('PDF – open sale in Sales to download/share PDF');
                      if (setOpenSaleIdForView && saleDetail.id) {
                        setOpenSaleIdForView(saleDetail.id);
                        setCurrentView('sales');
                      }
                    }}
                  >
                    <FileText size={14} className="mr-2" />
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-gray-200 focus:bg-blue-600 focus:text-white focus:outline-none cursor-pointer"
                    onSelect={() => {
                      if (setOpenSaleIdForView && saleDetail.id) {
                        setOpenSaleIdForView(saleDetail.id);
                        setCurrentView('sales');
                      }
                      toast.success('Open Sales to view or share invoice');
                    }}
                  >
                    <Share2 size={14} className="mr-2" />
                    Share
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                                          <button
                                            type="button"
                                            onClick={() => !stepLocked && handleOpenWorkerEdit(step.id)}
                                            className={cn(
                                              "text-orange-400 font-medium rounded px-1 -mx-1",
                                              !stepLocked && "hover:bg-orange-500/20 hover:text-orange-300 cursor-pointer",
                                              stepLocked && "cursor-default"
                                            )}
                                            title={stepLocked ? undefined : 'Click to edit worker / cost'}
                                          >
                                            {formatCurrency(step.workerCost)}
                                          </button>
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
                    <p className="text-xs text-gray-500">
                      {allTasksCompleted
                        ? 'Set profit margin in the right panel "Pricing Calculator", then click Save to sync invoice.'
                        : 'Complete all production stages to unlock the Pricing Calculator.'}
                    </p>
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
              
              {/* SHIPMENT SECTION – Add disabled until invoice is generated (studio product line). */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Truck size={18} className={hasInvoiceGenerated ? "text-blue-400" : "text-gray-600"} />
                    Shipment
                    {!hasInvoiceGenerated && (
                      <Lock size={14} className="text-gray-600" title="Generate invoice first (Create Product + Add to Sale)" />
                    )}
                  </h2>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!hasInvoiceGenerated) {
                        toast.warning('Generate the invoice first: use "Create Product + Add to Sale" in the left panel, then add shipment.');
                        return;
                      }
                      setShowShipmentModal(true);
                    }}
                    disabled={!hasInvoiceGenerated}
                    className={cn(
                      "bg-blue-600 hover:bg-blue-700",
                      !hasInvoiceGenerated && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Plus size={16} className="mr-2" />
                    Add
                  </Button>
                </div>

                {(!saleDetail.shipments || saleDetail.shipments.length === 0) ? (
                  /* No shipments: hide detailed block – only header + Add above; no empty-state box */
                  null
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
                              <p className="text-xs text-gray-500 uppercase font-medium mb-2">Tracking Documents</p>

                              {/* Documents List or clickable empty state with Upload / Take pic */}
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
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => setShowDocumentUpload(shipment.id)}
                                      className="w-full bg-gray-950 border border-gray-800 border-dashed rounded-lg p-4 text-center hover:bg-gray-900/80 hover:border-gray-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    >
                                      <Paperclip size={20} className="mx-auto text-gray-600 mb-1" />
                                      <p className="text-xs text-gray-500">No documents uploaded</p>
                                      <p className="text-[10px] text-blue-400 mt-1">Click to upload or take pic</p>
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="center" className="bg-gray-900 border-gray-700 min-w-[160px]">
                                    <DropdownMenuItem
                                      className="text-gray-200 focus:bg-blue-600 focus:text-white cursor-pointer"
                                      onSelect={() => setTimeout(() => fileInputRef.current?.click(), 100)}
                                    >
                                      <Upload size={14} className="mr-2" />
                                      Upload
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-gray-200 focus:bg-blue-600 focus:text-white cursor-pointer"
                                      onSelect={() => setTimeout(() => cameraInputRef.current?.click(), 100)}
                                    >
                                      <Camera size={14} className="mr-2" />
                                      Take pic
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
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

              {/* Single hidden file/camera inputs for Tracking Documents (use showDocumentUpload for shipment id) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => { if (showDocumentUpload) { handleFileUpload(showDocumentUpload, e); e.target.value = ''; } }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { if (showDocumentUpload) { handleCameraCapture(showDocumentUpload, e); e.target.value = ''; } }}
              />

              {/* PRICING CALCULATOR – disabled until all production stages are complete */}
              <div className={cn(
                "rounded-xl overflow-hidden border border-gray-800 bg-gray-900/50",
                !allTasksCompleted && "opacity-70 pointer-events-none"
              )}>
                <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800 flex items-center justify-between">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <DollarSign size={18} className={allTasksCompleted ? "text-blue-400" : "text-gray-500"} />
                    Pricing Calculator
                    {!allTasksCompleted && <Lock size={14} className="text-gray-500" />}
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  {!allTasksCompleted ? (
                    <p className="text-sm text-gray-400">Complete all production stages to set profit margin and sync invoice.</p>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Production Cost</p>
                        <p className="text-base font-semibold text-white">{formatCurrency(productionCostFromStages)}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm text-gray-400">Profit Margin</Label>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs", profitMarginMode === 'fixed' ? "text-gray-500" : "text-blue-400 font-medium")}>%</span>
                            <Switch
                              checked={profitMarginMode === 'fixed'}
                              onCheckedChange={(checked) => setProfitMarginMode(checked ? 'fixed' : 'percentage')}
                              className="data-[state=checked]:bg-blue-600"
                            />
                            <span className={cn("text-xs", profitMarginMode === 'fixed' ? "text-blue-400 font-medium" : "text-gray-500")}>Fixed</span>
                          </div>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          step={profitMarginMode === 'percentage' ? 0.5 : 1}
                          className="bg-gray-950 border-gray-700 text-white text-sm"
                          value={profitMarginValue}
                          onChange={(e) => setProfitMarginValue(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                          <Info size={12} className="text-blue-400 shrink-0" />
                          {profitMarginMode === 'percentage'
                            ? `${profitMarginValue || 0}% of production cost`
                            : 'Fixed amount'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Profit Distribution</p>
                        <div className="flex items-center justify-between bg-gray-950/80 border border-gray-800 rounded-lg p-3">
                          <span className="text-sm text-white">{completedProductionSteps.length} Stages</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                            onClick={() => setShowProfitDistributionModal(true)}
                            disabled={completedProductionSteps.length === 0}
                          >
                            Configure Profit Distribution
                            <ChevronRight size={14} className="ml-1" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
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
                    displayBalanceDue === 0 && "bg-green-600",
                    displayBalanceDue > 0 && saleDetail.paidAmount > 0 && "bg-blue-600",
                    displayBalanceDue >= grandTotalForCard && grandTotalForCard > 0 && "bg-orange-600"
                  )}>
                    {displayBalanceDue === 0 ? 'Paid' : saleDetail.paidAmount > 0 ? 'Partial' : 'Pending'}
                  </Badge>
                </div>

                {/* Summary Card – unified: pricing (Production Cost, Profit, Final Sale Price) + Paid + Balance Due */}
                <div className={cn(
                  "border rounded-xl p-5 mb-4",
                  displayBalanceDue === 0
                    ? "bg-gradient-to-br from-green-950/30 to-green-900/20 border-green-800/50"
                    : saleDetail.paidAmount > 0
                      ? "bg-gradient-to-br from-blue-950/30 to-blue-900/20 border-blue-800/50"
                      : "bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800"
                )}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Production Cost</span>
                      <span className="text-lg font-semibold text-white">{formatCurrency(productionCostFromStages)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-transparent">
                      <span className="text-sm text-gray-400">Profit</span>
                      <span className="text-lg font-semibold text-white">{formatCurrency(profitAmount)}</span>
                    </div>
                    {saleDetail.shipmentCharges > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Shipment</span>
                        <span className="text-lg font-semibold text-white">{formatCurrency(saleDetail.shipmentCharges)}</span>
                      </div>
                    )}
                    <div className="h-px bg-gray-800"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-300">Grand Total</span>
                      <span className="text-xl font-bold text-white">{formatCurrency(grandTotalForCard)}</span>
                    </div>
                    {saleDetail.paidAmount > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Customer Paid</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-green-400">{formatCurrency(saleDetail.paidAmount)}</span>
                            <span className="text-xs text-gray-500">
                              ({grandTotalForCard > 0 ? ((saleDetail.paidAmount / grandTotalForCard) * 100).toFixed(0) : 0}%)
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
                          displayBalanceDue === 0 ? "text-green-400" : "text-orange-400"
                        )}>
                          {formatCurrency(displayBalanceDue)}
                        </span>
                        {displayBalanceDue === 0 && (
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
                      {displayBalanceDue > 0 && saleDetail.source === 'sale' && (
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

      {/* Profit Distribution Modal */}
      {showProfitDistributionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1E27] border border-gray-800 rounded-xl overflow-hidden max-w-[590px] w-full max-h-[103.5vh] flex flex-col">
            <div className="bg-gradient-to-r from-emerald-600/80 to-blue-600/80 px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-emerald-200" />
                <h3 className="text-lg font-bold text-white">Profit Distribution</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowProfitDistributionModal(false)} className="text-white hover:bg-white/20 h-8 w-8 p-0">
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <p className="text-sm text-gray-300">Total Profit: <span className="font-bold text-green-400">{formatCurrency(Math.max(0, profitAmount))}</span></p>
              <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-300 flex items-center gap-1 mb-2">
                  <Info size={14} /> How it works:
                </p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Edit any stage to set a manual amount</li>
                  <li>• Remaining profit auto-distributes to other stages</li>
                  <li>• Total profit always remains fixed</li>
                </ul>
              </div>
              <div className="space-y-3">
                {profitDistributionRows.map((row, index) => (
                  <div key={row.stepId} className="bg-gray-900/80 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-400 text-xs font-bold">{index + 1}</span>
                        <span className="text-sm font-medium text-white">{row.name}</span>
                        <Badge variant="outline" className={cn("text-[10px]", row.isManual ? "bg-amber-500/20 text-amber-400 border-amber-600" : "bg-blue-500/20 text-blue-400 border-blue-600")}>
                          {row.isManual ? 'Manual' : 'Auto'}
                        </Badge>
                      </div>
                      <Edit2 size={14} className="text-gray-500" />
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Worker: {row.workerName}</p>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Profit Share</p>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="bg-gray-950 border-gray-700 text-white h-9 font-semibold text-green-400"
                        value={Math.round(row.amount)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (Number.isFinite(v) && v >= 0) updateProfitShare(row.stepId, v);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full border-amber-600 text-amber-200" onClick={resetProfitDistribution}>
                <RotateCcw size={14} className="mr-2" />
                Reset Auto Distribution
              </Button>
            </div>
            <div className="p-4 border-t border-gray-800 flex items-center justify-between shrink-0 bg-gray-950/50">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">Total Distributed: <span className="font-semibold text-green-400">{formatCurrency(totalDistributed)}</span></span>
                <span className="text-gray-500">Across Stages: <span className="text-white">{profitDistributionRows.length}</span></span>
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowProfitDistributionModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
      
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
                  onClick={() => handleAddShipment()}
                  disabled={savingShipment}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {savingShipment ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  Add Shipment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Product & Generate Invoice Modal */}
      {showCreateProductInvoiceModal && saleDetail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1E27] border border-gray-800 rounded-xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-blue-600/80 to-emerald-600/80 px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-white" />
                <div>
                  <h3 className="text-lg font-bold text-white">Create Product & Generate Invoice</h3>
                  <p className="text-xs text-white/80">Auto-create product and sales invoice from production order.</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setShowCreateProductInvoiceModal(false); setCreateProductInvoiceImageFiles([]); }} className="text-white hover:bg-white/20 h-8 w-8 p-0">
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <Label className="text-gray-400 text-sm">Product Name</Label>
                <Input
                  className="mt-1 bg-gray-950 border-gray-700 text-white"
                  placeholder="e.g., Custom BinSaee Print Dress"
                  value={createProductInvoiceForm.productName}
                  onChange={(e) => setCreateProductInvoiceForm(prev => ({ ...prev, productName: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Product Category</Label>
                <select
                  className="mt-1 w-full h-10 rounded-md bg-gray-950 border border-gray-700 text-white px-3 text-sm"
                  value={createProductInvoiceForm.categoryId}
                  onChange={(e) => setCreateProductInvoiceForm(prev => ({ ...prev, categoryId: e.target.value }))}
                >
                  <option value="">Select Category</option>
                  {createProductInvoiceCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Upload Product Image (optional)</Label>
                <div
                  {...createProductInvoiceDropzone.getRootProps()}
                  className={cn(
                    'mt-1 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors',
                    createProductInvoiceDropzone.isDragActive
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'
                  )}
                >
                  <input {...createProductInvoiceDropzone.getInputProps()} />
                  <Upload size={24} className="text-gray-500 mb-2" />
                  <Camera size={20} className="text-gray-500 mb-1" />
                  <p className="text-sm text-gray-400 text-center">
                    Drag & drop images here, or <span className="text-blue-500">browse</span>
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Supports: JPG, PNG (max 5MB)</p>
                </div>
                {createProductInvoiceImageFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {createProductInvoiceImageFiles.map((file, idx) => (
                      <div key={idx} className="relative group aspect-square w-14 h-14 rounded-lg overflow-hidden border border-gray-700 bg-gray-800">
                        <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCreateProductInvoiceImageFiles(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Sale Price (Rs)</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1 bg-gray-950 border-gray-700 text-white"
                  placeholder="0"
                  value={createProductInvoiceForm.salePrice}
                  onChange={(e) => setCreateProductInvoiceForm(prev => ({ ...prev, salePrice: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Description (Optional)</Label>
                <textarea
                  className="mt-1 w-full min-h-[80px] rounded-md bg-gray-950 border border-gray-700 text-white px-3 py-2 text-sm resize-y"
                  placeholder="Product description (same as in Add Product form)..."
                  value={createProductInvoiceForm.description}
                  onChange={(e) => setCreateProductInvoiceForm(prev => ({ ...prev, description: e.target.value }))}
                />
                <p className="text-[10px] text-gray-500 mt-1">This will be saved as the product description, linked to Add Product.</p>
              </div>
              <p className="text-xs text-gray-500">
                Product will be linked to order <strong className="text-white">{saleDetail.invoiceNo}</strong>.
              </p>
            </div>
            <div className="p-5 border-t border-gray-800 flex gap-3 shrink-0">
              <Button variant="outline" className="flex-1 border-gray-700" onClick={() => { setShowCreateProductInvoiceModal(false); setCreateProductInvoiceImageFiles([]); }}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={creatingProductAndInvoice || !createProductInvoiceForm.salePrice || parseFloat(createProductInvoiceForm.salePrice) <= 0}
                onClick={handleCreateProductAndInvoice}
              >
                {creatingProductAndInvoice ? <Loader2 size={16} className="animate-spin mr-2" /> : <Package size={16} className="mr-2" />}
                Create Product + Generate Invoice
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Worker Modal – workers filtered by task category (Dyeing / Stitching / Handwork); rendered in portal so it always stacks on top */}
      {showWorkerEditModal && createPortal(
        (() => {
        const currentStep = saleDetail?.productionSteps.find(s => s.id === showWorkerEditModal);
        const workersForCategory = getWorkersForStageType(currentStep?.stageType, workers);
        const workerList = showAllWorkersInAssignModal ? workers : workersForCategory;
        const categoryLabel = currentStep?.stageType === 'dyer' ? 'Dyeing' : currentStep?.stageType === 'stitching' ? 'Stitching' : currentStep?.stageType === 'handwork' ? 'Handwork / Embroidery' : 'this task';
        return (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          style={{ zIndex: 9999 }}
          onClick={() => { setShowWorkerEditModal(null); setShowAllWorkersInAssignModal(false); }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users size={18} className="text-blue-400" />
                  Assign worker – {currentStep?.name || categoryLabel}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {showAllWorkersInAssignModal ? 'Showing all workers.' : `Only ${categoryLabel} workers shown.`} Click <strong className="text-white">Save</strong> or <strong className="text-white">Done</strong> in the header above to save assignment.
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
                                {workerStagePaymentStatus[showWorkerEditModal] === 'paid' ? (
                                  <div className="bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
                                    <Lock size={14} />
                                    {formatCurrency(worker.cost || 0)} — locked (worker paid)
                                  </div>
                                ) : (
                                  <Input
                                    type="number"
                                    value={worker.cost || ''}
                                    onChange={(e) => handleUpdateWorker(worker.id, 'cost', Number(e.target.value))}
                                    placeholder="0"
                                    className="bg-gray-900 border-gray-700 text-sm h-9"
                                  />
                                )}
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

              {/* Expected Completion Date – DD MMM YYYY display, YYYY-MM-DD value (Step B: mandatory) */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Expected Completion Date *</label>
                <DatePicker
                  value={editingWorkerData.expectedCompletionDate || ''}
                  onChange={(v) => setEditingWorkerData(prev => ({ ...prev, expectedCompletionDate: v }))}
                  placeholder="Select date"
                  className="max-w-[200px]"
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
                  onClick={() => { setShowWorkerEditModal(null); setShowAllWorkersInAssignModal(false); }}
                  variant="outline"
                  className="border-gray-700"
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
      })(),
        document.body
      )}

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
