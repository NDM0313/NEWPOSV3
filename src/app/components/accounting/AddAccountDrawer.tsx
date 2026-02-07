import React, { useState, useEffect } from 'react';
import { X, Landmark, Wallet, Smartphone, Receipt, ArrowDownCircle, ArrowUpCircle, Building2 } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { accountService } from '@/app/services/accountService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';

// Operational: only these roles; category is derived, no parent, no equity/fixed assets
const OPERATIONAL_ROLES = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'bank', label: 'Bank', icon: Landmark },
  { value: 'mobile_wallet', label: 'Mobile Wallet', icon: Smartphone },
  { value: 'expense', label: 'Expense', icon: ArrowUpCircle },
  { value: 'income', label: 'Income', icon: ArrowDownCircle },
  { value: 'receivable', label: 'Receivable', icon: Receipt },
  { value: 'payable', label: 'Payable', icon: Building2 },
] as const;

// Reserved codes for default cash/bank/wallet (one per company)
const RESERVED_CODES: Record<string, string> = {
  cash: '1000',
  bank: '1010',
  mobile_wallet: '1020',
};

// Professional: full CoA categories
const PROFESSIONAL_CATEGORIES = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
] as const;

type OperationalRole = typeof OPERATIONAL_ROLES[number]['value'];
type ProfessionalCategory = typeof PROFESSIONAL_CATEGORIES[number]['value'];

interface AddAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddAccountDrawer = ({ isOpen, onClose, onSuccess }: AddAccountDrawerProps) => {
  const { companyId } = useSupabase();
  const [activeTab, setActiveTab] = useState<'operational' | 'professional'>('operational');
  const [existingAccounts, setExistingAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Shared fields
  const [accountName, setAccountName] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [notes, setNotes] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Operational only
  const [operationalRole, setOperationalRole] = useState<OperationalRole>('bank');

  // Professional only
  const [professionalCategory, setProfessionalCategory] = useState<ProfessionalCategory>('asset');
  const [parentId, setParentId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && companyId) {
      setLoadingAccounts(true);
      accountService.getAllAccounts(companyId).then((data) => {
        setExistingAccounts(data || []);
        setLoadingAccounts(false);
      }).catch(() => setLoadingAccounts(false));
    }
  }, [isOpen, companyId]);

  const getReservedCodeForRole = (role: OperationalRole): string | null =>
    RESERVED_CODES[role] ?? null;

  const isReservedCodeTaken = (role: OperationalRole, code: string): boolean => {
    const reserved = getReservedCodeForRole(role);
    if (!reserved) return false;
    return existingAccounts.some((a) => (a.code || '').trim() === reserved);
  };

  /** For Operational tab: get code to use (reserved if free, else next e.g. 1001, 1011). */
  const getOperationalCode = (): string | undefined => {
    const reserved = getReservedCodeForRole(operationalRole);
    const prefix = reserved ? reserved.slice(0, 3) : '';
    const codes = existingAccounts.map((a) => (a.code || '').trim()).filter(Boolean);
    if (reserved && !codes.includes(reserved)) return reserved;
    if (prefix) {
      let n = reserved ? parseInt(reserved.slice(3), 10) : 0;
      while (codes.includes(prefix + n)) n += 1;
      return prefix + n;
    }
    return undefined;
  };

  const operationalValidation = (): string | null => {
    if (!accountName.trim()) return 'Account name is required';
    return null;
  };

  const professionalValidation = (): string | null => {
    if (!accountName.trim()) return 'Account name is required';
    if (!parentId) return null;
    const parent = existingAccounts.find((a) => a.id === parentId);
    if (!parent) return null;
    const parentType = String(parent.type || '').toLowerCase().trim();
    const childType = professionalCategory;
    if (parentType !== childType) {
      return `Parent account type (${parentType}) must match category (${childType}) for sub-accounts.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error('Company ID is required');
      return;
    }

    if (activeTab === 'operational') {
      const err = operationalValidation();
      if (err) {
        toast.error(err);
        return;
      }
    } else {
      const err = professionalValidation();
      if (err) {
        toast.error(err);
        return;
      }
    }

    setIsSaving(true);
    try {
      const code =
        activeTab === 'operational'
          ? getOperationalCode()
          : accountCode.trim() || undefined;

      const payload: Parameters<typeof accountService.createAccount>[0] = {
        company_id: companyId,
        name: accountName.trim(),
        code,
        balance: openingBalance,
        is_active: isActive,
        ...(notes.trim() ? { description: notes.trim() } : {}),
      };

      if (activeTab === 'operational') {
        payload.type = operationalRole;
      } else {
        payload.type = professionalCategory;
        if (parentId) payload.parent_id = parentId;
      }

      await accountService.createAccount(payload);

      toast.success('Account created successfully');
      setAccountName('');
      setAccountCode('');
      setNotes('');
      setOpeningBalance(0);
      setIsActive(true);
      setParentId(null);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('[ADD ACCOUNT] Error creating account:', error);
      toast.error(`Failed to create account: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0B0F17] h-full shadow-2xl flex flex-col border-l border-gray-800 animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Create Account</h2>
            <p className="text-sm text-gray-400">Operational or full chart of accounts.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-800">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 p-6 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'operational' | 'professional')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800 border border-gray-700">
                <TabsTrigger value="operational" className="data-[state=active]:bg-gray-700 text-gray-300 data-[state=active]:text-white">
                  Operational
                </TabsTrigger>
                <TabsTrigger value="professional" className="data-[state=active]:bg-gray-700 text-gray-300 data-[state=active]:text-white">
                  Professional
                </TabsTrigger>
              </TabsList>

              <TabsContent value="operational" className="mt-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Account role *</Label>
                  <Select value={operationalRole} onValueChange={(v: OperationalRole) => setOperationalRole(v)}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      {OPERATIONAL_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          <div className="flex items-center gap-2">
                            <r.icon size={16} className="text-gray-400" />
                            {r.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Category is set automatically. No parent or hierarchy.</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Account name *</Label>
                  <Input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Meezan Bank, Shop Cash, JazzCash"
                    className="bg-gray-800 border-gray-700 text-white h-11"
                    required
                  />
                </div>

                {/* Operational: code is auto-assigned (1000/1010/1020 or next available); no field shown */}

                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Note</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes (e.g. branch, purpose)"
                    className="bg-gray-800 border-gray-700 text-white min-h-[80px] resize-y"
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Opening balance</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                    <Input
                      type="number"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      step="0.01"
                      className="bg-gray-800 border-gray-700 text-white h-11 pl-8"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-lg">
                  <div>
                    <Label className="text-base text-white">Active</Label>
                    <p className="text-xs text-gray-500">Account can be used in ledger and payments.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-green-600" />
                </div>
              </TabsContent>

              <TabsContent value="professional" className="mt-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Category *</Label>
                  <Select value={professionalCategory} onValueChange={(v: ProfessionalCategory) => setProfessionalCategory(v)}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      {PROFESSIONAL_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Parent account</Label>
                  <Select
                    value={parentId || '__none__'}
                    onValueChange={(v) => setParentId(v === '__none__' ? null : v)}
                    disabled={loadingAccounts}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-11">
                      <SelectValue placeholder="None (top-level)" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="__none__">None (top-level)</SelectItem>
                      {existingAccounts
                        .filter((a) => String(a.type || '').toLowerCase() === professionalCategory)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code ? `${a.code} – ` : ''}{a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Sub-accounts must have the same category as the parent.</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Account name *</Label>
                  <Input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Current Assets, Cost of Sales"
                    className="bg-gray-800 border-gray-700 text-white h-11"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Account code</Label>
                  <Input
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value)}
                    placeholder="e.g. 1100, 2000"
                    className="bg-gray-800 border-gray-700 text-white h-11 font-mono"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Note</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes (e.g. sub-ledger, reporting)"
                    className="bg-gray-800 border-gray-700 text-white min-h-[80px] resize-y"
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider">Opening balance</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                    <Input
                      type="number"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      step="0.01"
                      className="bg-gray-800 border-gray-700 text-white h-11 pl-8"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-lg">
                  <div>
                    <Label className="text-base text-white">Active</Label>
                    <p className="text-xs text-gray-500">Account appears in ledger and journal entries.</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-green-600" />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="p-6 border-t border-gray-800 bg-[#111827] space-y-3 shrink-0">
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 text-base font-semibold shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {isSaving ? 'Creating...' : 'Create Account'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 h-12">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
