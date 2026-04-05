import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, Filter, Download, Upload, Users, DollarSign, TrendingUp, 
  MoreVertical, Eye, Edit, Trash2, FileText, X, Phone, Mail, MapPin,
  Check, User, AlertCircle, Briefcase, CheckCircle, Clock, UserCheck, Loader2,
  Scale, BarChart3, Shield,
} from 'lucide-react';
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/app/components/ui/utils";
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { contactService } from '@/app/services/contactService';
import { saleService } from '@/app/services/saleService';
import { purchaseService } from '@/app/services/purchaseService';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import type { TrialBalanceRow } from '@/app/services/accountingReportsService';
import {
  getCompanyReconciliationSnapshot,
  type CompanyReconciliationSnapshot,
} from '@/app/services/contactBalanceReconciliationService';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import CustomerLedgerPageOriginal from '@/app/components/customer-ledger-test/CustomerLedgerPageOriginal';
import { GenericLedgerView } from '@/app/components/accounting/GenericLedgerView';
import { ViewContactProfile } from './ViewContactProfile';
import { ImportContactsModal } from './ImportContactsModal';
import { toast } from 'sonner';
import { formatCurrency } from '@/app/utils/formatCurrency';
import { supabase } from '@/lib/supabase';
import { CONTACT_BALANCES_REFRESH_EVENT } from '@/app/lib/contactBalancesRefresh';
import { CONTACTS_PARTY_DRILLDOWN_KEY } from '@/app/lib/contactsPartyDrilldown';
import { Pagination } from '@/app/components/ui/pagination';
import { CustomSelect } from '@/app/components/ui/custom-select';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";

type ContactType = 'all' | 'customers' | 'suppliers' | 'workers';
type WorkerRole = 'tailor' | 'stitching-master' | 'cutter' | 'hand-worker' | 'dyer' | 'helper' | 'embroidery';
type BalanceType = 'all' | 'due' | 'paid';
type StatusType = 'all' | 'active' | 'inactive' | 'onhold';

interface Contact {
  id: number;
  uuid: string; // Supabase UUID
  name: string;
  code: string;
  type: 'customer' | 'supplier' | 'worker' | 'both';
  workerRole?: WorkerRole;
  email: string;
  phone: string;
  receivables: number;
  payables: number;
  netBalance: number;
  status: 'active' | 'inactive' | 'onhold';
  branch: string;
  address?: string;
  lastTransaction?: string;
  is_system_generated?: boolean;
  system_type?: string;
  is_default?: boolean;
}

const workerRoleLabels: Record<WorkerRole, string> = {
  'tailor': 'Tailor',
  'stitching-master': 'Stitching Master',
  'cutter': 'Cutter',
  'hand-worker': 'Hand Worker',
  'dyer': 'Dyer',
  'helper': 'Helper / Labour',
  'embroidery': 'Embroidery',
};

/** Operational (open-doc) vs party-attributed GL slice — flag mismatch for row badge only; do not replace operational amount. */
const OP_VS_PARTY_GL_TOL = 1.01;

/** Dev-only: set localStorage DEBUG_CONTACT_BALANCE_TRACE to a contact UUID to log balance source per load. */
function readDebugContactBalanceTraceId(): string | null {
  if (!import.meta.env?.DEV || typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem('DEBUG_CONTACT_BALANCE_TRACE')?.trim();
    return v && v.length >= 32 ? v : null;
  } catch {
    return null;
  }
}

function partyGlMismatchFlags(
  contact: Contact,
  gl: { glArReceivable: number; glApPayable: number; glWorkerPayable: number } | undefined
): { receivables: boolean; payables: boolean } {
  if (!gl) return { receivables: false, payables: false };
  let receivables = false;
  let payables = false;
  if (contact.type === 'customer' || contact.type === 'both') {
    receivables =
      Math.abs(Number(contact.receivables) - Math.max(0, Number(gl.glArReceivable) || 0)) >= OP_VS_PARTY_GL_TOL;
  }
  if (contact.type === 'supplier' || contact.type === 'both') {
    payables =
      Math.abs(Number(contact.payables) - Math.max(0, Number(gl.glApPayable) || 0)) >= OP_VS_PARTY_GL_TOL;
  }
  if (contact.type === 'worker') {
    payables =
      Math.abs(Number(contact.payables) - Math.max(0, Number(gl.glWorkerPayable) || 0)) >= OP_VS_PARTY_GL_TOL;
  }
  return { receivables, payables };
}

type ContactPartyGlRow = { glArReceivable: number; glApPayable: number; glWorkerPayable: number };

/** Signed party GL for secondary line / recon (not clamped — nets with credits on 1100/2000). */
function contactPartyGlReceivableSigned(
  contact: Contact,
  partyGlByContactId: Map<string, ContactPartyGlRow> | null
): number | null {
  if (!partyGlByContactId?.size) return null;
  if (contact.type !== 'customer' && contact.type !== 'both') return null;
  const gl = partyGlByContactId.get(String(contact.uuid));
  if (!gl) return null;
  return Number(gl.glArReceivable) || 0;
}

function contactPartyGlPayableSigned(
  contact: Contact,
  partyGlByContactId: Map<string, ContactPartyGlRow> | null
): number | null {
  if (!partyGlByContactId?.size) return null;
  const gl = partyGlByContactId.get(String(contact.uuid));
  if (!gl) return null;
  if (contact.type === 'worker') return Number(gl.glWorkerPayable) || 0;
  if (contact.type === 'supplier' || contact.type === 'both') return Number(gl.glApPayable) || 0;
  return null;
}

export const ContactsPage = () => {
  const { openDrawer, setCurrentView, createdContactId, setCreatedContactId } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [contacts, setContacts] = useState<Contact[]>([]);
  /** True until first contact list is ready to show (before / without balance RPC). */
  const [listLoading, setListLoading] = useState(false);
  /** True while RPC or sales/purchase merge updates receivables/payables. */
  const [balancesLoading, setBalancesLoading] = useState(false);
  /** GL snapshot for AR/AP vs subledger reconciliation (journal, life-to-date). */
  const [glArAp, setGlArAp] = useState<{
    ar: TrialBalanceRow | null;
    ap: TrialBalanceRow | null;
    apNetCredit: number | null;
  } | null>(null);
  const [reconSnapshot, setReconSnapshot] = useState<CompanyReconciliationSnapshot | null>(null);
  /** Operational row amounts: from get_contact_balances_summary vs merged sales/purchases fallback. */
  const [operationalEngine, setOperationalEngine] = useState<'rpc' | 'fallback' | null>(null);
  /** Party-attributed GL slice per contact (optional compare-only; does not drive row numbers). */
  const [partyGlByContactId, setPartyGlByContactId] = useState<Map<
    string,
    { glArReceivable: number; glApPayable: number; glWorkerPayable: number }
  > | null>(null);
  /** Balance phase timed out — do not show opening-only/partial numbers as final. */
  const [balancesStale, setBalancesStale] = useState(false);
  const [activeTab, setActiveTab] = useState<ContactType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  
  // Action states
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [viewProfileOpen, setViewProfileOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const loadContactsInProgressRef = useRef(false);
  /** If refresh is requested while a load runs, run one more load when the current one finishes. */
  const pendingContactsBalanceRefreshRef = useRef(false);
  /** Incremented on each loadContacts start; stale async RPC/fallback must not call setContacts after a newer load began. */
  const loadContactsGenerationRef = useRef(0);
  const loadContactsRef = useRef<() => Promise<void>>(async () => {});
  const [filterPosition, setFilterPosition] = useState({ top: 0, left: 0 });

  // Convert Supabase contact to app format (receivables = due from customer, payables = due to supplier/worker)
  const convertFromSupabaseContact = useCallback(
    (
      supabaseContact: any,
      index: number,
      sales: any[],
      purchases: any[],
      /** Same id as contact (type=worker); studio stores payables on workers + worker_ledger */
      workerBalanceByContactId?: Map<string, number>
    ): Contact => {
    // Determine contact type (worker | supplier | customer | both)
    const isWorker = supabaseContact.type === 'worker';
    const isSupplier = supabaseContact.type === 'supplier' || supabaseContact.type === 'both';
    const isCustomer = supabaseContact.type === 'customer' || supabaseContact.type === 'both';
    const contactType: 'customer' | 'supplier' | 'worker' | 'both' =
      supabaseContact.type === 'both' ? 'both' : isWorker ? 'worker' : isSupplier ? 'supplier' : 'customer';

    // Receivables: opening_balance + sales due (for customer or both)
    const cid = String(supabaseContact.id ?? '');
    const contactSales = sales.filter(
      (s) =>
        String(s.customer_id ?? '') === cid ||
        (s.customer_name && s.customer_name === supabaseContact.name)
    );
    const salesReceivables = contactSales.reduce((sum, s) => {
      const due = s.due_amount != null ? Number(s.due_amount) : (Number(s.total) || 0) - (Number(s.paid_amount) || 0);
      return sum + Math.max(0, due);
    }, 0);
    const openingReceivables = isCustomer ? Math.max(0, Number(supabaseContact.opening_balance) || 0) : 0;
    const receivables = salesReceivables + openingReceivables;

    // Payables: supplier_opening/opening + purchases for supplier/both; current_balance/opening for workers
    let payables = 0;
    if (isWorker) {
      const wid = String(supabaseContact.id);
      const fromWorkers = workerBalanceByContactId?.get(wid);
      payables = Math.max(
        0,
        fromWorkers !== undefined && fromWorkers !== null
          ? fromWorkers
          : Number(supabaseContact.current_balance) || Number(supabaseContact.opening_balance) || 0
      );
    } else if (isSupplier) {
      const contactPurchases = purchases.filter(
        (p) =>
          String(p.supplier_id ?? '') === cid ||
          (p.supplier_name && p.supplier_name === supabaseContact.name)
      );
      const purchasePayables = contactPurchases.reduce((sum, p) => {
        const due = p.due_amount != null ? Number(p.due_amount) : (Number(p.total) || 0) - (Number(p.paid_amount) || 0);
        return sum + Math.max(0, due);
      }, 0);
      const openingPayables = Math.max(0, Number(supabaseContact.supplier_opening_balance) || Number(supabaseContact.opening_balance) || 0);
      payables = purchasePayables + openingPayables;
    }

    // Use DB code only (global sequence); no frontend-generated CUS-001
    const code = supabaseContact.code != null && String(supabaseContact.code).trim() !== ''
      ? String(supabaseContact.code).trim()
      : '—';

    // Map status
    let status: 'active' | 'inactive' | 'onhold' = 'active';
    if (!supabaseContact.is_active) {
      status = 'inactive';
    } else if (supabaseContact.status === 'onhold') {
      status = 'onhold';
    }

    return {
      id: index + 1, // Display ID
      uuid: String(supabaseContact.id ?? ''), // Supabase UUID (normalized)
      name: supabaseContact.name || '',
      code,
      type: contactType,
      workerRole: supabaseContact.worker_role as WorkerRole | undefined,
      email: supabaseContact.email || '-',
      phone: supabaseContact.phone || supabaseContact.mobile || '-',
      receivables,
      payables,
      netBalance: receivables - payables,
      status,
      branch: supabaseContact.branch_id || 'Main Branch (HQ)',
      address: supabaseContact.address,
      lastTransaction: supabaseContact.updated_at ? new Date(supabaseContact.updated_at).toISOString().split('T')[0] : undefined,
      is_system_generated: supabaseContact.is_system_generated || false,
      system_type: supabaseContact.system_type || undefined,
    };
  }, []);

  // Load contacts in two phases: (1) contacts list fast, (2) receivables/payables from RPC or merged sales/purchases
  const loadContacts = useCallback(async () => {
    if (!companyId) {
      setListLoading(false);
      setBalancesLoading(false);
      return;
    }
    if (loadContactsInProgressRef.current) {
      pendingContactsBalanceRefreshRef.current = true;
      return;
    }
    loadContactsInProgressRef.current = true;
    const myGen = ++loadContactsGenerationRef.current;
    const debugTraceId = readDebugContactBalanceTraceId();

    const timeoutMs = 25000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    });
    const clearBalanceTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    try {
      setListLoading(true);
      setBalancesLoading(false);
      setBalancesStale(false);
      setOperationalEngine(null);
      setPartyGlByContactId(null);

      const [, contactsData] = await Promise.all([
        contactService.ensureDefaultWalkingCustomerForCompany(companyId),
        contactService.getAllContacts(companyId),
      ]);
      if (!contactsData?.length) {
        setContacts([]);
        setListLoading(false);
        setBalancesLoading(false);
        clearBalanceTimeout();
        return;
      }

      const { data: workerRows } = await supabase
        .from('workers')
        .select('id, current_balance')
        .eq('company_id', companyId);
      const workerBalMap = new Map<string, number>(
        (workerRows || []).map((w: { id: string; current_balance?: number | null }) => [
          String(w.id),
          Number(w.current_balance) || 0,
        ])
      );

      // Phase 1: show contacts immediately with opening-only numbers; balance columns stay skeleton until phase 2
      const phase1Contacts: Contact[] = contactsData.map((c: any, index: number) =>
        convertFromSupabaseContact(c, index, [], [], workerBalMap)
      );
      if (debugTraceId) {
        const row = phase1Contacts.find((c) => c.uuid === debugTraceId);
        if (row) {
          console.log('[CONTACTS BALANCE TRACE]', {
            contactId: debugTraceId,
            source: 'phase1_opening_workers_table',
            row: { r: row.receivables, p: row.payables },
          });
        }
      }
      setContacts(phase1Contacts);
      setListLoading(false);
      setBalancesLoading(true);

      // Phase 2: RPC success (non-null Map) always overwrites row amounts — no phase1/fallback mix after that.
      const loadBalances = async () => {
        try {
          const balanceMap = await contactService.getContactBalancesSummary(companyId, branchId === 'all' ? null : branchId).catch(() => null);
          if (myGen !== loadContactsGenerationRef.current) return;

          if (balanceMap != null) {
            setOperationalEngine('rpc');
            if (balanceMap.size === 0 && phase1Contacts.length > 0 && import.meta.env?.DEV) {
              console.warn(
                '[CONTACTS PAGE] get_contact_balances_summary returned zero rows but contacts exist — applying 0/0 per row (check RLS or RPC).'
              );
            }
            const withBalances: Contact[] = phase1Contacts.map((contact) => {
              const uuid = contact.uuid;
              const bal = uuid ? balanceMap.get(String(uuid)) : undefined;
              const r = Number(bal?.receivables ?? 0) || 0;
              const p = Number(bal?.payables ?? 0) || 0;
              if (debugTraceId && uuid === debugTraceId) {
                console.log('[CONTACTS BALANCE TRACE]', {
                  contactId: uuid,
                  source: 'rpc',
                  before: { r: contact.receivables, p: contact.payables },
                  after: { r, p },
                });
              }
              return { ...contact, receivables: r, payables: p, netBalance: r - p };
            });
            if (myGen !== loadContactsGenerationRef.current) return;
            setBalancesStale(false);
            setContacts(withBalances);
            return;
          }

          setOperationalEngine('fallback');
          const [salesData, purchasesData] = await Promise.all([
            saleService.getAllSales(companyId, branchId === 'all' ? undefined : branchId || undefined).catch(() => []),
            purchaseService.getAllPurchases(companyId, branchId === 'all' ? undefined : branchId || undefined).catch(() => []),
          ]);
          if (myGen !== loadContactsGenerationRef.current) return;
          const withBalances: Contact[] = contactsData.map((c: any, index: number) =>
            convertFromSupabaseContact(c, index, salesData, purchasesData, workerBalMap)
          );
          for (const row of withBalances) {
            if (debugTraceId && row.uuid === debugTraceId) {
              const prev = phase1Contacts.find((x) => x.uuid === row.uuid);
              console.log('[CONTACTS BALANCE TRACE]', {
                contactId: row.uuid,
                source: 'fallback',
                before: prev ? { r: prev.receivables, p: prev.payables } : null,
                after: { r: row.receivables, p: row.payables },
              });
            }
          }
          setBalancesStale(false);
          setContacts(withBalances);
        } finally {
          clearBalanceTimeout();
        }
      };

      await Promise.race([loadBalances(), timeoutPromise]);
    } catch (error: any) {
      console.error('[CONTACTS PAGE] Error loading contacts:', error);
      clearBalanceTimeout();
      const msg = error?.message || '';
      if (msg === 'Request timed out') {
        setBalancesStale(true);
        setOperationalEngine(null);
        toast.error('Due balances timed out; refresh the page or try again — row amounts are hidden until operational load completes.');
      } else {
        setBalancesStale(false);
        toast.error('Failed to load contacts: ' + (msg || 'Unknown error'));
        setContacts([]);
      }
    } finally {
      clearBalanceTimeout();
      setListLoading(false);
      setBalancesLoading(false);
      loadContactsInProgressRef.current = false;
      if (pendingContactsBalanceRefreshRef.current) {
        pendingContactsBalanceRefreshRef.current = false;
        queueMicrotask(() => {
          void loadContactsRef.current();
        });
      }
    }
  }, [companyId, branchId, convertFromSupabaseContact]);

  useEffect(() => {
    loadContactsRef.current = loadContacts;
  }, [loadContacts]);

  // Load contacts as soon as companyId is available (no click needed)
  useEffect(() => {
    if (companyId) {
      loadContacts();
    } else {
      setListLoading(false);
      setBalancesLoading(false);
    }
  }, [companyId, loadContacts]);

  const balanceColumnsPending = balancesLoading || balancesStale;

  /** Load party-attributed GL map for row GL subline + mismatch badges (operational amounts stay primary). */
  useEffect(() => {
    if (!companyId || listLoading || balancesLoading || balancesStale) {
      if (listLoading || balancesLoading || balancesStale) setPartyGlByContactId(null);
      return;
    }
    let cancelled = false;
    contactService
      .getContactPartyGlBalancesMap(companyId, branchId === 'all' ? null : branchId)
      .then((m) => {
        if (!cancelled) setPartyGlByContactId(m);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, listLoading, balancesLoading, balancesStale]);

  /** Control-account drawer → open this contact’s canonical party statement */
  useEffect(() => {
    if (listLoading || contacts.length === 0) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(CONTACTS_PARTY_DRILLDOWN_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let payload: { contactId?: string; tabHint?: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(CONTACTS_PARTY_DRILLDOWN_KEY);
      return;
    }
    const id = payload.contactId;
    if (!id) {
      sessionStorage.removeItem(CONTACTS_PARTY_DRILLDOWN_KEY);
      return;
    }
    const row = contacts.find((c) => String(c.uuid) === String(id));
    if (!row) {
      sessionStorage.removeItem(CONTACTS_PARTY_DRILLDOWN_KEY);
      toast.error('Contact not found for drill-down');
      return;
    }
    sessionStorage.removeItem(CONTACTS_PARTY_DRILLDOWN_KEY);
    if (payload.tabHint === 'customers') setActiveTab('customers');
    else if (payload.tabHint === 'suppliers') setActiveTab('suppliers');
    else if (payload.tabHint === 'workers') setActiveTab('workers');
    setSelectedContact(row);
    setLedgerOpen(true);
  }, [listLoading, contacts]);

  // GL AR/AP from journal (life-to-date, same branch scope as contact balance RPC)
  useEffect(() => {
    if (!companyId) {
      setGlArAp(null);
      return;
    }
    if (balancesLoading || balancesStale) return;
    let cancelled = false;
    const b = branchId === 'all' || !branchId ? undefined : branchId;
    accountingReportsService
      .getArApGlSnapshot(companyId, new Date().toISOString().slice(0, 10), b)
      .then((snap) => {
        if (!cancelled) setGlArAp(snap);
      })
      .catch(() => {
        if (!cancelled) setGlArAp(null);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, balancesLoading, balancesStale]);

  // Refetch list when a new contact is created (e.g. Add Worker) so it shows without refresh
  useEffect(() => {
    if (createdContactId) {
      loadContacts();
      setCreatedContactId?.(null);
    }
  }, [createdContactId, loadContacts, setCreatedContactId]);

  // Refetch when page gains focus so receivables/payables stay updated (e.g. after payment or ledger)
  useEffect(() => {
    const onFocus = () => { if (companyId) loadContacts(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [companyId, loadContacts]);

  // After Add Entry / manual receipt saves — refresh operational balances + reconciliation snapshot inputs
  useEffect(() => {
    const onBalancesRefresh = (e: Event) => {
      const d = (e as CustomEvent<{ companyId?: string }>).detail;
      if (d?.companyId && d.companyId !== companyId) return;
      loadContacts();
    };
    window.addEventListener(CONTACT_BALANCES_REFRESH_EVENT, onBalancesRefresh as EventListener);
    return () => window.removeEventListener(CONTACT_BALANCES_REFRESH_EVENT, onBalancesRefresh as EventListener);
  }, [companyId, loadContacts]);

  /** Catch-all for sale/purchase flows that dispatch paymentAdded without contactBalancesRefresh (Phase 8 sync). */
  useEffect(() => {
    const onPaymentAdded = () => {
      if (companyId) loadContacts();
    };
    window.addEventListener('paymentAdded', onPaymentAdded);
    return () => window.removeEventListener('paymentAdded', onPaymentAdded);
  }, [companyId, loadContacts]);

  // Position filter dropdown when open (for portal)
  useEffect(() => {
    if (filterOpen && filterTriggerRef.current) {
      const rect = filterTriggerRef.current.getBoundingClientRect();
      setFilterPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - 320) });
    }
  }, [filterOpen]);
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [workerRoleFilter, setWorkerRoleFilter] = useState<WorkerRole[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusType>('all');
  const [balanceFilter, setBalanceFilter] = useState<BalanceType>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [phoneFilter, setPhoneFilter] = useState<'all' | 'has' | 'no'>('all');

  // Filtered contacts (type 'both' appears in both Customer and Supplier tabs)
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Tab filter: customers tab = customer | both, suppliers tab = supplier | both, workers tab = worker only
      if (activeTab !== 'all') {
        const tabType = activeTab.slice(0, -1);
        if (tabType === 'customer' && contact.type !== 'customer' && contact.type !== 'both') return false;
        if (tabType === 'supplier' && contact.type !== 'supplier' && contact.type !== 'both') return false;
        if (tabType === 'worker' && contact.type !== 'worker') return false;
      }

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          contact.name.toLowerCase().includes(search) ||
          contact.code.toLowerCase().includes(search) ||
          contact.email.toLowerCase().includes(search) ||
          contact.phone.toLowerCase().includes(search) ||
          contact.branch.toLowerCase().includes(search) ||
          (contact.workerRole && workerRoleLabels[contact.workerRole].toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }

      // Type filter (for advanced filters): 'customer' filter includes 'both', 'supplier' filter includes 'both'
      if (typeFilter.length > 0) {
        const matchesType = typeFilter.some(t =>
          t === contact.type || (t === 'customer' && contact.type === 'both') || (t === 'supplier' && contact.type === 'both')
        );
        if (!matchesType) return false;
      }
      
      // Worker role filter
      if (workerRoleFilter.length > 0 && contact.type === 'worker' && contact.workerRole && !workerRoleFilter.includes(contact.workerRole)) return false;
      
      // Status filter
      if (statusFilter !== 'all' && contact.status !== statusFilter) return false;
      
      // Balance filter
      if (balanceFilter === 'due' && contact.netBalance === 0) return false;
      if (balanceFilter === 'paid' && contact.netBalance !== 0) return false;
      
      // Branch filter
      if (branchFilter !== 'all' && contact.branch !== branchFilter) return false;

      // Phone filter
      if (phoneFilter === 'has' && (contact.phone === '-' || !contact.phone)) return false;
      if (phoneFilter === 'no' && contact.phone !== '-' && contact.phone) return false;
      
      return true;
    });
  }, [
    contacts,
    activeTab,
    searchTerm,
    typeFilter,
    workerRoleFilter,
    statusFilter,
    balanceFilter,
    branchFilter,
    phoneFilter,
  ]);

  // Tab summary: cards/rows primary = operational RPC; optional signed party GL totals when map loaded (matches TB attribution, includes credits).
  const { summaryOperational, summaryPartyGlSigned, summaryMeta } = useMemo(() => {
    const filtered = contacts.filter((c) => {
      if (activeTab === 'all') return true;
      const tabType = activeTab.slice(0, -1);
      if (tabType === 'customer') return c.type === 'customer' || c.type === 'both';
      if (tabType === 'supplier') return c.type === 'supplier' || c.type === 'both';
      return c.type === 'worker';
    });
    const activeCount = filtered.filter((c) => c.status === 'active').length;
    const totalCount = filtered.length;
    const operational = {
      totalReceivables: filtered.reduce((sum, c) => sum + c.receivables, 0),
      totalPayables: filtered.reduce((sum, c) => sum + c.payables, 0),
      activeCount,
      totalCount,
    };
    let partyRecvSigned = 0;
    let partyPaySigned = 0;
    if (partyGlByContactId?.size) {
      for (const c of filtered) {
        const gl = partyGlByContactId.get(String(c.uuid));
        if (!gl) continue;
        if (c.type === 'customer' || c.type === 'both') partyRecvSigned += Number(gl.glArReceivable) || 0;
        if (c.type === 'supplier' || c.type === 'both') partyPaySigned += Number(gl.glApPayable) || 0;
        if (c.type === 'worker') partyPaySigned += Number(gl.glWorkerPayable) || 0;
      }
    }
    return {
      summaryOperational: operational,
      summaryPartyGlSigned:
        partyGlByContactId?.size && filtered.length > 0
          ? { receivables: partyRecvSigned, payables: partyPaySigned }
          : null,
      summaryMeta: { activeCount, totalCount },
    };
  }, [activeTab, contacts, partyGlByContactId]);

  /** Contacts subledger vs GL (Trial Balance) — explains differences vs Reports. */
  const subledgerVsGl = useMemo(() => {
    if (!glArAp) return null;
    const ar =
      glArAp.ar != null
        ? {
            label: `${glArAp.ar.account_code || '—'} ${glArAp.ar.account_name}`.trim(),
            contactsTotal: summaryOperational.totalReceivables,
            glNetDrMinusCr: glArAp.ar.balance,
            variance: summaryOperational.totalReceivables - glArAp.ar.balance,
            assetNegative: glArAp.ar.balance < -0.01,
          }
        : null;
    const ap =
      glArAp.ap != null && glArAp.apNetCredit != null
        ? {
            label: `${glArAp.ap.account_code || '—'} ${glArAp.ap.account_name}`.trim(),
            contactsTotal: summaryOperational.totalPayables,
            glNetCredit: glArAp.apNetCredit,
            variance: summaryOperational.totalPayables - glArAp.apNetCredit,
          }
        : null;
    return { ar, ap };
  }, [glArAp, summaryOperational.totalReceivables, summaryOperational.totalPayables]);

  // Journal vs operational (tab-scoped operational totals from summary)
  useEffect(() => {
    if (!companyId || balancesLoading || balancesStale) {
      setReconSnapshot(null);
      return;
    }
    let cancelled = false;
    getCompanyReconciliationSnapshot(companyId, branchId, undefined, {
      operationalReceivablesTotal: summaryOperational.totalReceivables,
      operationalPayablesTotal: summaryOperational.totalPayables,
    })
      .then((snap) => {
        if (!cancelled) setReconSnapshot(snap);
      })
      .catch(() => {
        if (!cancelled) setReconSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    companyId,
    branchId,
    balancesLoading,
    balancesStale,
    summaryOperational.totalReceivables,
    summaryOperational.totalPayables,
  ]);

  // Calculate tab counts (type 'both' counts in both Customer and Supplier)
  const tabCounts = useMemo(() => ({
    all: contacts.length,
    customers: contacts.filter(c => c.type === 'customer' || c.type === 'both').length,
    suppliers: contacts.filter(c => c.type === 'supplier' || c.type === 'both').length,
    workers: contacts.filter(c => c.type === 'worker').length,
  }), [contacts]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (type: string) => {
    switch (type) {
      case 'customer': return 'bg-blue-600';
      case 'supplier': return 'bg-purple-600';
      case 'worker': return 'bg-orange-600';
      case 'both': return 'bg-cyan-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={14} className="text-green-500" />;
      case 'inactive': return <Clock size={14} className="text-gray-500" />;
      case 'onhold': return <AlertCircle size={14} className="text-yellow-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'onhold': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const clearAllFilters = () => {
    setTypeFilter([]);
    setWorkerRoleFilter([]);
    setStatusFilter('all');
    setBalanceFilter('all');
    setBranchFilter('all');
    setPhoneFilter('all');
  };

  const activeFilterCount = [
    typeFilter.length > 0,
    workerRoleFilter.length > 0,
    statusFilter !== 'all',
    balanceFilter !== 'all',
    branchFilter !== 'all',
    phoneFilter !== 'all',
  ].filter(Boolean).length;

  const toggleTypeFilter = (type: string) => {
    setTypeFilter(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleWorkerRoleFilter = (role: WorkerRole) => {
    setWorkerRoleFilter(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Paginated contacts
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredContacts.slice(startIndex, endIndex);
  }, [filteredContacts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredContacts.length / pageSize);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, typeFilter, workerRoleFilter, statusFilter, balanceFilter, branchFilter, phoneFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Action handlers
  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    
    try {
      await contactService.deleteContact(selectedContact.uuid);
      toast.success('Contact deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedContact(null);
      // Reload contacts from database
      await loadContacts();
    } catch (error: any) {
      toast.error('Failed to delete contact: ' + (error.message || 'Unknown error'));
    }
  };

  const refreshContacts = async () => {
    await loadContacts();
  };

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* Sticky top section: header + summary + toolbar - prevents overlap with content */}
      <div className="shrink-0 sticky top-0 z-20 bg-[#0B0F19] flex flex-col">
      {/* Page Header */}
      <div className="px-6 py-3 border-b border-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white sm:text-2xl">Contacts</h1>
            <p className="text-xs text-gray-400 mt-0.5 sm:text-sm">Manage your suppliers, customers, and workers</p>
            <details className="mt-2 text-xs text-gray-500 max-w-3xl group">
              <summary className="cursor-pointer text-gray-400 hover:text-gray-300 list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-2 group-open:underline">Balance &amp; GL notes</span>
              </summary>
              <p className="mt-2 leading-relaxed pl-0 border-l-2 border-gray-700 pl-3">
                <strong className="text-gray-400">Primary amounts</strong> are operational from{' '}
                <code className="text-gray-500 text-[10px]">get_contact_balances_summary</code>
                {operationalEngine === 'rpc' && ' (RPC). '}
                {operationalEngine === 'fallback' && (
                  <span className="text-amber-400/90"> (RPC unavailable — merged from sales/purchases). </span>
                )}
                {operationalEngine === null && !listLoading && contacts.length > 0 && <span> (resolving…). </span>}
                When the party GL map is loaded, a <strong className="text-gray-400">second line</strong> shows signed{' '}
                <code className="text-gray-500 text-[10px]">get_contact_party_gl_balances</code> (1100 / 2000 / worker) so you can trace to the GL control and party statements without mixing bases into one number. Amber icon = operational still differs from party GL slice (e.g. credits on AR).
              </p>
            </details>
          </div>
          <Button
            onClick={() => openDrawer('addContact')}
            className="bg-blue-600 hover:bg-blue-500 text-white h-9 gap-2 shrink-0 sm:h-10 w-full sm:w-auto"
          >
            <Users size={16} />
            Add Contact
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 sm:gap-2">
          {[
            { key: 'all', label: 'All Contacts', count: tabCounts.all },
            { key: 'customers', label: 'Customers', count: tabCounts.customers },
            { key: 'suppliers', label: 'Suppliers', count: tabCounts.suppliers },
            { key: 'workers', label: 'Workers', count: tabCounts.workers },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ContactType)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all sm:px-4 sm:py-2 sm:text-sm",
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-white"
              )}
            >
              {tab.label} <span className="ml-1.5 opacity-75">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary totals + search / tools — two columns on xl to free vertical space for the list */}
      <div className="px-6 py-3 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:items-start">
          <div className="grid grid-cols-3 gap-2 min-w-0 sm:gap-3">
          {/* Total Receivables */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-2.5 sm:rounded-xl sm:p-3">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold sm:text-xs">Recv.</p>
                <p className={cn('text-base font-bold text-green-400 mt-0.5 tabular-nums sm:text-lg', balanceColumnsPending && 'animate-pulse')}>
                  {balanceColumnsPending ? '—' : formatCurrency(summaryOperational.totalReceivables)}
                </p>
                <p className="text-[9px] text-gray-600 mt-0.5 hidden sm:block">
                  Operational · <code className="text-gray-500">get_contact_balances_summary</code>
                </p>
                {!balanceColumnsPending && summaryPartyGlSigned && (
                  <p className="text-[9px] text-violet-300/90 mt-0.5 leading-snug hidden sm:block">
                    Party GL (1100, signed, this tab): {formatCurrency(summaryPartyGlSigned.receivables)}
                  </p>
                )}
                {balancesStale && (
                  <p className="text-[9px] text-amber-400/95 mt-0.5">Incomplete</p>
                )}
                {balancesLoading && !balancesStale && (
                  <p className="text-[9px] text-blue-400/90 mt-0.5 flex items-center gap-1">
                    <Loader2 size={9} className="animate-spin shrink-0" />
                    Sync…
                  </p>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 sm:w-9 sm:h-9">
                <DollarSign size={16} className="text-green-500" />
              </div>
            </div>
          </div>

          {/* Total Payables */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-2.5 sm:rounded-xl sm:p-3">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold sm:text-xs">Pay.</p>
                <p className={cn('text-base font-bold text-red-400 mt-0.5 tabular-nums sm:text-lg', balanceColumnsPending && 'animate-pulse')}>
                  {balanceColumnsPending ? '—' : formatCurrency(summaryOperational.totalPayables)}
                </p>
                <p className="text-[9px] text-gray-600 mt-0.5 hidden sm:block">
                  Operational · <code className="text-gray-500">get_contact_balances_summary</code>
                </p>
                {!balanceColumnsPending && summaryPartyGlSigned && (
                  <p className="text-[9px] text-violet-300/90 mt-0.5 leading-snug hidden sm:block">
                    Party GL (2000 / worker, signed, this tab): {formatCurrency(summaryPartyGlSigned.payables)}
                  </p>
                )}
                {balancesLoading && !balancesStale && (
                  <p className="text-[9px] text-blue-400/90 mt-0.5 flex items-center gap-1">
                    <Loader2 size={9} className="animate-spin shrink-0" />
                    Sync…
                  </p>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 sm:w-9 sm:h-9">
                <DollarSign size={16} className="text-red-500" />
              </div>
            </div>
          </div>

          {/* Active Contacts */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-2.5 sm:rounded-xl sm:p-3">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold sm:text-xs leading-tight">Active</p>
                <p className="text-base font-bold text-white mt-0.5 sm:text-lg">{summaryMeta.activeCount}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">/ {summaryMeta.totalCount}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 sm:w-9 sm:h-9">
                <UserCheck size={16} className="text-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: search + page size + actions (same row on sm+) */}
        <div className="flex flex-col gap-2 min-w-0 xl:min-h-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex-1 min-w-[min(100%,200px)] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, code, phone…"
                className="pl-9 bg-gray-900 border-gray-700 text-white h-9 sm:h-10 text-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <CustomSelect
                value={pageSize}
                onChange={handlePageSizeChange}
                options={[
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                  { value: 100, label: '100' },
                  { value: 500, label: '500' },
                  { value: 1000, label: '1000' },
                  { value: filteredContacts.length, label: `All (${filteredContacts.length})` },
                ]}
              />
              <div ref={filterRef} className="relative">
                <Button
                  ref={filterTriggerRef}
                  variant="outline"
                  onClick={() => setFilterOpen(!filterOpen)}
                  className={cn(
                    'h-9 gap-1.5 bg-gray-900 border-gray-700 sm:h-10 sm:gap-2',
                    activeFilterCount > 0 && 'border-blue-500 text-blue-400'
                  )}
                >
                  <Filter size={16} />
                  <span className="hidden sm:inline">Filter</span>
                  {activeFilterCount > 0 && (
                    <Badge className="ml-0.5 bg-blue-600 text-white text-xs px-1.5 py-0 h-5 flex items-center justify-center min-w-[20px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                {filterOpen && typeof document !== 'undefined' && createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[9998]"
                      onClick={() => setFilterOpen(false)}
                      aria-hidden
                    />
                    <div
                      className="fixed w-80 max-w-[calc(100vw-2rem)] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-[9999]"
                      style={{ top: filterPosition.top, left: filterPosition.left }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white">Advanced Filters</h3>
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="space-y-4 max-h-[min(500px,70vh)] overflow-y-auto">
                        <div>
                          <label className="text-xs text-gray-400 mb-2 block font-medium">Contact Type</label>
                          <div className="space-y-2">
                            {[
                              { value: 'customer', label: 'Customer' },
                              { value: 'supplier', label: 'Supplier' },
                              { value: 'worker', label: 'Worker' },
                            ].map(opt => (
                              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={typeFilter.includes(opt.value)}
                                  onChange={() => toggleTypeFilter(opt.value)}
                                  className="w-4 h-4 rounded bg-gray-950 border-gray-700"
                                />
                                <span className="text-sm text-gray-300">{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {(typeFilter.includes('worker') || activeTab === 'workers') && (
                          <div>
                            <label className="text-xs text-gray-400 mb-2 block font-medium">Worker Role</label>
                            <div className="space-y-2">
                              {Object.entries(workerRoleLabels).map(([key, label]) => (
                                <label key={key} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={workerRoleFilter.includes(key as WorkerRole)}
                                    onChange={() => toggleWorkerRoleFilter(key as WorkerRole)}
                                    className="w-4 h-4 rounded bg-gray-950 border-gray-700"
                                  />
                                  <span className="text-sm text-gray-300">{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-gray-400 mb-2 block font-medium">Status</label>
                          <div className="space-y-2">
                            {[
                              { value: 'all', label: 'All Status' },
                              { value: 'active', label: 'Active' },
                              { value: 'onhold', label: 'On Hold' },
                              { value: 'inactive', label: 'Inactive' },
                            ].map(opt => (
                              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="status"
                                  checked={statusFilter === opt.value}
                                  onChange={() => setStatusFilter(opt.value as StatusType)}
                                  className="w-4 h-4 bg-gray-950 border-gray-700"
                                />
                                <span className="text-sm text-gray-300">{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-400 mb-2 block font-medium">Payment Status</label>
                          <div className="space-y-2">
                            {[
                              { value: 'all', label: 'All Balances' },
                              { value: 'due', label: 'Due (Has Balance)' },
                              { value: 'paid', label: 'Paid (Zero Balance)' },
                            ].map(opt => (
                              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="balance"
                                  checked={balanceFilter === opt.value}
                                  onChange={() => setBalanceFilter(opt.value as BalanceType)}
                                  className="w-4 h-4 bg-gray-950 border-gray-700"
                                />
                                <span className="text-sm text-gray-300">{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-400 mb-2 block font-medium">Branch</label>
                          <div className="space-y-2">
                            {[
                              { value: 'all', label: 'All Branches' },
                              { value: 'Main Branch (HQ)', label: 'Main Branch (HQ)' },
                              { value: 'Mall Outlet', label: 'Mall Outlet' },
                              { value: 'Warehouse', label: 'Warehouse' },
                            ].map(opt => (
                              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="branch"
                                  checked={branchFilter === opt.value}
                                  onChange={() => setBranchFilter(opt.value)}
                                  className="w-4 h-4 bg-gray-950 border-gray-700"
                                />
                                <span className="text-sm text-gray-300">{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-400 mb-2 block font-medium">Phone Number</label>
                          <div className="space-y-2">
                            {[
                              { value: 'all', label: 'All Contacts' },
                              { value: 'has', label: 'Has Phone Number' },
                              { value: 'no', label: 'No Phone Number' },
                            ].map(opt => (
                              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="phone"
                                  checked={phoneFilter === opt.value}
                                  onChange={() => setPhoneFilter(opt.value as 'all' | 'has' | 'no')}
                                  className="w-4 h-4 bg-gray-950 border-gray-700"
                                />
                                <span className="text-sm text-gray-300">{opt.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 gap-1.5 bg-gray-900 border-gray-700 relative z-10 sm:h-10 sm:gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setImportModalOpen(true);
                }}
              >
                <Upload size={16} />
                Import
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 gap-1.5 bg-gray-900 border-gray-700 sm:h-10 sm:gap-2">
                    <Download size={16} />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white">
                  <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                    <FileText size={14} className="mr-2 text-green-400" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                    <FileText size={14} className="mr-2 text-blue-400" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                    <Download size={14} className="mr-2 text-purple-400" />
                    Download Sample Template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        </div>

        {!listLoading && reconSnapshot && (
          <details className="mt-3 rounded-xl border border-blue-500/25 bg-blue-950/20 group">
            <summary className="cursor-pointer list-none px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-white hover:bg-blue-950/30 rounded-xl [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-400 shrink-0" />
                Reconciliation · tab vs GL
              </span>
              <span className="text-xs text-gray-400 font-normal">Expand</span>
            </summary>
          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-blue-500/15">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Scale className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Reconciliation · this tab vs GL control</p>
                  <p className="text-xs text-gray-400 mt-0.5 max-w-3xl">{reconSnapshot.message}</p>
                  <p className="text-[11px] text-amber-400/90 mt-1 font-medium">
                    Per-contact GL-aligned balance: pending journal mapping (no party_contact_id on lines yet).
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-indigo-500/40 text-indigo-200 hover:bg-indigo-950/40 gap-1.5"
                  onClick={() => setCurrentView('ar-ap-reconciliation-center')}
                >
                  <Shield size={14} />
                  Reconciliation Center
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-blue-500/40 text-blue-200 hover:bg-blue-950/50 gap-1.5"
                  onClick={() => setCurrentView('reports')}
                >
                  <BarChart3 size={14} />
                  Trial Balance
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-950/60 border border-gray-800 p-3 text-xs space-y-2">
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wide">Accounts Receivable</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <p className="text-gray-500">Operational</p>
                    <p className="text-green-400 font-semibold tabular-nums">{formatCurrency(reconSnapshot.operationalReceivablesTotal)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">GL (Dr−Cr)</p>
                    <p className="text-white font-semibold tabular-nums">
                      {reconSnapshot.glArNetDrMinusCr != null ? formatCurrency(reconSnapshot.glArNetDrMinusCr) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Variance</p>
                    <p
                      className={cn(
                        'font-semibold tabular-nums',
                        reconSnapshot.varianceReceivablesVsAr != null && Math.abs(reconSnapshot.varianceReceivablesVsAr) >= 1
                          ? 'text-amber-400'
                          : 'text-gray-400'
                      )}
                    >
                      {reconSnapshot.varianceReceivablesVsAr != null ? formatCurrency(reconSnapshot.varianceReceivablesVsAr) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Unmapped JEs</p>
                    <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/40 tabular-nums">
                      {reconSnapshot.unmappedArJournalCount}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-gray-950/60 border border-gray-800 p-3 text-xs space-y-2">
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wide">Accounts Payable</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <p className="text-gray-500">Operational</p>
                    <p className="text-red-400 font-semibold tabular-nums">{formatCurrency(reconSnapshot.operationalPayablesTotal)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">GL (Cr−Dr)</p>
                    <p className="text-white font-semibold tabular-nums">
                      {reconSnapshot.glApNetCredit != null ? formatCurrency(reconSnapshot.glApNetCredit) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Variance</p>
                    <p
                      className={cn(
                        'font-semibold tabular-nums',
                        reconSnapshot.variancePayablesVsAp != null && Math.abs(reconSnapshot.variancePayablesVsAp) >= 1
                          ? 'text-amber-400'
                          : 'text-gray-400'
                      )}
                    >
                      {reconSnapshot.variancePayablesVsAp != null ? formatCurrency(reconSnapshot.variancePayablesVsAp) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Unmapped JEs</p>
                    <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/40 tabular-nums">
                      {reconSnapshot.unmappedApJournalCount}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </details>
        )}

        {!listLoading && subledgerVsGl && (subledgerVsGl.ar || subledgerVsGl.ap) && (
          <details className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] text-xs text-gray-300 group">
            <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between gap-2 text-sm font-medium text-amber-100 hover:bg-amber-500/10 rounded-xl [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                Contacts vs GL (same branch)
              </span>
              <span className="text-xs text-gray-500 font-normal">Expand</span>
            </summary>
          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-amber-500/20">
            <div className="flex items-start gap-2 text-amber-200/95 pt-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-100">Contacts vs general ledger (same branch)</p>
                <p className="text-gray-400 mt-1 leading-relaxed">
                  <strong>Contacts (this tab)</strong> = operational roll-up (<code className="text-amber-400/80">get_contact_balances_summary</code>) — same basis as the green/red card totals.
                  <strong className="ml-1">Trial Balance</strong> = net on AR/AP control accounts from journal (life-to-date). A gap usually means
                  manual journals, on-account receipts, or legacy data. For party-attributed GL sums (signed), use the violet line on the cards or Control breakdown on Accounts.
                </p>
              </div>
            </div>
            {subledgerVsGl.ar && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg bg-gray-950/50 border border-gray-800/80 p-3">
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-semibold">Receivables (this tab)</p>
                  <p className="text-sm font-bold text-green-400 tabular-nums">{formatCurrency(subledgerVsGl.ar.contactsTotal)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-semibold">GL {subledgerVsGl.ar.label}</p>
                  <p className="text-sm font-bold text-white tabular-nums">Dr−Cr = {formatCurrency(subledgerVsGl.ar.glNetDrMinusCr)}</p>
                  {subledgerVsGl.ar.assetNegative && (
                    <p className="text-[10px] text-red-400 mt-1">Credit-heavy asset — review postings to this account.</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-semibold">Variance (contacts − GL net)</p>
                  <p
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      Math.abs(subledgerVsGl.ar.variance) < 1 ? 'text-gray-400' : 'text-amber-400'
                    )}
                  >
                    {formatCurrency(subledgerVsGl.ar.variance)}
                  </p>
                </div>
              </div>
            )}
            {subledgerVsGl.ap && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg bg-gray-950/50 border border-gray-800/80 p-3">
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-semibold">Payables (this tab)</p>
                  <p className="text-sm font-bold text-red-400 tabular-nums">{formatCurrency(subledgerVsGl.ap.contactsTotal)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-semibold">GL {subledgerVsGl.ap.label}</p>
                  <p className="text-sm font-bold text-white tabular-nums">Cr−Dr = {formatCurrency(subledgerVsGl.ap.glNetCredit)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-gray-500 font-semibold">Variance (contacts − GL)</p>
                  <p
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      Math.abs(subledgerVsGl.ap.variance) < 1 ? 'text-gray-400' : 'text-amber-400'
                    )}
                  >
                    {formatCurrency(subledgerVsGl.ap.variance)}
                  </p>
                </div>
              </div>
            )}
          </div>
          </details>
        )}
      </div>
      </div>

      {/* Contacts Table - Scrollable (min-h-0 lets flex-1 shrink so overflow works) */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-3">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden min-h-[200px]">
          {listLoading ? (
            <div className="p-4 md:p-5">
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-4">
                <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-3 animate-pulse">
                  <div className="h-2.5 w-20 bg-gray-700 rounded mb-2" />
                  <div className="h-7 w-24 bg-green-900/40 rounded mb-1" />
                  <p className="text-[10px] text-gray-500">Receivables</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-3 animate-pulse">
                  <div className="h-2.5 w-20 bg-gray-700 rounded mb-2" />
                  <div className="h-7 w-24 bg-red-900/40 rounded mb-1" />
                  <p className="text-[10px] text-gray-500">Payables</p>
                </div>
              </div>
              <div className="space-y-1.5 max-w-4xl mx-auto mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-11 rounded-md bg-gray-800/35 border border-gray-800/60 animate-pulse"
                    style={{ animationDelay: `${i * 35}ms` }}
                  />
                ))}
              </div>
              <div className="text-center space-y-2">
                <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="text-blue-500 animate-spin" />
                  Loading contacts &amp; due balances…
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  onClick={() => openDrawer('addContact')}
                >
                  <Users size={14} className="mr-2" />
                  Add Contact
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Wrapper for horizontal scroll */}
              <div className="overflow-x-auto">
                <div className="min-w-[1000px]">
                  {/* Table Header - Fixed within scroll container */}
                  <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 border-b border-gray-800">
                    <div className="grid grid-cols-[40px_1fr_120px_160px_112px_112px_110px_60px] gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <div className="text-left">#</div>
                      <div className="text-left">Name</div>
                      <div className="text-left">Type</div>
                      <div className="text-left">Contact Info</div>
                      <div className="text-right leading-tight">
                        <span className="block text-[9px] normal-case text-gray-500 font-medium tracking-normal">Operational</span>
                        <span className="block">Recv.</span>
                      </div>
                      <div className="text-right leading-tight">
                        <span className="block text-[9px] normal-case text-gray-500 font-medium tracking-normal">Operational</span>
                        <span className="block">Pay.</span>
                      </div>
                      <div className="text-center">Status</div>
                      <div className="text-center">Actions</div>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div>
                    {paginatedContacts.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No contacts found</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                    <Button
                      variant="outline"
                      className="mt-4 border-gray-600 text-gray-300 hover:bg-gray-800"
                      onClick={() => openDrawer('addContact')}
                    >
                      <Users size={16} className="mr-2" />
                      Add Contact
                    </Button>
                  </div>
                ) : (
                  paginatedContacts.map((contact, index) => (
                    <div
                      key={contact.id}
                      onMouseEnter={() => setHoveredRow(contact.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className="grid grid-cols-[40px_1fr_120px_160px_112px_112px_110px_60px] gap-3 px-4 min-h-14 py-1 hover:bg-gray-800/30 transition-colors items-center border-b border-gray-800/50 last:border-b-0"
                    >
                      {/* # */}
                      <div className="text-sm text-gray-500 font-medium">{index + 1}</div>

                      {/* Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className={cn("w-9 h-9 shrink-0", getAvatarColor(contact.type))}>
                          <AvatarFallback className="text-white text-xs font-semibold">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-white truncate leading-[1.3]">{contact.name}</div>
                            {(contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer')) && (
                              <Badge className="bg-gray-700/50 text-gray-300 border-gray-600 text-[10px] px-1.5 py-0 h-4">
                                System
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono leading-[1.3] mt-0.5">{contact.code}</div>
                        </div>
                      </div>

                      {/* Type */}
                      <div className="flex flex-col gap-0.5">
                        <Badge className={cn(
                          "text-xs font-medium capitalize w-fit px-2 py-0.5 h-5",
                          contact.type === 'customer' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                          contact.type === 'supplier' && "bg-purple-500/20 text-purple-400 border-purple-500/30",
                          contact.type === 'worker' && "bg-orange-500/20 text-orange-400 border-orange-500/30",
                          contact.type === 'both' && "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                        )}>
                          {contact.type === 'both' ? 'Customer + Supplier' : contact.type}
                        </Badge>
                        {contact.type === 'worker' && contact.workerRole && (
                          <span className="text-[10px] text-gray-500 leading-[1.2]">
                            {workerRoleLabels[contact.workerRole]}
                          </span>
                        )}
                      </div>

                      {/* Contact Info */}
                      <div className="text-xs text-gray-400 space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 truncate leading-[1.4]">
                          <Phone size={10} className="text-gray-600 shrink-0" />
                          <span className="truncate">{contact.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate leading-[1.4]">
                          <Mail size={10} className="text-gray-600 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      </div>

                      {/* Receivables — operational primary; signed party GL subline when map loaded */}
                      <div className="text-right">
                        {balanceColumnsPending ? (
                          <div
                            className="h-5 w-[4.25rem] ml-auto rounded bg-gray-800/60 border border-gray-800/50 animate-pulse"
                            title={
                              balancesStale
                                ? 'Operational balances did not finish loading — refresh'
                                : 'Loading open invoice balance…'
                            }
                          />
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center justify-end gap-1">
                              {partyGlByContactId &&
                                partyGlMismatchFlags(contact, partyGlByContactId.get(String(contact.uuid))).receivables && (
                                  <AlertCircle
                                    size={14}
                                    className="text-amber-400 shrink-0"
                                    title="Operational receivable ≠ max(0, party AR on 1100) — check party statement / GL tab"
                                  />
                                )}
                              <div
                                className={cn(
                                  'text-sm font-semibold tabular-nums leading-[1.4]',
                                  contact.receivables > 0 ? 'text-green-400' : 'text-gray-600'
                                )}
                                title="Operational receivable (get_contact_balances_summary or merged documents)"
                              >
                                {formatCurrency(contact.receivables)}
                              </div>
                            </div>
                            {(() => {
                              const gl = contactPartyGlReceivableSigned(contact, partyGlByContactId);
                              if (gl == null) return null;
                              return (
                                <div
                                  className={cn(
                                    'text-[10px] tabular-nums text-violet-300/90',
                                    gl < -0.005 && 'text-amber-200/90'
                                  )}
                                  title="Signed party AR on GL account 1100 (get_contact_party_gl_balances)"
                                >
                                  GL {formatCurrency(gl)}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Payables — operational primary; signed party GL subline when map loaded */}
                      <div className="text-right">
                        {balanceColumnsPending ? (
                          <div
                            className="h-5 w-[4.25rem] ml-auto rounded bg-gray-800/60 border border-gray-800/50 animate-pulse"
                            title={
                              balancesStale
                                ? 'Operational balances did not finish loading — refresh'
                                : 'Loading open bill / worker balance…'
                            }
                          />
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center justify-end gap-1">
                              {partyGlByContactId &&
                                partyGlMismatchFlags(contact, partyGlByContactId.get(String(contact.uuid))).payables && (
                                  <AlertCircle
                                    size={14}
                                    className="text-amber-400 shrink-0"
                                    title="Operational payable ≠ party AP / worker GL from journals — check party statement GL tab"
                                  />
                                )}
                              <div
                                className={cn(
                                  'text-sm font-semibold tabular-nums leading-[1.4]',
                                  contact.payables > 0 ? 'text-red-400' : 'text-gray-600'
                                )}
                                title="Operational payable (get_contact_balances_summary or merged documents)"
                              >
                                {formatCurrency(contact.payables)}
                              </div>
                            </div>
                            {(() => {
                              const gl = contactPartyGlPayableSigned(contact, partyGlByContactId);
                              if (gl == null) return null;
                              return (
                                <div
                                  className={cn(
                                    'text-[10px] tabular-nums text-violet-300/90',
                                    gl < -0.005 && 'text-amber-200/90'
                                  )}
                                  title="Signed party AP / worker payable (get_contact_party_gl_balances)"
                                >
                                  GL {formatCurrency(gl)}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Status */}
                      <div className="flex justify-center">
                        <Badge className={cn(
                          "text-xs font-medium capitalize gap-1 h-6 px-2",
                          getStatusColor(contact.status)
                        )}>
                          {getStatusIcon(contact.status)}
                          <span className="leading-none">
                            {contact.status === 'onhold' ? 'On Hold' : contact.status}
                          </span>
                        </Badge>
                      </div>

                      {/* Actions - Show only on hover */}
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className={cn(
                                "w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-all flex items-center justify-center text-gray-400 hover:text-white",
                                hoveredRow === contact.id ? "opacity-100" : "opacity-0"
                              )}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-52">
                            {/* Customer Actions (customer or both) */}
                            {(contact.type === 'customer' || contact.type === 'both') && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setViewProfileOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Eye size={14} className="mr-2 text-gray-400" />
                                  View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setCurrentView('sales');
                                    // CRITICAL FIX: Use contact.uuid (database UUID) not contact.id (number)
                                    // sale.customer_id matches contacts.id (UUID) in database
                                    sessionStorage.setItem('salesFilter_customerId', contact.uuid || contact.id?.toString() || '');
                                    sessionStorage.setItem('salesFilter_customerName', contact.name || '');
                                    toast.info(`Filtering sales for ${contact.name}`);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <FileText size={14} className="mr-2 text-blue-400" />
                                  View Sales
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setPaymentDialogOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <DollarSign size={14} className="mr-2 text-green-400" />
                                  Receive Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setLedgerOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <FileText size={14} className="mr-2 text-purple-400" />
                                  Party statement (Operational / GL / Reconciliation)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-gray-700" />
                                <DropdownMenuItem 
                                  onClick={() => openDrawer('addContact', undefined, { contact, prefillName: contact.name, prefillPhone: contact.phone })}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Edit size={14} className="mr-2 text-gray-400" />
                                  Edit Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setDeleteDialogOpen(true);
                                  }}
                                  disabled={(contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer'))}
                                  className={cn(
                                    "hover:bg-gray-800 cursor-pointer text-red-400",
                                    (contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer')) && "opacity-50 cursor-not-allowed"
                                  )}
                                  title={(contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer')) ? 'Default Walk-in Customer cannot be deleted' : ''}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Supplier Actions (supplier or both) */}
                            {(contact.type === 'supplier' || contact.type === 'both') && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setViewProfileOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Eye size={14} className="mr-2 text-gray-400" />
                                  View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setCurrentView('purchases');
                                    // Store supplier filter in sessionStorage for PurchasesPage to read
                                    sessionStorage.setItem('purchasesFilter_supplierId', contact.uuid || '');
                                    sessionStorage.setItem('purchasesFilter_supplierName', contact.name || '');
                                    toast.info(`Filtering purchases for ${contact.name}`);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <FileText size={14} className="mr-2 text-purple-400" />
                                  View Purchases
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setPaymentDialogOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <DollarSign size={14} className="mr-2 text-red-400" />
                                  Make Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setLedgerOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <FileText size={14} className="mr-2 text-blue-400" />
                                  Party statement (Operational / GL / Reconciliation)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-gray-700" />
                                <DropdownMenuItem 
                                  onClick={() => openDrawer('addContact', undefined, { contact, prefillName: contact.name, prefillPhone: contact.phone })}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Edit size={14} className="mr-2 text-gray-400" />
                                  Edit Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setDeleteDialogOpen(true);
                                  }}
                                  disabled={(contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer'))}
                                  className={cn(
                                    "hover:bg-gray-800 cursor-pointer text-red-400",
                                    (contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer')) && "opacity-50 cursor-not-allowed"
                                  )}
                                  title={(contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer')) ? 'Default Walk-in Customer cannot be deleted' : ''}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Worker Actions */}
                            {contact.type === 'worker' && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setViewProfileOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Eye size={14} className="mr-2 text-gray-400" />
                                  View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setCurrentView('studio-workflow');
                                    // TODO: Filter by worker
                                    toast.info('Work history for worker');
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <FileText size={14} className="mr-2 text-orange-400" />
                                  Work History
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setCurrentView('studio-workflow');
                                    toast.info('Assign job to worker');
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Users size={14} className="mr-2 text-blue-400" />
                                  Assign Job
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setPaymentDialogOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <DollarSign size={14} className="mr-2 text-green-400" />
                                  Payments
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setLedgerOpen(true);
                                  }}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <FileText size={14} className="mr-2 text-violet-400" />
                                  Party statement (Operational / GL / Reconciliation)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-gray-700" />
                                <DropdownMenuItem 
                                  onClick={() => openDrawer('addContact', undefined, { contact, prefillName: contact.name, prefillPhone: contact.phone })}
                                  className="hover:bg-gray-800 cursor-pointer"
                                >
                                  <Edit size={14} className="mr-2 text-gray-400" />
                                  Edit Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setDeleteDialogOpen(true);
                                  }}
                                  disabled={(contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer'))}
                                  className={cn(
                                    "hover:bg-gray-800 cursor-pointer text-red-400",
                                    (contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer')) && "opacity-50 cursor-not-allowed"
                                  )}
                                  title={(contact.is_default === true || (contact.is_system_generated && contact.system_type === 'walking_customer')) ? 'Default Walk-in Customer cannot be deleted' : ''}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Pagination Footer - Fixed */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredContacts.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Unified Payment Dialog */}
      {selectedContact && (
        <UnifiedPaymentDialog
          isOpen={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setSelectedContact(null);
          }}
          context={selectedContact.type === 'supplier' ? 'supplier' : 'customer'}
          entityName={selectedContact.name}
          entityId={selectedContact.uuid ?? selectedContact.id?.toString() ?? ''}
          outstandingAmount={
            selectedContact.type === 'supplier'
              ? selectedContact.payables
              : selectedContact.receivables
          }
          referenceNo={selectedContact.code}
          onSuccess={async () => {
            toast.success('Payment recorded successfully');
            setPaymentDialogOpen(false);
            setSelectedContact(null);
            refreshContacts();
          }}
        />
      )}

      {/* Customer Ledger - Full Screen (for customers and both) */}
      {selectedContact && (selectedContact.type === 'customer' || selectedContact.type === 'both') && ledgerOpen && (
        <div className="fixed inset-0 z-50 bg-[#111827] overflow-y-auto">
          <CustomerLedgerPageOriginal
            initialCustomerId={selectedContact.uuid}
            onClose={() => {
              setLedgerOpen(false);
              setSelectedContact(null);
            }}
          />
        </div>
      )}

      {/* Supplier / Worker Ledger - Full screen (exclude customer-only so 'both' uses Customer Ledger above) */}
      {selectedContact && (selectedContact.type === 'supplier' || selectedContact.type === 'worker') && ledgerOpen && (
        <div className="fixed inset-0 z-50 bg-[#111827] overflow-y-auto">
          <div className="sticky top-0 z-10 bg-[#111827] border-b border-gray-800 px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {selectedContact.type === 'supplier' ? 'Supplier' : 'Worker'} statement — {selectedContact.name}
              </h2>
              <p className="text-[11px] text-gray-500 mt-1 max-w-xl">
                Operational (Not GL) · GL (Journal) · Reconciliation (Variance) — three engines; no mixed running balance.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800 shrink-0"
              onClick={() => {
                setLedgerOpen(false);
                setSelectedContact(null);
              }}
            >
              <X size={18} className="mr-2" />
              Close
            </Button>
          </div>
          <div className="p-6">
            <GenericLedgerView
              ledgerType={selectedContact.type === 'supplier' ? 'supplier' : 'worker'}
              entityId={selectedContact.uuid ?? ''}
              entityName={selectedContact.name}
            />
          </div>
        </div>
      )}

      {/* View Contact Profile */}
      {selectedContact && (
        <ViewContactProfile
          isOpen={viewProfileOpen}
          onClose={() => {
            setViewProfileOpen(false);
            setSelectedContact(null);
          }}
          contact={selectedContact}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {selectedContact && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Are you sure you want to delete {selectedContact.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSelectedContact(null);
                }}
                className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteContact}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <ImportContactsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => { setImportModalOpen(false); loadContacts(); }}
      />
    </div>
  );
};