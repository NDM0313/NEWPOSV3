import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSales, Sale, convertFromSupabaseSale, isValidBranchId } from '@/app/context/SalesContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { branchService, Branch } from '@/app/services/branchService';
import { contactService } from '@/app/services/contactService';
import { saleService } from '@/app/services/saleService';
import { resolvePaymentRowForEdit, resolvePaymentIdForMutation } from '@/app/lib/paymentRowEditRouting';
import { saleReturnService } from '@/app/services/saleReturnService';
import { activityLogService } from '@/app/services/activityLogService';
import { studioProductionService } from '@/app/services/studioProductionService';
import { supabase } from '@/lib/supabase';
import { getContactWhatsAppPhone, openWhatsAppShare } from '@/app/lib/phoneWhatsApp';
import { UnifiedSalesInvoiceView } from '@/app/documents';
import { BespokeInstructionBullets } from '@/app/components/bespoke/BespokeInstructionBullets';
import { BespokeWorkOrdersPanel } from '@/app/components/bespoke/BespokeWorkOrdersPanel';
import { PackingListWorkflow } from '@/app/wholesale/PackingListWorkflow';
import { WorkflowNextStepBanner } from '@/app/workflows';
import type { InvoiceTemplateType } from '@/app/types/invoiceDocument';
import { PaymentDeleteConfirmationModal } from '../shared/PaymentDeleteConfirmationModal';
import { UnifiedPaymentDialog } from '../shared/UnifiedPaymentDialog';
import { readSaleBillRef } from '@/app/utils/saleBillRef';
import { 
  X, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  Package, 
  DollarSign, 
  CreditCard, 
  Truck,
  Edit,
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  Building2,
  UserCheck,
  Printer,
  Download,
  Share2,
  MoreVertical,
  Paperclip,
  Image as ImageIcon,
  File,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Scissors,
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { cn, formatBoxesPieces } from "../ui/utils";
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { usePrinterConfig } from '@/app/hooks/usePrinterConfig';
import { getThermalDimensions } from '@/app/constants/thermalPrintDimensions';
import { toast } from 'sonner';
import { getAttachmentOpenUrl } from '@/app/utils/paymentAttachmentUrl';
import { AttachmentPreviewRow } from '@/app/components/shared/AttachmentPreviewRow';
import { getEffectiveSaleStatus, getSaleStatusBadgeConfig, canAddPaymentToSale } from '@/app/utils/statusHelpers';
import { isSaleNonPostedCommercial } from '@/app/lib/postingStatusGate';
import { formatSaleChargeDisplayLabel, formatSaleChargeLabel } from '@/app/lib/saleChargeDisplay';
import { getStudioDeadlineFromNotes } from '@/app/utils/studioDeadlineNotes';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';

interface SaleItem {
  id: number;
  productId: number;
  name: string;
  sku: string;
  price: number;
  qty: number;
  size?: string;
  color?: string;
  thaans?: number;
  meters?: number;
  packingDetails?: { total_boxes?: number; total_pieces?: number; total_meters?: number; [k: string]: unknown };
  unit?: string;
  stock?: number;
}

interface Payment {
  id: number;
  date: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
}

interface SaleDetails {
  id: number;
  invoiceNo: string;
  date: string;
  customer: string;
  customerName: string;
  contactNumber: string;
  address?: string;
  location: string;
  salesman?: string;
  items: SaleItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  shippingCharges?: number;
  otherCharges?: number;
  total: number;
  paid: number;
  due: number;
  returnDue?: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  shippingStatus: 'Pending' | 'Processing' | 'Shipped' | 'Delivered';
  status: 'Draft' | 'Quotation' | 'Order' | 'Final';
  payments: Payment[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

interface ViewSaleDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string | null;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddPayment?: (id: string) => void;
  onPrint?: (id: string) => void;
  /** When set, drawer opens and immediately shows print/PDF view (Phase A document engine). */
  initialPrintType?: InvoiceTemplateType | null;
}

export const ViewSaleDetailsDrawer: React.FC<ViewSaleDetailsDrawerProps> = ({
  isOpen,
  onClose,
  saleId,
  onEdit,
  onDelete,
  onAddPayment,
  onPrint,
  initialPrintType = null,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'history'>('details');
  const { getSaleById } = useSales();
  const getSaleByIdRef = useRef(getSaleById);
  getSaleByIdRef.current = getSaleById;
  const { companyId, user } = useSupabase();
  const { company, inventorySettings, businessSettings } = useSettings();
  const enableBespoke = businessSettings.enableBespokeOrders;
  const { formatCurrency } = useFormatCurrency();
  const { config: printerConfig } = usePrinterConfig();
  const enablePacking = inventorySettings.enablePacking;
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [printLayoutType, setPrintLayoutType] = useState<InvoiceTemplateType>('A4');
  const [showPackingListWorkflow, setShowPackingListWorkflow] = useState(false);
  const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
  const [customerCode, setCustomerCode] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<any | null>(null);
  const [attachmentsDialogList, setAttachmentsDialogList] = useState<{ url: string; name: string }[] | null>(null);
  const [saleReturns, setSaleReturns] = useState<any[]>([]);
  const [loadingSaleReturns, setLoadingSaleReturns] = useState(false);
  const [studioSummary, setStudioSummary] = useState<Awaited<ReturnType<typeof studioProductionService.getStudioSummaryBySaleId>> | null>(null);
  const [loadingStudioSummary, setLoadingStudioSummary] = useState(false);
  const [showStudioBreakdown, setShowStudioBreakdown] = useState(true);
  const [studioV3Breakdown, setStudioV3Breakdown] = useState<{ stage_name: string; worker_name: string | null; worker_cost: number; type: string }[]>([]);
  const [loadingStudioV3Breakdown, setLoadingStudioV3Breakdown] = useState(false);
  const [salesmanName, setSalesmanName] = useState<string | null>(null);

  const handleShareWhatsApp = useCallback(() => {
    if (!sale) return;
    // Use sale.total directly — studio product line is already included in total
    const total = (sale.total ?? 0) + (Number(sale.shippingCharges ?? (sale as { shipment_charges?: number }).shipment_charges) || 0);
    const paid = payments.length > 0 ? payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) : (sale.paid ?? 0);
    const due = Math.max(0, total - paid);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin + (import.meta.env?.BASE_URL || '') : '';
    const link = `${baseUrl}/sales?invoice=${encodeURIComponent(sale.id)}`;
    const text = [`Invoice: ${sale.invoiceNo}`, `Customer: ${sale.customerName || 'Walk-in'}`, `Total: Rs. ${total.toLocaleString()}`, `Balance Due: Rs. ${due.toLocaleString()}`, `View: ${link}`].join('\n');
    saleService.logShare(sale.id, 'whatsapp', user?.id).catch(() => {});
    saleService.logSaleAction(sale.id, 'share_whatsapp', user?.id).catch(() => {});
    openWhatsAppShare(getContactWhatsAppPhone({ contact_number: sale.contact_number }), text);
    toast.success('WhatsApp share opened');
  }, [sale, payments, user?.id]);
  const handleSharePdf = useCallback(() => {
    if (!sale) return;
    setPrintLayoutType('A4');
    setShowPrintLayout(true);
    saleService.logShare(sale.id, 'pdf', user?.id).catch(() => {});
    saleService.logSaleAction(sale.id, 'share_pdf', user?.id).catch(() => {});
    toast.success('Open Print dialog to save as PDF or share');
  }, [sale, user?.id]);
  const handleDownloadPdf = useCallback(() => {
    if (!sale) return;
    setPrintLayoutType('A4');
    setShowPrintLayout(true);
    saleService.logSaleAction(sale.id, 'download_pdf', user?.id).catch(() => {});
    toast.success('Use browser Print → Save as PDF');
  }, [sale, user?.id]);
  const handlePrintA4 = useCallback(() => {
    if (!sale) return;
    setPrintLayoutType('A4');
    setShowPrintLayout(true);
    onPrint?.(sale.id);
    saleService.logPrint(sale.id, 'A4', user?.id).catch(() => {});
  }, [sale, user?.id, onPrint]);
  const handlePrintThermal = useCallback(() => {
    if (!sale) return;
    setPrintLayoutType('Thermal');
    setShowPrintLayout(true);
    saleService.logPrint(sale.id, 'Thermal', user?.id).catch(() => {});
  }, [sale, user?.id]);

  // When opened with initialPrintType (e.g. from SalesPage Print A4/Thermal/Download PDF), show document engine immediately
  useEffect(() => {
    if (isOpen && initialPrintType) {
      setPrintLayoutType(initialPrintType);
      setShowPrintLayout(true);
    }
  }, [isOpen, initialPrintType]);

  // Load branches for location display
  useEffect(() => {
    const loadBranches = async () => {
      if (!companyId) return;
      try {
        const branchesData = await branchService.getAllBranches(companyId);
        // Create mapping from branch_id to branch name
        const map = new Map<string, string>();
        branchesData.forEach(branch => {
          map.set(branch.id, branch.name);
        });
        setBranchMap(map);
      } catch (error) {
        console.error('[VIEW SALE DETAILS] Error loading branches:', error);
      }
    };
    loadBranches();
  }, [companyId]);

  // CRITICAL FIX: Load payments breakdown (must be defined before useEffect that uses it)
  const loadPayments = useCallback(async (saleId: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoadingPayments(true);
    try {
      const fetchedPayments = await saleService.getSalePayments(saleId);
      setPayments(fetchedPayments);
    } catch (error) {
      console.error('[VIEW SALE] Error loading payments:', error);
      if (!silent) setPayments([]);
    } finally {
      if (!silent) setLoadingPayments(false);
    }
  }, []);

  // CRITICAL FIX: Load activity logs (must be defined before useEffect that uses it)
  const loadActivityLogs = useCallback(async (saleId: string) => {
    if (!companyId) return;
    setLoadingActivityLogs(true);
    try {
      const logs = await activityLogService.getEntityActivityLogs(companyId, 'sale', saleId);
      setActivityLogs(logs);
    } catch (error) {
      console.error('[VIEW SALE] Error loading activity logs:', error);
      setActivityLogs([]);
    } finally {
      setLoadingActivityLogs(false);
    }
  }, [companyId]);

  // Load sale data from context (TASK 2 & 3 FIX - Real data instead of mock)
  useEffect(() => {
    if (isOpen && saleId) {
      const loadSaleData = async () => {
        setLoading(true);
        try {
          // CRITICAL FIX: Fetch fresh sale data from database (not just context)
          const saleData = await saleService.getSaleById(saleId);
          if (saleData) {
            const convertedSale = convertFromSupabaseSale(saleData);
            // Preserve variation and packing from raw sale data (same as Purchase View: data from API)
            if (saleData.items && convertedSale.items) {
              const parsePacking = (v: any): any => {
                if (v == null) return v;
                if (typeof v === 'string') {
                  try { return JSON.parse(v); } catch { return null; }
                }
                return v;
              };
              convertedSale.items = convertedSale.items.map((item, idx) => {
                const rawItem = saleData.items[idx];
                if (rawItem) {
                  const rawPacking = parsePacking(rawItem.packing_details);
                  const packingDetails = rawPacking
                    ? { ...rawPacking, total_boxes: rawPacking.total_boxes ?? 0, total_pieces: rawPacking.total_pieces ?? 0, total_meters: rawPacking.total_meters ?? rawItem.packing_quantity ?? 0 }
                    : item.packingDetails;
                  return {
                    ...item,
                    variation: rawItem.variation || rawItem.product_variations || null,
                    packing_details: rawPacking ?? item.packing_details ?? undefined,
                    packingDetails: packingDetails ?? item.packingDetails ?? undefined,
                    customizationDetails:
                      item.customizationDetails ??
                      (rawItem as { customization_details?: unknown }).customization_details,
                  } as any;
                }
                return item;
              });
            }
            // CRITICAL FIX: Ensure attachments are preserved
            if (saleData.attachments) {
              convertedSale.attachments = saleData.attachments;
            }
            setSale(convertedSale);
            
            // CRITICAL FIX: Load customer code if customer ID exists (not UUID display)
            if (convertedSale.customer && companyId) {
              contactService.getContact(convertedSale.customer)
                .then(contact => {
                  if (contact && (contact as any).code) {
                    setCustomerCode((contact as any).code);
                  } else {
                    setCustomerCode(null);
                  }
                })
                .catch(error => {
                  console.error('[VIEW SALE] Error loading customer:', error);
                  setCustomerCode(null);
                });
            } else {
              setCustomerCode(null);
            }
            
            // CRITICAL FIX: Load payments breakdown and activity timeline
            loadPayments(saleId);
            loadActivityLogs(saleId);
          } else {
            // Fallback to context
            const contextSale = getSaleByIdRef.current(saleId);
            if (contextSale) {
              setSale(contextSale);
              loadPayments(saleId);
              loadActivityLogs(saleId);
            }
          }
        } catch (error: any) {
          console.error('[VIEW SALE] Error loading sale:', error?.message || error);
          // Fallback to context (ref avoids re-running this effect when only getSaleById identity changes)
          const contextSale = getSaleByIdRef.current(saleId);
          if (contextSale) {
            setSale(contextSale);
            loadPayments(saleId);
            loadActivityLogs(saleId);
          } else {
            // If context also doesn't have it, show error
            console.error('[VIEW SALE] Sale not found in context either');
          }
        } finally {
          setLoading(false);
        }
      };
      
      loadSaleData();
    } else {
      setLoading(false);
    }
  }, [isOpen, saleId, companyId, loadPayments, loadActivityLogs]);

  // Refresh activity logs when History tab is opened (e.g. after mobile attachment add)
  useEffect(() => {
    if (!isOpen || !saleId || activeTab !== 'history') return;
    void loadActivityLogs(saleId);
  }, [isOpen, saleId, activeTab, loadActivityLogs]);

  // Load studio summary for this sale (real-time sync: productions + stages)
  useEffect(() => {
    if (!isOpen || !saleId) {
      setStudioSummary(null);
      return;
    }
    let cancelled = false;
    setLoadingStudioSummary(true);
    studioProductionService.getStudioSummaryBySaleId(saleId).then((summary) => {
      if (!cancelled) {
        setStudioSummary(summary);
      }
    }).catch(() => {
      if (!cancelled) setStudioSummary(null);
    }).finally(() => {
      if (!cancelled) setLoadingStudioSummary(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, saleId]);

  // Load Studio Production V3 breakdown when sale has source=studio_production_v3 and show_studio_breakdown
  useEffect(() => {
    const src = (sale as any)?.source;
    const sourceId = (sale as any)?.source_id;
    const showBreakdown = (sale as any)?.show_studio_breakdown;
    if (!isOpen || !saleId || src !== 'studio_production_v3' || !showBreakdown || !sourceId) {
      setStudioV3Breakdown([]);
      return;
    }
    let cancelled = false;
    setLoadingStudioV3Breakdown(true);
    supabase
      .from('studio_production_cost_breakdown_v3')
      .select('stage_name, worker_name, worker_cost, type')
      .eq('production_id', sourceId)
      .order('id')
      .then(({ data, error }) => {
        if (!cancelled && !error && data) {
          setStudioV3Breakdown(data as { stage_name: string; worker_name: string | null; worker_cost: number; type: string }[]);
        } else if (!cancelled) {
          setStudioV3Breakdown([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStudioV3Breakdown(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, saleId, (sale as any)?.source, (sale as any)?.source_id, (sale as any)?.show_studio_breakdown]);

  // CRITICAL FIX: Reload sale data (called after payment is added or sale updated e.g. Studio invoice sync)
  const reloadSaleData = useCallback(async (opts?: { silentPayments?: boolean }) => {
    if (!saleId) return;
    try {
      const saleData = await saleService.getSaleById(saleId);
      if (saleData) {
        const convertedSale = convertFromSupabaseSale(saleData);
        setSale(convertedSale);
        await loadPayments(saleId, { silent: opts?.silentPayments });
        await loadActivityLogs(saleId);
        if ((convertedSale as any).studioCharges != null || (convertedSale as any).is_studio) {
          const summary = await studioProductionService.getStudioSummaryBySaleId(saleId).catch(() => null);
          if (summary) setStudioSummary(summary);
        }
      }
    } catch (error: any) {
      console.error('[VIEW SALE] Error reloading sale:', error?.message || error);
    }
  }, [saleId, loadPayments, loadActivityLogs]);
  
  // CRITICAL FIX: Listen for payment added event
  useEffect(() => {
    const handlePaymentAdded = () => {
      if (saleId) {
        reloadSaleData({ silentPayments: true });
      }
    };
    
    window.addEventListener('paymentAdded', handlePaymentAdded);
    return () => {
      window.removeEventListener('paymentAdded', handlePaymentAdded);
    };
  }, [saleId, reloadSaleData]);

  // Reload sale when this sale was updated (e.g. Studio invoice sync) so table prices and totals refresh
  useEffect(() => {
    const handler = (e: CustomEvent<{ saleId: string }>) => {
      if (e.detail?.saleId && saleId && e.detail.saleId === saleId) {
        reloadSaleData({ silentPayments: true });
      }
    };
    window.addEventListener('saleUpdated', handler as EventListener);
    return () => window.removeEventListener('saleUpdated', handler as EventListener);
  }, [saleId, reloadSaleData]);

  // Load sale returns for this sale when final (targeted query — not whole-company list)
  useEffect(() => {
    if (!companyId || !saleId || !sale) return;
    const isFinal = (sale.status || '').toString().toLowerCase() === 'final';
    if (!isFinal) {
      setSaleReturns([]);
      return;
    }
    let cancelled = false;
    setLoadingSaleReturns(true);
    saleReturnService
      .getSaleReturnsForOriginalSale(companyId, saleId)
      .then((forThisSale) => {
        if (cancelled) return;
        setSaleReturns(forThisSale || []);
        if ((forThisSale || []).length > 0) {
          setSale((prev) => {
            if (!prev) return null;
            const count = forThisSale.length;
            if ((prev as any).hasReturn && (prev as any).returnCount === count) return prev;
            return { ...prev, hasReturn: true, returnCount: count } as Sale;
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSaleReturns([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSaleReturns(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, saleId, sale?.id, (sale as any)?.status, (sale as any)?.returnDue]);

  const salesmanId = (sale as any)?.salesmanId ?? (sale as any)?.salesman_id;
  useEffect(() => {
    if (!salesmanId || salesmanId === 'none' || salesmanId === '1') {
      setSalesmanName(null);
      return;
    }
    setSalesmanName(null);
    supabase
      .from('users')
      .select('full_name, email')
      .eq('id', salesmanId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSalesmanName((data as any).full_name || (data as any).email || 'Unknown');
      });
  }, [salesmanId]);

  /** Non-posted stages: hide payment UI (defined before early returns for hook + derived state consistency). */
  const hidePaymentCommercial = sale
    ? isSaleNonPostedCommercial(getEffectiveSaleStatus(sale))
    : false;

  useEffect(() => {
    if (hidePaymentCommercial && activeTab === 'payments') {
      setActiveTab('details');
    }
  }, [hidePaymentCommercial, activeTab]);

  if (!isOpen || !saleId) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-foreground">Loading sale details...</div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="text-foreground">Sale not found</div>
        <Button onClick={onClose} className="ml-4">Close</Button>
      </div>
    );
  }

  const effectiveStatus = getEffectiveSaleStatus(sale);
  const isCancelled = effectiveStatus === 'cancelled';
  const isReturned = effectiveStatus === 'returned';
  const isPartiallyReturned = effectiveStatus === 'partially_returned';
  const statusBadgeConfig = getSaleStatusBadgeConfig(sale);
  const badge = statusBadgeConfig?.bg != null ? statusBadgeConfig : { bg: 'bg-gray-500/20', text: 'text-muted-foreground', border: 'border-gray-500/30', label: 'Draft' };
  // Studio: show production cost for legacy; when we have generated invoice item, show its total (final sale with profit)
  const studioCostLegacy = Number(sale.studioCharges ?? 0) || Number(studioSummary?.totalStudioCost ?? 0);
  const genId = (studioSummary as { generatedInvoiceItemId?: string | null } | null)?.generatedInvoiceItemId;
  const studioLineItem = genId && sale.items?.length ? (sale.items as any[]).find((i: any) => i.id === genId) : null;
  const studioLineTotalFromInvoice = studioLineItem
    ? (Number(studioLineItem.price) || 0) * (Number(studioLineItem.quantity) || (studioLineItem as any).qty || 1)
    : 0;
  const studioCost = studioLineTotalFromInvoice > 0 ? studioLineTotalFromInvoice : studioCostLegacy;
  // Issue 02: Include shipping in grand total (sale.total is product-only when shipment exists; shipment_charges synced by trigger)
  const saleWithShipping = (sale.total ?? 0) + (Number(sale.shippingCharges ?? (sale as { shipment_charges?: number }).shipment_charges) || 0);
  const grandTotal = studioLineTotalFromInvoice > 0 ? saleWithShipping : saleWithShipping + studioCostLegacy;
  // Use sum of actual payment records when loaded (single source of truth); fallback to sale.paid from DB.
  // Fixes desktop drawer showing wrong paid amount (e.g. doubled) when sales.paid_amount is out of sync.
  const totalPaidDisplay =
    payments.length > 0
      ? payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : (sale.paid ?? 0);
  const dueAmount = Math.max(0, grandTotal - totalPaidDisplay);
  const canAddPayment =
    !hidePaymentCommercial && canAddPaymentToSale(sale, dueAmount);

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'final': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'order': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'quotation': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'draft': return 'bg-gray-500/10 text-muted-foreground border-gray-500/20';
      case 'cancelled': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'returned': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'partially_returned': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-gray-500/10 text-muted-foreground border-gray-500/20';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-500/10 text-green-500';
      case 'Partial': return 'bg-yellow-500/10 text-yellow-500';
      case 'Unpaid': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-muted-foreground';
    }
  };

  const getShippingStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered': return 'bg-green-500/10 text-green-500';
      case 'Shipped': return 'bg-blue-500/10 text-blue-500';
      case 'Processing': return 'bg-yellow-500/10 text-yellow-500';
      case 'Pending': return 'bg-gray-500/10 text-muted-foreground';
      default: return 'bg-gray-500/10 text-muted-foreground';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full md:w-[1100px] bg-input-background shadow-2xl z-50 overflow-hidden flex flex-col border-l border-border">
        {/* Cancelled banner - top of drawer when sale is cancelled */}
        {isCancelled && (
          <div className="shrink-0 bg-amber-500/20 border-b border-amber-500/30 px-6 py-3 flex items-center gap-2">
            <X size={18} className="text-amber-500" />
            <span className="font-semibold text-amber-200 uppercase tracking-wide">Cancelled Invoice</span>
            <span className="text-amber-300/90 text-sm">Reversed entry created.</span>
          </div>
        )}
        {/* Header */}
        <div className="bg-card/95 border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-3 flex-wrap">
                {sale.invoiceNo}
                <Badge className={cn("text-xs font-semibold border", badge.bg, badge.text, badge.border)}>
                  {badge.label}
                </Badge>
                {((sale as any).is_studio || (sale.invoiceNo || '').startsWith('STD-') || (sale.invoiceNo || '').startsWith('ST-')) && (
                  <Badge className="text-xs font-semibold border bg-purple-500/20 text-purple-300 border-purple-500/30">
                    <Scissors size={12} className="mr-1" />
                    Studio Sale
                  </Badge>
                )}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Sale Transaction Details
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Action Buttons */}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={handlePrintA4}
            >
              <Printer size={16} className="mr-2" />
              Print A4
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground w-52">
                {!isCancelled && (
                  <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={() => onEdit?.(sale.id)}>
                    <Edit size={14} className="mr-2" />
                    Edit Sale
                  </DropdownMenuItem>
                )}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="hover:bg-muted cursor-pointer">
                    <Share2 size={14} className="mr-2" />
                    Share
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-popover border-border text-popover-foreground">
                    <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={handleShareWhatsApp}>Share via WhatsApp</DropdownMenuItem>
                    <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={handleSharePdf}>Share PDF</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="hover:bg-muted cursor-pointer">
                    <Printer size={14} className="mr-2" />
                    Print
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-popover border-border text-popover-foreground">
                    <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={handlePrintA4}>Print A4 (Regular)</DropdownMenuItem>
                    <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={handlePrintThermal}>Print Thermal (80mm/58mm)</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={handleDownloadPdf}>
                  <Download size={14} className="mr-2" />
                  Download PDF
                </DropdownMenuItem>
                {!isCancelled && companyId && (
                  <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={() => setShowPackingListWorkflow(true)}>
                    <Package size={14} className="mr-2" />
                    Packing List
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-muted" />
                {!isCancelled && (
                  <DropdownMenuItem className="hover:bg-muted cursor-pointer text-red-400" onClick={() => onDelete?.(sale.id)}>
                    <Trash2 size={14} className="mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Workflow: next step (e.g. Retail: Sale → Payment → Receipt) */}
        {sale && !isCancelled && !hidePaymentCommercial && (
          <div className="px-6 py-2 border-b border-border/80 bg-muted/30 flex items-center gap-2">
            <WorkflowNextStepBanner currentStepId="sale" compact />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-muted/40 border-b border-border px-6 shrink-0">
          <div className="flex gap-1">
            {(
              hidePaymentCommercial
                ? [
                    { id: 'details' as const, label: 'Details' },
                    { id: 'history' as const, label: 'History' },
                  ]
                : [
                    { id: 'details' as const, label: 'Details' },
                    { id: 'payments' as const, label: 'Payments' },
                    { id: 'history' as const, label: 'History' },
                  ]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-4 py-3 text-sm font-medium transition-colors relative",
                  activeTab === tab.id
                    ? "text-blue-400"
                    : "text-muted-foreground hover:text-muted-foreground"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'details' && (
            <>
              {/* Customer & Transaction Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Info */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                    <User size={16} />
                    Customer Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Customer Name</p>
                      <p className="text-foreground font-medium">{sale.customerName}</p>
                      {customerCode && (
                        <p className="text-sm text-muted-foreground">Code: {customerCode}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Contact Number</p>
                      <p className="text-foreground flex items-center gap-2">
                        <Phone size={14} className="text-muted-foreground" />
                        {sale.contactNumber}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transaction Info */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Transaction Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Date</span>
                      <div className="text-foreground flex items-center gap-2">
                        <Calendar size={14} className="text-muted-foreground" />
                        <div>
                          <div>{new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(sale.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Location</span>
                      <span className="text-foreground flex items-center gap-2">
                        <Building2 size={14} className="text-muted-foreground" />
                        {branchMap.get(sale.location) || sale.location}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Created At</span>
                      <span className="text-foreground">{new Date(sale.createdAt).toLocaleString()}</span>
                    </div>
                    {sale.createdBy && (
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Created By</span>
                        <span className="text-foreground flex items-center gap-2">
                          <User size={14} className="text-muted-foreground" />
                          {sale.createdBy}
                        </span>
                      </div>
                    )}
                    {sale.updatedAt && (
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Last Updated</span>
                        <span className="text-foreground">{new Date(sale.updatedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {(() => {
                      const due = (sale as any).deadline || getStudioDeadlineFromNotes((sale as any).notes);
                      const isStudio = (sale as any).is_studio || (sale.invoiceNo || '').startsWith('STD-') || (sale.invoiceNo || '').startsWith('ST-');
                      const isOrder = String(sale.status || '').toLowerCase() === 'order';
                      if (!due || (!isStudio && !isOrder)) return null;
                      return (
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">{isStudio ? 'Studio / Due Date' : 'Delivery Date'}</span>
                          <span className="text-foreground">{new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      );
                    })()}
                    {(((sale as any).hasReturn || (sale as any).returnDue > 0 || saleReturns.length > 0) || loadingSaleReturns) && (() => {
                      const finalReturns = saleReturns.filter((r: any) => String(r.status || '').toLowerCase() === 'final');
                      const sumFinal = finalReturns.reduce((s, r: any) => s + (Number(r.total) || 0), 0);
                      return (
                        <div className="flex justify-between gap-3 border-t border-border/60 pt-3 mt-1">
                          <span className="text-xs text-muted-foreground shrink-0">Sale returns</span>
                          <span className="text-foreground text-sm text-right">
                            {loadingSaleReturns ? (
                              <span className="text-muted-foreground">Loading…</span>
                            ) : saleReturns.length === 0 ? (
                              <span className="text-muted-foreground">None loaded</span>
                            ) : (
                              <>
                                <span className="font-medium text-purple-300">{saleReturns.length}</span>
                                <span className="text-muted-foreground"> credit note(s)</span>
                                {sumFinal > 0 && (
                                  <>
                                    <span className="text-muted-foreground"> · </span>
                                    <span className="text-amber-200 tabular-nums">Returned {formatCurrency(sumFinal)}</span>
                                    <span className="text-muted-foreground"> (final)</span>
                                  </>
                                )}
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Salesman & Commission (when applicable) — Salesman = commission/report ownership; Created By = who created the record */}
              {(salesmanId || (sale as any).commissionAmount > 0) && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                    <UserCheck size={16} />
                    Salesman & Commission
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Salesman (commission/report)</p>
                      <p className="text-foreground font-medium">{salesmanName ?? (salesmanId ? '…' : '—')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Commission %</p>
                      <p className="text-foreground">{(sale as any).commissionPercent != null ? `${Number((sale as any).commissionPercent)}%` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Commission Amount</p>
                      <p className="text-foreground font-medium text-[var(--erp-money-positive)]">{formatCurrency(Number((sale as any).commissionAmount) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Commission Status</p>
                      <span className={cn(
                        'text-sm font-medium',
                        (sale as any).commissionStatus === 'posted' ? 'text-blue-400' : 'text-amber-400'
                      )}>
                        {(sale as any).commissionStatus === 'posted' ? 'Posted' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hidePaymentCommercial ? (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-2">Payments</p>
                    <p className="text-sm text-muted-foreground">
                      Customer balance and payment tracking start when this document is a <strong className="text-muted-foreground">final invoice</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-2">Payment Status</p>
                    <Badge className={cn("text-sm font-semibold", getPaymentStatusColor(sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'))}>
                      {sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                    </Badge>
                  </div>
                )}
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-2">Shipping Status</p>
                  <Badge className={cn("text-sm font-semibold", getShippingStatusColor(sale.shippingStatus === 'delivered' ? 'Delivered' : sale.shippingStatus === 'processing' ? 'Processing' : sale.shippingStatus === 'cancelled' ? 'Cancelled' : 'Pending'))}>
                    <Truck size={14} className="mr-1" />
                    {sale.shippingStatus === 'delivered' ? 'Delivered' : sale.shippingStatus === 'processing' ? 'Processing' : sale.shippingStatus === 'cancelled' ? 'Cancelled' : 'Pending'}
                  </Badge>
                </div>
              </div>

              {/* Sale Returns — amounts, lines, reason (not only invoice metadata) */}
              {((sale as any).hasReturn || (sale as any).returnCount > 0 || (sale as any).returnDue > 0 || saleReturns.length > 0 || loadingSaleReturns) && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <RotateCcw size={16} className="text-purple-400" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sale returns</h3>
                      {loadingSaleReturns && <span className="text-xs text-muted-foreground">Loading…</span>}
                    </div>
                    {!loadingSaleReturns && saleReturns.length > 0 && (() => {
                      const sumFinal = saleReturns
                        .filter((r: any) => String(r.status || '').toLowerCase() === 'final')
                        .reduce((s, r: any) => s + (Number(r.total) || 0), 0);
                      return sumFinal > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Total returned (final): <span className="text-amber-200 font-semibold tabular-nums">{formatCurrency(sumFinal)}</span>
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="p-4">
                    {loadingSaleReturns ? (
                      <p className="text-sm text-muted-foreground">Loading returns…</p>
                    ) : saleReturns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No return documents linked to this invoice yet.</p>
                    ) : (
                      <ul className="space-y-3">
                        {saleReturns.map((ret: any) => {
                          const retStatus = (ret.status || '').toString().toLowerCase();
                          const statusLabel =
                            retStatus === 'void' ? 'Void' : retStatus === 'final' ? 'Final' : 'Draft';
                          const statusClass = retStatus === 'void' ? 'bg-gray-500/20 text-muted-foreground border-gray-500/30' : retStatus === 'final' ? 'bg-green-500/20 text-[var(--erp-money-positive)] border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                          const lineCount = Array.isArray(ret.items) ? ret.items.length : 0;
                          const amt = Number(ret.total) || 0;
                          return (
                            <li key={ret.id} className="rounded-lg border border-border/80 bg-input-background/40 p-3 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-foreground font-mono">{ret.return_no || ret.id?.slice?.(0, 8) || '—'}</span>
                                <Badge className={cn('text-xs border', statusClass)}>{statusLabel}</Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>Date: <span className="text-gray-200">{ret.return_date ? new Date(ret.return_date).toLocaleString() : '—'}</span></span>
                                <span>Lines: <span className="text-gray-200">{lineCount}</span></span>
                                <span className="text-amber-200/90 font-semibold tabular-nums">Amount: {formatCurrency(amt)}</span>
                              </div>
                              {(ret.reason || ret.notes) && (
                                <p className="text-xs text-muted-foreground line-clamp-3">
                                  <span className="text-muted-foreground">Note: </span>
                                  {String(ret.reason || '').trim()}
                                  {ret.reason && ret.notes ? ' · ' : ''}
                                  {String(ret.notes || '').trim()}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Items Table — same structure as ViewPurchaseDetailsDrawer (UI + data from API) */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Package size={16} />
                    Items ({sale.items.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Product</TableHead>
                        <TableHead className="text-muted-foreground">SKU</TableHead>
                        <TableHead className="text-muted-foreground">Variation</TableHead>
                        {enablePacking && <TableHead className="text-muted-foreground">Packing</TableHead>}
                        <TableHead className="text-muted-foreground text-right">Unit Price</TableHead>
                        <TableHead className="text-muted-foreground text-center">Qty</TableHead>
                        <TableHead className="text-muted-foreground">Unit</TableHead>
                        <TableHead className="text-muted-foreground text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sale.items.map((item) => {
                        const productName = item.isStudioProduct === true
                          ? 'Studio Product (Auto Generated)'
                          : (item.productName || item.name || 'Unknown Product');
                        const displaySku = item.sku || 'N/A';
                        const qty = item.quantity ?? (item as any).qty ?? 0;
                        const variation = (item as any).variation || (item as any).product_variations || null;
                        const variationAttrs = variation?.attributes || {};
                        const variationSku = variation?.sku || null;
                        const variationText = variationAttrs
                          ? Object.entries(variationAttrs)
                              .filter(([_, v]) => v != null && v !== '')
                              .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                              .join(', ')
                          : null;
                        // Packing: same as Purchase View — from item.packing_details || item.packingDetails (parse if JSON string)
                        const rawPd = (item as any).packing_details ?? item.packingDetails;
                        const pd = (() => {
                          if (rawPd == null) return {};
                          if (typeof rawPd === 'string') {
                            try { return JSON.parse(rawPd) || {}; } catch { return {}; }
                          }
                          return rawPd;
                        })();
                        const totalBoxes = pd.total_boxes ?? 0;
                        const totalPieces = pd.total_pieces ?? 0;
                        const totalMeters = pd.total_meters ?? 0;
                        const packingParts: string[] = [];
                        if (Number(totalBoxes) > 0) packingParts.push(`${formatBoxesPieces(totalBoxes)} Box${Math.round(Number(totalBoxes)) !== 1 ? 'es' : ''}`);
                        if (Number(totalPieces) > 0) packingParts.push(`${formatBoxesPieces(totalPieces)} Piece${Math.round(Number(totalPieces)) !== 1 ? 's' : ''}`);
                        if (Number(totalMeters) > 0) packingParts.push(`${Number(totalMeters).toFixed(2)} M`);
                        const packingText = packingParts.length
                          ? packingParts.join(', ')
                          : (item.thaans != null || item.meters != null)
                            ? [item.thaans != null && item.thaans > 0 ? `${item.thaans} Thaan${item.thaans !== 1 ? 's' : ''}` : null, item.meters != null && item.meters > 0 ? `${item.meters}m` : null].filter(Boolean).join(' · ') || '—'
                            : '—';
                        const unitDisplay = item.unit ?? 'piece';
                        const finalSku = variationSku || displaySku;
                        return (
                          <TableRow key={item.id} className="border-border">
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{productName}</p>
                                {finalSku && finalSku !== 'N/A' && (
                                  <p className="text-xs text-muted-foreground">SKU: {finalSku}</p>
                                )}
                                {enableBespoke &&
                                  !(item as { bespokeParentItemId?: string | null }).bespokeParentItemId && (
                                  <BespokeInstructionBullets
                                    variant="screen"
                                    customizationDetails={
                                      (item as { customizationDetails?: unknown }).customizationDetails ??
                                      (item as { customization_details?: unknown }).customization_details
                                    }
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{finalSku}</TableCell>
                            <TableCell>
                              {variationText ? (
                                <span className="text-muted-foreground text-sm">{variationText}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            {enablePacking && (
                              <TableCell className="text-muted-foreground">
                                <span>{packingText}</span>
                              </TableCell>
                            )}
                            <TableCell className="text-right text-foreground">
{formatCurrency(Number(item.price || 0))}
                            </TableCell>
                            <TableCell className="text-center text-foreground font-medium">
                              {qty}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{unitDisplay}</TableCell>
                            <TableCell className="text-right text-foreground font-medium">
{formatCurrency(Number(item.price || 0) * qty)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {enableBespoke && companyId && isValidBranchId(sale.branchId) && (
                <BespokeWorkOrdersPanel
                  saleId={sale.id}
                  companyId={companyId}
                  branchId={sale.branchId}
                  formatCurrency={formatCurrency}
                  parentItems={(sale.items ?? [])
                    .filter((item: { bespokeParentItemId?: string | null }) => !item.bespokeParentItemId)
                    .map((item: { id?: string; productName?: string; name?: string; customizationDetails?: unknown; customization_details?: unknown }) => ({
                      id: String(item.id),
                      productName: item.productName ?? item.name ?? 'Item',
                      customizationDetails:
                        (item as { customizationDetails?: unknown }).customizationDetails ??
                        (item as { customization_details?: unknown }).customization_details,
                    }))}
                />
              )}

              {/* Studio Cost Summary – real-time from studio_productions + stages */}
              {(studioSummary?.hasStudio || (sale as any).studioCharges) && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowStudioBreakdown(!showStudioBreakdown)}
                    className="w-full px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between text-left hover:bg-accent/30 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Scissors size={16} className="text-amber-400" />
                      Studio Cost Summary
                    </h3>
                    {showStudioBreakdown ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </button>
                  {showStudioBreakdown && (
                    <div className="p-5 space-y-3">
                      {loadingStudioSummary ? (
                        <p className="text-sm text-muted-foreground">Loading studio data...</p>
                      ) : studioSummary?.hasStudio ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Production Status</span>
                            <span className={studioSummary.productionStatus === 'completed' ? 'text-[var(--erp-money-positive)] font-medium' : 'text-amber-400 font-medium'}>
                              {studioSummary.productionStatus === 'completed' ? 'Completed' : studioSummary.productionStatus === 'in_progress' ? 'In Progress' : 'Pending'}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Production Cost</span>
                            <span className="text-foreground font-semibold">{formatCurrency(studioSummary.totalStudioCost)}</span>
                          </div>
                          {(() => {
                            const genId = (studioSummary as any).generatedInvoiceItemId;
                            const studioItem = genId && sale.items?.length ? sale.items.find((i: any) => i.id === genId) : null;
                            const qty = studioItem ? (Number(studioItem.quantity) || (studioItem as any).qty || 1) : 0;
                            const finalSalePrice = studioItem ? (Number(studioItem.price) || 0) * qty : 0;
                            const profit = Math.max(0, finalSalePrice - studioSummary.totalStudioCost);
                            return (
                              <>
                                {genId && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Final Sale Price</span>
                                    <span className="text-foreground">{formatCurrency(finalSalePrice)}</span>
                                  </div>
                                )}
                                {genId && finalSalePrice > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-[var(--erp-money-positive)] font-medium">Profit</span>
                                    <span className="text-[var(--erp-money-positive)] font-medium">{formatCurrency(profit)}</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tasks Completed</span>
                            <span className="text-foreground">{studioSummary.tasksCompleted} / {studioSummary.tasksTotal}</span>
                          </div>
                          {studioSummary.productionDurationDays != null && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Production Duration</span>
                              <span className="text-foreground">{studioSummary.productionDurationDays} Day{studioSummary.productionDurationDays !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {studioSummary.completedAt && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Completed On</span>
                              <span className="text-foreground">{new Date(studioSummary.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          )}
                          {(studioSummary.breakdown.length > 0 || (sale.total ?? 0) > 0) && (
                            <>
                              <Separator className="bg-muted" />
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Breakdown</p>
                              {studioSummary.breakdown.map((row) => (
                                <div key={row.stageType} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{row.label}</span>
                                  <span className="text-foreground">{formatCurrency(row.amount)}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      ) : (sale as any).studioCharges > 0 ? (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Studio Cost</span>
                          <span className="text-foreground font-semibold">{formatCurrency((sale as any).studioCharges)}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* Studio Production V3 – Production Breakdown (when Show Production Detail enabled) */}
              {(sale as any)?.source === 'studio_production_v3' && (sale as any)?.show_studio_breakdown && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-muted/40 border-b border-border">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Scissors size={16} className="text-emerald-400" />
                      Production Breakdown
                    </h3>
                  </div>
                  <div className="p-5 space-y-2">
                    {loadingStudioV3Breakdown ? (
                      <p className="text-sm text-muted-foreground">Loading breakdown…</p>
                    ) : studioV3Breakdown.length > 0 ? (
                      <>
                        {studioV3Breakdown.map((row, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {row.type === 'profit' ? 'Studio Profit' : row.stage_name}
                            </span>
                            <span className="text-foreground">{formatCurrency(Number(row.worker_cost) || 0)}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No breakdown stored.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b border-border">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <DollarSign size={16} />
                    Payment Summary
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground font-medium">{formatCurrency(sale.subtotal ?? 0)}</span>
                  </div>
                  
                  {(sale.discount ?? 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-red-400 font-medium">- {formatCurrency(sale.discount)}</span>
                    </div>
                  )}
                  
                  {(sale.tax ?? 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="text-foreground font-medium">{formatCurrency(sale.tax)}</span>
                    </div>
                  )}
                  
                  {/* Extra expenses + shipping: line-level sale_charges when available */}
                  {(() => {
                    const charges = (sale as { charges?: Array<{ id?: string; charge_type?: string; chargeType?: string; amount?: number }> }).charges ?? [];
                    const chargeList = Array.isArray(charges) ? charges : [];
                    const shippingRows = chargeList.filter((c) => (c.charge_type || c.chargeType) === 'shipping');
                    const extraRows = chargeList.filter((c) => {
                      const t = c.charge_type || c.chargeType;
                      return t !== 'discount' && t !== 'shipping';
                    });
                    const extraFallback = Number(sale.expenses ?? (sale as { extra_expenses?: number }).extra_expenses ?? 0) || 0;
                    const shippingFallback = Number(sale.shippingCharges ?? (sale as { shipment_charges?: number }).shipment_charges ?? 0) || 0;
                    const hasLines = shippingRows.length > 0 || extraRows.length > 0 || extraFallback > 0 || shippingFallback > 0;
                    if (!hasLines) return null;
                    return (
                      <>
                        {shippingRows.length > 0
                          ? shippingRows.map((c, idx) => (
                              <div key={c.id || `ship-${idx}`} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{formatSaleChargeLabel('shipping')}</span>
                                <span className="text-foreground font-medium">{formatCurrency(Number(c.amount) || 0)}</span>
                              </div>
                            ))
                          : shippingFallback > 0 ? (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Shipping</span>
                                <span className="text-foreground font-medium">{formatCurrency(shippingFallback)}</span>
                              </div>
                            ) : null}
                        {extraRows.length > 0
                          ? extraRows.map((c, idx) => (
                              <div key={c.id || `extra-${idx}`} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{formatSaleChargeDisplayLabel(c)}</span>
                                <span className="text-foreground font-medium">{formatCurrency(Number(c.amount) || 0)}</span>
                              </div>
                            ))
                          : extraFallback > 0 ? (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Extra charges</span>
                                <span className="text-foreground font-medium">{formatCurrency(extraFallback)}</span>
                              </div>
                            ) : null}
                      </>
                    );
                  })()}
                  
                  {(sale as any).otherCharges > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Other Charges</span>
                      <span className="text-foreground font-medium">{formatCurrency((sale as any).otherCharges)}</span>
                    </div>
                  )}
                  
                  <Separator className="bg-muted" />
                  
                  {studioCost > 0 ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sale Amount</span>
                        <span className="text-foreground font-medium">{formatCurrency(studioLineTotalFromInvoice > 0 ? Math.max(0, (sale.total ?? 0) - studioLineTotalFromInvoice) : (sale.total ?? 0))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">+ Production Cost</span>
                        <span className="text-amber-400 font-medium">{formatCurrency(studioCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-semibold">Grand Total</span>
                        <span className="text-foreground text-xl font-bold">{formatCurrency(grandTotal)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-semibold">Grand Total</span>
                      <span className="text-foreground text-xl font-bold">{formatCurrency(sale.total ?? 0)}</span>
                    </div>
                  )}
                  
                  {!hidePaymentCommercial && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Paid</span>
                        <span className="text-[var(--erp-money-positive)] font-medium">{formatCurrency(totalPaidDisplay)}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Amount Due</span>
                        <span className="text-red-400 text-lg font-bold">{formatCurrency(dueAmount)}</span>
                      </div>
                    </>
                  )}

                  {(sale.returnDue ?? 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Return Due</span>
                      <span className="text-yellow-400 font-medium">{formatCurrency(sale.returnDue)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {sale.notes && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notes</h3>
                  <p className="text-foreground text-sm leading-relaxed">{sale.notes}</p>
                </div>
              )}

              {/* Attachments */}
              {(() => {
                const hasAttachments = sale.attachments && (
                  Array.isArray(sale.attachments) 
                    ? sale.attachments.length > 0 
                    : !!sale.attachments
                );
                
                if (!hasAttachments) {
                  return null;
                }
                
                
                return (
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Paperclip size={16} />
                      Attachments ({Array.isArray(sale.attachments) ? sale.attachments.length : 1})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(sale.attachments) ? (
                        sale.attachments.map((att: any, idx: number) => {
                          const url = typeof att === 'string' ? att : (att?.url || att?.fileUrl || '');
                          const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name) ? (att.fileName || att.file_name) : `Attachment ${idx + 1}`);
                          if (!url) {
                            console.warn('[VIEW SALE] Attachment missing URL:', att);
                            return null;
                          }
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name || '');
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={async () => {
                                const openUrl = await getAttachmentOpenUrl(url);
                                window.open(openUrl, '_blank');
                              }}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm transition-colors"
                            >
                              {isImage ? <ImageIcon size={16} /> : <File size={16} />}
                              <span>{name}</span>
                            </button>
                          );
                        })
                      ) : typeof sale.attachments === 'string' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const openUrl = await getAttachmentOpenUrl(sale.attachments as string);
                            window.open(openUrl, '_blank');
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm transition-colors"
                        >
                          <Paperclip size={16} />
                          <span>View attachment</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {activeTab === 'payments' && !hidePaymentCommercial && (
            <div className="space-y-4">
              {/* Add Payment Button - hidden when cancelled/returned; shown for final or partially_returned with due */}
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-foreground">Payment History</h3>
                {canAddPayment && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        onAddPayment?.(sale.id);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <CreditCard size={16} className="mr-2" />
                      Add Payment
                    </Button>
                  </div>
                )}
              </div>
              {canAddPayment && (
                <p className="text-xs text-muted-foreground">
                  To record <strong>COD received from courier</strong>: use Add Payment and add note &quot;COD received from courier&quot;.
                </p>
              )}

              {/* CRITICAL FIX: Payment Summary with Cash/Bank Breakdown */}
              {loadingPayments ? (
                <div className="text-center py-12 text-muted-foreground">Loading payments...</div>
              ) : payments.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary Cards by Payment Method */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Cash Payments Summary */}
                    {payments.filter(p => p.method === 'cash').length > 0 && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Paid (Cash)</p>
                        <p className="text-2xl font-bold text-[var(--erp-money-positive)]">
{formatCurrency(payments.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {payments.filter(p => p.method === 'cash').length} payment(s)
                        </p>
                      </div>
                    )}
                    
                    {/* Bank Payments Summary */}
                    {payments.filter(p => p.method === 'bank' || p.method === 'card').length > 0 && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Paid (Bank/Card)</p>
                        <p className="text-2xl font-bold text-blue-400">
{formatCurrency(payments.filter(p => p.method === 'bank' || p.method === 'card').reduce((sum, p) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {payments.filter(p => p.method === 'bank' || p.method === 'card').length} payment(s)
                        </p>
                      </div>
                    )}
                    
                    {/* Other Payments Summary */}
                    {payments.filter(p => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).length > 0 && (
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Paid (Other)</p>
                        <p className="text-2xl font-bold text-purple-400">
{formatCurrency(payments.filter(p => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).reduce((sum, p) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {payments.filter(p => p.method === 'other' || (p.method !== 'cash' && p.method !== 'bank' && p.method !== 'card')).length} payment(s)
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Total Paid Summary - use sum of payment records when loaded (matches mobile, avoids DB paid_amount drift) */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="text-foreground font-semibold text-xl">
                          {formatCurrency(totalPaidDisplay)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Total Paid Amount
                        </p>
                      </div>
                      <Badge className={cn(
                        "text-sm font-semibold",
                        sale.paymentStatus === 'paid' ? "bg-green-500/10 text-[var(--erp-money-positive)] border-green-500/20" :
                        sale.paymentStatus === 'partial' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                        "bg-red-500/10 text-red-400 border-red-500/20"
                      )}>
                        {sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
                      </Badge>
                    </div>
                    
{dueAmount > 0 && canAddPayment && (
                    <div className="flex justify-between text-sm pt-3 border-t border-border">
                        <span className="text-muted-foreground">Amount Due:</span>
                        <span className="text-red-400 font-medium">
{formatCurrency(dueAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Individual Payment Breakdown */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase">Payment Details</h4>
                    {payments.map((payment) => (
                    <div 
                      key={payment.id}
                        className="bg-card border border-border rounded-xl p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="text-foreground font-semibold">
{formatCurrency(payment.amount)}
                          </p>
                              {(() => {
                                const p = payment as { createdAt?: string; updatedAt?: string };
                                const c = p.createdAt ? new Date(p.createdAt).getTime() : 0;
                                const u = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
                                if (c && u > c + 1500) {
                                  return (
                                    <Badge className="text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      Adjusted
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                              {payment.referenceNo && (
                                <code className="text-xs bg-muted px-2 py-0.5 rounded text-blue-400 border border-border">
                                  {payment.referenceNo}
                                </code>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                            {new Date(payment.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                                year: 'numeric'
                            })}
                          </p>
                            {payment.accountName && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Account: {payment.accountName}
                              </p>
                            )}
                            {payment.notes && (
                              <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
                                <FileText size={12} className="text-muted-foreground shrink-0 mt-0.5" />
                                <span><span className="text-muted-foreground">Note:</span> {payment.notes}</span>
                              </p>
                            )}
                        </div>
                          <div className="flex items-center gap-2">
                            {payment.attachments && (Array.isArray(payment.attachments) ? payment.attachments.length > 0 : !!payment.attachments) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const list: { url: string; name: string }[] = [];
                                  const raw = payment.attachments;
                                  const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [{ url: raw, name: 'Attachment' }] : []);
                                  arr.forEach((att: any) => {
                                    const url = typeof att === 'string' ? att : (att?.url ?? att?.fileUrl ?? '');
                                    const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name) ? (att.fileName || att.file_name) : 'Attachment');
                                    if (url) list.push({ url: String(url), name: name || 'Attachment' });
                                  });
                                  if (list.length) setAttachmentsDialogList(list);
                                }}
                                className="p-1.5 rounded-lg hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400 transition-colors"
                                title={`${Array.isArray(payment.attachments) ? payment.attachments.length : 1} attachment(s)`}
                              >
                                <Paperclip size={14} />
                              </button>
                            )}
                            <Badge className={cn(
                              "text-xs font-semibold",
                              payment.method === 'cash' ? "bg-green-500/10 text-[var(--erp-money-positive)] border-green-500/20" :
                              payment.method === 'bank' || payment.method === 'card' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                              "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            )}>
                              {payment.method === 'cash' ? 'Cash' : 
                               payment.method === 'bank' ? 'Bank' :
                               payment.method === 'card' ? 'Card' : 'Other'}
                        </Badge>
                            {!isCancelled && (
                              <>
                            <button
                              onClick={() => {
                                try {
                                  setPaymentToEdit(resolvePaymentRowForEdit(payment as any));
                                  setEditPaymentDialogOpen(true);
                                } catch (e: any) {
                                  toast.error(e?.message || 'Cannot edit this payment line');
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-blue-500/20 text-muted-foreground hover:text-blue-400 transition-colors"
                              title="Edit payment (allocation lines edit the parent receipt)"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setPaymentToDelete(payment);
                                setDeleteConfirmationOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Cancel Payment"
                              disabled={isDeletingPayment || loadingPayments}
                            >
                              <Trash2 size={14} />
                            </button>
                              </>
                            )}
                      </div>
                        </div>
                        {/* Note: shown above; attachments section below */}
                        {(payment.attachments && (Array.isArray(payment.attachments) ? payment.attachments.length > 0 : !!payment.attachments)) && (
                          <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Paperclip size={12} /> Attachments:
                            </span>
                            {Array.isArray(payment.attachments) ? (
                              payment.attachments.map((att: any, idx: number) => {
                                const url = typeof att === 'string' ? att : (att?.url || att?.fileUrl || att?.href);
                                const name = typeof att === 'object' && att?.name ? att.name : (typeof att === 'object' && (att?.fileName || att?.file_name)) ? (att.fileName || att.file_name) : `Attachment ${idx + 1}`;
                                if (!url) return null;
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(String(url));
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={async () => {
                                      const openUrl = await getAttachmentOpenUrl(url);
                                      window.open(openUrl, '_blank');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-xs transition-colors"
                                  >
                                    {isImage ? <ImageIcon size={14} /> : <File size={14} />}
                                    <span>{name}</span>
                                  </button>
                                );
                              })
                            ) : typeof payment.attachments === 'string' ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const openUrl = await getAttachmentOpenUrl(payment.attachments);
                                  window.open(openUrl, '_blank');
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-xs transition-colors"
                              >
                                <Paperclip size={14} />
                                <span>View attachment</span>
                              </button>
                            ) : null}
                          </div>
                        )}
                    </div>
                  ))}
                  </div>
                </div>
              ) : totalPaidDisplay > 0 ? (
                <div className="bg-card border border-border rounded-xl p-5">
                  <p className="text-foreground font-semibold text-lg">
                    {formatCurrency(totalPaidDisplay)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Total paid amount (payment details loading...)
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CreditCard size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="text-muted-foreground">No payments recorded yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground mb-4">Activity Timeline</h3>
              
              {loadingActivityLogs ? (
                <div className="text-center py-12 text-muted-foreground">Loading activity logs...</div>
              ) : activityLogs.length > 0 ? (
              <div className="space-y-4">
                  {activityLogs.map((log, index) => {
                    const getIcon = () => {
                      switch (log.action) {
                        case 'create':
                          return <FileText size={16} className="text-muted-foreground" />;
                        case 'status_change':
                          return <CheckCircle2 size={16} className="text-green-500" />;
                        case 'payment_added':
                          return <DollarSign size={16} className="text-blue-500" />;
                        case 'payment_deleted':
                          return <DollarSign size={16} className="text-red-500" />;
                        case 'attachment_added':
                          return <Paperclip size={16} className="text-blue-400" />;
                        case 'attachment_removed':
                          return <Paperclip size={16} className="text-orange-400" />;
                        case 'update':
                          return <Edit size={16} className="text-yellow-500" />;
                        case 'delete':
                          return <Trash2 size={16} className="text-red-500" />;
                        default:
                          return <Clock size={16} className="text-muted-foreground" />;
                      }
                    };

                    const getBgColor = () => {
                      switch (log.action) {
                        case 'create':
                          return 'bg-muted/20';
                        case 'status_change':
                          return 'bg-green-500/20';
                        case 'payment_added':
                          return 'bg-blue-500/20';
                        case 'payment_deleted':
                          return 'bg-red-500/20';
                        case 'attachment_added':
                          return 'bg-blue-500/20';
                        case 'attachment_removed':
                          return 'bg-orange-500/20';
                        case 'update':
                          return 'bg-yellow-500/20';
                        case 'delete':
                          return 'bg-red-500/20';
                        default:
                          return 'bg-muted/20';
                      }
                    };

                    return (
                      <div key={log.id || index} className="flex gap-4">
                  <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full ${getBgColor()} flex items-center justify-center`}>
                            {getIcon()}
                    </div>
                          {index < activityLogs.length - 1 && (
                    <div className="w-0.5 h-full bg-muted mt-2" />
                          )}
                  </div>
                  <div className="flex-1 pb-6">
                          <p className="text-foreground font-medium">
                            {log.description || activityLogService.formatActivityLog(log)}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                          {log.performed_by_name && (
                            <p className="text-sm text-muted-foreground mt-1">
                              By: {log.performed_by_name}
                            </p>
                          )}
                          {log.field && log.old_value !== undefined && log.new_value !== undefined && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {log.field}: {String(log.old_value)} → {String(log.new_value)}
                            </p>
                          )}
                          {log.amount && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Amount: {formatCurrency(log.amount)} {log.payment_method && `via ${log.payment_method}`}
                            </p>
                          )}
                  </div>
                </div>
                    );
                  })}
                    </div>
              ) : (
                <div className="text-center py-12">
                  <Clock size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="text-muted-foreground">No activity logs found</p>
                  </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions - Add Payment when allowed by effective status (final/partially_returned with due) */}
{activeTab === 'details' && canAddPayment && (
          <div className="border-t border-border px-6 py-4 bg-muted/40 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Amount Due</p>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(dueAmount)}</p>
              </div>
          <Button
                onClick={() => onAddPayment?.(sale.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CreditCard size={16} className="mr-2" />
                Add Payment
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Print / PDF / Share – single document engine (Phase A) */}
      {showPrintLayout && sale && companyId && (
        <div className="fixed inset-0 z-[100] bg-[var(--erp-overlay)] flex items-center justify-center p-4 thermal-print-overlay">
          <div
            className={`bg-white rounded-lg w-full max-h-[90vh] overflow-auto ${
              printLayoutType === 'Thermal' ? 'thermal-print-modal-shell' : 'max-w-4xl'
            }`}
            style={
              printLayoutType === 'Thermal'
                ? { maxWidth: getThermalDimensions(printerConfig.paperSize).modalMaxPx }
                : undefined
            }
          >
            <UnifiedSalesInvoiceView
              saleId={sale.id}
              companyId={companyId}
              templateType={printLayoutType}
              onClose={() => setShowPrintLayout(false)}
              showPrintAction={true}
            />
          </div>
        </div>
      )}

      {/* Wholesale: Packing List workflow */}
      {sale && companyId && (
        <PackingListWorkflow
          saleId={sale.id}
          saleInvoiceNo={sale.invoiceNo}
          saleDate={sale.date}
          companyId={companyId}
          companyName={company?.businessName ?? ''}
          companyAddress={company?.businessAddress ?? null}
          customerName={sale.customerName}
          customerAddress={sale.location || null}
          customerPhone={sale.contactNumber || null}
          isOpen={showPackingListWorkflow}
          onClose={() => setShowPackingListWorkflow(false)}
        />
      )}

      {/* Payment Delete Confirmation Modal */}
      {paymentToDelete && (
        <PaymentDeleteConfirmationModal
          isOpen={deleteConfirmationOpen}
          onClose={() => {
            setDeleteConfirmationOpen(false);
            setPaymentToDelete(null);
          }}
          onConfirm={async () => {
            if (!paymentToDelete || !sale || !companyId) return;
            
            setIsDeletingPayment(true);
            try {
              const pid = resolvePaymentIdForMutation(paymentToDelete as any);
              const deletePromise = saleService.deletePayment(pid, sale.id);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Payment deletion timed out. Please try again.')), 15000)
              );
              
              await Promise.race([deletePromise, timeoutPromise]);
              
              // CRITICAL FIX: Log activity (module 'sale' so it appears in sale Activity Timeline)
              if (companyId) {
                try {
                  await activityLogService.logActivity({
                    companyId,
                    module: 'sale',
                    entityId: sale.id,
                    entityReference: sale.invoiceNo,
                    action: 'payment_deleted',
                    amount: paymentToDelete.amount,
                    paymentMethod: paymentToDelete.method,
                    performedBy: user?.id || undefined,
                    description: `Payment of ${formatCurrency(paymentToDelete.amount)} deleted from sale ${sale.invoiceNo}`,
                  });
                  await loadActivityLogs(sale.id);
                } catch (logError) {
                  console.error('[VIEW SALE] Error logging payment deletion:', logError);
                }
              }
              
              toast.success('Payment deleted successfully. Reverse entry created.');
              
              await Promise.all([
                loadPayments(sale.id),
                reloadSaleData()
              ]);
              
              setDeleteConfirmationOpen(false);
              setPaymentToDelete(null);
            } catch (error: any) {
              console.error('[VIEW SALE] Error deleting payment:', error);
              toast.error(error?.message || 'Failed to delete payment. Please try again.');
            } finally {
              setIsDeletingPayment(false);
            }
          }}
          paymentAmount={paymentToDelete.amount}
          paymentMethod={paymentToDelete.method}
          paymentDate={paymentToDelete.date}
          referenceNumber={paymentToDelete.referenceNo}
          isLoading={isDeletingPayment}
        />
      )}

      {/* Edit Payment Dialog */}
      {paymentToEdit && sale && (
        <UnifiedPaymentDialog
          isOpen={editPaymentDialogOpen}
          onClose={() => {
            setEditPaymentDialogOpen(false);
            setPaymentToEdit(null);
          }}
          context="customer"
          entityName={sale.customerName || 'Customer'}
          entityId={sale.customer}
          outstandingAmount={dueAmount}
          totalAmount={grandTotal}
          paidAmount={totalPaidDisplay}
          referenceNo={sale.invoiceNo}
          referenceId={sale.id}
          customerBillRef={readSaleBillRef(sale as unknown as Record<string, unknown>)}
          editMode={true}
          paymentToEdit={{
            id: paymentToEdit.id,
            amount: paymentToEdit.amount,
            method: paymentToEdit.method,
            accountId: paymentToEdit.accountId || paymentToEdit.payment_account_id,
            date: paymentToEdit.date || paymentToEdit.payment_date,
            createdAt: paymentToEdit.createdAt || paymentToEdit.created_at,
            referenceNumber: paymentToEdit.referenceNo || paymentToEdit.reference_number,
            notes: paymentToEdit.notes,
            attachments: paymentToEdit.attachments,
            parentPaymentId: (paymentToEdit as { parentPaymentId?: string }).parentPaymentId,
          }}
          onSuccess={async () => {
            toast.success('Payment updated successfully');
            await Promise.all([
              loadPayments(sale.id),
              reloadSaleData()
            ]);
            setEditPaymentDialogOpen(false);
            setPaymentToEdit(null);
            if (sale.customer) {
              window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: sale.customer } }));
            }
          }}
        />
      )}

      {/* Attachments dialog: same as Payment History — size, preview, click to zoom */}
      <Dialog open={!!attachmentsDialogList} onOpenChange={(open) => !open && setAttachmentsDialogList(null)}>
        <DialogContent className="bg-popover border-border text-popover-foreground w-full max-w-2xl min-h-[320px] max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Paperclip size={20} className="text-amber-400" />
              Attachments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
            {attachmentsDialogList?.map((att, idx) => (
              <AttachmentPreviewRow key={idx} att={att} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
