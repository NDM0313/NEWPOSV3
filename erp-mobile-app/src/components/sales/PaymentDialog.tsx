import { useState } from 'react';
import { ArrowLeft, Banknote, Building2, CreditCard, Check } from 'lucide-react';

interface PaymentDialogProps {
  onBack: () => void;
  totalAmount: number;
  onComplete: () => void;
}

type Method = 'cash' | 'bank';

const CASH_ACCOUNTS = [
  { id: 'cash1', name: 'Main Cash', balance: 125000 },
  { id: 'cash2', name: 'Shop Till', balance: 45000 },
];
const BANK_ACCOUNTS = [
  { id: 'bank1', name: 'Meezan Bank', balance: 850000 },
  { id: 'bank2', name: 'HBL', balance: 320000 },
];

export function PaymentDialog({ onBack, totalAmount, onComplete }: PaymentDialogProps) {
  const [method, setMethod] = useState<Method | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const accounts = method === 'cash' ? CASH_ACCOUNTS : method === 'bank' ? BANK_ACCOUNTS : [];
  const canConfirm = method && selectedId;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onComplete();
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Payment</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <p className="text-sm text-[#9CA3AF] mb-1">Amount to pay</p>
          <p className="text-2xl font-bold text-[#10B981]">Rs. {totalAmount.toLocaleString()}</p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">PAYMENT METHOD</h2>
          <div className="flex gap-3">
            <button
              onClick={() => { setMethod('cash'); setSelectedId(null); }}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                method === 'cash' ? 'border-[#3B82F6] bg-[#3B82F6]/10' : 'border-[#374151] bg-[#1F2937] hover:border-[#4B5563]'
              }`}
            >
              <Banknote className="w-8 h-8 text-white" />
              <span className="text-sm font-medium text-white">Cash</span>
            </button>
            <button
              onClick={() => { setMethod('bank'); setSelectedId(null); }}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                method === 'bank' ? 'border-[#3B82F6] bg-[#3B82F6]/10' : 'border-[#374151] bg-[#1F2937] hover:border-[#4B5563]'
              }`}
            >
              <Building2 className="w-8 h-8 text-white" />
              <span className="text-sm font-medium text-white">Bank</span>
            </button>
          </div>
        </div>

        {method && (
          <div>
            <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">SELECT ACCOUNT</h2>
            <div className="space-y-2">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedId(acc.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                    selectedId === acc.id ? 'border-[#10B981] bg-[#10B981]/10' : 'border-[#374151] bg-[#1F2937] hover:border-[#4B5563]'
                  }`}
                >
                  <div>
                    <p className="font-medium text-white">{acc.name}</p>
                    <p className="text-sm text-[#9CA3AF]">Balance: Rs. {acc.balance.toLocaleString()}</p>
                  </div>
                  {selectedId === acc.id && <Check className="w-5 h-5 text-[#10B981]" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom">
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2"
        >
          <CreditCard className="w-5 h-5" />
          Confirm Payment
        </button>
      </div>
    </div>
  );
}
