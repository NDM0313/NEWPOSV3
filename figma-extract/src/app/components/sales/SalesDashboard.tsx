import React from 'react';
import { Plus, ShoppingCart, DollarSign, TrendingUp, Calendar, MoreVertical, Eye, Edit, Trash2, FileText, Phone, MapPin, Package, Truck } from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { useNavigation } from '../../context/NavigationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ViewSaleDetailsDrawer } from './ViewSaleDetailsDrawer';
import { toast } from 'sonner';

const mockSales = [
  { 
    id: 1, 
    invoiceNo: 'INV-001', 
    customer: 'Ahmed Retailers',
    customerName: 'Ahmed Ali', 
    contactNumber: '+92-300-1234567',
    date: '2024-01-15', 
    location: 'Main Branch',
    items: 12, 
    subtotal: 45000, 
    expenses: 500, 
    total: 45500, 
    paid: 45500, 
    due: 0,
    returnDue: 0,
    paymentStatus: 'Paid',
    paymentMethod: 'Cash',
    shippingStatus: 'Delivered'
  },
  { 
    id: 2, 
    invoiceNo: 'INV-002', 
    customer: 'Walk-in Customer',
    customerName: 'Sara Khan',
    contactNumber: '+92-321-9876543',
    date: '2024-01-15', 
    location: 'Branch 2',
    items: 3, 
    subtotal: 8000, 
    expenses: 200, 
    total: 8200, 
    paid: 5000, 
    due: 3200,
    returnDue: 0,
    paymentStatus: 'Partial',
    paymentMethod: 'Card',
    shippingStatus: 'Pending'
  },
  { 
    id: 3, 
    invoiceNo: 'INV-003', 
    customer: 'Local Store',
    customerName: 'Bilal Ahmed',
    contactNumber: '+92-333-5555555',
    date: '2024-01-14', 
    location: 'Main Branch',
    items: 24, 
    subtotal: 98000, 
    expenses: 1200, 
    total: 99200, 
    paid: 0, 
    due: 99200,
    returnDue: 500,
    paymentStatus: 'Unpaid',
    paymentMethod: 'Credit',
    shippingStatus: 'Processing'
  },
  { 
    id: 4, 
    invoiceNo: 'INV-004', 
    customer: 'Ahmed Retailers',
    customerName: 'Usman Malik',
    contactNumber: '+92-345-7777777',
    date: '2024-01-14', 
    location: 'Branch 2',
    items: 8, 
    subtotal: 32000, 
    expenses: 800, 
    total: 32800, 
    paid: 32800, 
    due: 0,
    returnDue: 0,
    paymentStatus: 'Paid',
    paymentMethod: 'Bank Transfer',
    shippingStatus: 'Delivered'
  },
];

export const SalesDashboard = () => {
  const { openDrawer } = useNavigation();
  const [selectedSaleId, setSelectedSaleId] = React.useState<number | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = React.useState(false);

  const todaySales = mockSales.filter(s => s.date === '2024-01-15').reduce((acc, s) => acc + s.total, 0);
  const monthlySales = mockSales.reduce((acc, s) => acc + s.total, 0);
  const profit = mockSales.reduce((acc, s) => acc + (s.total * 0.25), 0); // Mock 25% profit

  const handleViewDetails = (saleId: number) => {
    setSelectedSaleId(saleId);
    setIsDetailsDrawerOpen(true);
  };

  const handleEditSale = (saleId: number) => {
    toast.info('Edit functionality will be implemented');
    // TODO: Navigate to edit form with pre-filled data
  };

  const handleDeleteSale = (saleId: number) => {
    toast.error('Delete functionality will be implemented');
    // TODO: Show confirmation dialog and delete
  };

  const handleAddPayment = (saleId: number) => {
    toast.info('Add Payment modal will be implemented');
    // TODO: Open payment modal
  };

  const handlePrintInvoice = (saleId: number) => {
    toast.info('Print functionality will be implemented');
    // TODO: Generate and print invoice
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Sales</h2>
          <p className="text-gray-400 text-sm">Track your sales and customer orders.</p>
        </div>
        <Button 
          onClick={() => openDrawer('addSale')}
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} />
          Add Sale
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard 
          title="Today's Sales" 
          value={`$${todaySales.toLocaleString()}`}
          subtitle="2 Transactions"
          icon={ShoppingCart}
          highlightColor="text-blue-400" 
        />
        <GlassCard 
          title="Monthly Sales" 
          value={`$${monthlySales.toLocaleString()}`}
          subtitle="This Month"
          icon={Calendar}
          highlightColor="text-green-400"
        />
        <GlassCard 
          title="Total Profit" 
          value={`$${profit.toLocaleString()}`}
          subtitle="25% Average Margin"
          icon={TrendingUp}
          highlightColor="text-yellow-400"
        />
        <GlassCard 
          title="Total Invoices" 
          value={mockSales.length.toString()}
          subtitle="Active Invoices"
          icon={FileText}
          highlightColor="text-purple-400"
        />
      </div>

      {/* Table Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-950/50 text-gray-400 font-medium border-b border-gray-800">
              <tr>
                <th className="px-6 py-4"></th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Invoice No.</th>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Contact Number</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4 text-center">Payment Status</th>
                <th className="px-6 py-4">Payment Method</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4 text-right">Total Paid</th>
                <th className="px-6 py-4 text-right">Sell Due</th>
                <th className="px-6 py-4 text-right">Sell Return Due</th>
                <th className="px-6 py-4 text-center">Shipping Status</th>
                <th className="px-6 py-4 text-center">Total Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {mockSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gray-500 hover:text-white"
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white">
                        <DropdownMenuItem 
                          className="hover:bg-gray-800 cursor-pointer"
                          onClick={() => handleViewDetails(sale.id)}
                        >
                          <Eye size={14} className="mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="hover:bg-gray-800 cursor-pointer"
                          onClick={() => handleEditSale(sale.id)}
                        >
                          <Edit size={14} className="mr-2" />
                          Edit Sale
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="hover:bg-gray-800 cursor-pointer"
                          onClick={() => handlePrintInvoice(sale.id)}
                        >
                          <FileText size={14} className="mr-2" />
                          Print Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="hover:bg-gray-800 cursor-pointer"
                          onClick={() => handleAddPayment(sale.id)}
                        >
                          <DollarSign size={14} className="mr-2" />
                          Add Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                          <Truck size={14} className="mr-2" />
                          Update Shipping
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="hover:bg-gray-800 cursor-pointer text-red-400"
                          onClick={() => handleDeleteSale(sale.id)}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                  <td className="px-6 py-4 text-gray-400">
                    {new Date(sale.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-white">{sale.invoiceNo}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white">{sale.customerName}</p>
                      <p className="text-xs text-gray-500">{sale.customer}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone size={12} className="text-gray-500" />
                      <span className="text-sm">{sale.contactNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <MapPin size={12} className="text-gray-500" />
                      <span className="text-sm">{sale.location}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      sale.paymentStatus === 'Paid' ? "bg-green-500/10 text-green-500" : 
                      sale.paymentStatus === 'Partial' ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-red-500/10 text-red-500"
                    )}>
                      {sale.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-300">{sale.paymentMethod}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-white">${sale.total.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-emerald-400 font-medium">${sale.paid.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {sale.due > 0 ? (
                      <span className="text-red-400 font-medium">${sale.due.toLocaleString()}</span>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {sale.returnDue > 0 ? (
                      <span className="text-orange-400 font-medium">${sale.returnDue.toLocaleString()}</span>
                    ) : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      sale.shippingStatus === 'Delivered' ? "bg-green-500/10 text-green-500" : 
                      sale.shippingStatus === 'Processing' ? "bg-blue-500/10 text-blue-500" :
                      "bg-yellow-500/10 text-yellow-500"
                    )}>
                      {sale.shippingStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-300">
                      <Package size={12} className="text-gray-500" />
                      <span className="font-medium">{sale.items}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Drawer */}
      <ViewSaleDetailsDrawer
        isOpen={isDetailsDrawerOpen}
        onClose={() => setIsDetailsDrawerOpen(false)}
        saleId={selectedSaleId}
        onEdit={handleEditSale}
        onDelete={handleDeleteSale}
        onAddPayment={handleAddPayment}
        onPrint={handlePrintInvoice}
      />
    </div>
  );
};

const GlassCard = ({ title, value, subtitle, icon: Icon, highlightColor }: any) => (
  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-xl shadow-lg relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <Icon size={48} className="text-white" />
    </div>
    <p className="text-gray-400 text-sm font-medium">{title}</p>
    <div className="flex items-end gap-3 mt-1 mb-2">
      <h3 className={cn("text-3xl font-bold", highlightColor || "text-white")}>{value}</h3>
    </div>
    <p className="text-gray-500 text-xs">{subtitle}</p>
  </div>
);