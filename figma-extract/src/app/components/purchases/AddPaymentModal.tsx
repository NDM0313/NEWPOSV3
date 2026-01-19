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
      <DialogContent className="sm:max-w-[450px] bg-gray-900 text-white border-gray-800 p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Record Payment for {purchaseOrderId}</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-gray-950">
          <div className="text-lg font-bold text-white flex flex-col gap-1">
            <span>Record Payment</span>
            <span className="text-sm font-normal text-gray-400">
              For {purchaseOrderId} •{" "}
              <span className="text-blue-400">
                {supplierName}
              </span>
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Total Due Card */}
          <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-xs text-red-300 uppercase font-bold tracking-wider">
                Total Due
              </p>
              <p className="text-xs text-red-400/70 mt-0.5">
                Outstanding Balance
              </p>
            </div>
            <p className="text-2xl font-bold text-red-500">
              ${totalDue.toLocaleString()}
            </p>
          </div>

          <div className="space-y-4">
            {/* Paying Amount */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                Paying Amount
              </Label>
              <div className="relative">
                <DollarSign
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  className="bg-gray-800 border-gray-700 text-white pl-9 text-lg font-bold placeholder:text-gray-600 focus:border-green-500 focus:ring-green-500/20"
                  autoFocus
                />
              </div>
            </div>

            {/* Payment Account */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                Payment Account
              </Label>
              <Select
                value={account}
                onValueChange={setAccount}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-11">
                  <div className="flex items-center gap-2">
                    {account === "cash" ? (
                      <Wallet
                        size={16}
                        className="text-green-400"
                      />
                    ) : (
                      <CreditCard
                        size={16}
                        className="text-blue-400"
                      />
                    )}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
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
              <Label className="text-xs text-gray-500 uppercase tracking-wider">
                Transaction ID / Note
              </Label>
              <div className="relative">
                <Receipt
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. TRX-998877 or 'Paid via Rider'"
                  className="bg-gray-800 border-gray-700 text-white pl-9"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button className="bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-600/20 px-6">
            <DollarSign size={16} className="mr-2" />
            Confirm Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};