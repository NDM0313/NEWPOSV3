import React, { useState } from "react";
import {
  DollarSign,
  CreditCard,
  Wallet,
  Receipt,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId: string;
  totalDue: number;
  supplierName: string;
}

export const AddPaymentModal = ({
  isOpen,
  onClose,
  purchaseOrderId,
  totalDue,
  supplierName,
}: AddPaymentModalProps) => {
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("cash");
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent 
        className="sm:max-w-[450px] p-0 gap-0 overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)'
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Record Payment for {purchaseOrderId}</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div 
          className="p-5 border-b"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          <div 
            className="text-lg font-bold flex flex-col gap-1"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <span>Record Payment</span>
            <span 
              className="text-sm font-normal"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              For {purchaseOrderId} •{" "}
              <span style={{ color: 'var(--color-primary)' }}>
                {supplierName}
              </span>
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Total Due Card */}
          <div 
            className="border p-4 rounded-lg flex items-center justify-between"
            style={{
              backgroundColor: 'rgba(127, 29, 29, 0.1)',
              borderColor: 'rgba(127, 29, 29, 0.3)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div>
              <p 
                className="text-xs uppercase font-bold tracking-wider"
                style={{ color: 'var(--color-error)' }}
              >
                Total Due
              </p>
              <p 
                className="text-xs mt-0.5"
                style={{ color: 'rgba(239, 68, 68, 0.7)' }}
              >
                Outstanding Balance
              </p>
            </div>
            <p 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-error)' }}
            >
              ${totalDue.toLocaleString()}
            </p>
          </div>

          <div className="space-y-4">
            {/* Paying Amount */}
            <div className="space-y-2">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Paying Amount
              </Label>
              <div className="relative">
                <DollarSign
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-secondary)' }}
                />
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  className="pl-9 text-lg font-bold"
                  autoFocus
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-success)';
                    e.target.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border-secondary)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Payment Account */}
            <div className="space-y-2">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Payment Account
              </Label>
              <Select
                value={account}
                onValueChange={setAccount}
              >
                <SelectTrigger 
                  className="h-11"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    {account === "cash" ? (
                      <Wallet
                        size={16}
                        style={{ color: 'var(--color-success)' }}
                      />
                    ) : (
                      <CreditCard
                        size={16}
                        style={{ color: 'var(--color-primary)' }}
                      />
                    )}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectItem value="cash">
                    Cash in Hand
                  </SelectItem>
                  <SelectItem value="bank">
                    Bank Transfer (HBL)
                  </SelectItem>
                  <SelectItem value="jazzcash">
                    JazzCash / EasyPaisa
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Note / Transaction ID */}
            <div className="space-y-2">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Transaction ID / Note
              </Label>
              <div className="relative">
                <Receipt
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-secondary)' }}
                />
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. TRX-998877 or 'Paid via Rider'"
                  className="pl-9"
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
          </div>
        </div>

        {/* Footer */}
        <div 
          className="p-5 border-t flex justify-end gap-3"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          <Button
            variant="ghost"
            onClick={onClose}
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            Cancel
          </Button>
          <Button 
            className="font-bold px-6"
            style={{
              backgroundColor: 'var(--color-success)',
              color: 'var(--color-text-primary)',
              boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)'
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
            <DollarSign size={16} className="mr-2" />
            Confirm Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};