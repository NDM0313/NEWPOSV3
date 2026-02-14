import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Upload, 
  Calendar as CalendarIcon, 
  Building2, 
  Zap, 
  Users, 
  Plus, 
  Wallet, 
  CreditCard,
  MapPin,
  Loader2
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Sheet, SheetContent } from "../ui/sheet";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { format } from "date-fns";
import { cn } from "../ui/utils";
import { VirtualNumpad } from "../ui/virtual-numpad";
import { useExpenses } from "@/app/context/ExpenseContext";
import { useSupabase } from "@/app/context/SupabaseContext";
import { useAccounting } from "@/app/context/AccountingContext";
import { branchService } from "@/app/services/branchService";
import { expenseCategoryService, type ExpenseCategoryTreeItem } from "@/app/services/expenseCategoryService";
import { userService } from "@/app/services/userService";
import { toast } from "sonner";
import type { ExpenseCategory } from "@/app/context/ExpenseContext";
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

interface AddExpenseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** When provided, opens in edit mode with form pre-filled */
  expenseToEdit?: { id: string; expenseNo?: string; category: string; description: string; amount: number; date: string; paymentMethod: string; payeeName?: string; location?: string } | null;
}

const FALLBACK_CATEGORIES: { id: ExpenseCategory; name: string; slug: string; icon: typeof Building2; color: string }[] = [
  { id: 'Rent', name: 'Rent', slug: 'rent', icon: Building2, color: 'text-blue-500' },
  { id: 'Utilities', name: 'Electricity / Utilities', slug: 'utilities', icon: Zap, color: 'text-yellow-500' },
  { id: 'Salaries', name: 'Salary', slug: 'salaries', icon: Users, color: 'text-purple-500' },
  { id: 'Marketing', name: 'Marketing', slug: 'marketing', icon: Zap, color: 'text-pink-500' },
  { id: 'Travel', name: 'Travel', slug: 'travel', icon: MapPin, color: 'text-cyan-500' },
  { id: 'Office Supplies', name: 'Office Supplies', slug: 'office_supplies', icon: Building2, color: 'text-gray-400' },
  { id: 'Repairs & Maintenance', name: 'Repairs & Maintenance', slug: 'repairs', icon: Zap, color: 'text-orange-500' },
  { id: 'Other', name: 'Other', slug: 'miscellaneous', icon: Wallet, color: 'text-gray-500' },
];

export const AddExpenseDrawer = ({ isOpen, onClose, onSuccess, expenseToEdit }: AddExpenseDrawerProps) => {
  const { formatCurrency } = useFormatCurrency();
  const { companyId, branchId: contextBranchId } = useSupabase();
  const { createExpense, updateExpense, refreshExpenses } = useExpenses();
  const { accounts: accountingAccounts } = useAccounting();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [categoryTree, setCategoryTree] = useState<ExpenseCategoryTreeItem[]>([]);
  const [mainCategoryId, setMainCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [paidToUserId, setPaidToUserId] = useState("");
  const [salaryUsers, setSalaryUsers] = useState<Array<{ id: string; full_name: string; email?: string; role?: string }>>([]);
  const [salaryUserSearch, setSalaryUserSearch] = useState("");
  const [paidFromAccountId, setPaidFromAccountId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; address?: string }>>([]);

  const userRole = "Admin";

  useEffect(() => {
    if (!companyId) return;
    branchService.getAllBranches(companyId).then((data) => {
      setBranches(data || []);
      if (!selectedBranchId && data?.length) setSelectedBranchId(contextBranchId && contextBranchId !== 'all' ? contextBranchId : data[0]?.id || "");
    }).catch(() => setBranches([]));
  }, [companyId, contextBranchId]);

  useEffect(() => {
    if (contextBranchId && contextBranchId !== 'all' && !selectedBranchId) setSelectedBranchId(contextBranchId);
  }, [contextBranchId, selectedBranchId]);

  useEffect(() => {
    if (isOpen && companyId) expenseCategoryService.getTree(companyId).then(setCategoryTree).catch(() => setCategoryTree([]));
  }, [isOpen, companyId]);

  // Pre-fill form when editing
  useEffect(() => {
    if (isOpen && expenseToEdit) {
      setDate(expenseToEdit.date ? new Date(expenseToEdit.date) : new Date());
      setAmount(String(expenseToEdit.amount || ''));
      setDescription(expenseToEdit.description || '');
      const catSlug = typeof expenseToEdit.category === 'string' ? expenseToEdit.category.toLowerCase().replace(/\s+/g, '_') : '';
      setCategorySlug(catSlug);
      if (expenseToEdit.location) setSelectedBranchId(expenseToEdit.location);
    } else if (isOpen && !expenseToEdit) {
      setDate(new Date());
      setAmount('');
      setDescription('');
      setCategorySlug('');
      setMainCategoryId('');
      setSubCategoryId('');
      setPaidToUserId('');
      setSalaryUserSearch('');
      setPaidFromAccountId('');
    }
  }, [isOpen, expenseToEdit?.id]);

  const currentBranch = branches.find(b => b.id === selectedBranchId) || branches[0];
  const selectedMain = categoryTree.find((m) => m.id === mainCategoryId);
  const subOptions = selectedMain?.children ?? [];
  const selectedSub = subOptions.find((s) => s.id === subCategoryId);
  const effectiveSlug = selectedSub?.slug ?? selectedMain?.slug ?? categorySlug;
  const isSalaryCategory = effectiveSlug === 'salaries' || selectedMain?.type === 'salary' || selectedSub?.type === 'salary';

  useEffect(() => {
    if (isOpen && companyId && isSalaryCategory) {
      userService.getUsersForSalary(companyId).then((list) => {
        setSalaryUsers(list.map((u) => ({
          id: u.id,
          full_name: u.full_name || u.email || 'Unknown',
          email: u.email,
          role: u.role,
        })));
      }).catch(() => setSalaryUsers([]));
    } else if (!isSalaryCategory) {
      setPaidToUserId('');
      setSalaryUserSearch('');
    }
  }, [isOpen, companyId, isSalaryCategory]);

  const accountsList = (accountingAccounts || []).map((acc: { id: string; name: string; balance?: number; type?: string }) => ({
    id: acc.id,
    name: acc.name,
    balance: acc.balance ?? 0,
    icon: Wallet,
  }));
  const accounts = accountsList.length > 0 ? accountsList : [{ id: 'cash', name: 'Cash in Hand', balance: 0, icon: Wallet }];

  // When editing, set paidFromAccountId and category from expense
  useEffect(() => {
    if (isOpen && expenseToEdit && accounts.length > 0) {
      const accMatch = accounts.find((a: { id: string; name: string }) => 
        a.name === expenseToEdit.paymentMethod || a.id === expenseToEdit.paymentMethod
      );
      if (accMatch) setPaidFromAccountId(accMatch.id);
    }
    if (isOpen && expenseToEdit && categoryTree.length > 0) {
      const catName = String(expenseToEdit.category || '').toLowerCase();
      for (const main of categoryTree) {
        if ((main.name || '').toLowerCase() === catName || (main.slug || '').toLowerCase() === catName) {
          setMainCategoryId(main.id);
          setSubCategoryId('');
          break;
        }
        const sub = main.children?.find((s: { name?: string; slug?: string }) => 
          (s.name || '').toLowerCase() === catName || (s.slug || '').toLowerCase() === catName
        );
        if (sub) {
          setMainCategoryId(main.id);
          setSubCategoryId(sub.id);
          break;
        }
      }
    }
  }, [isOpen, expenseToEdit?.id, expenseToEdit?.paymentMethod, expenseToEdit?.category, accounts, categoryTree]);

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (window.innerWidth < 768) {
      e.preventDefault();
      e.target.blur();
      setIsNumpadOpen(true);
    }
  };

  const resetForm = useCallback(() => {
    setDate(new Date());
    setAmount("");
    setDescription("");
    setCategorySlug("");
    setMainCategoryId("");
    setSubCategoryId("");
    setPaidToUserId("");
    setSalaryUserSearch("");
    setPaidFromAccountId("");
  }, []);

  const handleSave = async () => {
    const amt = Number(amount?.replace(/,/g, '')) || 0;
    if (amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!effectiveSlug) {
      toast.error("Please select a category");
      return;
    }
    if (isSalaryCategory && !paidToUserId) {
      toast.error("Please select the user to pay (Salary is for Staff/Salesman/Operator only)");
      return;
    }
    if (!paidFromAccountId) {
      toast.error("Please select Paid From account");
      return;
    }
    const paidFromAccount = accounts.find((a: { id: string }) => a.id === paidFromAccountId);
    const paymentMethodName = paidFromAccount?.name || "Cash in Hand";
    const effectiveBranchId = selectedBranchId || contextBranchId;
    const selectedSalaryUser = isSalaryCategory ? salaryUsers.find((u) => u.id === paidToUserId) : null;
    if (!effectiveBranchId || effectiveBranchId === 'all') {
      toast.error("Please select a branch");
      return;
    }
    setSaving(true);
    try {
      if (expenseToEdit) {
        await updateExpense(expenseToEdit.id, {
          category: effectiveSlug,
          description: description.trim() || (isSalaryCategory && selectedSalaryUser ? `${selectedSalaryUser.full_name} – Salary` : selectedSub?.name ?? selectedMain?.name ?? effectiveSlug),
          amount: amt,
          date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          paymentMethod: paymentMethodName,
          payeeName: isSalaryCategory && selectedSalaryUser ? selectedSalaryUser.full_name : "",
          location: effectiveBranchId,
        });
      } else {
        await createExpense(
          {
            category: effectiveSlug,
            description: description.trim() || (isSalaryCategory && selectedSalaryUser ? `${selectedSalaryUser.full_name} – Salary` : selectedSub?.name ?? selectedMain?.name ?? effectiveSlug),
            amount: amt,
            date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
            paymentMethod: paymentMethodName,
            payeeName: isSalaryCategory && selectedSalaryUser ? selectedSalaryUser.full_name : "",
            location: effectiveBranchId,
            status: "paid",
            submittedBy: "",
            receiptAttached: false,
          },
          {
            branchId: effectiveBranchId,
            payment_account_id: paidFromAccountId && /^[0-9a-f-]{36}$/i.test(paidFromAccountId) ? paidFromAccountId : undefined,
            paidToUserId: isSalaryCategory && paidToUserId ? paidToUserId : undefined,
          }
        );
      }
      refreshExpenses();
      resetForm();
      onClose();
      onSuccess?.();
    } catch (e) {
      // toast already in context
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      onClose();
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && handleOpenChange(false)}>
        <SheetContent side="right" className="w-full max-w-full sm:max-w-md bg-[#111827] border-l border-gray-800 text-white p-0 flex flex-col">
          
          {/* TOP HEADER - Branch Info */}
          <div className="bg-gray-900 p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-600/20 backdrop-blur-sm flex items-center justify-center border border-blue-600/30">
                  <Building2 size={20} className="text-blue-400" />
                </div>
                <div>
                  {userRole === "Admin" && branches.length > 0 ? (
                    <Select value={selectedBranchId || branches[0]?.id} onValueChange={setSelectedBranchId}>
                      <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white hover:bg-gray-700 w-[200px] focus:ring-0 focus:ring-offset-0">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700 text-white">
                        {branches.map((branch) => (
                          <SelectItem 
                            key={branch.id} 
                            value={branch.id}
                            className="focus:bg-gray-800 focus:text-white cursor-pointer"
                          >
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{branch.name}</span>
                              <span className="text-xs text-gray-400">{branch.address || branch.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <p className="text-white font-semibold text-sm">{currentBranch?.name || 'Branch'}</p>
                      <p className="text-gray-400 text-xs flex items-center gap-1">
                        <MapPin size={10} />
                        {currentBranch?.address || currentBranch?.name || ''}
                      </p>
                    </>
                  )}
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8" 
                onClick={onClose}
              >
                <X size={20} />
              </Button>
            </div>
          </div>

          {/* TITLE BAR */}
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-xl font-bold text-white">{expenseToEdit ? 'Edit Expense' : 'Record Expense'}</h2>
            <p className="text-sm text-gray-400 mt-1">{expenseToEdit ? expenseToEdit.expenseNo || expenseToEdit.id : 'Track operational costs and expenditures'}</p>
          </div>

          {/* Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Row 1: Date Picker */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-11 bg-gray-900 border-gray-700 text-white hover:bg-gray-800 hover:text-white",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800 text-white">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="bg-gray-900 text-white"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Row 2: Category – Main + Sub from DB, or single fallback */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Category</Label>
              {categoryTree.length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value={mainCategoryId || '_none'}
                    onValueChange={(v) => {
                      setMainCategoryId(v === '_none' ? '' : v);
                      setSubCategoryId('');
                    }}
                  >
                    <SelectTrigger className="h-11 bg-gray-900 border-gray-700 text-white">
                      <SelectValue placeholder="Main category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800 text-white">
                      <SelectItem value="_none" className="focus:bg-gray-800 focus:text-white cursor-pointer">Select main category</SelectItem>
                      {categoryTree.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="focus:bg-gray-800 focus:text-white cursor-pointer">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {subOptions.length > 0 && (
                    <Select value={subCategoryId || '_main'} onValueChange={(v) => setSubCategoryId(v === '_main' ? '' : v)}>
                      <SelectTrigger className="h-11 bg-gray-900 border-gray-700 text-white">
                        <SelectValue placeholder="Sub-category (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-800 text-white">
                        <SelectItem value="_main" className="focus:bg-gray-800 focus:text-white cursor-pointer">
                          — {selectedMain?.name} (main)
                        </SelectItem>
                        {subOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="focus:bg-gray-800 focus:text-white cursor-pointer">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <Select value={categorySlug} onValueChange={setCategorySlug}>
                  <SelectTrigger className="h-11 bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800 text-white">
                    {FALLBACK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.slug} className="focus:bg-gray-800 focus:text-white cursor-pointer">
                        <div className="flex items-center gap-2">
                          <cat.icon className={cn("h-4 w-4", cat.color)} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Salary: Pay to (User) only – Staff/Salesman/Operator from User Management. Workers (Dyer, Stitcher) never here. */}
            {isSalaryCategory && (
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Pay to (User)</Label>
                <Input
                  placeholder="Search user..."
                  value={salaryUserSearch}
                  onChange={(e) => setSalaryUserSearch(e.target.value)}
                  className="h-9 mb-1 bg-gray-900 border-gray-700 text-white text-sm"
                />
                <Select value={paidToUserId} onValueChange={setPaidToUserId}>
                  <SelectTrigger className="h-11 bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="Select user (Staff / Salesman / Operator)" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800 text-white max-h-[280px]">
                    {salaryUsers
                      .filter((u) => !salaryUserSearch || (u.full_name + ' ' + (u.email || '') + ' ' + (u.role || '')).toLowerCase().includes(salaryUserSearch.toLowerCase()))
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id} className="focus:bg-gray-800 focus:text-white cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-400 shrink-0" />
                            <span>{u.full_name}</span>
                            {u.role && <span className="text-xs text-gray-500 capitalize">({u.role})</span>}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Salary is for users only (Admin, Staff, Salesman, Operator). Workers are paid via Production → Worker Ledger.</p>
              </div>
            )}

            {/* Row 3: Paid From Account */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Paid From</Label>
              <Select value={paidFromAccountId} onValueChange={setPaidFromAccountId}>
                <SelectTrigger className="h-11 bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  {accounts.map((acc: { id: string; name: string; balance: number; icon: typeof Wallet }) => (
                    <SelectItem key={acc.id} value={acc.id} className="focus:bg-gray-800 focus:text-white cursor-pointer">
                      <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex items-center gap-2">
                          <acc.icon className="h-4 w-4 text-gray-400" />
                          {acc.name}
                        </div>
                        <span className="text-xs text-green-500 font-mono">
                          {formatCurrency(acc.balance || 0)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 4: Amount Input */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">Rs</span>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={handleAmountFocus}
                  placeholder="0.00"
                  className="pl-10 h-11 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 focus:border-blue-500 text-base"
                />
              </div>
            </div>

            {/* Row 5: Description Area */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Description</Label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter expense details..." 
                className="bg-gray-900 border-gray-700 text-white min-h-[100px] resize-none focus:border-blue-500"
              />
            </div>

            {/* Row 6: Upload Receipt Box */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Upload Receipt (Optional)</Label>
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-gray-800/50 transition-colors cursor-pointer group bg-gray-900/50">
                <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform border border-gray-700">
                  <Upload className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-400">Click to upload bill</p>
                <p className="text-xs text-gray-600 mt-1">PNG, JPG up to 5MB</p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white h-11"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                className="bg-orange-600 hover:bg-orange-500 text-white font-semibold h-11 shadow-lg shadow-orange-600/20 transition-all active:scale-[0.98] disabled:opacity-70"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                Save Expense
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <VirtualNumpad 
        isOpen={isNumpadOpen} 
        onClose={() => setIsNumpadOpen(false)}
        onSubmit={(val) => setAmount(val)}
        initialValue={amount}
        label="Enter Expense Amount"
      />
    </>
  );
};