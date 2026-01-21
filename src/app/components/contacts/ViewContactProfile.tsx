import React, { useState } from 'react';
import { 
  Phone, 
  MessageCircle, 
  Mail, 
  MapPin, 
  CreditCard, 
  Download, 
  Calendar as CalendarIcon, 
  Printer, 
  FileText, 
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  X
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent } from "../ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter
} from "../ui/table";
import { cn } from "../ui/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

// Mock Data
const contactDetails = {
  name: "Mr. Din Mohammad",
  image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  initials: "DM",
  type: "Supplier",
  tags: ["Wholesale", "Active"],
  address: "Shop #45, Azam Cloth Market, Lahore",
  phone: "+92 300 1234567",
  taxId: "STRN-89898-12",
  stats: {
    totalDue: 450000,
    lastPayment: "12 Oct 2023",
    lastPaymentAmount: 50000,
    walletBalance: 12000
  }
};

const ledgerData = [
  { id: 1, date: "01-Dec-2025", ref: "INV-2023-001", description: "Purchase Invoice #500 - Winter Collection", debit: 0, credit: 150000, balance: 150000 },
  { id: 2, date: "05-Dec-2025", ref: "PAY-99887", description: "Payment via Bank Transfer", debit: 50000, credit: 0, balance: 100000 },
  { id: 3, date: "10-Dec-2025", ref: "RET-102", description: "Return - Damaged Goods (Invoice #500)", debit: 10000, credit: 0, balance: 90000 },
  { id: 4, date: "15-Dec-2025", ref: "INV-2023-045", description: "Purchase Invoice #545 - Accessories", debit: 0, credit: 60000, balance: 150000 },
  { id: 5, date: "28-Dec-2025", ref: "INV-2023-090", description: "Purchase Invoice #590 - Bridal Sets", debit: 0, credit: 300000, balance: 450000 },
];

interface ViewContactProfileProps {
  isOpen?: boolean;
  onClose?: () => void;
  contact?: any;
}

export const ViewContactProfile: React.FC<ViewContactProfileProps> = ({ isOpen = true, onClose, contact }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0B0F17] rounded-xl border border-gray-800 w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        )}
        
        <div className="flex flex-col lg:flex-row gap-6 p-6 overflow-auto flex-1">
      
      {/* 1. Left Sidebar (Identity Card) */}
      <div className="w-full lg:w-1/4 bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center h-fit sticky top-6">
        <Avatar className="h-32 w-32 mb-4 border-4 border-gray-800 shadow-xl">
          <AvatarImage src={contactDetails.image} />
          <AvatarFallback className="bg-blue-900 text-white text-2xl">{contactDetails.initials}</AvatarFallback>
        </Avatar>
        
        <h2 className="text-2xl font-bold text-white mb-2">{contactDetails.name}</h2>
        
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20">{contactDetails.type}</Badge>
          {contactDetails.tags.map(tag => (
            <Badge key={tag} variant="outline" className="border-gray-700 text-gray-400">{tag}</Badge>
          ))}
        </div>

        <div className="w-full space-y-4 text-left mb-8">
          <div className="flex items-start gap-3 text-gray-400 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{contactDetails.address}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{contactDetails.phone}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <CreditCard className="h-4 w-4 shrink-0" />
            <span>{contactDetails.taxId}</span>
          </div>
        </div>

        <div className="w-full grid grid-cols-3 gap-2">
          <Button className="bg-green-600 hover:bg-green-500 text-white h-10 px-0" title="Call">
            <Phone size={18} />
          </Button>
          <Button variant="outline" className="border-green-600 text-green-500 hover:bg-green-900/10 h-10 px-0" title="WhatsApp">
            <MessageCircle size={18} />
          </Button>
          <Button className="bg-gray-700 hover:bg-gray-600 text-white h-10 px-0" title="Email">
            <Mail size={18} />
          </Button>
        </div>
      </div>

      {/* 2. Right Content Area (The Tabs) */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-red-950/20 border-red-900/30">
            <CardContent className="p-6">
              <p className="text-red-400 text-sm font-medium uppercase tracking-wide">Total Due</p>
              <h3 className="text-3xl font-bold text-white mt-1">Rs {contactDetails.stats.totalDue.toLocaleString()}</h3>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6">
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wide">Last Payment</p>
              <h3 className="text-2xl font-bold text-white mt-1">{contactDetails.stats.lastPayment}</h3>
              <p className="text-xs text-gray-500 mt-1">Amount: Rs {contactDetails.stats.lastPaymentAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-green-950/20 border-green-900/30">
            <CardContent className="p-6">
              <p className="text-green-400 text-sm font-medium uppercase tracking-wide">Wallet Balance</p>
              <h3 className="text-3xl font-bold text-white mt-1">Rs {contactDetails.stats.walletBalance.toLocaleString()}</h3>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue="ledger" className="w-full flex-1 flex flex-col">
          <div className="border-b border-gray-800">
            <TabsList className="bg-transparent h-auto p-0 w-full justify-start overflow-x-auto">
              {['Ledger', 'Purchases', 'Stock History', 'Documents', 'Payments'].map((tab) => (
                <TabsTrigger 
                  key={tab} 
                  value={tab.toLowerCase().replace(' ', '-')}
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 text-gray-400 rounded-none px-6 py-3"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="ledger" className="flex-1 mt-6 space-y-4">
            {/* Ledger Header Controls */}
            <div className="flex flex-wrap justify-between items-center gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
              <div className="flex items-center gap-2">
                <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white bg-gray-950">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  December 2025
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <Printer size={16} className="mr-2" /> Print
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400">
                  <FileText size={16} className="mr-2" /> PDF
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-green-400">
                  <FileSpreadsheet size={16} className="mr-2" /> Excel
                </Button>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
              <Table>
                <TableHeader className="bg-gray-900/80">
                  <TableRow className="border-gray-800 hover:bg-gray-900/80">
                    <TableHead className="text-gray-400 w-[120px]">Date</TableHead>
                    <TableHead className="text-gray-400 w-[140px]">Ref #</TableHead>
                    <TableHead className="text-gray-400">Description</TableHead>
                    <TableHead className="text-right text-red-400 font-medium w-[140px]">Debit (Out)</TableHead>
                    <TableHead className="text-right text-green-400 font-medium w-[140px]">Credit (In)</TableHead>
                    <TableHead className="text-right text-white font-bold w-[160px]">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerData.map((row) => (
                    <TableRow key={row.id} className="border-gray-800 hover:bg-gray-800/30">
                      <TableCell className="text-gray-300 font-mono text-xs">{row.date}</TableCell>
                      <TableCell>
                        <span className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer text-sm font-medium">
                          {row.ref}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-300">{row.description}</TableCell>
                      <TableCell className="text-right text-red-400/90 font-mono">
                        {row.debit > 0 ? `Rs ${row.debit.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-400/90 font-mono">
                        {row.credit > 0 ? `Rs ${row.credit.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-white font-bold font-mono bg-gray-900/30">
                        Rs {row.balance.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-gray-900 border-t border-gray-800">
                  <TableRow className="hover:bg-gray-900">
                    <TableCell colSpan={5} className="text-right font-bold text-gray-300 uppercase tracking-wider">Closing Balance</TableCell>
                    <TableCell className="text-right font-bold text-xl text-white">Rs 450,000</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="purchases" className="text-center text-gray-500 py-20">Purchases content placeholder</TabsContent>
          <TabsContent value="stock-history" className="text-center text-gray-500 py-20">Stock History content placeholder</TabsContent>
          <TabsContent value="documents" className="text-center text-gray-500 py-20">Documents content placeholder</TabsContent>
          <TabsContent value="payments" className="text-center text-gray-500 py-20">Payments content placeholder</TabsContent>
        </Tabs>
      </div>
      </div>
      </div>
    </div>
  );
};
