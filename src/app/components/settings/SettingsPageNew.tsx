import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, CreditCard, Hash, ToggleLeft, Save, 
  CheckCircle, Users, Lock, Key, Settings as SettingsIcon, AlertCircle, UserCog,
  MapPin, Store, ShoppingCart, ShoppingBag, Package, Shirt, Calculator, X, Edit, Download, Server, Copy, Printer, RefreshCw, QrCode, FileText, Activity, Shield
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { cn } from "../ui/utils";
import { useSettings, BranchSettings } from '@/app/context/SettingsContext';
import { usePrinterConfig } from '@/app/hooks/usePrinterConfig';
import { branchService } from '@/app/services/branchService';
import { accountService } from '@/app/services/accountService';
import { unitService } from '@/app/services/unitService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { userService, User as UserType } from '@/app/services/userService';
import { useAccounting } from '@/app/context/AccountingContext';
import { toast } from 'sonner';
import { AddUserModal } from '../users/AddUserModal';
import { AddBranchModal } from '../branches/AddBranchModal';
import { exportAndDownloadBackup } from '@/app/services/backupService';
import { InventoryMasters, type InventoryMasterTab } from './inventory/InventoryMasters';
import { LeadTools } from './LeadTools';
import { invoiceDocumentService } from '@/app/services/invoiceDocumentService';
import type { InvoiceTemplate } from '@/app/types/invoiceDocument';
import { getHealthDashboard, type ErpHealthRow } from '@/app/services/healthService';
import { PermissionManagementPanel } from './PermissionManagementPanel';
import { UserPermissionsTab } from './UserPermissionsTab';
import { useFeatureFlagOptional } from '@/app/context/FeatureFlagContext';

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
        <Label className="text-gray-300">Logo URL</Label>
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

  const statusColor = (status: string) => {
    if (status === 'OK') return 'text-green-400 bg-green-500/10';
    if (status === 'FAIL') return 'text-red-400 bg-red-500/10';
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
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-700 rounded-lg border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="text-left text-gray-300 font-medium p-3 border-b border-gray-700">Component</th>
              <th className="text-left text-gray-300 font-medium p-3 border-b border-gray-700">Status</th>
              <th className="text-left text-gray-300 font-medium p-3 border-b border-gray-700">Details</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r, i) => (
              <tr key={i} className="border-b border-gray-800">
                <td className="p-3 text-white">{r.component}</td>
                <td className="p-3">
                  <span className={cn('inline-block px-2 py-0.5 rounded text-sm font-medium', statusColor(r.status))}>
                    {r.status}
                  </span>
                </td>
                <td className="p-3 text-gray-400">{r.details ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

type SettingsTab =
  | 'company'
  | 'branches'
  | 'pos'
  | 'sales'
  | 'purchase'
  | 'inventory'
  | 'rental'
  | 'accounting'
  | 'accounts'
  | 'numbering'
  | 'printer'
  | 'invoiceTemplates'
  | 'users'
  | 'modules'
  | 'leadTools'
  | 'permissions'
  | 'userPermissions'
  | 'systemHealth'
  | 'data';

export const SettingsPageNew = () => {
  const settings = useSettings();
  const printer = usePrinterConfig();
  const { permissionV2 } = useFeatureFlagOptional();
  const { companyId, refreshEnablePacking, userRole } = useSupabase();
  const isAdminOrOwner = (() => {
    if (!userRole) return false;
    const r = userRole.toLowerCase().trim();
    return r === 'admin' || r === 'owner' || r === 'super admin' || r === 'superadmin';
  })();
  const accounting = useAccounting();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
  const [accountingForm, setAccountingForm] = useState(settings.accountingSettings);
  const [accountsForm, setAccountsForm] = useState(settings.defaultAccounts);
  const [numberingForm, setNumberingForm] = useState(settings.numberingRules);
  const [modulesForm, setModulesForm] = useState(settings.modules);
  const [inventorySubTab, setInventorySubTab] = useState<InventoryMasterTab>('general');
  const [units, setUnits] = useState<{ id: string; name: string; short_code?: string }[]>([]);

  // Phase B: Invoice template settings (A4 & Thermal)
  const [invoiceTemplateA4, setInvoiceTemplateA4] = useState<Partial<InvoiceTemplate>>({
    show_sku: true, show_discount: true, show_tax: true, show_studio: true, show_signature: false, logo_url: null, footer_note: null,
  });
  const [invoiceTemplateThermal, setInvoiceTemplateThermal] = useState<Partial<InvoiceTemplate>>({
    show_sku: true, show_discount: true, show_tax: true, show_studio: true, show_signature: false, logo_url: null, footer_note: null,
  });
  const [loadingInvoiceTemplates, setLoadingInvoiceTemplates] = useState(false);
  const [savingInvoiceTemplates, setSavingInvoiceTemplates] = useState(false);

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
    if (activeTab === 'inventory') setInventoryForm(settings.inventorySettings);
  }, [activeTab]);
  useEffect(() => {
    if (activeTab === 'company') setCompanyForm(settings.company);
  }, [activeTab, settings.company]);

  // Load users when users tab is active
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
    if (activeTab === 'invoiceTemplates') {
      loadInvoiceTemplates();
    }
  }, [activeTab, loadUsers, loadInvoiceTemplates]);

  // Load branches when branches tab is active
  useEffect(() => {
    if (activeTab === 'branches') {
      loadBranches();
    }
  }, [activeTab, loadBranches]);

  // When Permission V2 is turned off and we're on User Permissions tab, switch to Permission Management
  useEffect(() => {
    if (!permissionV2 && activeTab === 'userPermissions') {
      setActiveTab('permissions');
    }
  }, [permissionV2, activeTab]);

  // Load units when inventory tab is active (for Default Unit dropdown)
  useEffect(() => {
    if (activeTab === 'inventory' && companyId) {
      unitService.getAll(companyId, { includeInactive: false }).then((list) => {
        setUnits(list || []);
      }).catch(() => setUnits([]));
    }
  }, [activeTab, companyId]);

  // 🔧 FIX: Auto-select default core accounts if not already set
  // This runs when accounts tab is opened and accounts are loaded
  useEffect(() => {
    if (activeTab === 'accounts' && accounting.accounts.length > 0) {
      setAccountsForm(prev => {
        // Check if any default account needs to be auto-selected
        const cashMethod = prev.paymentMethods.find(p => p.method === 'Cash');
        const bankMethod = prev.paymentMethods.find(p => p.method === 'Bank');
        const walletMethod = prev.paymentMethods.find(p => p.method === 'Mobile Wallet');
        
        // Only update if at least one account is missing
        const needsUpdate = 
          (!cashMethod?.defaultAccount || cashMethod.defaultAccount === '') ||
          (!bankMethod?.defaultAccount || bankMethod.defaultAccount === '') ||
          (!walletMethod?.defaultAccount || walletMethod.defaultAccount === '');
        
        if (!needsUpdate) {
          return prev; // No update needed
        }
        
        const updatedMethods = prev.paymentMethods.map(p => {
          // Auto-select Cash account (code 1000) if not set
          if (p.method === 'Cash' && (!p.defaultAccount || p.defaultAccount === '')) {
            const cashAccount = accounting.accounts.find(acc => 
              acc.code === '1000' || 
              (acc.type === 'Cash' && acc.isActive)
            );
            if (cashAccount) {
              return { ...p, defaultAccount: cashAccount.name };
            }
          }
          
          // Auto-select Bank account (code 1010) if not set
          if (p.method === 'Bank' && (!p.defaultAccount || p.defaultAccount === '')) {
            const bankAccount = accounting.accounts.find(acc => 
              acc.code === '1010' || 
              (acc.type === 'Bank' && acc.isActive)
            );
            if (bankAccount) {
              return { ...p, defaultAccount: bankAccount.name };
            }
          }
          
          // Auto-select Mobile Wallet account (code 1020) if not set
          if (p.method === 'Mobile Wallet' && (!p.defaultAccount || p.defaultAccount === '')) {
            const walletAccount = accounting.accounts.find(acc => 
              acc.code === '1020' || 
              (acc.type === 'Mobile Wallet' && acc.isActive)
            );
            if (walletAccount) {
              return { ...p, defaultAccount: walletAccount.name };
            }
          }
          
          return p;
        });
        
        return { ...prev, paymentMethods: updatedMethods };
      });
    }
  }, [activeTab, accounting.accounts.length]); // Only depend on accounts length to avoid infinite loops

  // Listen for userCreated event - Real-time update
  useEffect(() => {
    const handleUserCreated = () => {
      if (activeTab === 'users') {
        loadUsers();
      }
    };
    
    window.addEventListener('userCreated', handleUserCreated);
    return () => {
      window.removeEventListener('userCreated', handleUserCreated);
    };
  }, [activeTab, loadUsers]);

  // Handle branch edit (using new modal) – pass default account IDs so modal can prefill
  const handleEditBranch = (branch: BranchSettings) => {
    const branchForModal = {
      id: branch.id,
      company_id: companyId || '',
      name: branch.branchName,
      code: branch.branchCode,
      phone: branch.phone,
      address: branch.address,
      city: undefined,
      state: undefined,
      is_active: branch.isActive ?? true,
      default_cash_account_id: branch.cashAccountId || null,
      default_bank_account_id: branch.bankAccountId || null,
      default_pos_drawer_account_id: branch.posCashDrawerId || null,
    };
    setEditingBranchForModal(branchForModal);
    setAddBranchModalOpen(true);
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
      const branchUpdates = {
        name: branchForm.branchName,
        code: branchForm.branchCode,
        address: branchForm.address || null,
        phone: branchForm.phone || null,
        is_active: branchForm.isActive ?? true,
        is_default: branchForm.isDefault ?? false,
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
      switch(activeTab) {
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
          break;
        case 'accounting':
          await settings.updateAccountingSettings(accountingForm);
          break;
        case 'accounts':
          await settings.updateDefaultAccounts(accountsForm);
          break;
        case 'numbering':
          await settings.updateNumberingRules(numberingForm);
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

  const tabs = [
    { id: 'company' as const, label: 'Company Info', icon: Building2 },
    { id: 'branches' as const, label: 'Branch Management', icon: MapPin },
    { id: 'pos' as const, label: 'POS Settings', icon: Store },
    { id: 'sales' as const, label: 'Sales Settings', icon: ShoppingCart },
    { id: 'purchase' as const, label: 'Purchase Settings', icon: ShoppingBag },
    { id: 'inventory' as const, label: 'Inventory Settings', icon: Package },
    { id: 'rental' as const, label: 'Rental Settings', icon: Shirt },
    { id: 'accounting' as const, label: 'Accounting Settings', icon: Calculator },
    { id: 'accounts' as const, label: 'Default Accounts', icon: CreditCard },
    { id: 'numbering' as const, label: 'Numbering Rules', icon: Hash },
    { id: 'printer' as const, label: 'Printer Configuration', icon: Printer },
    { id: 'invoiceTemplates' as const, label: 'Invoice Templates', icon: FileText },
    { id: 'users' as const, label: 'User Management', icon: UserCog },
    ...(isAdminOrOwner ? [{ id: 'permissions' as const, label: 'Permission Management', icon: Shield }] : []),
    ...(permissionV2 ? [{ id: 'userPermissions' as const, label: 'User Permissions', icon: Users }] : []),
    { id: 'modules' as const, label: 'Module Toggles', icon: ToggleLeft },
    { id: 'leadTools' as const, label: 'Lead Tools', icon: QrCode },
    ...(isAdminOrOwner ? [{ id: 'systemHealth' as const, label: 'System Health', icon: Activity }] : []),
    { id: 'data' as const, label: 'Data & Backup', icon: Download },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <SettingsIcon size={32} className="text-blue-500" />
            System Settings
          </h2>
          <p className="text-gray-400 mt-1">Configure your ERP system defaults and preferences.</p>
        </div>
        
        {hasUnsavedChanges && (
          <Button 
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-500 text-white gap-2 shadow-lg"
          >
            <Save size={16} /> Save Changes
          </Button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Sidebar Navigation */}
        <div className="col-span-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <tab.icon size={18} />
              <span className="font-medium text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="col-span-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8">
            
            {/* COMPANY INFO TAB */}
            {activeTab === 'company' && (
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

                <div className="grid grid-cols-2 gap-6">
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
                </div>
              </div>
            )}

            {/* BRANCH MANAGEMENT TAB */}
            {activeTab === 'branches' && (
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

                      <div className="grid grid-cols-3 gap-3 mt-4">
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
            {activeTab === 'pos' && (
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

                <div className="grid grid-cols-2 gap-6">
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
            {activeTab === 'sales' && (
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

                <div className="grid grid-cols-2 gap-6">
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
              </div>
            )}

            {/* PURCHASE SETTINGS TAB */}
            {activeTab === 'purchase' && (
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

                <div className="grid grid-cols-2 gap-6">
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
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-teal-500/10 rounded-lg">
                    <Package className="text-teal-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Inventory Settings</h3>
                    <p className="text-sm text-gray-400">Configure stock management and masters (Units, Categories, Sub-Categories, Brands)</p>
                  </div>
                </div>

                <InventoryMasters
                  activeSubTab={inventorySubTab}
                  onSubTabChange={setInventorySubTab}
                  generalContent={
                    <>
                      <div className="grid grid-cols-2 gap-6">
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
                            <p className="text-sm text-gray-400">When ON: packing columns and modal appear in Sale, Purchase, Inventory, Ledger & Print. When OFF: system behaves as quantity-only.</p>
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
                    </>
                  }
                />
              </div>
            )}

            {/* RENTAL SETTINGS TAB */}
            {activeTab === 'rental' && (
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

                <div className="grid grid-cols-2 gap-6">
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
            {activeTab === 'accounting' && (
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

                <div className="grid grid-cols-2 gap-6">
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
            {activeTab === 'accounts' && (
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
                      {accounting.accounts
                        .filter(acc => acc.type === 'Cash' && acc.isActive)
                        .map(acc => (
                          <option key={acc.id} value={acc.name}>
                            {acc.name} {acc.code ? `(${acc.code})` : ''} • Balance: Rs {acc.balance.toLocaleString()}
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
                      {accounting.accounts
                        .filter(acc => acc.type === 'Bank' && acc.isActive)
                        .map(acc => (
                          <option key={acc.id} value={acc.name}>
                            {acc.name} {acc.code ? `(${acc.code})` : ''} • Balance: Rs {acc.balance.toLocaleString()}
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
                      {accounting.accounts
                        .filter(acc => acc.type === 'Mobile Wallet' && acc.isActive)
                        .map(acc => (
                          <option key={acc.id} value={acc.name}>
                            {acc.name} {acc.code ? `(${acc.code})` : ''} • Balance: Rs {acc.balance.toLocaleString()}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* NUMBERING RULES TAB */}
            {activeTab === 'numbering' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-cyan-500/10 rounded-lg">
                    <Hash className="text-cyan-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Numbering Rules</h3>
                    <p className="text-sm text-gray-400">Configure auto-increment patterns for all modules</p>
                  </div>
                </div>

                <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-amber-300">
                    ⚠️ <strong>Warning:</strong> Changing numbering rules will only affect new entries. Existing records remain unchanged.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Sales */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingCart size={18} className="text-blue-400" />
                      <h4 className="text-white font-semibold">Sales Invoice</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.salePrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, salePrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="SAL-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.saleNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, saleNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.salePrefix}{String(numberingForm.saleNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* Purchases – PUR */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingBag size={18} className="text-orange-400" />
                      <h4 className="text-white font-semibold">Purchase (PUR)</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.purchasePrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, purchasePrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="PUR-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.purchaseNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, purchaseNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.purchasePrefix}{String(numberingForm.purchaseNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* Rentals */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Shirt size={18} className="text-pink-400" />
                      <h4 className="text-white font-semibold">Rental Booking</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.rentalPrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, rentalPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="RNT-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.rentalNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, rentalNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.rentalPrefix}{String(numberingForm.rentalNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* POS */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Store size={18} className="text-purple-400" />
                      <h4 className="text-white font-semibold">POS Invoice</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.posPrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, posPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="POS-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.posNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, posNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.posPrefix}{String(numberingForm.posNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* Expenses */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard size={18} className="text-red-400" />
                      <h4 className="text-white font-semibold">Expense Entry</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.expensePrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, expensePrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="EXP-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.expenseNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, expenseNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.expensePrefix}{String(numberingForm.expenseNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* Products */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Package size={18} className="text-teal-400" />
                      <h4 className="text-white font-semibold">Product SKU</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.productPrefix}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, productPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="PRD-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.productNextNumber || ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, productNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {numberingForm.productPrefix}{String(numberingForm.productNextNumber).padStart(4, '0')}</p>
                  </div>

                  {/* Studio Sale – STD */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Package size={18} className="text-amber-400" />
                      <h4 className="text-white font-semibold">Studio Sale (STD)</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.studioPrefix ?? 'STD-'}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, studioPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="STD-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.studioNextNumber ?? ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, studioNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {(numberingForm.studioPrefix || 'STD-')}{String(numberingForm.studioNextNumber ?? 1).padStart(4, '0')}</p>
                  </div>

                  {/* Payment – PAY */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard size={18} className="text-emerald-400" />
                      <h4 className="text-white font-semibold">Payment (PAY)</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.paymentPrefix ?? 'PAY-'}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, paymentPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="PAY-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.paymentNextNumber ?? ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, paymentNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {(numberingForm.paymentPrefix || 'PAY-')}{String(numberingForm.paymentNextNumber ?? 1).padStart(4, '0')}</p>
                  </div>

                  {/* Job (Worker) – JOB */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Package size={18} className="text-sky-400" />
                      <h4 className="text-white font-semibold">Job / Worker (JOB)</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.jobPrefix ?? 'JOB-'}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, jobPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="JOB-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.jobNextNumber ?? ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, jobNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {(numberingForm.jobPrefix || 'JOB-')}{String(numberingForm.jobNextNumber ?? 1).padStart(4, '0')}</p>
                  </div>

                  {/* Journal – JV */}
                  <div className="bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard size={18} className="text-violet-400" />
                      <h4 className="text-white font-semibold">Journal (JV)</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Prefix</Label>
                        <Input 
                          value={numberingForm.journalPrefix ?? 'JV-'}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, journalPrefix: e.target.value });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                          placeholder="JV-"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400 text-xs mb-1 block">Next #</Label>
                        <Input 
                          type="number"
                          value={numberingForm.journalNextNumber ?? ''}
                          onFocus={(e) => e.target.value === '0' && (e.target.value = '')}
                          onChange={(e) => {
                            setNumberingForm({ ...numberingForm, journalNextNumber: Number(e.target.value) || 0 });
                            setHasUnsavedChanges(true);
                          }}
                          className="bg-gray-900 border-gray-700 text-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Preview: {(numberingForm.journalPrefix || 'JV-')}{String(numberingForm.journalNextNumber ?? 1).padStart(4, '0')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* PRINTER CONFIGURATION TAB */}
            {activeTab === 'printer' && (
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
            {activeTab === 'invoiceTemplates' && (
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

            {/* USER MANAGEMENT TAB */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 rounded-lg">
                      <UserCog className="text-indigo-500" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">User Management</h3>
                      <p className="text-sm text-gray-400">Manage system users and access</p>
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
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Code</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-900/50 transition-colors">
                            {/* User Code */}
                            <td className="px-4 py-4">
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 font-mono text-xs">
                                {user.code || user.user_code || '—'}
                              </Badge>
                            </td>
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
                            <td className="px-4 py-4 text-gray-400">{user.email}</td>
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


            {/* PERMISSION MANAGEMENT TAB (Admin/Owner only) */}
            {activeTab === 'permissions' && (
              <PermissionManagementPanel />
            )}

            {/* USER PERMISSIONS TAB (V2 – roles, matrix, branch access) */}
            {activeTab === 'userPermissions' && (
              <UserPermissionsTab />
            )}

            {/* MODULE TOGGLES TAB */}
            {activeTab === 'modules' && (
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Store size={20} className="text-purple-400" />
                      <div>
                        <p className="text-white font-medium text-lg">POS Module</p>
                        <p className="text-sm text-gray-400">Point of Sale system for quick sales</p>
                      </div>
                    </div>
                    <Switch
                      checked={modulesForm.posModuleEnabled}
                      onCheckedChange={(val) => {
                        setModulesForm({ ...modulesForm, posModuleEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Shirt size={20} className="text-pink-400" />
                      <div>
                        <p className="text-white font-medium text-lg">Rental Module</p>
                        <p className="text-sm text-gray-400">Dress rental management and tracking</p>
                      </div>
                    </div>
                    <Switch
                      checked={modulesForm.rentalModuleEnabled}
                      onCheckedChange={(val) => {
                        setModulesForm({ ...modulesForm, rentalModuleEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Users size={20} className="text-blue-400" />
                      <div>
                        <p className="text-white font-medium text-lg">Studio Module</p>
                        <p className="text-sm text-gray-400">Suit stitching and worker management</p>
                      </div>
                    </div>
                    <Switch
                      checked={modulesForm.studioModuleEnabled}
                      onCheckedChange={(val) => {
                        setModulesForm({ ...modulesForm, studioModuleEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-gray-950 p-5 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-3">
                      <Calculator size={20} className="text-yellow-400" />
                      <div>
                        <p className="text-white font-medium text-lg">Accounting Module</p>
                        <p className="text-sm text-gray-400">Double-entry accounting system</p>
                      </div>
                    </div>
                    <Switch
                      checked={modulesForm.accountingModuleEnabled}
                      onCheckedChange={(val) => {
                        setModulesForm({ ...modulesForm, accountingModuleEnabled: val });
                        setHasUnsavedChanges(true);
                      }}
                    />
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-6">
                  <p className="text-sm text-blue-300">
                    ℹ️ <strong>Note:</strong> Disabling a module will hide it from the sidebar. Existing data will be preserved.
                  </p>
                </div>
              </div>
            )}

            {/* LEAD TOOLS TAB */}
            {activeTab === 'leadTools' && (
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
            {activeTab === 'systemHealth' && (
              <SystemHealthPanel />
            )}

            {/* DATA & BACKUP TAB */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-emerald-500/10 rounded-lg">
                    <Download className="text-emerald-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Data & Backup</h3>
                    <p className="text-sm text-gray-400">Export company data for backup</p>
                  </div>
                </div>

                <div className="bg-gray-950 p-6 rounded-lg border border-gray-800">
                  <h4 className="text-white font-medium mb-2">Company Backup (JSON)</h4>
                  <p className="text-sm text-gray-400 mb-4">
                    Export contacts, products, sales, purchases, expenses, and branches as a single JSON file.
                  </p>
                  <Button
                    onClick={async () => {
                      if (!companyId) return;
                      const ok = await exportAndDownloadBackup(companyId);
                      if (ok) toast.success('Backup downloaded');
                    }}
                    disabled={!companyId}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                  >
                    <Download size={16} />
                    Export Backup
                  </Button>
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
              </div>
            )}

          </div>
        </div>
      </div>

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
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-3 gap-4">
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
    </div>
  );
};
