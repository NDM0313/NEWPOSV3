import React, { useState, useEffect, useCallback } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useSupabase } from '../../context/SupabaseContext';
import { branchService, Branch } from '../../services/branchService';
import { accountService, Account } from '../../services/accountService';
import { settingsService } from '../../services/settingsService';
import { toast } from 'sonner';

interface AddBranchModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingBranch?: Branch | null;
}

export const AddBranchModal: React.FC<AddBranchModalProps> = ({
  open,
  onClose,
  onSuccess,
  editingBranch,
}) => {
  const { companyId } = useSupabase();
  const [saving, setSaving] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    is_active: true,
    cashAccountId: '',
    bankAccountId: '',
    posCashDrawerId: '',
  });

  // Load accounts
  const loadAccounts = useCallback(async () => {
    if (!companyId) return;
    setLoadingAccounts(true);
    try {
      const allAccounts = await accountService.getAllAccounts(companyId);
      setAccounts(allAccounts);
      
      // Filter by type
      const cash = allAccounts.filter(acc => acc.type === 'Cash' && acc.is_active);
      const bank = allAccounts.filter(acc => acc.type === 'Bank' && acc.is_active);
      setCashAccounts(cash);
      setBankAccounts(bank);
    } catch (error) {
      console.error('[ADD BRANCH MODAL] Error loading accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, [companyId]);

  // Auto-generate branch code
  const generateBranchCode = useCallback(async () => {
    if (!companyId || editingBranch) return; // Don't auto-generate for edit mode
    
    try {
      // Get next number for branch code (using 'branch' document type)
      const nextCode = await settingsService.getNextDocumentNumber(companyId, undefined, 'branch');
      setFormData(prev => ({ ...prev, code: nextCode }));
    } catch (error) {
      // If branch document type doesn't exist, use simple increment
      console.log('[ADD BRANCH MODAL] Branch sequence not found, using simple code');
      const existingBranches = await branchService.getAllBranches(companyId);
      const nextNum = existingBranches.length + 1;
      setFormData(prev => ({ ...prev, code: `BR-${String(nextNum).padStart(4, '0')}` }));
    }
  }, [companyId, editingBranch]);

  // Load accounts when modal opens
  useEffect(() => {
    if (open && companyId) {
      loadAccounts();
    }
  }, [open, companyId, loadAccounts]);

  // Auto-generate branch code when name is entered (new branch only)
  useEffect(() => {
    if (open && !editingBranch && formData.name.trim() && !formData.code) {
      generateBranchCode();
    }
  }, [open, editingBranch, formData.name, formData.code, generateBranchCode]);

  // Reset form when modal opens/closes or editingBranch changes
  useEffect(() => {
    if (open) {
      if (editingBranch) {
        // Edit mode - prefill form
        setFormData({
          name: editingBranch.name || '',
          code: editingBranch.code || '',
          phone: editingBranch.phone || '',
          address: editingBranch.address || '',
          city: editingBranch.city || '',
          state: editingBranch.state || '',
          is_active: editingBranch.is_active ?? true,
          cashAccountId: '', // These need to be loaded from branch settings
          bankAccountId: '',
          posCashDrawerId: '',
        });
      } else {
        // Add mode - reset form
        setFormData({
          name: '',
          code: '',
          phone: '',
          address: '',
          city: '',
          state: '',
          is_active: true,
          cashAccountId: '',
          bankAccountId: '',
          posCashDrawerId: '',
        });
      }
    }
  }, [open, editingBranch]);

  const handleSave = async () => {
    if (!companyId) {
      toast.error('Company ID not found');
      return;
    }

    // Validation
    if (!formData.name.trim()) {
      toast.error('Please enter branch name');
      return;
    }

    setSaving(true);

    try {
      // Auto-generate code if not provided (for new branches only)
      let branchCode = formData.code.trim();
      if (!branchCode && !editingBranch) {
        try {
          branchCode = await settingsService.getNextDocumentNumber(companyId, undefined, 'branch');
          // Update form state to show the generated code
          setFormData(prev => ({ ...prev, code: branchCode }));
        } catch (error) {
          console.log('[ADD BRANCH MODAL] Branch sequence not found, using simple code');
          // Fallback: use simple increment
          const existingBranches = await branchService.getAllBranches(companyId);
          const nextNum = existingBranches.length + 1;
          branchCode = `BR-${String(nextNum).padStart(4, '0')}`;
          setFormData(prev => ({ ...prev, code: branchCode }));
        }
      }

      const branchData: Partial<Branch> = {
        company_id: companyId,
        name: formData.name.trim(),
        code: branchCode || formData.code.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        is_active: formData.is_active,
      };

      console.log('[ADD BRANCH MODAL] Saving branch with data:', JSON.stringify(branchData, null, 2));

      if (editingBranch) {
        // Update existing branch
        console.log('[ADD BRANCH MODAL] Updating branch:', editingBranch.id);
        const result = await branchService.updateBranch(editingBranch.id, branchData);
        console.log('[ADD BRANCH MODAL] Update result:', result);
        toast.success('Branch updated successfully!');
      } else {
        // Create new branch
        console.log('[ADD BRANCH MODAL] Creating new branch');
        const result = await branchService.createBranch(branchData);
        console.log('[ADD BRANCH MODAL] Create result:', result);
        toast.success('Branch created successfully!');
      }

      // Trigger success callback to refresh list
      onSuccess();
      
      // Close modal
      onClose();
    } catch (error: any) {
      console.error('[ADD BRANCH MODAL] Error saving branch:', error);
      toast.error(error.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {editingBranch ? 'Edit Branch' : 'Add New Branch'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {editingBranch ? 'Update branch information' : 'Create a new branch for your business'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Branch Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-200">Branch Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Main Branch"
              className="bg-gray-900 border-gray-700 text-white"
              required
            />
          </div>

          {/* Branch Code - Auto-generated, Read-only */}
          <div className="space-y-2">
            <Label htmlFor="code" className="text-gray-200">Branch Code</Label>
            <Input
              id="code"
              value={formData.code || 'BR-0001'}
              readOnly
              disabled
              placeholder="BR-0001"
              className="bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed"
            />
            {!editingBranch && (
              <p className="text-xs text-gray-500">Code will be auto-generated when you enter branch name</p>
            )}
            {editingBranch && (
              <p className="text-xs text-gray-500">Branch code cannot be changed after creation</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-200">Phone (Optional)</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+92 300 1234567"
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-gray-200">Address (Optional)</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Street address"
              className="bg-gray-900 border-gray-700 text-white"
              rows={2}
            />
          </div>

          {/* City & State */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-gray-200">City (Optional)</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Karachi"
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state" className="text-gray-200">State (Optional)</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="Sindh"
                className="bg-gray-900 border-gray-700 text-white"
              />
            </div>
          </div>

          {/* Default Accounts */}
          <div className="space-y-4 pt-4 border-t border-gray-800">
            <Label className="text-gray-200 font-medium">Default Accounts (Optional)</Label>
            
            {/* Cash Account */}
            <div className="space-y-2">
              <Label htmlFor="cashAccount" className="text-gray-300 text-sm">Cash Account</Label>
              <Select
                value={formData.cashAccountId || undefined}
                onValueChange={(value) => setFormData({ ...formData, cashAccountId: value || '' })}
                disabled={loadingAccounts}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select cash account (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  {cashAccounts.length === 0 ? (
                    <SelectItem value="no-accounts" disabled>No cash accounts available</SelectItem>
                  ) : (
                    cashAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id || 'invalid'}>
                        {account.name} ({account.code || 'N/A'})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Bank Account */}
            <div className="space-y-2">
              <Label htmlFor="bankAccount" className="text-gray-300 text-sm">Bank Account</Label>
              <Select
                value={formData.bankAccountId || undefined}
                onValueChange={(value) => setFormData({ ...formData, bankAccountId: value || '' })}
                disabled={loadingAccounts}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select bank account (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  {bankAccounts.length === 0 ? (
                    <SelectItem value="no-accounts" disabled>No bank accounts available</SelectItem>
                  ) : (
                    bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id || 'invalid'}>
                        {account.name} ({account.code || 'N/A'})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* POS Cash Drawer (also uses Cash accounts) */}
            <div className="space-y-2">
              <Label htmlFor="posCashDrawer" className="text-gray-300 text-sm">POS Cash Drawer</Label>
              <Select
                value={formData.posCashDrawerId || undefined}
                onValueChange={(value) => setFormData({ ...formData, posCashDrawerId: value || '' })}
                disabled={loadingAccounts}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select POS drawer account (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  {cashAccounts.length === 0 ? (
                    <SelectItem value="no-accounts" disabled>No cash accounts available</SelectItem>
                  ) : (
                    cashAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id || 'invalid'}>
                        {account.name} ({account.code || 'N/A'})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <div>
              <Label htmlFor="is_active" className="text-gray-200">Active Status</Label>
              <p className="text-xs text-gray-400">Branch is operational and visible</p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </div>

        <DialogFooter className="bg-gray-950 px-6 py-4 border-t border-gray-800 flex justify-end items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-gray-300 hover:bg-gray-800 hover:text-white border-gray-700"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white"
            disabled={saving}
          >
            {saving ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
