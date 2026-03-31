import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, Calculator, Save, DollarSign, ArrowRight, Info, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';

type AccountModule = 'POS' | 'Rental' | 'Studio' | 'General Accounting';
type EntryType = 'single-a' | 'single-b';

interface JournalEntryLine {
  id: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id?: string;
  date: string;
  referenceNo: string;
  description: string;
  module: AccountModule;
  lines: JournalEntryLine[];
  attachments?: string[]; // File paths for uploaded slips
}

interface EnhancedJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: JournalEntry | null;
  accounts: Array<{ id: string; code: string; name: string }>;
  onSave: (entry: JournalEntry) => void;
}

export const EnhancedJournalEntryDialog = ({ open, onOpenChange, entry, accounts, onSave }: EnhancedJournalEntryDialogProps) => {
  const [entryType, setEntryType] = useState<EntryType>('single-a');
  
  const [date, setDate] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [description, setDescription] = useState('');
  const [module, setModule] = useState<AccountModule>('General Accounting');
  const [loading, setLoading] = useState(false);

  // Single Entry Type A fields
  const [accountId, setAccountId] = useState('');
  const [transactionType, setTransactionType] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState('');

  // Single Entry Type B fields (Transfer)
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferCategory, setTransferCategory] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [uploadedSlips, setUploadedSlips] = useState<File[]>([]);

  const SUSPENSE_ACCOUNT_ID = 'suspense-001'; // System suspense account

  useEffect(() => {
    if (entry) {
      setDate(entry.date);
      setReferenceNo(entry.referenceNo);
      setDescription(entry.description);
      setModule(entry.module);
      // If it's a transfer (2 lines without suspense)
      if (entry.lines.length === 2) {
        const hasSuspense = entry.lines.some(l => l.accountId === SUSPENSE_ACCOUNT_ID);
        if (!hasSuspense) {
          setEntryType('single-b');
          const creditLine = entry.lines.find(l => l.credit > 0);
          const debitLine = entry.lines.find(l => l.debit > 0);
          setFromAccountId(creditLine?.accountId || '');
          setToAccountId(debitLine?.accountId || '');
          setTransferAmount((debitLine?.debit || 0).toString());
        } else {
          setEntryType('single-a');
          const mainLine = entry.lines.find(l => l.accountId !== SUSPENSE_ACCOUNT_ID);
          setAccountId(mainLine?.accountId || '');
          setAmount((mainLine?.debit || mainLine?.credit || 0).toString());
          setTransactionType(mainLine?.debit ? 'debit' : 'credit');
        }
      }
    } else {
      resetForm();
    }
  }, [entry, open]);

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setReferenceNo(`JE-${Date.now()}`);
    setDescription('');
    setModule('General Accounting');
    setAccountId('');
    setTransactionType('debit');
    setAmount('');
    setFromAccountId('');
    setToAccountId('');
    setTransferAmount('');
    setTransferCategory('');
    setTransferNotes('');
    setUploadedSlips([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedSlips([...uploadedSlips, ...newFiles]);
    }
  };

  const removeSlip = (index: number) => {
    setUploadedSlips(uploadedSlips.filter((_, i) => i !== index));
  };

  const buildJournalLines = (): JournalEntryLine[] => {
    if (entryType === 'single-a') {
      // Single entry with suspense account
      const amt = parseFloat(amount);
      const mainAccount = accounts.find(a => a.id === accountId);
      const suspenseAccount = { id: SUSPENSE_ACCOUNT_ID, code: 'SUSP', name: 'Suspense Account' };
      
      if (transactionType === 'debit') {
        return [
          { id: '1', accountId: mainAccount!.id, accountName: mainAccount!.name, accountCode: mainAccount!.code, debit: amt, credit: 0 },
          { id: '2', accountId: suspenseAccount.id, accountName: suspenseAccount.name, accountCode: suspenseAccount.code, debit: 0, credit: amt },
        ];
      } else {
        return [
          { id: '1', accountId: suspenseAccount.id, accountName: suspenseAccount.name, accountCode: suspenseAccount.code, debit: amt, credit: 0 },
          { id: '2', accountId: mainAccount!.id, accountName: mainAccount!.name, accountCode: mainAccount!.code, debit: 0, credit: amt },
        ];
      }
    } else if (entryType === 'single-b') {
      // Transfer between two accounts
      const amt = parseFloat(transferAmount);
      const fromAccount = accounts.find(a => a.id === fromAccountId);
      const toAccount = accounts.find(a => a.id === toAccountId);
      
      return [
        { id: '1', accountId: toAccount!.id, accountName: toAccount!.name, accountCode: toAccount!.code, debit: amt, credit: 0 },
        { id: '2', accountId: fromAccount!.id, accountName: fromAccount!.name, accountCode: fromAccount!.code, debit: 0, credit: amt },
      ];
    }
    
    return [];
  };

  const validateForm = (): boolean => {
    if (!date || !referenceNo || !description) {
      toast.error('Validation failed', { description: 'Please fill in all required fields' });
      return false;
    }

    if (entryType === 'single-a') {
      if (!accountId || !amount || parseFloat(amount) <= 0) {
        toast.error('Validation failed', { description: 'Please select account and enter valid amount' });
        return false;
      }
    } else if (entryType === 'single-b') {
      if (!fromAccountId || !toAccountId || !transferAmount || parseFloat(transferAmount) <= 0) {
        toast.error('Validation failed', { description: 'Please select both accounts and enter valid amount' });
        return false;
      }
      if (fromAccountId === toAccountId) {
        toast.error('Validation failed', { description: 'From and To accounts must be different' });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    setLoading(true);
    
    setTimeout(() => {
      const journalLines = buildJournalLines();
      
      onSave({
        id: entry?.id,
        date,
        referenceNo,
        description,
        module,
        lines: journalLines,
        attachments: uploadedSlips.map(f => f.name),
      });
      
      toast.success(entry ? 'Journal entry updated' : 'Journal entry created');
      setLoading(false);
      onOpenChange(false);
      resetForm();
    }, 500);
  };

  const renderPreview = () => {
    const previewLines = buildJournalLines();
    if (previewLines.length === 0) return null;

    return (
      <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-blue-400">Preview - How this will be posted:</span>
        </div>
        <div className="space-y-2">
          {previewLines.map((line, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-300">{line.accountCode} - {line.accountName}</span>
              <div className="flex items-center gap-4">
                <span className={cn("font-semibold", line.debit > 0 ? "text-green-400" : "text-gray-600")}>
                  Dr: {line.debit > 0 ? `Rs. ${line.debit.toFixed(2)}` : '-'}
                </span>
                <span className={cn("font-semibold", line.credit > 0 ? "text-red-400" : "text-gray-600")}>
                  Cr: {line.credit > 0 ? `Rs. ${line.credit.toFixed(2)}` : '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content 
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 rounded-lg p-0 w-full max-w-5xl max-h-[90vh] overflow-hidden z-50"
        >
          <Dialog.Description className="sr-only">
            Create or edit a journal entry for accounting transactions
          </Dialog.Description>
          <div className="flex flex-col h-full max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-[#111827]">
              <div>
                <Dialog.Title className="text-xl font-bold text-white">
                  {entry ? 'Edit Journal Entry' : 'Add Journal Entry'}
                </Dialog.Title>
                <p className="text-sm text-gray-400 mt-1">
                  Single-entry accounting transaction
                </p>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm"><X className="h-4 w-4" /></Button>
              </Dialog.Close>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Common Fields */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <Label className="text-xs text-gray-400 mb-2 block">Date *</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-gray-900 border-gray-700 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-gray-400 mb-2 block">Reference No *</Label>
                  <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="bg-gray-900 border-gray-700 text-white" />
                </div>
                <div>
                  <Label className="text-xs text-gray-400 mb-2 block">Module</Label>
                  <select value={module} onChange={(e) => setModule(e.target.value as AccountModule)} className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white">
                    <option value="General Accounting">General Accounting</option>
                    <option value="POS">POS</option>
                    <option value="Rental">Rental</option>
                    <option value="Studio">Studio</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <Label className="text-xs text-gray-400 mb-2 block">Description *</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this transaction..." className="bg-gray-900 border-gray-700 text-white" />
              </div>

              {/* Entry Type Selector */}
              {!entry && (
                <div className="mb-6">
                  <Label className="text-sm font-semibold text-white mb-3 block">Entry Type</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={entryType === 'single-a' ? 'default' : 'outline'}
                      className={cn(entryType === 'single-a' && 'bg-blue-600 hover:bg-blue-500')}
                      onClick={() => setEntryType('single-a')}
                    >
                      Type A: Single Account
                    </Button>
                    <Button
                      variant={entryType === 'single-b' ? 'default' : 'outline'}
                      className={cn(entryType === 'single-b' && 'bg-blue-600 hover:bg-blue-500')}
                      onClick={() => setEntryType('single-b')}
                    >
                      Type B: Transfer
                    </Button>
                  </div>
                </div>
              )}

              {/* Entry Type Specific Forms */}
              {entryType === 'single-a' && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="col-span-2">
                      <Label className="text-xs text-gray-400 mb-2 block">Select Account *</Label>
                      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white">
                        <option value="">Select Account...</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400 mb-2 block">Transaction Type *</Label>
                      <select value={transactionType} onChange={(e) => setTransactionType(e.target.value as 'debit' | 'credit')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white">
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400 mb-2 block">Amount *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs.</span>
                      <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="bg-gray-800 border-gray-700 text-white pl-12 text-lg font-semibold" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">System will auto-balance with Suspense Account</p>
                </div>
              )}

              {entryType === 'single-b' && (
                <div className="space-y-4">
                  {/* Transfer Accounts */}
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
                    <Label className="text-sm font-semibold text-white mb-4 block">Transfer Details</Label>
                    
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-red-400"></div>
                          <Label className="text-xs text-gray-400">From Account (Credit) *</Label>
                        </div>
                        <select 
                          value={fromAccountId} 
                          onChange={(e) => setFromAccountId(e.target.value)} 
                          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-md text-white"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map(account => (
                            <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                          <Label className="text-xs text-gray-400">To Account (Debit) *</Label>
                        </div>
                        <select 
                          value={toAccountId} 
                          onChange={(e) => setToAccountId(e.target.value)} 
                          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-md text-white"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map(account => (
                            <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Arrow Indicator */}
                    <div className="flex items-center justify-center my-3">
                      <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2">
                        <span className="text-sm text-gray-400">
                          {fromAccountId && toAccountId ? 'Transfer Flow' : 'Select accounts to see flow'}
                        </span>
                        <ArrowRight className="h-5 w-5 text-blue-400" />
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="mb-4">
                      <Label className="text-xs text-gray-400 mb-2 block">Transfer Amount *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rs.</span>
                        <Input 
                          type="number" 
                          value={transferAmount} 
                          onChange={(e) => setTransferAmount(e.target.value)} 
                          placeholder="0.00" 
                          className="bg-gray-800 border-gray-700 text-white pl-12 text-lg font-semibold" 
                        />
                      </div>
                    </div>

                    {/* Transfer Category */}
                    <div className="mb-4">
                      <Label className="text-xs text-gray-400 mb-2 block">Transfer Category</Label>
                      <select 
                        value={transferCategory} 
                        onChange={(e) => setTransferCategory(e.target.value)} 
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                      >
                        <option value="">Select Category...</option>
                        <option value="internal">Internal Transfer</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="cash">Cash Transfer</option>
                        <option value="vendor">Vendor Payment</option>
                        <option value="customer">Customer Refund</option>
                        <option value="salary">Salary Payment</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Additional Notes */}
                    <div>
                      <Label className="text-xs text-gray-400 mb-2 block">Additional Notes</Label>
                      <textarea
                        value={transferNotes}
                        onChange={(e) => setTransferNotes(e.target.value)}
                        placeholder="Add any additional details about this transfer..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white min-h-[80px] resize-none"
                      />
                    </div>
                  </div>

                  {/* Slip Upload Section */}
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-blue-400" />
                        <Label className="text-sm font-semibold text-white">Upload Transfer Slip/Receipt</Label>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <Button variant="outline" size="sm" className="border-gray-700" type="button">
                          <Plus className="h-4 w-4 mr-1" />
                          Add File
                        </Button>
                      </label>
                    </div>

                    {uploadedSlips.length > 0 ? (
                      <div className="space-y-2">
                        {uploadedSlips.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              {file.type.startsWith('image/') ? (
                                <ImageIcon className="h-5 w-5 text-blue-400" />
                              ) : (
                                <FileText className="h-5 w-5 text-blue-400" />
                              )}
                              <div>
                                <p className="text-sm text-white font-medium">{file.name}</p>
                                <p className="text-xs text-gray-500">
                                  {(file.size / 1024).toFixed(2)} KB
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSlip(index)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-gray-700 rounded-lg">
                        <Upload className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No files uploaded</p>
                        <p className="text-xs text-gray-600 mt-1">Click "Add File" to upload slip or receipt</p>
                      </div>
                    )}
                  </div>

                  {/* Preview */}
                  {fromAccountId && toAccountId && transferAmount && parseFloat(transferAmount) > 0 && renderPreview()}
                </div>
              )}

              {accountId && amount && parseFloat(amount) > 0 && entryType === 'single-a' && renderPreview()}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700 bg-gray-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {loading ? (
                  <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-400">
                    <Calculator className="h-3 w-3 mr-1 animate-spin" />
                    Processing...
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400">
                    <Save className="h-3 w-3 mr-1" />
                    Ready to Post
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-500">
                  <Save className="h-4 w-4 mr-2" />
                  Post Entry
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};