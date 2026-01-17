import React, { useState } from "react";
import { Banknote, Building2, CreditCard, FileText } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type PaymentMethod = "cash" | "bank" | "card" | "cheque";
type TransactionType = "sale" | "purchase";

interface Account {
  id: string;
  name: string;
  balance: number;
  icon: string;
  type: "cash" | "bank" | "card";
}

interface PaymentFooterWidgetProps {
  transactionType?: TransactionType;
  onPaymentChange?: (data: {
    method: PaymentMethod;
    amount: number;
    accountId: string;
    reference?: string;
  }) => void;
}

export function PaymentFooterWidget({
  transactionType = "sale",
  onPaymentChange,
}: PaymentFooterWidgetProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
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

  const accountLabel =
    transactionType === "sale" ? "Deposit Into Account" : "Pay From Account";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
      {/* Row 1: Payment Method Tabs */}
      <div>
        <Label className="text-gray-400 text-xs mb-3 block">
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
                className={`
                  relative flex flex-col items-center justify-center p-4 rounded-lg
                  border-2 transition-all duration-200
                  ${
                    isActive
                      ? "border-blue-600 bg-blue-600/10"
                      : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                  }
                `}
              >
                {/* Glow effect on active */}
                {isActive && (
                  <div className="absolute inset-0 bg-blue-600/5 rounded-lg blur-sm" />
                )}

                <div className="relative z-10 flex flex-col items-center gap-2">
                  <span className="text-2xl">{method.emoji}</span>
                  <span
                    className={`text-sm font-medium ${
                      isActive ? "text-blue-400" : "text-gray-400"
                    }`}
                  >
                    {method.label}
                  </span>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Payment Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Input A: Received Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount" className="text-gray-400 text-xs">
            {transactionType === "sale" ? "Received Amount" : "Paid Amount"}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              Rs
            </span>
            <Input
              id="amount"
              type="text"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, "");
                setAmount(value);
              }}
              className="pl-10 bg-gray-800 border-gray-700 text-white text-lg font-semibold h-12 focus:border-blue-600 focus:ring-blue-600/20"
            />
          </div>
        </div>

        {/* Input B: Account Selector */}
        <div className="space-y-2">
          <Label htmlFor="account" className="text-gray-400 text-xs">
            {accountLabel}
          </Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger
              id="account"
              className="bg-gray-800 border-gray-700 text-white h-12 focus:border-blue-600 focus:ring-blue-600/20"
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
                    <span className="font-medium text-white">
                      {accounts.find((acc) => acc.id === selectedAccount)?.name}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
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
            <SelectContent className="bg-gray-800 border-gray-700">
              {getFilteredAccounts().map((account) => (
                <SelectItem
                  key={account.id}
                  value={account.id}
                  className="text-white hover:bg-gray-700 focus:bg-gray-700 cursor-pointer py-3"
                >
                  <div className="flex items-center gap-3 w-full">
                    <span className="text-lg">{account.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white">
                        {account.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        Balance: {formatCurrency(account.balance)}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Input C: Reference */}
        <div className="space-y-2">
          <Label htmlFor="reference" className="text-gray-400 text-xs">
            {selectedMethod === "cheque"
              ? "Cheque Number"
              : selectedMethod === "bank"
              ? "Transaction ID"
              : "Reference"}
            <span className="text-gray-600 ml-1">(Optional)</span>
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
            className="bg-gray-800 border-gray-700 text-white h-12 focus:border-blue-600 focus:ring-blue-600/20"
          />
        </div>
      </div>

      {/* Summary Info */}
      {amount && selectedAccount && (
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="text-lg">
              {paymentMethods.find((m) => m.id === selectedMethod)?.emoji}
            </span>
            <span>
              {formatCurrency(parseFloat(amount) || 0)} via {selectedMethod}
            </span>
          </div>
          {reference && (
            <div className="text-xs text-gray-500">Ref: {reference}</div>
          )}
        </div>
      )}
    </div>
  );
}
