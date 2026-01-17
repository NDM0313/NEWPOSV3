import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Trash2, 
  Copy, 
  CreditCard, 
  Loader2, 
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

// --- 1. Custom Toast Components (for advanced styling if Sonner's default isn't enough, but Sonner is flexible)
// We will use standard Sonner toast() calls with custom styling/icons as requested.

// --- 2. Table Row Animation Component
const AnimatedTableRow = ({ item, onUpdateStatus, onDelete }: any) => {
  const [isFlashing, setIsFlashing] = useState(false);
  const [prevStatus, setPrevStatus] = useState(item.status);

  useEffect(() => {
    // Trigger flash if status changes
    if (item.status !== prevStatus) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 1000); // 1s flash
      setPrevStatus(item.status);
      return () => clearTimeout(timer);
    }
  }, [item.status, prevStatus]);

  return (
    <TableRow 
      className={cn(
        "transition-colors duration-500",
        isFlashing ? "bg-green-500/10" : "hover:bg-gray-800/50"
      )}
    >
      <TableCell className="font-medium text-white">{item.id}</TableCell>
      <TableCell>{item.product}</TableCell>
      <TableCell>${item.amount}</TableCell>
      <TableCell>
        <Badge 
          className={cn(
            "transition-all duration-300",
            item.status === 'Paid' 
              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" 
              : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 cursor-pointer"
          )}
          onClick={() => item.status === 'Pending' && onUpdateStatus(item.id)}
        >
          {item.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-red-400" onClick={() => onDelete(item.id)}>
          <Trash2 size={16} />
        </Button>
      </TableCell>
    </TableRow>
  );
};

// --- Main Demo Component
export const InteractiveFeedbackDemo = () => {
  // --- State for Loading Button
  const [isSaving, setIsSaving] = useState(false);

  // --- State for Table
  const [transactions, setTransactions] = useState([
    { id: "TRX-001", product: "Bridal Lehenga Rental", amount: 500, status: "Pending" },
    { id: "TRX-002", product: "Groom Sherwani", amount: 350, status: "Paid" },
    { id: "TRX-003", product: "Jewelry Set #5", amount: 120, status: "Pending" },
  ]);

  // --- handlers
  const handlePaymentSuccess = () => {
    toast.success("Payment Recorded", {
      description: "Payment of $500 recorded. Status updated to Partial.",
      icon: <div className="bg-green-500/20 p-1 rounded-full"><Check size={16} className="text-green-500" /></div>,
      style: {
        background: '#000',
        border: '1px solid #333',
        color: '#fff',
      },
      className: "group-[.toaster]:bg-black group-[.toaster]:text-white group-[.toaster]:border-gray-800",
    });
  };

  const handleDuplicate = () => {
    toast.success("Product Duplicated", {
      description: "Product duplicated successfully.",
      icon: <div className="bg-blue-500/20 p-1 rounded-full"><Copy size={16} className="text-blue-500" /></div>,
      style: { background: '#000', border: '1px solid #333', color: '#fff' }
    });
  };

  const handleDeleteToast = () => {
    toast.error("Item Deleted", {
      description: "Item moved to trash.",
      icon: <div className="bg-red-500/20 p-1 rounded-full"><Trash2 size={16} className="text-red-500" /></div>,
      style: { background: '#000', border: '1px solid #333', color: '#fff' } // Force dark styling
    });
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Changes Saved");
    }, 2000);
  };

  const handleUpdateStatus = (id: string) => {
    // 1. Update state
    setTransactions(prev => prev.map(t => 
      t.id === id ? { ...t, status: "Paid" } : t
    ));
    
    // 2. Trigger toast
    toast.success("Status Updated", {
        description: `Transaction ${id} marked as Paid.`,
        icon: <div className="bg-green-500/20 p-1 rounded-full"><Check size={16} className="text-green-500" /></div>,
        style: { background: '#000', border: '1px solid #333', color: '#fff' }
    });
  };

  const handleDeleteRow = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    handleDeleteToast();
  };

  return (
    <div className="p-8 space-y-12 max-w-5xl mx-auto animate-in fade-in duration-500">
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Interactive Feedback States</h1>
        <p className="text-gray-400">Demonstration of Toasts, Animations, and Loading states.</p>
      </div>

      {/* 1. Toast Notifications Demo */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <div className="h-6 w-1 bg-blue-500 rounded-full"></div>
          1. Toast Notifications
        </h2>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Trigger Toasts</CardTitle>
            <CardDescription className="text-gray-400">Click buttons to see the different toast variants.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button 
              onClick={handlePaymentSuccess}
              variant="outline" 
              className="border-green-900/50 bg-green-900/10 text-green-400 hover:bg-green-900/20 hover:text-green-300"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Payment Success
            </Button>

            <Button 
              onClick={handleDuplicate}
              variant="outline"
              className="border-blue-900/50 bg-blue-900/10 text-blue-400 hover:bg-blue-900/20 hover:text-blue-300"
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicate Success
            </Button>

            <Button 
              onClick={handleDeleteToast}
              variant="outline"
              className="border-red-900/50 bg-red-900/10 text-red-400 hover:bg-red-900/20 hover:text-red-300"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Notification
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* 2. Table Row Animation Demo */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <div className="h-6 w-1 bg-green-500 rounded-full"></div>
          2. Table Row Update Animation
        </h2>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Live Status Updates</CardTitle>
            <CardDescription className="text-gray-400">
              Click the <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/10 cursor-default mx-1">Pending</Badge> 
              badge to mark as Paid. Watch the row flash green.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-gray-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-950">
                  <TableRow className="hover:bg-gray-950 border-gray-800">
                    <TableHead className="text-gray-400 w-[100px]">ID</TableHead>
                    <TableHead className="text-gray-400">Product</TableHead>
                    <TableHead className="text-gray-400">Amount</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-right text-gray-400">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-gray-900/50">
                  {transactions.map((trx) => (
                    <AnimatedTableRow 
                      key={trx.id} 
                      item={trx} 
                      onUpdateStatus={handleUpdateStatus}
                      onDelete={handleDeleteRow}
                    />
                  ))}
                  {transactions.length === 0 && (
                     <TableRow>
                       <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                         <div className="flex flex-col items-center gap-2">
                           <RefreshCw size={24} className="opacity-50" />
                           <p>All items deleted. Refresh page to reset.</p>
                           <Button variant="link" onClick={() => setTransactions([
                              { id: "TRX-001", product: "Bridal Lehenga Rental", amount: 500, status: "Pending" },
                              { id: "TRX-002", product: "Groom Sherwani", amount: 350, status: "Paid" },
                              { id: "TRX-003", product: "Jewelry Set #5", amount: 120, status: "Pending" },
                           ])}>Reset Data</Button>
                         </div>
                       </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Loading Button States */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <div className="h-6 w-1 bg-purple-500 rounded-full"></div>
          3. Loading Button States
        </h2>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Async Action Simulation</CardTitle>
            <CardDescription className="text-gray-400">Click Save to see the loading state transformation.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-4 p-6 border border-dashed border-gray-800 rounded-lg bg-gray-950/50 justify-center">
                
                {/* The Loading Button */}
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-500 text-white min-w-[140px] transition-all"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                      Processing...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>

             </div>
          </CardContent>
        </Card>
      </section>

    </div>
  );
};
