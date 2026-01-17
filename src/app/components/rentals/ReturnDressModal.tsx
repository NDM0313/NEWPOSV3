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
      <DialogContent 
        className="sm:max-w-[600px] animate-in fade-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)'
        }}
      >
        <DialogHeader>
          <DialogTitle 
            className="flex items-center gap-2 text-xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <CheckCircle2 style={{ color: 'var(--color-success)' }} />
            Process Return & Release Security
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Top Info Bar */}
          <div 
            className="border p-4 rounded-lg flex justify-between items-center"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
             <div>
                <p 
                  className="text-xs uppercase"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Customer
                </p>
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {customerName}
                </p>
             </div>
             <div className="text-right">
                <p 
                  className="text-xs uppercase"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Security Held
                </p>
                <div className="flex items-center gap-2 justify-end">
                    <Badge 
                      variant="outline" 
                      className="capitalize"
                      style={{
                        backgroundColor: 'rgba(30, 58, 138, 0.2)',
                        color: 'var(--color-primary)',
                        borderColor: 'rgba(30, 58, 138, 0.5)'
                      }}
                    >
                        {securityType.replace('_', ' ')}
                    </Badge>
                    {isCashDeposit && (
                      <span 
                        className="font-mono font-bold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        ${securityValue.toLocaleString()}
                      </span>
                    )}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
             {/* Left Col: Condition & Penalty Inputs */}
             <div className="space-y-4">
                <h4 
                  className="font-medium border-b pb-2 text-sm uppercase"
                  style={{
                    color: 'var(--color-text-primary)',
                    borderBottomColor: 'var(--color-border-primary)'
                  }}
                >
                  Condition Check
                </h4>
                
                <div className="space-y-3">
                    <Label style={{ color: 'var(--color-text-primary)' }}>Dress Condition</Label>
                    <RadioGroup defaultValue="Good" value={returnCondition} onValueChange={(v: any) => setReturnCondition(v)} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Good" id="r1" style={{ borderColor: 'var(--color-border-secondary)' }} />
                            <Label htmlFor="r1" className="cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>Good</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Damaged" id="r2" style={{ borderColor: 'var(--color-border-secondary)' }} />
                            <Label htmlFor="r2" className="cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>Damaged</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="flex items-start space-x-3 pt-2">
                    <Checkbox 
                        id="accessories" 
                        checked={accessoriesOk} 
                        onCheckedChange={(c) => setAccessoriesOk(c === true)}
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label 
                          htmlFor="accessories" 
                          className="text-sm font-medium leading-none"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                        Accessories Returned
                        </Label>
                        <p 
                          className="text-xs"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                        Check kit inventory.
                        </p>
                    </div>
                </div>

                {(returnCondition === 'Damaged' || !accessoriesOk) && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                        <Label style={{ color: 'var(--color-error)' }}>Damage / Missing Penalty ($)</Label>
                        <Input 
                            type="number" 
                            placeholder="0.00"
                            value={penaltyAmount}
                            onChange={(e) => setPenaltyAmount(e.target.value)}
                            style={{
                              backgroundColor: 'var(--color-bg-card)',
                              borderColor: 'rgba(127, 29, 29, 0.5)',
                              color: 'var(--color-text-primary)'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = 'var(--color-error)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = 'rgba(127, 29, 29, 0.5)';
                            }}
                        />
                        <Input 
                            placeholder="Reason (e.g. Tear on hem, missing belt)"
                            value={penaltyReason}
                            onChange={(e) => setPenaltyReason(e.target.value)}
                            className="text-xs h-8"
                            style={{
                              backgroundColor: 'var(--color-bg-card)',
                              borderColor: 'var(--color-border-primary)',
                              color: 'var(--color-text-primary)'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = 'var(--color-primary)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = 'var(--color-border-primary)';
                            }}
                        />
                    </div>
                )}
             </div>

             {/* Right Col: Financial Calculation */}
             <div 
               className="rounded-lg p-4 space-y-4 border"
               style={{
                 backgroundColor: 'rgba(31, 41, 55, 0.5)',
                 borderColor: 'var(--color-border-primary)',
                 borderRadius: 'var(--radius-lg)'
               }}
             >
                <h4 
                  className="font-medium border-b pb-2 text-sm uppercase"
                  style={{
                    color: 'var(--color-text-primary)',
                    borderBottomColor: 'var(--color-border-primary)'
                  }}
                >
                  Refund / Settlement
                </h4>
                
                <div className="space-y-2 text-sm">
                    {isCashDeposit && (
                        <div 
                          className="flex justify-between"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                            <span>Security Deposit</span>
                            <span 
                              className="font-mono"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              ${securityValue.toLocaleString()}
                            </span>
                        </div>
                    )}
                    
                    {lateFee > 0 && (
                        <div 
                          className="flex justify-between"
                          style={{ color: 'var(--color-error)' }}
                        >
                            <span>Late Fees ({daysLate} Days)</span>
                            <span className="font-mono">-${lateFee.toLocaleString()}</span>
                        </div>
                    )}

                    {parseFloat(penaltyAmount) > 0 && (
                        <div 
                          className="flex justify-between"
                          style={{ color: 'var(--color-error)' }}
                        >
                            <span>Damage Penalty</span>
                            <span className="font-mono">-${parseFloat(penaltyAmount).toLocaleString()}</span>
                        </div>
                    )}
                    
                    <Separator style={{ backgroundColor: 'var(--color-border-secondary)' }} className="my-2" />

                    {isCashDeposit ? (
                        <>
                             <div className="flex justify-between items-center">
                                <span 
                                  className="font-bold"
                                  style={{ color: 'var(--color-text-primary)' }}
                                >
                                  Net Refund
                                </span>
                                <span 
                                  className={cn("font-bold font-mono text-lg", refundAmount > 0 ? "" : "")}
                                  style={{ 
                                    color: refundAmount > 0 ? 'var(--color-success)' : 'var(--color-text-tertiary)'
                                  }}
                                >
                                    ${refundAmount.toLocaleString()}
                                </span>
                            </div>
                            {balanceDue > 0 && (
                                <div 
                                  className="mt-3 border p-2 rounded text-xs flex items-start gap-2"
                                  style={{
                                    backgroundColor: 'rgba(127, 29, 29, 0.2)',
                                    borderColor: 'rgba(127, 29, 29, 0.5)',
                                    color: 'var(--color-error)',
                                    borderRadius: 'var(--radius-sm)'
                                  }}
                                >
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
                                 <span 
                                   className="font-bold"
                                   style={{ color: 'var(--color-text-primary)' }}
                                 >
                                   Total Payable
                                 </span>
                                 <span 
                                   className={cn("font-bold font-mono text-lg", balanceDue > 0 ? "" : "")}
                                   style={{ 
                                     color: balanceDue > 0 ? 'var(--color-error)' : 'var(--color-success)'
                                   }}
                                 >
                                     ${balanceDue.toLocaleString()}
                                 </span>
                             </div>
                             {balanceDue === 0 ? (
                                 <div 
                                   className="border p-2 rounded text-xs flex items-center gap-2"
                                   style={{
                                     backgroundColor: 'rgba(5, 150, 105, 0.2)',
                                     borderColor: 'rgba(5, 150, 105, 0.5)',
                                     color: 'var(--color-success)',
                                     borderRadius: 'var(--radius-sm)'
                                   }}
                                 >
                                     <FileCheck size={14} />
                                     Release Document (No Dues)
                                 </div>
                             ) : (
                                 <div 
                                   className="border p-2 rounded text-xs flex items-start gap-2"
                                   style={{
                                     backgroundColor: 'rgba(234, 179, 8, 0.2)',
                                     borderColor: 'rgba(234, 179, 8, 0.5)',
                                     color: 'var(--color-warning)',
                                     borderRadius: 'var(--radius-sm)'
                                   }}
                                 >
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
             className="font-bold w-full sm:w-auto shadow-lg"
             style={{
               backgroundColor: balanceDue > 0 ? 'var(--color-error)' : 'var(--color-success)',
               color: 'var(--color-text-primary)',
               boxShadow: balanceDue > 0 
                 ? '0 10px 15px -3px rgba(127, 29, 29, 0.2)' 
                 : '0 10px 15px -3px rgba(5, 150, 105, 0.2)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.opacity = '0.9';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.opacity = '1';
             }}
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
