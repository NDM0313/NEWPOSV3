import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, FileCheck, X, Calculator, Receipt, AlertCircle, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { cn } from "../ui/utils";
import { toast } from "sonner";

interface ReturnDressModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  securityType: string;
  securityValue: number; // Cash amount or 0 for documents
  returnDate: Date;
}

export const ReturnDressModal = ({ 
  isOpen, 
  onClose, 
  customerName, 
  securityType, 
  securityValue,
  returnDate 
}: ReturnDressModalProps) => {
  const [returnCondition, setReturnCondition] = useState<'Good' | 'Damaged'>('Good');
  const [accessoriesOk, setAccessoriesOk] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState<string>('');
  const [penaltyReason, setPenaltyReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock late calculation
  const today = new Date();
  const isLate = today > returnDate;
  // Simple check: if mock today is "after" return date. 
  // Since we use real Date() it won't be late unless returnDate is in past.
  // For demo, let's trust the prop logic or just assume 0 if not late.
  const daysLate = Math.max(0, Math.ceil((today.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24)));
  const lateFee = daysLate * 2500; 

  const totalDeductions = (parseFloat(penaltyAmount) || 0) + lateFee;
  
  // Logic:
  // If Cash Deposit: Refund = Deposit - Deductions.
  // If Document: Balance Due = Deductions.
  const isCashDeposit = securityType === 'cash';
  const refundAmount = isCashDeposit ? Math.max(0, securityValue - totalDeductions) : 0;
  const balanceDue = isCashDeposit 
    ? Math.max(0, totalDeductions - securityValue) 
    : totalDeductions;

  const handleReturn = async () => {
    setIsProcessing(true);
    
    // Simulate Backend API Call
    console.log("--- BACKEND TRANSACTION LOG ---");
    console.log(`1. UPDATE RentalOrder SET status = 'RETURNED' WHERE customer = '${customerName}'`);
    
    if (totalDeductions > 0) {
        console.log("2. ACCOUNTING ENTRY (PENALTY/LATE FEE):");
        console.log(`   - CREDIT: Other Income (Penalty) = ${totalDeductions}`);
        if (isCashDeposit) {
            console.log(`   - DEBIT: Security Liability Account = ${Math.min(securityValue, totalDeductions)}`);
        } else {
            console.log(`   - DEBIT: Accounts Receivable (Invoice Generated) = ${balanceDue}`);
        }
    }

    if (returnCondition === 'Damaged') {
        console.log("3. INVENTORY UPDATE:");
        console.log("   - UPDATE Product SET status = 'DAMAGED_IN_REPAIR', isSellable = false, isRentable = false");
    } else {
        console.log("3. INVENTORY UPDATE:");
        console.log("   - UPDATE Product SET status = 'AVAILABLE', isSellable = true, isRentable = true");
    }

    if (balanceDue > 0) {
        console.log(`4. GENERATE INVOICE #${Math.floor(Math.random() * 10000)} for Balance Due: ${balanceDue}`);
        toast.error(`Invoice generated for Balance Due: $${balanceDue}`);
    } else {
        if (isCashDeposit && refundAmount > 0) {
            toast.success(`Refund processed: $${refundAmount}`);
        }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success("Return processed successfully. Inventory updated.");
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-gray-950 text-white border-gray-800 animate-in fade-in zoom-in-95 duration-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-white">
            <CheckCircle2 className="text-green-500" />
            Process Return & Release Security
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Top Info Bar */}
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg flex justify-between items-center">
             <div>
                <p className="text-gray-400 text-xs uppercase">Customer</p>
                <p className="font-semibold">{customerName}</p>
             </div>
             <div className="text-right">
                <p className="text-gray-400 text-xs uppercase">Security Held</p>
                <div className="flex items-center gap-2 justify-end">
                    <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-800 capitalize">
                        {securityType.replace('_', ' ')}
                    </Badge>
                    {isCashDeposit && <span className="font-mono font-bold">${securityValue.toLocaleString()}</span>}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
             {/* Left Col: Condition & Penalty Inputs */}
             <div className="space-y-4">
                <h4 className="font-medium text-white border-b border-gray-800 pb-2 text-sm uppercase text-gray-400">Condition Check</h4>
                
                <div className="space-y-3">
                    <Label>Dress Condition</Label>
                    <RadioGroup defaultValue="Good" value={returnCondition} onValueChange={(v: any) => setReturnCondition(v)} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Good" id="r1" className="border-gray-600 text-green-500" />
                            <Label htmlFor="r1" className="text-white cursor-pointer">Good</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Damaged" id="r2" className="border-gray-600 text-red-500" />
                            <Label htmlFor="r2" className="text-white cursor-pointer">Damaged</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="flex items-start space-x-3 pt-2">
                    <Checkbox 
                        id="accessories" 
                        checked={accessoriesOk} 
                        onCheckedChange={(c) => setAccessoriesOk(c === true)}
                        className="border-gray-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="accessories" className="text-sm font-medium leading-none">
                        Accessories Returned
                        </Label>
                        <p className="text-xs text-gray-500">
                        Check kit inventory.
                        </p>
                    </div>
                </div>

                {(returnCondition === 'Damaged' || !accessoriesOk) && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                        <Label className="text-red-400">Damage / Missing Penalty ($)</Label>
                        <Input 
                            type="number" 
                            placeholder="0.00"
                            value={penaltyAmount}
                            onChange={(e) => setPenaltyAmount(e.target.value)}
                            className="bg-gray-900 border-red-900/50 focus:border-red-500 text-white"
                        />
                        <Input 
                            placeholder="Reason (e.g. Tear on hem, missing belt)"
                            value={penaltyReason}
                            onChange={(e) => setPenaltyReason(e.target.value)}
                            className="bg-gray-900 border-gray-800 text-xs h-8"
                        />
                    </div>
                )}
             </div>

             {/* Right Col: Financial Calculation */}
             <div className="bg-gray-900/50 rounded-lg p-4 space-y-4 border border-gray-800">
                <h4 className="font-medium text-white border-b border-gray-800 pb-2 text-sm uppercase text-gray-400">Refund / Settlement</h4>
                
                <div className="space-y-2 text-sm">
                    {isCashDeposit && (
                        <div className="flex justify-between text-gray-400">
                            <span>Security Deposit</span>
                            <span className="text-white font-mono">${securityValue.toLocaleString()}</span>
                        </div>
                    )}
                    
                    {lateFee > 0 && (
                        <div className="flex justify-between text-red-400">
                            <span>Late Fees ({daysLate} Days)</span>
                            <span className="font-mono">-${lateFee.toLocaleString()}</span>
                        </div>
                    )}

                    {parseFloat(penaltyAmount) > 0 && (
                        <div className="flex justify-between text-red-400">
                            <span>Damage Penalty</span>
                            <span className="font-mono">-${parseFloat(penaltyAmount).toLocaleString()}</span>
                        </div>
                    )}
                    
                    <Separator className="bg-gray-700 my-2" />

                    {isCashDeposit ? (
                        <>
                             <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-200">Net Refund</span>
                                <span className={cn("font-bold font-mono text-lg", refundAmount > 0 ? "text-green-500" : "text-gray-500")}>
                                    ${refundAmount.toLocaleString()}
                                </span>
                            </div>
                            {balanceDue > 0 && (
                                <div className="mt-3 bg-red-900/20 border border-red-900/50 p-2 rounded text-xs text-red-300 flex items-start gap-2">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                    <span>
                                        Deposit insufficient. Customer owes <b>${balanceDue.toLocaleString()}</b>. 
                                        System will generate Invoice.
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-3">
                             <div className="flex justify-between items-center">
                                 <span className="font-bold text-gray-200">Total Payable</span>
                                 <span className={cn("font-bold font-mono text-lg", balanceDue > 0 ? "text-red-500" : "text-green-500")}>
                                     ${balanceDue.toLocaleString()}
                                 </span>
                             </div>
                             {balanceDue === 0 ? (
                                 <div className="bg-green-900/20 border border-green-900/50 p-2 rounded text-xs text-green-400 flex items-center gap-2">
                                     <FileCheck size={14} />
                                     Release Document (No Dues)
                                 </div>
                             ) : (
                                 <div className="bg-yellow-900/20 border border-yellow-900/50 p-2 rounded text-xs text-yellow-400 flex items-start gap-2">
                                     <Receipt size={14} className="mt-0.5 shrink-0" />
                                     <span>
                                         Collect Payment to release document.
                                     </span>
                                 </div>
                             )}
                         </div>
                     )}
                 </div>
              </div>
           </div>
         </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
           <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">Cancel</Button>
           <Button 
             className={cn(
                 "font-bold w-full sm:w-auto shadow-lg",
                 balanceDue > 0 ? "bg-red-600 hover:bg-red-500 shadow-red-900/20" : "bg-green-600 hover:bg-green-500 shadow-green-900/20"
             )}
             disabled={isProcessing}
             onClick={handleReturn}
           >
             {isProcessing ? "Processing..." : balanceDue > 0 ? `Generate Invoice ($${balanceDue})` : isCashDeposit ? "Refund & Close" : "Release Document"}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
