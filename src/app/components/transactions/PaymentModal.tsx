import React, { useState } from "react";
import { X, ArrowLeft, Banknote, Building2, CreditCard, FileText } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";

type PaymentMethod = "cash" | "bank" | "card" | "cheque";
type TransactionType = "sale" | "purchase";

interface Account {
  id: string;
  name: string;
  balance: number;
  icon: string;
  type: "cash" | "bank" | "card";
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentData: any) => void;
  grandTotal: number;
  transactionType?: TransactionType;
}

export function PaymentModal({
  isOpen,
  onClose,
  onConfirm,
  grandTotal,
  transactionType = "sale",
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState((grandTotal || 0).toString());
  const [selectedAccount, setSelectedAccount] = useState("");
  const [reference, setReference] = useState("");

  // Mock accounts data
  const accounts: Account[] = [
    {
      id: "cash-1",
      name: "Cash in Hand",
      balance: 125000,
      icon: "💵",
      type: "cash",
    },
    {
      id: "bank-1",
      name: "Meezan Bank",
      balance: 500000,
      icon: "🏦",
      type: "bank",
    },
    {
      id: "bank-2",
      name: "HBL - Business Account",
      balance: 750000,
      icon: "🏦",
      type: "bank",
    },
    {
      id: "bank-3",
      name: "Allied Bank",
      balance: 320000,
      icon: "🏦",
      type: "bank",
    },
    {
      id: "card-1",
      name: "Business Credit Card",
      balance: 180000,
      icon: "💳",
      type: "card",
    },
  ];

  // Auto-select cash account on mount
  React.useEffect(() => {
    const cashAccount = accounts.find((acc) => acc.type === "cash");
    if (cashAccount && !selectedAccount) {
      setSelectedAccount(cashAccount.id);
    }
  }, [selectedAccount]);

  const paymentMethods = [
    {
      id: "cash" as PaymentMethod,
      label: "Cash",
      icon: Banknote,
      emoji: "💵",
    },
    {
      id: "bank" as PaymentMethod,
      label: "Bank",
      icon: Building2,
      emoji: "🏛️",
    },
    {
      id: "card" as PaymentMethod,
      label: "Card",
      icon: CreditCard,
      emoji: "💳",
    },
    {
      id: "cheque" as PaymentMethod,
      label: "Cheque",
      icon: FileText,
      emoji: "📄",
    },
  ];

  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
    
    // Auto-select appropriate account based on method
    if (method === "cash") {
      const cashAccount = accounts.find((acc) => acc.type === "cash");
      if (cashAccount) setSelectedAccount(cashAccount.id);
    } else if (method === "bank" || method === "cheque") {
      const bankAccount = accounts.find((acc) => acc.type === "bank");
      if (bankAccount) setSelectedAccount(bankAccount.id);
    } else if (method === "card") {
      const cardAccount = accounts.find((acc) => acc.type === "card");
      if (cardAccount) setSelectedAccount(cardAccount.id);
    }
  };

  // Filter accounts based on selected payment method
  const getFilteredAccounts = () => {
    if (selectedMethod === "cash") {
      return accounts.filter((acc) => acc.type === "cash");
    } else if (selectedMethod === "bank" || selectedMethod === "cheque") {
      return accounts.filter((acc) => acc.type === "bank");
    } else if (selectedMethod === "card") {
      return accounts.filter((acc) => acc.type === "card");
    }
    return accounts;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleConfirm = () => {
    onConfirm({
      method: selectedMethod,
      amount: parseFloat(amount),
      accountId: selectedAccount,
      reference,
    });
    onClose();
  };

  const accountLabel =
    transactionType === "sale" ? "Deposit Into Account" : "Pay From Account";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl m-4"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-2xl)',
          borderWidth: '1px'
        }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 border-b p-6"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderBottomColor: 'var(--color-border-primary)'
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-full transition-colors"
              style={{ borderRadius: 'var(--radius-full)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ArrowLeft size={20} style={{ color: 'var(--color-text-secondary)' }} />
            </button>
            <div className="flex-1">
              <h2 
                className="text-xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Payment Details
              </h2>
              <p 
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Complete the transaction
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full transition-colors"
              style={{ borderRadius: 'var(--radius-full)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Net Payable Summary */}
          <div 
            className="border rounded-xl p-6"
            style={{
              background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <div className="text-center">
              <p 
                className="text-sm mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {transactionType === "sale" ? "Net Payable" : "Total Payment"}
              </p>
              <p 
                className="text-4xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {formatCurrency(grandTotal)}
              </p>
            </div>
          </div>

          {/* Payment Method Tabs */}
          <div>
            <Label 
              className="text-xs mb-3 block"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Payment Method
            </Label>
            <div className="grid grid-cols-4 gap-3">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isActive = selectedMethod === method.id;

                return (
                  <button
                    key={method.id}
                    onClick={() => handleMethodChange(method.id)}
                    className="relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200"
                    style={{
                      borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border-secondary)',
                      borderWidth: '2px',
                      backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(31, 41, 55, 0.5)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      }
                    }}
                  >
                    {/* Glow effect on active */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 rounded-lg blur-sm"
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.05)',
                          borderRadius: 'var(--radius-lg)'
                        }}
                      />
                    )}

                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <span className="text-2xl">{method.emoji}</span>
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)'
                        }}
                      >
                        {method.label}
                      </span>
                    </div>

                    {/* Active indicator */}
                    {isActive && (
                      <div 
                        className="absolute top-2 right-2 w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          borderRadius: 'var(--radius-full)'
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label 
                htmlFor="amount" 
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {transactionType === "sale" ? "Received Amount" : "Paid Amount"}
              </Label>
              <div className="relative">
                <span 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Rs
                </span>
                <Input
                  id="amount"
                  type="text"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, "");
                    setAmount(value);
                  }}
                  className="pl-10 text-lg font-semibold h-12"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-primary)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border-secondary)';
                  }}
                />
              </div>
            </div>

            {/* Account Selector */}
            <div className="space-y-2">
              <Label 
                htmlFor="account" 
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {accountLabel}
              </Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger
                  id="account"
                  className="h-12"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue placeholder="Select account...">
                    {selectedAccount && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {
                            accounts.find((acc) => acc.id === selectedAccount)
                              ?.icon
                          }
                        </span>
                        <span 
                          className="font-medium"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {accounts.find((acc) => acc.id === selectedAccount)?.name}
                        </span>
                        <span 
                          className="text-xs ml-auto"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          (Bal:{" "}
                          {formatCurrency(
                            accounts.find((acc) => acc.id === selectedAccount)
                              ?.balance || 0
                          )}
                          )
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)'
                  }}
                >
                  {getFilteredAccounts().map((account) => (
                    <SelectItem
                      key={account.id}
                      value={account.id}
                      className="cursor-pointer py-3"
                      style={{ color: 'var(--color-text-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <span className="text-lg">{account.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div 
                            className="font-medium"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {account.name}
                          </div>
                          <div 
                            className="text-xs"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Balance: {formatCurrency(account.balance)}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label 
                htmlFor="reference" 
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {selectedMethod === "cheque"
                  ? "Cheque Number"
                  : selectedMethod === "bank"
                  ? "Transaction ID"
                  : "Reference"}
                <span 
                  className="ml-1"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  (Optional)
                </span>
              </Label>
              <Input
                id="reference"
                type="text"
                placeholder={
                  selectedMethod === "cheque"
                    ? "e.g., CHQ-123456"
                    : selectedMethod === "bank"
                    ? "e.g., TXN-789012"
                    : "Enter reference..."
                }
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="h-12"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border-secondary)';
                }}
              />
            </div>
          </div>

          {/* Summary Info */}
          {amount && selectedAccount && (
            <div 
              className="flex items-center justify-between p-4 rounded-lg border"
              style={{
                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                borderColor: 'var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <div 
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <span className="text-lg">
                  {paymentMethods.find((m) => m.id === selectedMethod)?.emoji}
                </span>
                <span>
                  {formatCurrency(parseFloat(amount) || 0)} via {selectedMethod}
                </span>
              </div>
              {reference && (
                <div 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Ref: {reference}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="sticky bottom-0 border-t p-6"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderTopColor: 'var(--color-border-primary)'
          }}
        >
          <div className="flex gap-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-12"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!amount || !selectedAccount}
              className="flex-1 h-12 font-semibold"
              style={{
                backgroundColor: 'var(--color-success)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-success)';
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-success)';
                e.currentTarget.style.opacity = '1';
              }}
            >
              Confirm Payment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}