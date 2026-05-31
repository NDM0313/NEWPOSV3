import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Building2, CreditCard, Hash, ToggleLeft, Save, 
  CheckCircle, Users, Lock,   Key, Settings as SettingsIcon, AlertCircle, UserCog,
  Briefcase,
  MapPin, Store, ShoppingCart, ShoppingBag, Package, Shirt, Calculator, X, Edit, Download, Server, Copy, Printer, RefreshCw, QrCode, FileText, Activity, Shield, FlaskConical, Factory,   ChevronDown, Scissors, Loader2
} from 'lucide-react';
import type { BespokeFormConfig } from '@/app/types/bespoke';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { cn } from "../ui/utils";
import { useSettings, BranchSettings } from '@/app/context/SettingsContext';
import { usePrinterConfig } from '@/app/hooks/usePrinterConfig';
import { branchService, type Branch } from '@/app/services/branchService';
import { accountService, type Account } from '@/app/services/accountService';
import { unitService } from '@/app/services/unitService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { userService, User as UserType } from '@/app/services/userService';
import { useAccounting } from '@/app/context/AccountingContext';
import { toast } from 'sonner';
import { AddUserModal } from '../users/AddUserModal';
import { AddBranchModal } from '../branches/AddBranchModal';
import { exportAndDownloadBackup, restoreCompanyBackup, type CompanyBackupData } from '@/app/services/backupService';
import { BackupRestoreWorkbench } from '@/app/modules/csv-workbench';
import {
  companyResetService,
  type CompanyResetPreview,
  type CompanyResetMode,
  type CompanyResetDomains,
  buildResetOptionsForMode,
  requiredConfirmationPhrase,
} from '@/app/services/companyResetService';
import { defaultAccountsService } from '@/app/services/defaultAccountsService';
import { InventoryMasters, type InventoryMasterTab } from './inventory/InventoryMasters';
import { LeadTools } from './LeadTools';
import { invoiceDocumentService } from '@/app/services/invoiceDocumentService';
import { printingSettingsService } from '@/app/services/printingSettingsService';
import type { InvoiceTemplate } from '@/app/types/invoiceDocument';
import type { CompanyPrintingSettings } from '@/app/types/printingSettings';
import { mergeWithDefaults } from '@/app/types/printingSettings';
import { PrintingSettingsPanel } from './PrintingSettingsPanel';
import { getHealthDashboard, type ErpHealthRow } from '@/app/services/healthService';
import { EmployeesTab } from './EmployeesTab';
import { ErpPermissionArchitecturePage } from '@/app/components/erp-permissions/ErpPermissionArchitecturePage';
import { canAccessTechnicalDeveloperSettings } from '@/app/lib/developerAccountingAccess';
import { AppVersionTapTarget } from '@/app/components/settings/developer/AppVersionTapTarget';
import { DeveloperToolsPanel } from '@/app/components/settings/developer/DeveloperToolsPanel';
import { settingsService } from '@/app/services/settingsService';
import { NumberingPanel } from './NumberingPanel';
import { ModuleTogglesSection } from './ModuleTogglesSection';
import { BarcodeLabelSettingsPanel } from './BarcodeLabelSettingsPanel';
import { CompanyLogoUpload } from './CompanyLogoUpload';
import type { NumberingInnerTab } from './NumberingPanel';
import { SettingsLayout } from './SettingsLayout';
import {
  findNavItem,
  getVisibleSettingsNav,
  parseSettingsHash,
  writeSettingsHash,
  type SettingsCategoryId,
  type SettingsContentKey,
} from './settingsNavigation';
import {
  filterPaymentAccountsByMethod,
  findDefaultPaymentAccount,
  formatPaymentAccountOptionLabel,
} from '@/app/lib/paymentAccountFilters';
import {
  getHealthCheckGuidance,
  HEALTH_OVERALL_FAIL_BANNER_UR,
  HEALTH_SKIP_NOTE_UR,
  HEALTH_SQL_COPY_WARNING_UR,
} from '@/app/lib/healthCheckGuidance';

const INVENTORY_SUB_TAB_TO_NAV_ITEM: Record<InventoryMasterTab, string> = {
  general: 'inventoryGeneral',
  units: 'inventoryUnits',
  categories: 'inventoryCategories',
  'sub-categories': 'inventorySubCategories',
  brands: 'inventoryBrands',
  variations: 'inventoryVariations',
};

function TemplateFormFields({
  template,
  onChange,
}: {
  template: Partial<InvoiceTemplate>;
  onChange: (t: Partial<InvoiceTemplate>) => void;
}) {
  const update = (key: keyof InvoiceTemplate, value: boolean | string | null) => {
    onChange({ ...template, [key]: value });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Show SKU</Label>
        <Switch checked={template.show_sku ?? true} onCheckedChange={(v) => update('show_sku', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Show Discount</Label>
        <Switch checked={template.show_discount ?? true} onCheckedChange={(v) => update('show_discount', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Show Tax</Label>
        <Switch checked={template.show_tax ?? true} onCheckedChange={(v) => update('show_tax', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Show Studio Cost</Label>
        <Switch checked={template.show_studio ?? true} onCheckedChange={(v) => update('show_studio', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Show Signature Line</Label>
        <Switch checked={template.show_signature ?? false} onCheckedChange={(v) => update('show_signature', v)} />
      </div>
      <div>
        <Label className="text-gray-300">Logo URL (optional override)</Label>
        <p className="text-xs text-gray-500 mt-1 mb-2">
          Leave blank to use the company logo from Company Information.
        </p>
        <Input
          className="mt-1 bg-gray-800 border-gray-700 text-white"
          placeholder="https://..."
          value={template.logo_url ?? ''}
          onChange={(e) => update('logo_url', e.target.value || null)}
        />
      </div>
      <div>
        <Label className="text-gray-300">Footer Note</Label>
        <Textarea
          className="mt-1 bg-gray-800 border-gray-700 text-white min-h-[60px]"
          placeholder="Thank you for your business..."
          value={template.footer_note ?? ''}
          onChange={(e) => update('footer_note', e.target.value || null)}
        />
      </div>
    </div>
  );
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";

function SystemHealthPanel() {
  const [rows, setRows] = useState<ErpHealthRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGuides, setExpandedGuides] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getHealthDashboard();
      setRows(result.rows);
      if (result.error) setError(result.error);
    } catch {
      setError('Failed to load health data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleGuide = (component: string) => {
    setExpandedGuides((prev) => ({ ...prev, [component]: !prev[component] }));
  };

  const copySql = async (sql: string) => {
    try {
      await navigator.clipboard.writeText(sql);
      toast.success('Diagnostic SQL copy ho gaya');
    } catch {
      toast.error('Copy fail — manually select karein');
    }
  };

  const statusColor = (status: string) => {
    if (status === 'OK') return 'text-green-400 bg-green-500/10';
    if (status === 'FAIL') return 'text-red-400 bg-red-500/10';
    if (status === 'SKIP') return 'text-amber-400 bg-amber-500/10';
    return 'text-gray-400 bg-gray-500/10';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-500/10 rounded-lg">
            <Activity className="text-emerald-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">System Health</h3>
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-500/10 rounded-lg">
            <Activity className="text-emerald-500" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">System Health</h3>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const displayRows = [...rows];
  const overallStatus = rows.some((r) => r.status === 'FAIL') ? 'FAIL' : 'PASS';
  if (!rows.some((r) => r.component === 'OVERALL')) {
    displayRows.push({ component: 'OVERALL', status: overallStatus === 'PASS' ? 'OK' : 'FAIL', details: null });
  }

  const hasFail = rows.some((r) => r.status === 'FAIL');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-emerald-500/10 rounded-lg">
          <Activity className="text-emerald-500" size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">System Health</h3>
          <p className="text-sm text-gray-400">ERP integrity checks (admin/owner only)</p>
        </div>
      </div>

      {hasFail ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {HEALTH_OVERALL_FAIL_BANNER_UR}
        </div>
      ) : null}

      <div className="overflow-x-auto space-y-3">
        {displayRows.map((r, i) => {
          const guide = getHealthCheckGuidance(r.component);
          const isExpanded = Boolean(expandedGuides[r.component]);
          const showGuide = (r.status === 'FAIL' || r.status === 'SKIP') && guide;

          return (
            <div
              key={`${r.component}-${i}`}
              className={cn(
                'rounded-lg border border-gray-800 bg-gray-950/40 overflow-hidden',
                r.status === 'FAIL' && 'border-red-900/40',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white font-medium">{r.component}</span>
                    <span className={cn('inline-block px-2 py-0.5 rounded text-sm font-medium', statusColor(r.status))}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{r.details ?? '—'}</p>
                  {r.status === 'SKIP' ? (
                    <p className="text-xs text-amber-400/90 mt-1">{HEALTH_SKIP_NOTE_UR}</p>
                  ) : null}
                </div>
                {showGuide ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleGuide(r.component)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800 shrink-0 gap-1"
                  >
                    Fix guide
                    <ChevronDown
                      size={14}
                      className={cn('transition-transform', isExpanded ? 'rotate-180' : '')}
                    />
                  </Button>
                ) : null}
              </div>

              {showGuide && isExpanded && guide ? (
                <div className="border-t border-gray-800 px-4 py-3 space-y-3 bg-gray-900/30">
                  <p className="text-sm text-gray-300">{guide.meaningUr}</p>
                  {guide.settingsHint ? (
                    <p className="text-xs text-blue-300">Settings: {guide.settingsHint}</p>
                  ) : null}
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-400">
                    {guide.stepsUr.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                  {guide.diagnosticSql ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">{HEALTH_SQL_COPY_WARNING_UR}</p>
                      <pre className="text-xs text-gray-400 bg-gray-950 border border-gray-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                        {guide.diagnosticSql}
                      </pre>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copySql(guide.diagnosticSql!)}
                        className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-2"
                      >
                        <Copy size={14} />
                        Copy diagnostic SQL
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error && <p className="text-amber-400 text-sm">{error}</p>}
      <Button
        type="button"
        variant="outline"
        onClick={load}
        className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-2"
      >
        <RefreshCw size={16} />
        Refresh
      </Button>
    </div>
  );
}

export const SettingsPageNew = () => {
  const settings = useSettings();
  const printer = usePrinterConfig();
  const { companyId, refreshEnablePacking, userRole } = useSupabase();
  const isAdminOrOwner = (() => {
    if (!userRole) return false;
    const r = userRole.toLowerCase().trim();
    return r === 'admin' || r === 'owner' || r === 'super admin' || r === 'superadmin';
  })();
  const isOwner = (() => {
    if (!userRole) return false;
    const r = userRole.toLowerCase().trim();
    return r === 'owner';
  })();
  const canDeveloperTools = canAccessTechnicalDeveloperSettings(userRole);
  const visibleNav = useMemo(
    () => getVisibleSettingsNav(isAdminOrOwner, canDeveloperTools),
    [isAdminOrOwner, canDeveloperTools],
  );
  const accounting = useAccounting();
  const [activeCategoryId, setActiveCategoryId] = useState<SettingsCategoryId>(visibleNav.defaultCategoryId);
  const [activeItemId, setActiveItemId] = useState<string>(visibleNav.defaultItemId);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const fromHash = parseSettingsHash();
    if (!fromHash) return;
    const item = findNavItem(visibleNav.categories, fromHash.categoryId, fromHash.itemId);
    if (item) {
      setActiveCategoryId(fromHash.categoryId);
      setActiveItemId(fromHash.itemId);
    }
  }, [visibleNav.categories]);

  const activeNavItem =
    findNavItem(visibleNav.categories, activeCategoryId, activeItemId) ??
    findNavItem(visibleNav.categories, visibleNav.defaultCategoryId, visibleNav.defaultItemId);

  const resolvedCategoryId = activeNavItem
    ? visibleNav.categories.find((c) => c.items.some((i) => i.id === activeNavItem.id))?.id ?? visibleNav.defaultCategoryId
    : visibleNav.defaultCategoryId;

  const resolvedItemId = activeNavItem?.id ?? visibleNav.defaultItemId;
  const contentKey: SettingsContentKey = activeNavItem?.contentKey ?? 'company';
  const navSubTabId = activeNavItem?.subTabId ?? resolvedItemId;

  const handleNavSelect = useCallback((categoryId: SettingsCategoryId, itemId: string) => {
    setActiveCategoryId(categoryId);
    setActiveItemId(itemId);
    writeSettingsHash(categoryId, itemId);
  }, []);

  // Branch edit dialog state (OLD - keeping for backward compatibility)
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchSettings | null>(null);
  const [branchForm, setBranchForm] = useState<Partial<BranchSettings>>({});
  
  // Branch modal state (NEW - using AddBranchModal)
  const [addBranchModalOpen, setAddBranchModalOpen] = useState(false);
  const [editingBranchForModal, setEditingBranchForModal] = useState<any>(null);

  // User Management state
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);

  // Local state for form editing
  const [companyForm, setCompanyForm] = useState(settings.company);
  const [posForm, setPOSForm] = useState(settings.posSettings);
  const [salesForm, setSalesForm] = useState(settings.salesSettings);
  const [purchaseForm, setPurchaseForm] = useState(settings.purchaseSettings);
  const [inventoryForm, setInventoryForm] = useState(settings.inventorySettings);
  const [rentalForm, setRentalForm] = useState(settings.rentalSettings);
  const [defaultDressDevaluation, setDefaultDressDevaluation] = useState<number>(5000);
  const [accountingForm, setAccountingForm] = useState(settings.accountingSettings);
  const [accountsForm, setAccountsForm] = useState(settings.defaultAccounts);
  const [numberingForm, setNumberingForm] = useState(settings.numberingRules);
  const [modulesForm, setModulesForm] = useState(settings.modules);
  const [units, setUnits] = useState<{ id: string; name: string; short_code?: string }[]>([]);
  const [resetPreview, setResetPreview] = useState<CompanyResetPreview | null>(null);
  const [loadingResetPreview, setLoadingResetPreview] = useState(false);
  const [executingReset, setExecutingReset] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetMode, setResetMode] = useState<CompanyResetMode>('transactional');
  const [resetDomains, setResetDomains] = useState<CompanyResetDomains>({
    transactional: true,
    contacts: false,
    products: false,
    accounts: false,
    workers: false,
  });
  const resetOptions = useMemo(
    () => buildResetOptionsForMode(resetMode, resetDomains),
    [resetMode, resetDomains]
  );
  const resetConfirmPhrase = useMemo(() => requiredConfirmationPhrase(resetOptions), [resetOptions]);
  const resetPhraseMatches = useMemo(
    () => resetConfirmation.trim().toUpperCase() === resetConfirmPhrase,
    [resetConfirmation, resetConfirmPhrase]
  );
  const resetBusy = executingReset || loadingResetPreview;
  const resetRunDisabled = !companyId || executingReset || !resetPhraseMatches;
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [loadingPaymentAccounts, setLoadingPaymentAccounts] = useState(false);

  // Phase B: Invoice template settings (A4 & Thermal)
  const [invoiceTemplateA4, setInvoiceTemplateA4] = useState<Partial<InvoiceTemplate>>({
    show_sku: true, show_discount: true, show_tax: true, show_studio: true, show_signature: false, logo_url: null, footer_note: null,
  });
  const [invoiceTemplateThermal, setInvoiceTemplateThermal] = useState<Partial<InvoiceTemplate>>({
    show_sku: true, show_discount: true, show_tax: true, show_studio: true, show_signature: false, logo_url: null, footer_note: null,
  });
  const [loadingInvoiceTemplates, setLoadingInvoiceTemplates] = useState(false);
  const [savingInvoiceTemplates, setSavingInvoiceTemplates] = useState(false);

  // Centralized Printing settings (Settings → Printing)
  const [printingSettings, setPrintingSettings] = useState<CompanyPrintingSettings | null>(null);
  const [loadingPrinting, setLoadingPrinting] = useState(false);
  const [savingPrinting, setSavingPrinting] = useState(false);
  const [backupRestoreConfirmation, setBackupRestoreConfirmation] = useState('');
  const [backupRestoreLoading, setBackupRestoreLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!companyId) return;
    settingsService.getDefaultDressDevaluation(companyId).then(setDefaultDressDevaluation).catch(() => setDefaultDressDevaluation(5000));
  }, [companyId]);

  // Load users function
  const loadUsers = useCallback(async () => {
    if (!companyId) return;
    
    setLoadingUsers(true);
    try {
      const usersData = await userService.getAllUsers(companyId, { includeInactive: true });
      setUsers(usersData);
    } catch (error) {
      console.error('[SETTINGS] Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [companyId]);

  const formatResetError = useCallback((message?: string | null) => {
    const msg = String(message || '').trim();
    if (!msg) return 'Reset request failed';
    const lower = msg.toLowerCase();
    if (
      lower.includes('bad gateway') ||
      lower.includes('gateway timeout') ||
      lower.includes('service unavailable') ||
      lower.includes('502') ||
      lower.includes('503') ||
      lower.includes('504')
    ) {
      return 'Service temporarily unavailable. Retry in 5-10 seconds.';
    }
    return msg;
  }, []);

  const handleResetModeChange = useCallback((mode: CompanyResetMode) => {
    setResetMode(mode);
    setResetConfirmation('');
    setResetPreview(null);
    if (mode === 'transactional') {
      setResetDomains({
        transactional: true,
        contacts: false,
        products: false,
        accounts: false,
        workers: false,
      });
    } else if (mode === 'complete') {
      setResetDomains({
        transactional: true,
        contacts: true,
        products: true,
        accounts: true,
        workers: true,
      });
    }
  }, []);

  const loadResetPreview = useCallback(async () => {
    if (!companyId) return;
    setLoadingResetPreview(true);
    try {
      const preview = await companyResetService.preview(companyId, resetOptions);
      if (!preview.success) {
        toast.error(formatResetError(preview.error || 'Failed to load reset preview'));
        return;
      }
      setResetPreview(preview);
    } catch (error: any) {
      toast.error(formatResetError(error?.message || 'Failed to load reset preview'));
    } finally {
      setLoadingResetPreview(false);
    }
  }, [companyId, formatResetError, resetOptions]);

  const executeCompanyReset = useCallback(async () => {
    if (!companyId) return;
    const phrase = resetConfirmPhrase;
    if (resetConfirmation.trim().toUpperCase() !== phrase) {
      toast.error(`Please type ${phrase} to confirm`);
      return;
    }
    setExecutingReset(true);
    try {
      const result = await companyResetService.execute(
        companyId,
        resetConfirmation.trim().toUpperCase(),
        resetOptions
      );
      if (!result.success) {
        toast.error(formatResetError(result.error || 'Reset failed'));
        return;
      }
      const shouldReseed =
        result.reseed_accounts === true ||
        resetOptions.reseed_accounts === true ||
        resetOptions.domains.accounts;
      if (shouldReseed) {
        try {
          await defaultAccountsService.ensureDefaultAccounts(companyId);
        } catch (reseedErr: unknown) {
          const msg = reseedErr instanceof Error ? reseedErr.message : 'Failed to reseed chart of accounts';
          toast.error(msg);
        }
      }
      toast.success(
        resetMode === 'complete'
          ? 'Complete company reset finished'
          : resetMode === 'selective'
            ? 'Selective company reset finished'
            : 'Company transactional data reset completed'
      );
      setResetConfirmation('');
      await loadResetPreview();
      window.dispatchEvent(new Event('inventory-updated'));
      window.dispatchEvent(new Event('products-updated'));
      try {
        localStorage.removeItem('erp_modules');
        sessionStorage.clear();
      } catch {
        // no-op
      }
      setTimeout(() => window.location.reload(), 700);
    } finally {
      setExecutingReset(false);
    }
  }, [
    companyId,
    formatResetError,
    loadResetPreview,
    resetConfirmation,
    resetConfirmPhrase,
    resetMode,
    resetOptions,
  ]);

  const parseBackupFile = async (file: File): Promise<CompanyBackupData> => {
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON file.');
    }
    const backup = parsed as CompanyBackupData;
    if (!backup?.meta?.company_id || !backup?.data) {
      throw new Error('Invalid backup format.');
    }
    return backup;
  };

  const handleRestoreBackupFile = useCallback(
    async (file: File | null) => {
      if (!file || !companyId) return;
      if (!isOwner) {
        toast.error('Backup restore is restricted to Owner role.');
        return;
      }
      if (backupRestoreConfirmation.trim().toUpperCase() !== 'RESTORE') {
        toast.error('Type RESTORE before importing backup.');
        return;
      }
      setBackupRestoreLoading(true);
      try {
        const backup = await parseBackupFile(file);
        if (backup.meta.company_id !== companyId) {
          throw new Error('Backup company_id does not match active company.');
        }
        const confirmed = window.confirm(
          'This will overwrite current company data for supported modules. Continue restore?'
        );
        if (!confirmed) return;
        const result = await restoreCompanyBackup(companyId, backup);
        toast.success(
          `Restore complete. Contacts: ${result.restored.contacts}, Products: ${result.restored.products}, Sales: ${result.restored.sales}`
        );
        setBackupRestoreConfirmation('');
        setTimeout(() => window.location.reload(), 700);
      } catch (error: any) {
        toast.error(error?.message || 'Restore failed');
      } finally {
        setBackupRestoreLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [backupRestoreConfirmation, companyId, isOwner]
  );

  // Phase B: Load invoice templates (A4 & Thermal) when opening the tab
  const loadInvoiceTemplates = useCallback(async () => {
    if (!companyId) return;
    setLoadingInvoiceTemplates(true);
    try {
      const [a4Res, thermalRes] = await Promise.all([
        invoiceDocumentService.getTemplate(companyId, 'A4'),
        invoiceDocumentService.getTemplate(companyId, 'Thermal'),
      ]);
      if (a4Res.data) {
        setInvoiceTemplateA4({
          show_sku: a4Res.data.show_sku,
          show_discount: a4Res.data.show_discount,
          show_tax: a4Res.data.show_tax,
          show_studio: a4Res.data.show_studio,
          show_signature: a4Res.data.show_signature,
          logo_url: a4Res.data.logo_url,
          footer_note: a4Res.data.footer_note,
        });
      }
      if (thermalRes.data) {
        setInvoiceTemplateThermal({
          show_sku: thermalRes.data.show_sku,
          show_discount: thermalRes.data.show_discount,
          show_tax: thermalRes.data.show_tax,
          show_studio: thermalRes.data.show_studio,
          show_signature: thermalRes.data.show_signature,
          logo_url: thermalRes.data.logo_url,
          footer_note: thermalRes.data.footer_note,
        });
      }
    } catch (e) {
      console.error('[SETTINGS] Error loading invoice templates:', e);
      toast.error('Failed to load invoice template settings');
    } finally {
      setLoadingInvoiceTemplates(false);
    }
  }, [companyId]);

  const loadPrintingSettings = useCallback(async () => {
    if (!companyId) return;
    setLoadingPrinting(true);
    try {
      const { data, error } = await printingSettingsService.get(companyId);
      if (error) {
        toast.error(error);
        return;
      }
      setPrintingSettings(data ?? null);
    } catch (e) {
      console.error('[SETTINGS] Error loading printing settings:', e);
      toast.error('Failed to load printing settings');
    } finally {
      setLoadingPrinting(false);
    }
  }, [companyId]);

  const savePrintingSettings = useCallback(async () => {
    if (!companyId) return;
    setSavingPrinting(true);
    try {
      const toSave = mergeWithDefaults(printingSettings);
      const { error } = await printingSettingsService.update(companyId, toSave);
      if (error) {
        toast.error(error);
        return;
      }
      setPrintingSettings(toSave);
      toast.success('Printing settings saved');
    } catch (e) {
      console.error('[SETTINGS] Error saving printing settings:', e);
      toast.error('Failed to save printing settings');
    } finally {
      setSavingPrinting(false);
    }
  }, [companyId, printingSettings]);

  const loadPaymentAccounts = useCallback(async () => {
    if (!companyId) return;
    setLoadingPaymentAccounts(true);
    try {
      const list = await accountService.getPaymentAccountsOnly(companyId);
      setPaymentAccounts((list || []) as Account[]);
    } catch (e) {
      console.error('[SETTINGS] Error loading payment accounts:', e);
      setPaymentAccounts([]);
    } finally {
      setLoadingPaymentAccounts(false);
    }
  }, [companyId]);

  // Load branches from database and resolve default account names
  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    try {
      const [branchesData, accountsList] = await Promise.all([
        branchService.getAllBranches(companyId),
        accountService.getAllAccounts(companyId),
      ]);
      const accountNameById = new Map<string, string>();
      (accountsList || []).forEach((a: any) => { if (a.id && a.name) accountNameById.set(a.id, a.name); });
      const branchSettings: BranchSettings[] = (branchesData || []).map((branch: any) => ({
        id: branch.id,
        branchName: branch.name,
        branchCode: branch.code || '',
        address: branch.address || '',
        phone: branch.phone || '',
        city: branch.city || '',
        state: branch.state || '',
        fiscalYearStart: branch.fiscal_year_start ? String(branch.fiscal_year_start).split('T')[0] : '',
        fiscalYearEnd: branch.fiscal_year_end ? String(branch.fiscal_year_end).split('T')[0] : '',
        isActive: branch.is_active ?? true,
        isDefault: !!branch.is_default,
        cashAccount: (branch.default_cash_account_id && accountNameById.get(branch.default_cash_account_id)) || '',
        bankAccount: (branch.default_bank_account_id && accountNameById.get(branch.default_bank_account_id)) || '',
        posCashDrawer: (branch.default_pos_drawer_account_id && accountNameById.get(branch.default_pos_drawer_account_id)) || '',
        cashAccountId: branch.default_cash_account_id || undefined,
        bankAccountId: branch.default_bank_account_id || undefined,
        posCashDrawerId: branch.default_pos_drawer_account_id || undefined,
      }));
      settings.updateBranches(branchSettings);
    } catch (error) {
      console.error('[SETTINGS] Error loading branches:', error);
      toast.error('Failed to load branches');
    }
  }, [companyId, settings]);

  // Sync forms when switching tabs (show latest from DB)
  useEffect(() => {
    if (contentKey === 'inventory') setInventoryForm(settings.inventorySettings);
  }, [contentKey, settings.inventorySettings]);
  useEffect(() => {
    if (contentKey === 'company') setCompanyForm(settings.company);
  }, [contentKey, settings.company]);

  // Load users when users tab is active
  useEffect(() => {
    if (contentKey === 'users') {
      loadUsers();
    }
    if (contentKey === 'invoiceTemplates') {
      loadInvoiceTemplates();
    }
    if (contentKey === 'printing') {
      loadPrintingSettings();
    }
  }, [contentKey, loadUsers, loadInvoiceTemplates, loadPrintingSettings]);

  // Load branches when branches tab is active
  useEffect(() => {
    if (contentKey === 'branches') {
      loadBranches();
    }
  }, [contentKey, loadBranches]);

  // Load units when inventory tab is active (for Default Unit dropdown)
  useEffect(() => {
    if (contentKey === 'inventory' && companyId) {
      unitService.getAll(companyId, { includeInactive: false }).then((list) => {
        setUnits(list || []);
      }).catch(() => setUnits([]));
    }
  }, [contentKey, companyId]);

  // Load default payment accounts when accounts tab is active
  useEffect(() => {
    if (contentKey === 'accounts' && companyId) {
      setAccountsForm(settings.defaultAccounts);
      loadPaymentAccounts();
    }
  }, [contentKey, companyId, loadPaymentAccounts, settings.defaultAccounts]);

  // Auto-select default core accounts if not already set
  useEffect(() => {
    if (contentKey !== 'accounts' || paymentAccounts.length === 0) return;

    setAccountsForm((prev) => {
      const cashMethod = prev.paymentMethods.find((p) => p.method === 'Cash');
      const bankMethod = prev.paymentMethods.find((p) => p.method === 'Bank');
      const walletMethod = prev.paymentMethods.find((p) => p.method === 'Mobile Wallet');

      const needsUpdate =
        !cashMethod?.defaultAccount
        || !bankMethod?.defaultAccount
        || !walletMethod?.defaultAccount;

      if (!needsUpdate) return prev;

      const updatedMethods = prev.paymentMethods.map((p) => {
        if (p.defaultAccount) return p;
        const match = findDefaultPaymentAccount(paymentAccounts, p.method as 'Cash' | 'Bank' | 'Mobile Wallet');
        return match ? { ...p, defaultAccount: match.name } : p;
      });

      return { ...prev, paymentMethods: updatedMethods };
    });
  }, [contentKey, paymentAccounts]);

  // Listen for userCreated event - Real-time update
  useEffect(() => {
    const handleUserCreated = () => {
      if (contentKey === 'users') {
        loadUsers();
      }
    };
    
    window.addEventListener('userCreated', handleUserCreated);
    return () => {
      window.removeEventListener('userCreated', handleUserCreated);
    };
  }, [contentKey, loadUsers]);

  // Handle branch edit — load full row from DB so fiscal/location fields are not stale
  const handleEditBranch = async (branch: BranchSettings) => {
    try {
      const full = await branchService.getBranch(branch.id);
      setEditingBranchForModal(full);
      setAddBranchModalOpen(true);
    } catch (error) {
      console.error('[SETTINGS] Error loading branch for edit:', error);
      toast.error('Failed to load branch details');
    }
  };

  // Handle branch save
  const handleSaveBranch = async () => {
    if (!editingBranch || !companyId) return;

    try {
      // Validate required fields
      if (!branchForm.branchName || !branchForm.branchCode) {
        toast.error('Branch name and code are required');
        return;
      }

      // Map BranchSettings to Branch format for database
      const branchUpdates: Partial<Branch> = {
        name: branchForm.branchName,
        code: branchForm.branchCode,
        address: branchForm.address || undefined,
        phone: branchForm.phone || undefined,
        is_active: branchForm.isActive ?? true,
      };

      // Save to database
      await branchService.updateBranch(editingBranch.id, branchUpdates);

      // Update local state
      const updatedBranches = settings.branches.map(b =>
        b.id === editingBranch.id ? { ...b, ...branchForm } as BranchSettings : b
      );
      settings.updateBranches(updatedBranches);
      
      toast.success('Branch updated successfully');
      setIsBranchDialogOpen(false);
      setEditingBranch(null);
      setBranchForm({});
    } catch (error: any) {
      console.error('[SETTINGS PAGE] Error saving branch:', error);
      toast.error(`Failed to save branch: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSave = async () => {
    try {
      switch (contentKey) {
        case 'company':
          await settings.updateCompanySettings(companyForm);
          break;
        case 'pos':
          await settings.updatePOSSettings(posForm);
          break;
        case 'sales':
          await settings.updateSalesSettings(salesForm);
          break;
        case 'purchase':
          await settings.updatePurchaseSettings(purchaseForm);
          break;
        case 'inventory':
          await settings.updateInventorySettings(inventoryForm);
          break;
        case 'rental':
          await settings.updateRentalSettings(rentalForm);
          if (companyId) {
            await settingsService.setDefaultDressDevaluation(companyId, defaultDressDevaluation);
          }
          break;
        case 'accounting':
          await settings.updateAccountingSettings(accountingForm);
          break;
        case 'accounts':
          await settings.updateDefaultAccounts(accountsForm);
          break;
        case 'numbering':
          // Numbering is saved via NumberingPanel → NumberingRulesTable "Save Rules" (erp_document_sequences)
          break;
        case 'modules':
          await settings.updateModules(modulesForm);
          break;
        case 'data':
          // No save - export only
          break;
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('[SETTINGS PAGE] Error saving:', error);
      toast.error('Failed to save settings');
    }
  };

  const activeCategory = visibleNav.categories.find((c) => c.id === resolvedCategoryId);

  return (
    <>
      <SettingsLayout
        categories={visibleNav.categories}
        activeCategoryId={resolvedCategoryId}
        activeItemId={resolvedItemId}
        onSelect={handleNavSelect}
        categoryDescription={activeCategory?.description}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={handleSave}
      >
          {/* COMPANY INFO */}
          {contentKey === 'company' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Building2 className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Company Information</h3>
                    <p className="text-sm text-gray-400">Basic business details and contact info</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Business Name *</Label>
                    <Input 
                      value={companyForm.businessName}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessName: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="Din Collection"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Tax ID / NTN</Label>
                    <Input 
                      value={companyForm.taxId}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, taxId: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="TAX-123456"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-gray-300 mb-2 block">Business Address</Label>
                    <Input 
                      value={companyForm.businessAddress}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessAddress: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="Main Branch, Lahore, Pakistan"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Phone Number</Label>
                    <Input 
                      value={companyForm.businessPhone}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessPhone: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="+92 300 1234567"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Email Address</Label>
                    <Input 
                      value={companyForm.businessEmail}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, businessEmail: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="contact@dincollection.com"
                    />
                  </div>

                  <CompanyLogoUpload
                    logoUrl={companyForm.logoUrl}
                    onChange={(logoUrl) => {
                      setCompanyForm({ ...companyForm, logoUrl });
                      setHasUnsavedChanges(true);
                    }}
                  />

                  <div>
                    <Label className="text-gray-300 mb-2 block">Currency</Label>
                    <select 
                      value={companyForm.currency}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, currency: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="PKR">PKR - Pakistani Rupee</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Company timezone</Label>
                    <select 
                      value={companyForm.timezone ?? 'Asia/Karachi'}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, timezone: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="Asia/Karachi">Asia/Karachi</option>
                      <option value="UTC">UTC</option>
                      <option value="Asia/Dubai">Asia/Dubai</option>
                      <option value="Asia/Riyadh">Asia/Riyadh</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="America/New_York">America/New_York</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Date format</Label>
                    <select 
                      value={companyForm.dateFormat ?? 'DD/MM/YYYY'}
                      onChange={(e) => {
                        setCompanyForm({ ...companyForm, dateFormat: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* BRANCH MANAGEMENT TAB */}
            {contentKey === 'branches' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500/10 rounded-lg">
                      <MapPin className="text-green-500" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Branch Management</h3>
                      <p className="text-sm text-gray-400">Manage multiple business locations</p>
                    </div>
                  </div>
                  <Button 
                    className="bg-green-600 hover:bg-green-500 text-white gap-2"
                    onClick={() => {
                      setEditingBranchForModal(null);
                      setAddBranchModalOpen(true);
                    }}
                  >
                    <MapPin size={16} /> Add New Branch
                  </Button>
                </div>

                <div className="grid gap-4">
                  {settings.branches.map((branch) => (
                    <div key={branch.id} className="bg-gray-950 border border-gray-800 rounded-lg p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-white font-bold text-lg">{branch.branchName}</h4>
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                              {branch.branchCode}
                            </Badge>
                            {branch.isDefault && (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                Default
                              </Badge>
                            )}
                            {branch.isActive ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                            ) : (
                              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">{branch.address}</p>
                          <p className="text-xs text-gray-500 mt-1">{branch.phone}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-gray-400 hover:text-white"
                          onClick={() => handleEditBranch(branch)}
                        >
                          <Edit size={14} className="mr-1" /> Edit
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                        <div className="bg-gray-900 p-3 rounded-lg border border-gray-800">
                          <p className="text-xs text-gray-500 mb-1">Cash Account</p>
                          <p className="text-sm text-white font-medium">{branch.cashAccount}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded-lg border border-gray-800">
                          <p className="text-xs text-gray-500 mb-1">Bank Account</p>
                          <p className="text-sm text-white font-medium">{branch.bankAccount}</p>
                        </div>
                        <div className="bg-gray-900 p-3 rounded-lg border border-gray-800">
                          <p className="text-xs text-gray-500 mb-1">POS Drawer</p>
                          <p className="text-sm text-white font-medium">{branch.posCashDrawer}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* POS SETTINGS TAB */}
            {contentKey === 'pos' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <Store className="text-purple-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">POS Settings</h3>
                    <p className="text-sm text-gray-400">Configure point of sale behavior</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Cash Account</Label>
                    <Input
                      value={posForm.defaultCashAccount}
                      onChange={(e) => {
                        setPOSForm({ ...posForm, defaultCashAccount: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="Cash Drawer"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Invoice Prefix</Label>
                    <Input
                      value={posForm.invoicePrefix}
                      onChange={(e) => {
                        setPOSForm({ ...posForm, invoicePrefix: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="POS-"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Tax Rate (%)</Label>
                    <Input
                      type="number"
                      value={posForm.defaultTaxRate || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setPOSForm({ ...posForm, defaultTaxRate: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Max Discount (%)</Label>
                    <Input
                      type="number"
                      value={posForm.maxDiscountPercent || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setPOSForm({ ...posForm, maxDiscountPercent: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">POS Behavior</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Credit Sale Allowed</p>
                      <p className="text-sm text-gray-400">Allow sales on credit without payment</p>
                    </div>
                    <Switch
                      checked={posForm.creditSaleAllowed}
                      onCheckedChange={(val) => {
                        setPOSForm({ ...posForm, creditSaleAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Print Receipt</p>
                      <p className="text-sm text-gray-400">Automatically print after sale</p>
                    </div>
                    <Switch
                      checked={posForm.autoPrintReceipt}
                      onCheckedChange={(val) => {
                        setPOSForm({ ...posForm, autoPrintReceipt: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Negative Stock Allowed</p>
                      <p className="text-sm text-gray-400">Sell items with zero stock</p>
                    </div>
                    <Switch
                      checked={posForm.negativeStockAllowed}
                      onCheckedChange={(val) => {
                        setPOSForm({ ...posForm, negativeStockAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Allow Discount</p>
                      <p className="text-sm text-gray-400">Enable discount in POS</p>
                    </div>
                    <Switch
                      checked={posForm.allowDiscount}
                      onCheckedChange={(val) => {
                        setPOSForm({ ...posForm, allowDiscount: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SALES SETTINGS TAB */}
            {contentKey === 'sales' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <ShoppingCart className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Sales Settings</h3>
                    <p className="text-sm text-gray-400">Configure sales module behavior</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Invoice Prefix</Label>
                    <Input
                      value={salesForm.invoicePrefix}
                      onChange={(e) => {
                        setSalesForm({ ...salesForm, invoicePrefix: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="SAL-"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Payment Method</Label>
                    <select
                      value={salesForm.defaultPaymentMethod}
                      onChange={(e) => {
                        setSalesForm({ ...salesForm, defaultPaymentMethod: e.target.value as any });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="Mobile Wallet">Mobile Wallet</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Auto Due Days</Label>
                    <Input
                      type="number"
                      value={salesForm.autoDueDays || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setSalesForm({ ...salesForm, autoDueDays: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="7"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">Sales Behavior</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Partial Payment Allowed</p>
                      <p className="text-sm text-gray-400">Allow installment payments</p>
                    </div>
                    <Switch
                      checked={salesForm.partialPaymentAllowed}
                      onCheckedChange={(val) => {
                        setSalesForm({ ...salesForm, partialPaymentAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Ledger Entry</p>
                      <p className="text-sm text-gray-400">Auto-post to accounting</p>
                    </div>
                    <Switch
                      checked={salesForm.autoLedgerEntry}
                      onCheckedChange={(val) => {
                        setSalesForm({ ...salesForm, autoLedgerEntry: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Allow Credit Sale</p>
                      <p className="text-sm text-gray-400">Enable credit sales</p>
                    </div>
                    <Switch
                      checked={salesForm.allowCreditSale}
                      onCheckedChange={(val) => {
                        setSalesForm({ ...salesForm, allowCreditSale: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Require Customer Info</p>
                      <p className="text-sm text-gray-400">Make customer details mandatory</p>
                    </div>
                    <Switch
                      checked={salesForm.requireCustomerInfo}
                      onCheckedChange={(val) => {
                        setSalesForm({ ...salesForm, requireCustomerInfo: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>

                {isAdminOrOwner && (
                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Scissors size={16} className="text-violet-400" />
                      Bespoke / Custom Orders
                    </h4>
                    <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-violet-500/30">
                      <div>
                        <p className="text-white font-medium">Enable customization</p>
                        <p className="text-sm text-gray-400">
                          When ON, generic custom SKUs (CUSTOM-BRIDAL, etc.) appear in search and the Customize button is available. Stitching charges use Extra Expenses on the sale.
                        </p>
                      </div>
                      <Switch
                        checked={settings.businessSettings.enableBespokeOrders}
                        onCheckedChange={async (val) => {
                          try {
                            await settings.updateBusinessSettings({ enableBespokeOrders: val }, { silent: true });
                            toast.success(val ? 'Customization enabled' : 'Customization disabled');
                          } catch (e: unknown) {
                            const err = e as { code?: string; message?: string };
                            if (err?.code === 'MIGRATION_REQUIRED') {
                              toast.error(err.message || 'Database migration required for customization.');
                              return;
                            }
                            toast.error(err?.message || 'Failed to update');
                          }
                        }}
                      />
                    </div>

                    {settings.businessSettings.enableBespokeOrders && (
                      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-3">
                        <p className="text-sm text-gray-400">Choose which fields appear in the customization modal:</p>
                        {(
                          [
                            ['show_measurements', 'Measurements'],
                            ['show_fabric', 'Fabric details'],
                            ['show_color_code', 'Color / shade card code'],
                            ['show_image_upload', 'Reference image (URL or upload)'],
                            ['show_delivery_date', 'Expected delivery date'],
                          ] as const
                        ).map(([key, label]) => (
                          <div key={key} className="flex items-center justify-between">
                            <p className="text-white text-sm">{label}</p>
                            <Switch
                              checked={settings.businessSettings.bespokeFormConfig[key as keyof BespokeFormConfig]}
                              onCheckedChange={async (val) => {
                                try {
                                  await settings.updateBusinessSettings(
                                    { bespokeFormConfig: { [key]: val } },
                                    { silent: true },
                                  );
                                } catch (e: any) {
                                  toast.error(e?.message || 'Failed to update');
                                }
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PURCHASE SETTINGS TAB */}
            {contentKey === 'purchase' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <ShoppingBag className="text-orange-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Purchase Settings</h3>
                    <p className="text-sm text-gray-400">Configure purchase workflow</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Supplier Payable Account</Label>
                    <Input
                      value={purchaseForm.defaultSupplierPayableAccount}
                      onChange={(e) => {
                        setPurchaseForm({ ...purchaseForm, defaultSupplierPayableAccount: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="Accounts Payable"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Payment Terms (Days)</Label>
                    <Input
                      type="number"
                      value={purchaseForm.defaultPaymentTerms || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setPurchaseForm({ ...purchaseForm, defaultPaymentTerms: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="30"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">Purchase Workflow</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Over Receive Allowed</p>
                      <p className="text-sm text-gray-400">Receive more than ordered qty</p>
                    </div>
                    <Switch
                      checked={purchaseForm.overReceiveAllowed}
                      onCheckedChange={(val) => {
                        setPurchaseForm({ ...purchaseForm, overReceiveAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Approval Required</p>
                      <p className="text-sm text-gray-400">Manager approval before order</p>
                    </div>
                    <Switch
                      checked={purchaseForm.purchaseApprovalRequired}
                      onCheckedChange={(val) => {
                        setPurchaseForm({ ...purchaseForm, purchaseApprovalRequired: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">GRN Required</p>
                      <p className="text-sm text-gray-400">Goods Receipt Note mandatory</p>
                    </div>
                    <Switch
                      checked={purchaseForm.grnRequired}
                      onCheckedChange={(val) => {
                        setPurchaseForm({ ...purchaseForm, grnRequired: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Post to Inventory</p>
                      <p className="text-sm text-gray-400">Update stock automatically</p>
                    </div>
                    <Switch
                      checked={purchaseForm.autoPostToInventory}
                      onCheckedChange={(val) => {
                        setPurchaseForm({ ...purchaseForm, autoPostToInventory: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* INVENTORY SETTINGS TAB – General + Masters (Units, Categories, Sub-Categories, Brands) */}
            {contentKey === 'inventory' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-teal-500/10 rounded-lg">
                    <Package className="text-teal-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Inventory Settings</h3>
                    <p className="text-sm text-gray-400">Configure stock management and masters (Units, Categories, Brands, Variation attributes)</p>
                  </div>
                </div>

                <InventoryMasters
                  activeSubTab={navSubTabId as InventoryMasterTab}
                  onSubTabChange={(t) => {
                    const itemId = INVENTORY_SUB_TAB_TO_NAV_ITEM[t] ?? 'inventoryGeneral';
                    handleNavSelect('operations', itemId);
                  }}
                  generalContent={
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label className="text-gray-300 mb-2 block">Low Stock Threshold</Label>
                          <Input
                            type="number"
                            value={inventoryForm.lowStockThreshold || ''}
                            onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                            onChange={(e) => {
                              setInventoryForm({ ...inventoryForm, lowStockThreshold: Number(e.target.value) || 0 });
                              setHasUnsavedChanges(true);
                            }}
                            className="bg-gray-950 border-gray-700 text-white"
                            placeholder="10"
                          />
                        </div>

                        <div>
                          <Label className="text-gray-300 mb-2 block">Reorder Alert Days</Label>
                          <Input
                            type="number"
                            value={inventoryForm.reorderAlertDays || ''}
                            onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                            onChange={(e) => {
                              setInventoryForm({ ...inventoryForm, reorderAlertDays: Number(e.target.value) || 0 });
                              setHasUnsavedChanges(true);
                            }}
                            className="bg-gray-950 border-gray-700 text-white"
                            placeholder="30"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-gray-300 mb-2 block">Valuation Method</Label>
                          <select
                            value={inventoryForm.valuationMethod}
                            onChange={(e) => {
                              setInventoryForm({ ...inventoryForm, valuationMethod: e.target.value as any });
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                          >
                            <option value="FIFO">FIFO (First In First Out)</option>
                            <option value="LIFO">LIFO (Last In First Out)</option>
                            <option value="Weighted Average">Weighted Average</option>
                          </select>
                        </div>

                        <div className="col-span-2">
                          <Label className="text-gray-300 mb-2 block">Default Unit</Label>
                          <select
                            value={inventoryForm.defaultUnitId ?? ''}
                            onChange={(e) => {
                              setInventoryForm({ ...inventoryForm, defaultUnitId: e.target.value || null });
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                          >
                            <option value="">No default (select per product)</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}{u.short_code ? ` (${u.short_code})` : ''}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Used when creating products or when no unit is selected</p>
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-gray-800">
                        <h4 className="text-white font-semibold mb-3">Packing (Boxes / Pieces)</h4>
                        <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-amber-500/30">
                          <div>
                            <p className="text-white font-medium">Enable Packing (Boxes / Pieces)</p>
                            <p className="text-sm text-gray-400">When ON: packing columns and modal appear in Sale, Purchase, Inventory, Ledger, Print, and the mobile app. When OFF: system behaves as quantity-only.</p>
                          </div>
                          <Switch
                            checked={settings.inventorySettings.enablePacking}
                            onCheckedChange={async (val) => {
                              try {
                                await settings.updateInventorySettings({ enablePacking: val }, { silent: true });
                                await refreshEnablePacking?.();
                                toast.success(val ? 'Packing enabled' : 'Packing disabled');
                              } catch (e: any) {
                                toast.error(e?.message || 'Failed to update');
                              }
                            }}
                          />
                        </div>

                        <h4 className="text-white font-semibold mb-3 mt-6">Inventory Control</h4>

                        <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                          <div>
                            <p className="text-white font-medium">Negative Stock Allowed</p>
                            <p className="text-sm text-gray-400">Stock can go below zero</p>
                          </div>
                          <Switch
                            checked={inventoryForm.negativeStockAllowed}
                            onCheckedChange={async (val) => {
                              setInventoryForm((prev) => ({ ...prev, negativeStockAllowed: val }));
                              try {
                                await settings.updateInventorySettings({ negativeStockAllowed: val }, { silent: true });
                                toast.success(val ? 'Negative stock allowed' : 'Negative stock disabled');
                              } catch (e: any) {
                                toast.error(e?.message || 'Failed to update');
                                setInventoryForm((prev) => ({ ...prev, negativeStockAllowed: !val }));
                              }
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                          <div>
                            <p className="text-white font-medium">Auto Reorder Enabled</p>
                            <p className="text-sm text-gray-400">Auto-create purchase orders</p>
                          </div>
                          <Switch
                            checked={inventoryForm.autoReorderEnabled}
                            onCheckedChange={async (val) => {
                              setInventoryForm((prev) => ({ ...prev, autoReorderEnabled: val }));
                              try {
                                await settings.updateInventorySettings({ autoReorderEnabled: val }, { silent: true });
                                toast.success(val ? 'Auto reorder enabled' : 'Auto reorder disabled');
                              } catch (e: any) {
                                toast.error(e?.message || 'Failed to update');
                                setInventoryForm((prev) => ({ ...prev, autoReorderEnabled: !val }));
                              }
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                          <div>
                            <p className="text-white font-medium">Barcode Required</p>
                            <p className="text-sm text-gray-400">Mandatory for all products</p>
                          </div>
                          <Switch
                            checked={inventoryForm.barcodeRequired}
                            onCheckedChange={async (val) => {
                              setInventoryForm((prev) => ({ ...prev, barcodeRequired: val }));
                              try {
                                await settings.updateInventorySettings({ barcodeRequired: val }, { silent: true });
                                toast.success(val ? 'Barcode required' : 'Barcode optional');
                              } catch (e: any) {
                                toast.error(e?.message || 'Failed to update');
                                setInventoryForm((prev) => ({ ...prev, barcodeRequired: !val }));
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-gray-800">
                        <BarcodeLabelSettingsPanel
                          companyId={companyId}
                          companyName={companyForm.businessName}
                        />
                      </div>
                    </>
                  }
                />
              </div>
            )}

            {/* RENTAL SETTINGS TAB */}
            {contentKey === 'rental' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-pink-500/10 rounded-lg">
                    <Shirt className="text-pink-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Rental Settings</h3>
                    <p className="text-sm text-gray-400">Configure rental policies and fees</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Late Fee Per Day (Rs)</Label>
                    <Input
                      type="number"
                      value={rentalForm.defaultLateFeePerDay || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setRentalForm({ ...rentalForm, defaultLateFeePerDay: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="500"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Grace Period (Days)</Label>
                    <Input
                      type="number"
                      value={rentalForm.gracePeriodDays || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setRentalForm({ ...rentalForm, gracePeriodDays: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Advance Percentage (%)</Label>
                    <Input
                      type="number"
                      value={rentalForm.advancePercentage || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setRentalForm({ ...rentalForm, advancePercentage: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="50"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Security Deposit (Rs)</Label>
                    <Input
                      type="number"
                      value={rentalForm.securityDepositAmount || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setRentalForm({ ...rentalForm, securityDepositAmount: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="5000"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Dress Devaluation (Rs)</Label>
                    <Input
                      type="number"
                      value={defaultDressDevaluation || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setDefaultDressDevaluation(Math.max(0, Number(e.target.value) || 0));
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="5000"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">Rental Policies</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Advance Required</p>
                      <p className="text-sm text-gray-400">Require advance payment</p>
                    </div>
                    <Switch
                      checked={rentalForm.advanceRequired}
                      onCheckedChange={(val) => {
                        setRentalForm({ ...rentalForm, advanceRequired: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Security Deposit Required</p>
                      <p className="text-sm text-gray-400">Refundable security deposit</p>
                    </div>
                    <Switch
                      checked={rentalForm.securityDepositRequired}
                      onCheckedChange={(val) => {
                        setRentalForm({ ...rentalForm, securityDepositRequired: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Damage Charge Enabled</p>
                      <p className="text-sm text-gray-400">Charge for damaged items</p>
                    </div>
                    <Switch
                      checked={rentalForm.damageChargeEnabled}
                      onCheckedChange={(val) => {
                        setRentalForm({ ...rentalForm, damageChargeEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Extend Allowed</p>
                      <p className="text-sm text-gray-400">Allow rental extension</p>
                    </div>
                    <Switch
                      checked={rentalForm.autoExtendAllowed}
                      onCheckedChange={(val) => {
                        setRentalForm({ ...rentalForm, autoExtendAllowed: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNTING SETTINGS TAB */}
            {contentKey === 'accounting' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-yellow-500/10 rounded-lg">
                    <Calculator className="text-yellow-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Accounting Settings</h3>
                    <p className="text-sm text-gray-400">Configure fiscal year and policies</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Fiscal Year Start</Label>
                    <Input
                      type="date"
                      value={accountingForm.fiscalYearStart}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, fiscalYearStart: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Fiscal Year End</Label>
                    <Input
                      type="date"
                      value={accountingForm.fiscalYearEnd}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, fiscalYearEnd: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Currency</Label>
                    <Input
                      value={accountingForm.defaultCurrency}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, defaultCurrency: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="PKR"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block">Default Tax Rate (%)</Label>
                    <Input
                      type="number"
                      value={accountingForm.defaultTaxRate || ''}
                      onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, defaultTaxRate: Number(e.target.value) || 0 });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                      placeholder="0"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-gray-300 mb-2 block">Tax Calculation Method</Label>
                    <select
                      value={accountingForm.taxCalculationMethod}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, taxCalculationMethod: e.target.value as any });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="Inclusive">Tax Inclusive (Price includes tax)</option>
                      <option value="Exclusive">Tax Exclusive (Tax added on top)</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <Label className="text-gray-300 mb-2 block">Lock Accounting Date (Optional)</Label>
                    <Input
                      type="date"
                      value={accountingForm.lockAccountingDate || ''}
                      onChange={(e) => {
                        setAccountingForm({ ...accountingForm, lockAccountingDate: e.target.value });
                        setHasUnsavedChanges(true);
                      }}
                      className="bg-gray-950 border-gray-700 text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">No entries before this date</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-800">
                  <h4 className="text-white font-semibold mb-3">Accounting Policies</h4>
                  
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Manual Journal Enabled</p>
                      <p className="text-sm text-gray-400">Allow manual journal entries</p>
                    </div>
                    <Switch
                      checked={accountingForm.manualJournalEnabled}
                      onCheckedChange={(val) => {
                        setAccountingForm({ ...accountingForm, manualJournalEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Multi Currency Enabled</p>
                      <p className="text-sm text-gray-400">Enable multiple currencies</p>
                    </div>
                    <Switch
                      checked={accountingForm.multiCurrencyEnabled}
                      onCheckedChange={(val) => {
                        setAccountingForm({ ...accountingForm, multiCurrencyEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* DEFAULT ACCOUNTS TAB */}
            {contentKey === 'accounts' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <CreditCard className="text-green-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Default Payment Accounts</h3>
                    <p className="text-sm text-gray-400">Set default accounts for Cash, Bank, and Mobile Wallet payments</p>
                  </div>
                </div>

                <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-300">
                    💡 <strong>Tip:</strong> These accounts will be auto-selected in payment dialogs. You can still change them per transaction.
                  </p>
                </div>

                <div className="space-y-6">
                  {loadingPaymentAccounts ? (
                    <p className="text-sm text-gray-400">Payment accounts load ho rahe hain…</p>
                  ) : null}
                  <div>
                    <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Cash</Badge>
                      Default Cash Account
                    </Label>
                    <select 
                      value={accountsForm.paymentMethods.find(p => p.method === 'Cash')?.defaultAccount || ''}
                      onChange={(e) => {
                        const newMethods = accountsForm.paymentMethods.map(p => 
                          p.method === 'Cash' ? { ...p, defaultAccount: e.target.value } : p
                        );
                        setAccountsForm({ ...accountsForm, paymentMethods: newMethods });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">Select Cash Account</option>
                      {filterPaymentAccountsByMethod(paymentAccounts, 'Cash').map((acc) => (
                        <option key={acc.id ?? acc.name} value={acc.name}>
                          {formatPaymentAccountOptionLabel(acc)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Bank</Badge>
                      Default Bank Account
                    </Label>
                    <select 
                      value={accountsForm.paymentMethods.find(p => p.method === 'Bank')?.defaultAccount || ''}
                      onChange={(e) => {
                        const newMethods = accountsForm.paymentMethods.map(p => 
                          p.method === 'Bank' ? { ...p, defaultAccount: e.target.value } : p
                        );
                        setAccountsForm({ ...accountsForm, paymentMethods: newMethods });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">Select Bank Account</option>
                      {filterPaymentAccountsByMethod(paymentAccounts, 'Bank').map((acc) => (
                        <option key={acc.id ?? acc.name} value={acc.name}>
                          {formatPaymentAccountOptionLabel(acc)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Mobile</Badge>
                      Default Mobile Wallet Account
                    </Label>
                    <select 
                      value={accountsForm.paymentMethods.find(p => p.method === 'Mobile Wallet')?.defaultAccount || ''}
                      onChange={(e) => {
                        const newMethods = accountsForm.paymentMethods.map(p => 
                          p.method === 'Mobile Wallet' ? { ...p, defaultAccount: e.target.value } : p
                        );
                        setAccountsForm({ ...accountsForm, paymentMethods: newMethods });
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="">Select Mobile Wallet Account</option>
                      {filterPaymentAccountsByMethod(paymentAccounts, 'Mobile Wallet').map((acc) => (
                        <option key={acc.id ?? acc.name} value={acc.name}>
                          {formatPaymentAccountOptionLabel(acc)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* NUMBERING – Rules, Maintenance, Audit (Admin/Owner only) */}
            {contentKey === 'numbering' && (
              <NumberingPanel
                isAdminOrOwner={isAdminOrOwner}
                activeSubTab={(navSubTabId === 'rules' || navSubTabId === 'maintenance' || navSubTabId === 'audit' ? navSubTabId : 'rules') as NumberingInnerTab}
              />
            )}


            {/* PRINTER CONFIGURATION TAB */}
            {contentKey === 'printer' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-slate-500/10 rounded-lg">
                    <Printer className="text-slate-400" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Printer Configuration</h3>
                    <p className="text-sm text-gray-400">Receipt and invoice print settings (58mm / 80mm thermal, A4)</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Printer Mode</p>
                      <p className="text-sm text-gray-400">Thermal receipt or A4 invoice layout</p>
                    </div>
                    <select
                      value={printer.config.mode}
                      onChange={(e) => printer.setMode(e.target.value as 'thermal' | 'a4')}
                      className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                    >
                      <option value="a4">A4 (Standard)</option>
                      <option value="thermal">Thermal Receipt</option>
                    </select>
                  </div>

                  {printer.config.mode === 'thermal' && (
                    <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                      <div>
                        <p className="text-white font-medium">Paper Size</p>
                        <p className="text-sm text-gray-400">58mm or 80mm thermal roll</p>
                      </div>
                      <select
                        value={printer.config.paperSize}
                        onChange={(e) => printer.setPaperSize(e.target.value as '58mm' | '80mm')}
                        className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                      >
                        <option value="58mm">58mm</option>
                        <option value="80mm">80mm</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-white font-medium">Auto Print Receipt</p>
                      <p className="text-sm text-gray-400">Print receipt after POS sale</p>
                    </div>
                    <Switch
                      checked={printer.config.autoPrintReceipt}
                      onCheckedChange={(val) => printer.setAutoPrintReceipt(val)}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      onClick={() => {
                        window.print();
                        toast.success('Test print dialog opened');
                      }}
                    >
                      <Printer size={16} className="mr-2" />
                      Test Print
                    </Button>
                    <span className="text-sm text-gray-500">Opens browser print dialog</span>
                  </div>
                </div>
              </div>
            )}

            {/* PHASE B: INVOICE TEMPLATES TAB */}
            {/* Centralized Printing (Settings → Printing) */}
            {contentKey === 'printing' && (
              <PrintingSettingsPanel
                subTabId={navSubTabId}
                settings={printingSettings}
                loading={loadingPrinting}
                saving={savingPrinting}
                onSettingsChange={(partial) => setPrintingSettings((prev) => ({ ...(prev ?? {}), ...partial }))}
                onSave={savePrintingSettings}
              />
            )}

            {contentKey === 'invoiceTemplates' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-slate-500/10 rounded-lg">
                      <FileText className="text-slate-400" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Invoice Templates</h3>
                      <p className="text-sm text-gray-400">Control what appears on A4 and Thermal invoices (Print / PDF / Share)</p>
                    </div>
                  </div>
                  <Button
                    className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
                    disabled={savingInvoiceTemplates || loadingInvoiceTemplates}
                    onClick={async () => {
                      if (!companyId) return;
                      setSavingInvoiceTemplates(true);
                      try {
                        const a4Payload = {
                          show_sku: invoiceTemplateA4.show_sku ?? true,
                          show_discount: invoiceTemplateA4.show_discount ?? true,
                          show_tax: invoiceTemplateA4.show_tax ?? true,
                          show_studio: invoiceTemplateA4.show_studio ?? true,
                          show_signature: invoiceTemplateA4.show_signature ?? false,
                          logo_url: invoiceTemplateA4.logo_url || null,
                          footer_note: invoiceTemplateA4.footer_note || null,
                        };
                        const thermalPayload = {
                          show_sku: invoiceTemplateThermal.show_sku ?? true,
                          show_discount: invoiceTemplateThermal.show_discount ?? true,
                          show_tax: invoiceTemplateThermal.show_tax ?? true,
                          show_studio: invoiceTemplateThermal.show_studio ?? true,
                          show_signature: invoiceTemplateThermal.show_signature ?? false,
                          logo_url: invoiceTemplateThermal.logo_url || null,
                          footer_note: invoiceTemplateThermal.footer_note || null,
                        };
                        const [a4Err, thermalErr] = await Promise.all([
                          invoiceDocumentService.upsertTemplate(companyId, 'A4', a4Payload),
                          invoiceDocumentService.upsertTemplate(companyId, 'Thermal', thermalPayload),
                        ]);
                        if (a4Err.error || thermalErr.error) {
                          toast.error(a4Err.error || thermalErr.error || 'Failed to save');
                          return;
                        }
                        toast.success('Invoice template settings saved');
                      } catch (e) {
                        console.error('[SETTINGS] Error saving invoice templates:', e);
                        toast.error('Failed to save invoice template settings');
                      } finally {
                        setSavingInvoiceTemplates(false);
                      }
                    }}
                  >
                    {savingInvoiceTemplates ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    Save Invoice Templates
                  </Button>
                </div>

                {loadingInvoiceTemplates ? (
                  <div className="p-8 text-center text-gray-400">Loading template settings...</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* A4 template */}
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-4">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <FileText size={18} /> A4 Invoice
                      </h4>
                      <TemplateFormFields
                        template={invoiceTemplateA4}
                        onChange={setInvoiceTemplateA4}
                      />
                    </div>
                    {/* Thermal template */}
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-4">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Printer size={18} /> Thermal (58mm / 80mm)
                      </h4>
                      <TemplateFormFields
                        template={invoiceTemplateThermal}
                        onChange={setInvoiceTemplateThermal}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* USERS TAB (Access Control) */}
            {contentKey === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 rounded-lg">
                      <UserCog className="text-indigo-500" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Users</h3>
                      <p className="text-sm text-gray-400">Manage system users, roles, and branch access</p>
                    </div>
                  </div>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                    onClick={() => {
                      setEditingUser(null);
                      setAddUserModalOpen(true);
                    }}
                  >
                    <Users size={16} /> Add User
                  </Button>
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                  {loadingUsers ? (
                    <div className="p-8 text-center text-gray-400">Loading users...</div>
                  ) : users.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <Users size={48} className="mx-auto mb-4 text-gray-600" />
                      <p className="text-gray-400 mb-2">No users found</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setEditingUser(null);
                          setAddUserModalOpen(true);
                        }}
                        className="mt-2"
                      >
                        Create First User
                      </Button>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-900 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Branches</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-900/50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center",
                                  user.role === 'admin' && "bg-red-500/20",
                                  user.role === 'manager' && "bg-blue-500/20",
                                  user.role === 'salesman' && "bg-green-500/20",
                                  user.role === 'staff' && "bg-gray-500/20",
                                  "bg-gray-500/20"
                                )}>
                                  <span className={cn(
                                    "font-bold text-sm",
                                    user.role === 'admin' && "text-red-400",
                                    user.role === 'manager' && "text-blue-400",
                                    user.role === 'salesman' && "text-green-400",
                                    "text-gray-400"
                                  )}>
                                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-white font-medium">{user.full_name || 'No Name'}</p>
                                  {user.phone && (
                                    <p className="text-xs text-gray-500">{user.phone}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <Badge className={cn(
                                "text-xs",
                                user.role === 'admin' && "bg-red-500/20 text-red-400 border-red-500/30",
                                user.role === 'manager' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                                user.role === 'salesman' && "bg-green-500/20 text-green-400 border-green-500/30",
                                user.role === 'staff' && "bg-gray-500/20 text-gray-400 border-gray-500/30",
                                "bg-gray-500/20 text-gray-400 border-gray-500/30"
                              )}>
                                {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Staff'}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 text-gray-400 text-sm">
                              {(user as any).branch_names?.length ? (user as any).branch_names.join(', ') : '—'}
                            </td>
                            <td className="px-4 py-4 text-gray-400">{user.email}</td>
                            <td className="px-4 py-4 text-center">
                              <Badge className={cn(
                                "text-xs",
                                user.is_active 
                                  ? "bg-green-500/20 text-green-400 border-green-500/30" 
                                  : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                              )}>
                                {user.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingUser(user);
                                    setAddUserModalOpen(true);
                                  }}
                                  className="text-xs h-7 text-blue-400 hover:text-blue-300"
                                >
                                  <Edit size={14} className="mr-1" /> Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await userService.updateUser(user.id, { is_active: !user.is_active });
                                      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
                                      loadUsers();
                                    } catch (error: any) {
                                      toast.error(`Failed to update user: ${error.message}`);
                                    }
                                  }}
                                  className="text-xs h-7"
                                >
                                  {user.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ROLES & PERMISSIONS TAB (Access Control – merged ERP Permissions + Matrix) */}
            {contentKey === 'rolesPermissions' && (
              <div className="space-y-6">
                <ErpPermissionArchitecturePage />
              </div>
            )}

            {/* MODULE TOGGLES TAB */}
            {contentKey === 'modules' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-lime-500/10 rounded-lg">
                    <ToggleLeft className="text-lime-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Module Toggles</h3>
                    <p className="text-sm text-gray-400">Enable or disable system modules</p>
                  </div>
                </div>

                                <ModuleTogglesSection
                  value={modulesForm}
                  onChange={(patch) => {
                    setModulesForm({ ...modulesForm, ...patch });
                    setHasUnsavedChanges(true);
                  }}
                />

<div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-6">
                  <p className="text-sm text-blue-300">
                    ℹ️ <strong>Note:</strong> Disabling a module hides it from the sidebar and mobile app for <strong>all users and roles</strong> (Admin, Manager, Staff) in this business. Existing data is preserved. After saving, mobile users should log out and back in to refresh modules.
                  </p>
                </div>

                {/* Developer / Feature flags — developer role only (or VITE_ACCOUNTING_DIAGNOSTICS). */}
                {canAccessTechnicalDeveloperSettings(userRole) && (
                <div className="mt-8 pt-6 border-t border-gray-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-amber-500/10 rounded-lg">
                      <FlaskConical className="text-amber-500" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Developer</h3>
                      <p className="text-sm text-gray-400">Feature toggles – safe rollback by disabling</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Package size={20} className="text-amber-400" />
                      <div>
                        <p className="text-white font-medium">Studio Production V2</p>
                        <p className="text-sm text-gray-400">Advanced workflow (separate tables). Disable to use legacy production.</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.featureFlags?.studio_production_v2 === true}
                      onCheckedChange={(val) => {
                        settings.updateFeatureFlag('studio_production_v2', val);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-amber-400" />
                      <div>
                        <p className="text-white font-medium">Studio Customer Invoice</p>
                        <p className="text-sm text-gray-400">Generate customer sale invoice from completed production (V2). Requires Studio Production V2.</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.featureFlags?.studio_customer_invoice_v1 === true}
                      onCheckedChange={(val) => {
                        settings.updateFeatureFlag('studio_customer_invoice_v1', val);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Factory size={20} className="text-amber-400" />
                      <div>
                        <p className="text-white font-medium">Studio Production V3</p>
                        <p className="text-sm text-gray-400">New workflow: stages, cost breakdown, invoice panel, product/sale creation. When ON, shows V3 instead of V2.</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.featureFlags?.studio_production_v3 === true}
                      onCheckedChange={(val) => {
                        settings.updateFeatureFlag('studio_production_v3', val);
                      }}
                    />
                  </div>
                </div>
                )}
              </div>
            )}

            {/* LEAD TOOLS TAB */}
            {contentKey === 'leadTools' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <QrCode className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Lead Tools</h3>
                    <p className="text-sm text-gray-400">Generate QR codes and links for public contact registration</p>
                  </div>
                </div>
                <LeadTools />
              </div>
            )}

            {/* SYSTEM HEALTH TAB (Admin/Owner only) */}
            {contentKey === 'employees' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Briefcase className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Employee Payroll & Ledger</h3>
                    <p className="text-sm text-gray-400">Manage employees, salaries, and commissions</p>
                  </div>
                </div>
                <EmployeesTab />
              </div>
            )}

            {contentKey === 'systemHealth' && (
              <SystemHealthPanel />
            )}

            {/* DATA & BACKUP TAB */}
            {contentKey === 'data' && (
              <div className="relative space-y-6">
                {executingReset && (
                  <div
                    className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-lg bg-gray-950/85 backdrop-blur-[2px]"
                    aria-busy="true"
                    aria-live="polite"
                  >
                    <Loader2 className="h-8 w-8 animate-spin text-red-400" />
                    <p className="text-sm font-medium text-red-300">Resetting company data…</p>
                    <p className="text-xs text-gray-500">Please wait — do not use other controls on this tab</p>
                  </div>
                )}
                <div className={cn(executingReset && 'pointer-events-none select-none opacity-50')}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-emerald-500/10 rounded-lg">
                    <Download className="text-emerald-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Data & Backup</h3>
                    <p className="text-sm text-gray-400">Export company data for backup</p>
                  </div>
                </div>

                <div className="bg-gray-950 p-6 rounded-lg border border-emerald-800/40">
                  <h4 className="text-white font-medium mb-2">Backup &amp; selective restore (ZIP / CSV)</h4>
                  <p className="text-sm text-gray-400 mb-4">
                    Export a full A-to-Z package with inventory stock balances, or import selected entities
                    with dependency checks. Client-only — uses existing contact, product, and stock services.
                  </p>
                  <BackupRestoreWorkbench isOwner={isOwner} />
                </div>

                <div className="bg-gray-950 p-6 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Advanced: Company Backup (JSON)</h4>
                  <p className="text-sm text-gray-400 mb-4">
                    Owner-only export. Data is strictly filtered by active company_id and includes tenant-safe tables.
                  </p>
                  <Button
                    onClick={async () => {
                      if (!companyId) return;
                      if (!isOwner) {
                        toast.error('Backup export is restricted to Owner role.');
                        return;
                      }
                      const ok = await exportAndDownloadBackup(companyId);
                      if (ok) toast.success('Backup downloaded');
                    }}
                    disabled={!companyId || !isOwner}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                  >
                    <Download size={16} />
                    Export Backup
                  </Button>
                  {!isOwner && (
                    <p className="text-xs text-amber-400 mt-2">Only Owner can export company backup.</p>
                  )}
                </div>

                <div className="bg-gray-950 p-6 rounded-lg border border-amber-700/50">
                  <h4 className="text-white font-medium mb-2">Advanced: Full restore (JSON, Owner Only)</h4>
                  <p className="text-sm text-gray-400 mb-3">
                    Restore validates `meta.company_id`, clears current tenant data in FK-safe order, then imports backup data hierarchically.
                  </p>
                  <div className="space-y-3">
                    <Input
                      value={backupRestoreConfirmation}
                      onChange={(e) => setBackupRestoreConfirmation(e.target.value)}
                      placeholder="Type RESTORE to enable import"
                      className="bg-gray-900 border-gray-700 text-white"
                      disabled={!isOwner || backupRestoreLoading}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      disabled={!isOwner || backupRestoreLoading || backupRestoreConfirmation.trim().toUpperCase() !== 'RESTORE'}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        void handleRestoreBackupFile(file);
                      }}
                      className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-amber-600/20 file:text-amber-300 hover:file:bg-amber-600/30"
                    />
                    {!isOwner && (
                      <p className="text-xs text-amber-400">Only Owner can restore backup.</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-950 p-6 rounded-lg border border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="text-amber-500" size={20} />
                    <h4 className="text-white font-medium">Server Database Backup (Self-Hosted)</h4>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Supabase Studio mein &quot;Backup&quot; option sirf Cloud par hota hai. Self-hosted par full database backup aapke server (VPS) par run karo.
                  </p>
                  <p className="text-sm text-gray-300 mb-2 font-mono bg-gray-900 px-3 py-2 rounded border border-gray-700 break-all">
                    cd /root/NEWPOSV3 &amp;&amp; bash deploy/backup-supabase-db.sh 7
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Backups save: <code className="bg-gray-800 px-1 rounded">./backups/supabase_db_YYYYMMDD_HHMMSS.dump</code>. Last argument = retention (days). Daily cron: <code className="bg-gray-800 px-1 rounded">0 2 * * * cd /root/NEWPOSV3 &amp;&amp; bash deploy/backup-supabase-db.sh 14</code>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-2"
                    onClick={() => {
                      const cmd = 'cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 7';
                      navigator.clipboard.writeText(cmd).then(() => toast.success('Command copied'));
                    }}
                  >
                    <Copy size={14} />
                    Copy command
                  </Button>
                </div>

                <div className="bg-gray-950 p-6 rounded-lg border border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="text-blue-500" size={20} />
                    <h4 className="text-white font-medium">Clear cache & refresh</h4>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Agar purana data dikh raha ho (e.g. truncate ke baad), cache clear karke page refresh karo. Fresh data database se load hoga.
                  </p>
                  <Button
                    variant="outline"
                    className="border-blue-600 text-blue-400 hover:bg-blue-500/10 gap-2"
                    onClick={() => {
                      try {
                        localStorage.removeItem('erp_modules');
                        sessionStorage.clear();
                        toast.success('Cache cleared. Refreshing...');
                        setTimeout(() => window.location.reload(), 500);
                      } catch (e) {
                        toast.error('Failed to clear cache');
                      }
                    }}
                  >
                    <RefreshCw size={16} />
                    Clear cache & refresh
                  </Button>
                </div>

                {isAdminOrOwner && (
                <div className="relative bg-red-950/30 p-6 rounded-lg border border-red-800/60">
                  {resetBusy && (
                    <div
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-lg bg-gray-950/85 backdrop-blur-[2px]"
                      aria-busy="true"
                      aria-live="polite"
                    >
                      <Loader2 className="h-8 w-8 animate-spin text-red-400" />
                      <p className="text-sm font-medium text-red-300">
                        {executingReset ? 'Resetting company data…' : 'Loading reset preview…'}
                      </p>
                      <p className="text-xs text-gray-500">Please wait — do not change options</p>
                    </div>
                  )}
                  <div className={cn(resetBusy && 'pointer-events-none select-none opacity-50')}>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="text-red-400" size={20} />
                      <h4 className="text-white font-medium">Company Reset (Danger Zone)</h4>
                    </div>
                    <Button
                      variant="outline"
                      className="border-red-700 text-red-300 hover:bg-red-900/30"
                      disabled={!companyId || resetBusy}
                      onClick={loadResetPreview}
                    >
                      {loadingResetPreview ? 'Loading...' : 'Preview reset impact'}
                    </Button>
                  </div>

                  <p className="text-sm text-gray-400 mb-4">
                    Company shell, branches, ERP users, and settings are never deleted. Choose a reset mode, preview counts, then confirm.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {(
                      [
                        {
                          id: 'transactional' as CompanyResetMode,
                          title: 'Transaction reset',
                          desc: 'Same as before: wipe sales, purchases, GL, stock, studio, numbering. Keeps contacts, products, COA, workers.',
                        },
                        {
                          id: 'selective' as CompanyResetMode,
                          title: 'Custom selection',
                          desc: 'Pick which domains to delete. Master deletes require RESET ALL.',
                        },
                        {
                          id: 'complete' as CompanyResetMode,
                          title: 'Complete reset (A–Z)',
                          desc: 'Transactions + contacts + products + chart of accounts + workers. Keeps company, branches, users, settings. COA re-seeded after run.',
                        },
                      ] as const
                    ).map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        disabled={resetBusy}
                        onClick={() => handleResetModeChange(card.id)}
                        className={cn(
                          'text-left p-4 rounded-lg border transition-colors',
                          resetMode === card.id
                            ? 'border-red-500 bg-red-950/50'
                            : 'border-gray-800 bg-gray-900/50 hover:border-gray-600',
                          resetBusy && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        <p className="text-sm font-medium text-white mb-1">{card.title}</p>
                        <p className="text-xs text-gray-400 leading-relaxed">{card.desc}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2 mb-4 rounded-lg border border-gray-800 bg-gray-900/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Domains to delete</p>
                    {(
                      [
                        {
                          key: 'transactional' as const,
                          label: 'Transactional data',
                          hint: 'Sales, purchases, payments, expenses, journal, stock, studio, bespoke, document sequences',
                        },
                        {
                          key: 'contacts' as const,
                          label: 'Contacts',
                          hint: 'Customers, suppliers, and contact-linked workers',
                        },
                        {
                          key: 'products' as const,
                          label: 'Products & variations',
                          hint: 'Products, combos, variations, branch product links',
                        },
                        {
                          key: 'accounts' as const,
                          label: 'Chart of accounts (COA)',
                          hint: 'All company accounts; default COA re-seeded after reset if selected',
                        },
                        {
                          key: 'workers' as const,
                          label: 'Workers table',
                          hint: 'Worker master rows for this company',
                        },
                      ] as const
                    ).map((domain) => {
                      const locked =
                        resetMode === 'complete' ||
                        (resetMode === 'transactional' && domain.key !== 'transactional');
                      const checked = resetDomains[domain.key];
                      return (
                        <label
                          key={domain.key}
                          className={cn(
                            'flex items-start gap-3 rounded-md p-2',
                            locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-800/50'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            disabled={locked || resetBusy}
                            onChange={(e) => {
                              if (locked) return;
                              setResetDomains((prev) => ({
                                ...prev,
                                [domain.key]: e.target.checked,
                              }));
                              setResetConfirmation('');
                            }}
                          />
                          <span>
                            <span className="text-sm text-gray-200 block">{domain.label}</span>
                            <span className="text-xs text-gray-500">{domain.hint}</span>
                          </span>
                        </label>
                      );
                    })}
                    {resetMode === 'selective' &&
                    (resetDomains.contacts ||
                      resetDomains.products ||
                      resetDomains.accounts ||
                      resetDomains.workers) &&
                    !resetDomains.transactional ? (
                      <p className="text-xs text-amber-400 mt-2">
                        Master data deletes always run transactional cleanup first (enforced server-side).
                      </p>
                    ) : null}
                  </div>

                  {resetPreview?.success ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-gray-900/70 border border-emerald-900/40 rounded p-3">
                        <p className="text-xs uppercase tracking-wide text-emerald-600 mb-2">Preserved (shell)</p>
                        <p className="text-sm text-gray-200">Branches: {resetPreview.preserve?.branches ?? 0}</p>
                        <p className="text-sm text-gray-200">ERP users: {resetPreview.preserve?.users ?? 0}</p>
                        <p className="text-sm text-gray-200">Settings keys: {resetPreview.preserve?.settings_keys ?? 0}</p>
                        {(resetPreview.preserve?.contacts ?? 0) > 0 ||
                        (resetPreview.preserve?.products ?? 0) > 0 ||
                        (resetPreview.preserve?.accounts ?? 0) > 0 ? (
                          <>
                            <p className="text-xs text-gray-500 mt-2 mb-1">Master kept after reset</p>
                            {(resetPreview.preserve?.contacts ?? 0) > 0 ? (
                              <p className="text-sm text-gray-200">Contacts: {resetPreview.preserve?.contacts}</p>
                            ) : null}
                            {(resetPreview.preserve?.products ?? 0) > 0 ? (
                              <p className="text-sm text-gray-200">Products: {resetPreview.preserve?.products}</p>
                            ) : null}
                            {(resetPreview.preserve?.accounts ?? 0) > 0 ? (
                              <p className="text-sm text-gray-200">Accounts: {resetPreview.preserve?.accounts}</p>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                      <div className="bg-gray-900/70 border border-gray-800 rounded p-3 max-h-48 overflow-y-auto">
                        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Transactional (to delete)</p>
                        <p className="text-sm text-red-300 mb-2">
                          Total:{' '}
                          {Object.values(resetPreview.transactional || {}).reduce(
                            (sum, n) => sum + Number(n || 0),
                            0
                          )}
                        </p>
                        {Object.entries(resetPreview.transactional || {})
                          .filter(([, n]) => Number(n) > 0)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([key, n]) => (
                            <p key={key} className="text-xs text-gray-400">
                              {key.replace(/_/g, ' ')}: {n}
                            </p>
                          ))}
                      </div>
                      <div className="bg-gray-900/70 border border-gray-800 rounded p-3 max-h-48 overflow-y-auto">
                        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Master (to delete)</p>
                        <p className="text-sm text-red-300 mb-2">
                          Total:{' '}
                          {Object.values(resetPreview.master || {}).reduce(
                            (sum, n) => sum + Number(n || 0),
                            0
                          )}
                        </p>
                        {Object.keys(resetPreview.master || {}).length === 0 ? (
                          <p className="text-xs text-gray-500">No master domains selected</p>
                        ) : (
                          Object.entries(resetPreview.master || {})
                            .filter(([, n]) => Number(n) > 0)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([key, n]) => (
                              <p key={key} className="text-xs text-gray-400">
                                {key.replace(/_/g, ' ')}: {n}
                              </p>
                            ))
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label className="text-gray-300">
                      Confirmation — type exactly:{' '}
                      <span className="font-mono text-red-300">{resetConfirmPhrase}</span>
                    </Label>
                    <div className="flex flex-col md:flex-row gap-3 md:items-end">
                      <div className="flex flex-col gap-1.5 md:max-w-sm flex-1">
                        <Input
                          value={resetConfirmation}
                          onChange={(e) => setResetConfirmation(e.target.value)}
                          placeholder={resetConfirmPhrase}
                          aria-label={`Confirmation phrase: ${resetConfirmPhrase}`}
                          className="bg-gray-900 border-red-900/70 text-white font-mono"
                          autoComplete="off"
                          spellCheck={false}
                          disabled={resetBusy}
                        />
                        <p
                          className={cn(
                            'text-xs flex items-center gap-1.5',
                            resetPhraseMatches ? 'text-emerald-400' : 'text-gray-500'
                          )}
                        >
                          {resetPhraseMatches ? (
                            <>
                              <CheckCircle size={14} aria-hidden />
                              Phrase matches — reset button is enabled
                            </>
                          ) : (
                            <>
                              <AlertCircle size={14} aria-hidden />
                              Type <span className="font-mono text-gray-400">{resetConfirmPhrase}</span> to
                              enable the reset button
                            </>
                          )}
                        </p>
                      </div>
                      <Button
                        onClick={executeCompanyReset}
                        disabled={resetRunDisabled}
                        title={
                          resetRunDisabled && !executingReset
                            ? `Type ${resetConfirmPhrase} in the field above to enable`
                            : undefined
                        }
                        className="bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      >
                        {executingReset
                          ? 'Resetting...'
                          : resetMode === 'complete'
                            ? 'Run Complete Reset'
                            : resetMode === 'selective'
                              ? 'Run Selective Reset'
                              : 'Run Transaction Reset'}
                      </Button>
                    </div>
                  </div>
                  {resetConfirmPhrase === 'RESET ALL' ? (
                    <p className="text-xs text-amber-400 mt-1">
                      Complete / master reset uses <span className="font-mono">RESET ALL</span> (two words), not{' '}
                      <span className="font-mono">RESET</span>.
                    </p>
                  ) : null}
                  </div>
                </div>
                )}
                </div>
              </div>
            )}

            {contentKey === 'developerTools' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-violet-500/10 rounded-lg">
                    <FlaskConical className="text-violet-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Developer Tools</h3>
                    <p className="text-sm text-gray-400">Technical diagnostics aur feature flags</p>
                  </div>
                </div>
                <AppVersionTapTarget />
                <DeveloperToolsPanel />
              </div>
            )}

      </SettingsLayout>

      {/* Branch Edit Dialog */}
      <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Branch</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update branch information and settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300 mb-2 block">Branch Name *</Label>
                <Input
                  value={branchForm.branchName || ''}
                  onChange={(e) => setBranchForm({ ...branchForm, branchName: e.target.value })}
                  className="bg-gray-900 border-gray-700 text-white"
                  placeholder="Main Branch"
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">Branch Code *</Label>
                <Input
                  value={branchForm.branchCode || ''}
                  onChange={(e) => setBranchForm({ ...branchForm, branchCode: e.target.value })}
                  className="bg-gray-900 border-gray-700 text-white"
                  placeholder="MB-001"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Address</Label>
              <Textarea
                value={branchForm.address || ''}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                className="bg-gray-900 border-gray-700 text-white"
                placeholder="Branch address"
                rows={3}
              />
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Phone</Label>
              <Input
                value={branchForm.phone || ''}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                className="bg-gray-900 border-gray-700 text-white"
                placeholder="+92 300 1234567"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300 mb-2 block">Cash Account</Label>
                <Input
                  value={branchForm.cashAccount || ''}
                  onChange={(e) => setBranchForm({ ...branchForm, cashAccount: e.target.value })}
                  className="bg-gray-900 border-gray-700 text-white"
                  placeholder="Cash Account"
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">Bank Account</Label>
                <Input
                  value={branchForm.bankAccount || ''}
                  onChange={(e) => setBranchForm({ ...branchForm, bankAccount: e.target.value })}
                  className="bg-gray-900 border-gray-700 text-white"
                  placeholder="Bank Account"
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">POS Drawer</Label>
                <Input
                  value={branchForm.posCashDrawer || ''}
                  onChange={(e) => setBranchForm({ ...branchForm, posCashDrawer: e.target.value })}
                  className="bg-gray-900 border-gray-700 text-white"
                  placeholder="POS Drawer"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={branchForm.isActive ?? true}
                  onCheckedChange={(checked) => setBranchForm({ ...branchForm, isActive: checked })}
                />
                <Label className="text-gray-300">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={branchForm.isDefault ?? false}
                  onCheckedChange={(checked) => setBranchForm({ ...branchForm, isDefault: checked })}
                />
                <Label className="text-gray-300">Default Branch</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsBranchDialogOpen(false);
                setEditingBranch(null);
                setBranchForm({});
              }}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveBranch}
              className="bg-green-600 hover:bg-green-500 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Modal - Centered Dialog */}
      <AddUserModal
        open={addUserModalOpen}
        onClose={() => {
          setAddUserModalOpen(false);
          setEditingUser(null);
        }}
        onSuccess={() => {
          loadUsers();
        }}
        editingUser={editingUser}
      />

      {/* Add Branch Modal - Centered Dialog */}
      <AddBranchModal
        open={addBranchModalOpen}
        onClose={() => {
          setAddBranchModalOpen(false);
          setEditingBranchForModal(null);
        }}
        onSuccess={() => {
          loadBranches();
        }}
        editingBranch={editingBranchForModal}
      />
    </>
  );
};
