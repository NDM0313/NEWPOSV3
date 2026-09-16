import React from 'react';
import { Plus, Search, ShoppingBag, DollarSign, Package, TrendingDown, MoreVertical, Eye, Edit, Trash2, FileText } from 'lucide-react';
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useNavigation } from '../../context/NavigationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const mockPurchases = [
  { id: 1, refNo: 'PO-001', supplier: 'Bilal Fabrics', date: '2024-01-15', location: 'Main Branch', items: 24, total: 15000, paid: 10000, due: 5000, purchaseStatus: 'Received', paymentStatus: 'Partial', addedBy: 'Ahmad Khan' },
  { id: 2, refNo: 'PO-002', supplier: 'ChenOne', date: '2024-01-14', location: 'Warehouse A', items: 56, total: 120000, paid: 120000, due: 0, purchaseStatus: 'Received', paymentStatus: 'Paid', addedBy: 'Sara Ali' },
  { id: 3, refNo: 'PO-003', supplier: 'Sapphire Mills', date: '2024-01-13', location: 'Main Branch', items: 12, total: 45000, paid: 0, due: 45000, purchaseStatus: 'Ordered', paymentStatus: 'Unpaid', addedBy: 'Bilal Ahmed' },
  { id: 4, refNo: 'PO-004', supplier: 'Local Supplier', date: '2024-01-12', location: 'Warehouse B', items: 8, total: 8500, paid: 8500, due: 0, purchaseStatus: 'Received', paymentStatus: 'Paid', addedBy: 'Ahmad Khan' },
];

export const PurchaseDashboard = () => {
  const { openDrawer } = useNavigation();

  const totalPurchase = mockPurchases.reduce((acc, p) => acc + p.total, 0);
  const totalDue = mockPurchases.reduce((acc, p) => acc + p.due, 0);
  const totalReturns = 2500; // Mock value

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Purchases</h2>
          <p className="text-muted-foreground text-sm">Manage purchase orders and supplier transactions.</p>
        </div>
        <Button 
          onClick={() => openDrawer('addPurchase')}
          className="bg-orange-600 hover:bg-orange-500 text-foreground gap-2 shadow-lg shadow-orange-500/20"
        >
          <Plus size={18} />
          Add Purchase
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard 
          title="Total Purchase" 
          value={`$${totalPurchase.toLocaleString()}`}
          subtitle="This Month"
          icon={ShoppingBag}
          highlightColor="text-orange-400" 
        />
        <GlassCard 
          title="Amount Due" 
          value={`$${totalDue.toLocaleString()}`}
          subtitle="Pending Payments"
          icon={DollarSign}
          highlightColor="text-red-400"
        />
        <GlassCard 
          title="Returns" 
          value={`$${totalReturns.toLocaleString()}`}
          subtitle="2 Items Returned"
          icon={Package}
          highlightColor="text-yellow-400"
        />
        <GlassCard 
          title="Purchase Orders" 
          value={mockPurchases.length.toString()}
          subtitle="Active Orders"
          icon={FileText}
          highlightColor="text-blue-400"
        />
      </div>

      {/* Table Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Table Header with Method Badge */}
        <div className="px-6 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Purchase Orders</h3>
            <span className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full text-xs font-medium">
              Standard Method
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4"></th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Reference No</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4 text-center">Purchase Status</th>
                <th className="px-6 py-4 text-center">Payment Status</th>
                <th className="px-6 py-4 text-right">Grand Total</th>
                <th className="px-6 py-4 text-right">Payment Due</th>
                <th className="px-6 py-4">Added By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-muted/50 transition-colors group">
                  <td className="px-6 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                        <DropdownMenuItem className="hover:bg-muted cursor-pointer">
                          <Eye size={14} className="mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-muted cursor-pointer">
                          <Edit size={14} className="mr-2" />
                          Edit Purchase
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-muted cursor-pointer">
                          <FileText size={14} className="mr-2" />
                          Generate Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-muted cursor-pointer">
                          <DollarSign size={14} className="mr-2" />
                          Add Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-muted cursor-pointer text-red-400">
                          <Trash2 size={14} className="mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(purchase.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-foreground">{purchase.refNo}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-muted-foreground">{purchase.location}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{purchase.supplier}</p>
                      <p className="text-xs text-muted-foreground">{purchase.items} items</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      purchase.purchaseStatus === 'Received' ? "bg-green-500/10 text-green-500" : 
                      purchase.purchaseStatus === 'Ordered' ? "bg-blue-500/10 text-blue-500" :
                      "bg-gray-500/10 text-muted-foreground"
                    )}>
                      {purchase.purchaseStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      purchase.paymentStatus === 'Paid' ? "bg-green-500/10 text-green-500" : 
                      purchase.paymentStatus === 'Partial' ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-red-500/10 text-red-500"
                    )}>
                      {purchase.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-foreground">${purchase.total.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {purchase.due > 0 ? (
                      <span className="text-red-400 font-medium">${purchase.due.toLocaleString()}</span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-muted-foreground text-sm">{purchase.addedBy}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const GlassCard = ({ title, value, subtitle, icon: Icon, highlightColor }: any) => (
  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-xl shadow-lg relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <Icon size={48} className="text-foreground" />
    </div>
    <p className="text-muted-foreground text-sm font-medium">{title}</p>
    <div className="flex items-end gap-3 mt-1 mb-2">
      <h3 className={cn("text-3xl font-bold", highlightColor || "text-foreground")}>{value}</h3>
    </div>
    <p className="text-muted-foreground text-xs">{subtitle}</p>
  </div>
);