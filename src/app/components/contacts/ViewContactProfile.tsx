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
import { Avatar, AvatarFallback } from "../ui/avatar";
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

interface ViewContactProfileProps {
  isOpen?: boolean;
  onClose?: () => void;
  contact?: {
    id?: number;
    uuid?: string;
    name: string;
    code?: string;
    type?: string;
    email?: string;
    phone?: string;
    receivables?: number;
    payables?: number;
    netBalance?: number;
    status?: string;
    branch?: string;
    address?: string;
    lastTransaction?: string;
    workerRole?: string;
  } | null;
}

export const ViewContactProfile: React.FC<ViewContactProfileProps> = ({ isOpen = true, onClose, contact }) => {
  if (!isOpen) return null;
  if (!contact) return null;

  const initials = (contact.name || '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
  const typeLabel = (contact.type || 'contact').charAt(0).toUpperCase() + (contact.type || '').slice(1);

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
          <AvatarFallback className="bg-blue-900 text-white text-2xl">{initials}</AvatarFallback>
        </Avatar>

        <h2 className="text-2xl font-bold text-white mb-2">{contact.name}</h2>

        <div className="flex flex-wrap gap-2 justify-center mb-6">
          <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20">{typeLabel}</Badge>
          {contact.code && (
            <Badge variant="outline" className="border-gray-700 text-gray-400 font-mono">{contact.code}</Badge>
          )}
          {contact.status && (
            <Badge variant="outline" className="border-gray-700 text-gray-400">{contact.status}</Badge>
          )}
        </div>

        <div className="w-full space-y-4 text-left mb-8">
          {contact.address && (
            <div className="flex items-start gap-3 text-gray-400 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{contact.address}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{contact.phone || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <Mail className="h-4 w-4 shrink-0" />
            <span>{contact.email || '—'}</span>
          </div>
          {contact.branch && (
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>{contact.branch}</span>
            </div>
          )}
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
        
        {/* Top Summary Cards - real contact data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-red-950/20 border-red-900/30">
            <CardContent className="p-6">
              <p className="text-red-400 text-sm font-medium uppercase tracking-wide">
                {contact.type === 'customer' ? 'Receivables' : 'Payables'}
              </p>
              <h3 className="text-3xl font-bold text-white mt-1">
                ${(contact.type === 'customer' ? (contact.receivables ?? 0) : (contact.payables ?? 0)).toLocaleString()}
              </h3>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-6">
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wide">Net Balance</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                ${(contact.netBalance ?? 0).toLocaleString()}
              </h3>
              {contact.lastTransaction && (
                <p className="text-xs text-gray-500 mt-1">Last activity: {contact.lastTransaction}</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-green-950/20 border-green-900/30">
            <CardContent className="p-6">
              <p className="text-green-400 text-sm font-medium uppercase tracking-wide">Status</p>
              <h3 className="text-3xl font-bold text-white mt-1 capitalize">{contact.status ?? 'Active'}</h3>
              {contact.branch && <p className="text-xs text-gray-500 mt-1">{contact.branch}</p>}
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
            <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30 p-8 text-center">
              <FileText className="mx-auto text-gray-500 mb-3" size={40} />
              <p className="text-gray-400">Full ledger and transactions are available from the contact row actions.</p>
              <p className="text-gray-500 text-sm mt-1">Use &quot;Ledger / Transactions&quot; in the ⋮ menu for this contact.</p>
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
