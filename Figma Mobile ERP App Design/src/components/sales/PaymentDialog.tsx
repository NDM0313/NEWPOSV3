import { useState } from 'react';
import { ArrowLeft, Banknote, Building2, Smartphone, CreditCard, ChevronDown, AlertCircle } from 'lucide-react';

interface PaymentDialogProps {
  onBack: () => void;
  totalAmount: number;
  onComplete: () => void;
}

type PaymentMethod = 'cash' | 'bank' | 'wallet' | 'card';
type PaymentMode = 'full' | 'partial' | 'skip';

interface Account {
  id: string;
  name: string;
  balance: number;
}

const cashAccounts: Account[] = [
  { id: 'cash1', name: 'Main Cash Counter', balance: 125000 },
  { id: 'cash2', name: 'Shop Till', balance: 45000 },
  { id: 'cash3', name: 'Owner Personal Cash', balance: 30000 },
  { id: 'cash4', name: 'Petty Cash', balance: 5000 },
];

const bankAccounts: Account[] = [
  { id: 'bank1', name: 'Meezan Bank - 1234', balance: 850000 },
  { id: 'bank2', name: 'HBL - 5678', balance: 320000 },
  { id: 'bank3', name: 'Allied Bank - 9012', balance: 180000 },
];

const walletAccounts: Account[] = [
  { id: 'wallet1', name: 'JazzCash', balance: 15000 },
  { id: 'wallet2', name: 'Easypaisa', balance: 8000 },
];

export function PaymentDialog({ onBack, totalAmount, onComplete }: PaymentDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [amount, setAmount] = useState(totalAmount.toString());
  const [showAccountError, setShowAccountError] = useState(false);

  const getAccounts = (): Account[] => {
    if (paymentMethod === 'cash') return cashAccounts;
    if (paymentMethod === 'bank') return bankAccounts;
    if (paymentMethod === 'wallet') return walletAccounts;
    return [];
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setSelectedAccount(null);
    setStep(2);
  };

  const handleAccountSelect = (account: Account) => {
    setSelectedAccount(account);
    setShowAccountError(false);
  };

  const handleProceedToAmount = () => {
    if (!selectedAccount) {
      setShowAccountError(true);
      return;
    }
    setStep(3);
  };

  const handleConfirmPayment = () => {
    if (!selectedAccount) {
      setShowAccountError(true);
      return;
    }

    const paymentAmount = paymentMode === 'full' ? totalAmount : 
                         paymentMode === 'partial' ? parseFloat(amount) || 0 : 0;

    if (paymentMode === 'partial' && paymentAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (paymentMode === 'partial' && paymentAmount > totalAmount) {
      alert('Payment amount cannot exceed total amount');
      return;
    }

    // In real app, would post to accounting
    onComplete();
  };

  const quickAmounts = [50000, 40000, 30000, 20000, 10000, 5000];
  const paymentAmount = paymentMode === 'full' ? totalAmount : 
                       paymentMode === 'partial' ? parseFloat(amount) || 0 : 0;
  const remaining = totalAmount - paymentAmount;

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (step === 1) onBack();
                else if (step === 2) setStep(1);
                else setStep(2);
              }}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Payment</h1>
          </div>
          {step === 3 && (
            <button
              onClick={handleConfirmPayment}
              className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg font-medium transition-colors active:scale-95"
            >
              Post
            </button>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mt-4">
          <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-[#3B82F6]' : 'bg-[#374151]'}`}></div>
          <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-[#3B82F6]' : 'bg-[#374151]'}`}></div>
          <div className={`flex-1 h-1 rounded-full ${step >= 3 ? 'bg-[#3B82F6]' : 'bg-[#374151]'}`}></div>
        </div>
      </div>

      {/* Total Amount Banner */}
      <div className="bg-gradient-to-r from-[#3B82F6] to-[#2563EB] p-6">
        <p className="text-sm text-white/80 mb-1">Total Amount</p>
        <p className="text-3xl font-bold text-white">Rs. {totalAmount.toLocaleString()}</p>
        {step === 3 && paymentMode !== 'skip' && (
          <div className="mt-3 flex items-center justify-between text-white/90">
            <span className="text-sm">Paid: Rs. {paymentAmount.toLocaleString()}</span>
            <span className="text-sm">Due: Rs. {remaining.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Step 1: Payment Method Selection */}
      {step === 1 && (
        <div className="p-6 space-y-3">
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-4">SELECT PAYMENT METHOD</h2>
          
          <button
            onClick={() => handleMethodSelect('cash')}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-6 hover:border-[#3B82F6] transition-all active:scale-[0.98] text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#10B981]/10 rounded-xl flex items-center justify-center">
                <Banknote className="w-7 h-7 text-[#10B981]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">CASH</h3>
                <p className="text-sm text-[#9CA3AF]">Fast & Simple</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleMethodSelect('bank')}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-6 hover:border-[#3B82F6] transition-all active:scale-[0.98] text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#3B82F6]/10 rounded-xl flex items-center justify-center">
                <Building2 className="w-7 h-7 text-[#3B82F6]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">BANK</h3>
                <p className="text-sm text-[#9CA3AF]">Transfer/Cheque</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleMethodSelect('wallet')}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-6 hover:border-[#3B82F6] transition-all active:scale-[0.98] text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center">
                <Smartphone className="w-7 h-7 text-[#8B5CF6]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">WALLET</h3>
                <p className="text-sm text-[#9CA3AF]">JazzCash/Easypaisa</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleMethodSelect('card')}
            className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-6 hover:border-[#3B82F6] transition-all active:scale-[0.98] text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#F59E0B]/10 rounded-xl flex items-center justify-center">
                <CreditCard className="w-7 h-7 text-[#F59E0B]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">CARD</h3>
                <p className="text-sm text-[#9CA3AF]">Debit/Credit</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Step 2: Account Selection */}
      {step === 2 && paymentMethod && (
        <div className="p-6">
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-2">SELECT ACCOUNT *</h2>
          <p className="text-xs text-[#6B7280] mb-4">(Required for accounting)</p>

          {showAccountError && (
            <div className="mb-4 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#EF4444]">Account Required</p>
                <p className="text-xs text-[#EF4444]/80 mt-1">
                  Please select a specific account to continue. Payment cannot be posted without account selection.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {getAccounts().map((account) => (
              <button
                key={account.id}
                onClick={() => handleAccountSelect(account)}
                className={`w-full bg-[#1F2937] border-2 rounded-xl p-4 transition-all active:scale-[0.98] text-left ${
                  selectedAccount?.id === account.id
                    ? 'border-[#3B82F6] bg-[#3B82F6]/5'
                    : 'border-[#374151] hover:border-[#3B82F6]/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-[#F9FAFB]">{account.name}</h3>
                  {selectedAccount?.id === account.id && (
                    <div className="w-5 h-5 bg-[#3B82F6] rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
                <p className="text-sm text-[#9CA3AF]">
                  Balance: Rs. {account.balance.toLocaleString()}
                </p>
              </button>
            ))}
          </div>

          <button
            onClick={handleProceedToAmount}
            disabled={!selectedAccount}
            className="w-full mt-6 h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors active:scale-[0.98]"
          >
            Next →
          </button>
        </div>
      )}

      {/* Step 3: Amount Entry */}
      {step === 3 && selectedAccount && (
        <div className="p-6">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-6">
            <p className="text-xs text-[#9CA3AF] mb-1">Selected Account</p>
            <p className="font-medium text-[#F9FAFB]">{selectedAccount.name}</p>
            <p className="text-sm text-[#9CA3AF] mt-1">
              Balance: Rs. {selectedAccount.balance.toLocaleString()}
            </p>
          </div>

          {/* Payment Mode */}
          <div className="space-y-3 mb-6">
            <h2 className="text-sm font-medium text-[#9CA3AF]">PAYMENT TYPE</h2>
            
            <button
              onClick={() => {
                setPaymentMode('full');
                setAmount(totalAmount.toString());
              }}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                paymentMode === 'full'
                  ? 'bg-[#3B82F6]/10 border-2 border-[#3B82F6]'
                  : 'bg-[#1F2937] border border-[#374151]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Full Payment</span>
                <span className="font-semibold text-[#10B981]">
                  Rs. {totalAmount.toLocaleString()}
                </span>
              </div>
            </button>

            <button
              onClick={() => setPaymentMode('partial')}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                paymentMode === 'partial'
                  ? 'bg-[#3B82F6]/10 border-2 border-[#3B82F6]'
                  : 'bg-[#1F2937] border border-[#374151]'
              }`}
            >
              <span className="font-medium">Partial Payment</span>
              {paymentMode === 'partial' && (
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full mt-3 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm focus:outline-none focus:border-[#3B82F6]"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </button>

            <button
              onClick={() => {
                setPaymentMode('skip');
                setAmount('0');
              }}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                paymentMode === 'skip'
                  ? 'bg-[#3B82F6]/10 border-2 border-[#3B82F6]'
                  : 'bg-[#1F2937] border border-[#374151]'
              }`}
            >
              <span className="font-medium">Skip Payment (Due Invoice)</span>
            </button>
          </div>

          {/* Quick Amounts */}
          {paymentMode === 'partial' && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">QUICK AMOUNTS</h3>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((qa) => (
                  <button
                    key={qa}
                    onClick={() => setAmount(qa.toString())}
                    className="h-10 bg-[#1F2937] border border-[#374151] hover:border-[#3B82F6] rounded-lg text-sm font-medium transition-colors"
                  >
                    {qa >= 1000 ? `${qa / 1000}K` : qa}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gradient-to-br from-[#1F2937] to-[#111827] border border-[#374151] rounded-xl p-4 mb-6">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Total Amount</span>
                <span className="text-[#F9FAFB]">Rs. {totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Paying Now</span>
                <span className="font-semibold text-[#10B981]">
                  Rs. {paymentAmount.toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-[#374151] flex justify-between">
                <span className="font-medium">Remaining Due</span>
                <span className={`font-bold ${remaining > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                  Rs. {remaining.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleConfirmPayment}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg font-medium transition-colors active:scale-[0.98]"
          >
            Confirm Payment
          </button>
        </div>
      )}
    </div>
  );
}
