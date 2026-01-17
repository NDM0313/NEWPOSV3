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
  ArrowDownRight
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

export const ViewContactProfile = () => {
  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)] min-h-[600px] animate-in slide-in-from-bottom-2 duration-300">
      
      {/* 1. Left Sidebar (Identity Card) */}
      <div 
        className="w-full lg:w-1/4 border rounded-xl p-6 flex flex-col items-center text-center h-fit sticky top-6"
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.5)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <Avatar 
          className="h-32 w-32 mb-4 border-4 shadow-xl"
          style={{ borderColor: 'var(--color-border-primary)' }}
        >
          <AvatarImage src={contactDetails.image} />
          <AvatarFallback 
            className="text-2xl"
            style={{
              backgroundColor: 'rgba(30, 58, 138, 0.8)',
              color: 'var(--color-text-primary)'
            }}
          >
            {contactDetails.initials}
          </AvatarFallback>
        </Avatar>
        
        <h2 
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {contactDetails.name}
        </h2>
        
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          <Badge
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--color-primary)',
              borderColor: 'rgba(59, 130, 246, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            }}
          >
            {contactDetails.type}
          </Badge>
          {contactDetails.tags.map(tag => (
            <Badge 
              key={tag} 
              variant="outline"
              style={{
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-secondary)'
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="w-full space-y-4 text-left mb-8">
          <div 
            className="flex items-start gap-3 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{contactDetails.address}</span>
          </div>
          <div 
            className="flex items-center gap-3 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Phone className="h-4 w-4 shrink-0" />
            <span>{contactDetails.phone}</span>
          </div>
          <div 
            className="flex items-center gap-3 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <CreditCard className="h-4 w-4 shrink-0" />
            <span>{contactDetails.taxId}</span>
          </div>
        </div>

        <div className="w-full grid grid-cols-3 gap-2">
          <Button 
            className="h-10 px-0"
            title="Call"
            style={{
              backgroundColor: 'var(--color-success)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Phone size={18} />
          </Button>
          <Button 
            variant="outline" 
            className="h-10 px-0"
            title="WhatsApp"
            style={{
              borderColor: 'var(--color-success)',
              color: 'var(--color-success)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <MessageCircle size={18} />
          </Button>
          <Button 
            className="h-10 px-0"
            title="Email"
            style={{
              backgroundColor: 'var(--color-hover-bg)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Mail size={18} />
          </Button>
        </div>
      </div>

      {/* 2. Right Content Area (The Tabs) */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            style={{
              backgroundColor: 'rgba(127, 29, 29, 0.2)',
              borderColor: 'rgba(127, 29, 29, 0.3)'
            }}
          >
            <CardContent className="p-6">
              <p 
                className="text-sm font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-error)' }}
              >
                Total Due
              </p>
              <h3 
                className="text-3xl font-bold mt-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Rs {contactDetails.stats.totalDue.toLocaleString()}
              </h3>
            </CardContent>
          </Card>
          
          <Card
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.5)',
              borderColor: 'var(--color-border-primary)'
            }}
          >
            <CardContent className="p-6">
              <p 
                className="text-sm font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Last Payment
              </p>
              <h3 
                className="text-2xl font-bold mt-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {contactDetails.stats.lastPayment}
              </h3>
              <p 
                className="text-xs mt-1"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Amount: Rs {contactDetails.stats.lastPaymentAmount.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          
          <Card
            style={{
              backgroundColor: 'rgba(5, 150, 105, 0.2)',
              borderColor: 'rgba(5, 150, 105, 0.3)'
            }}
          >
            <CardContent className="p-6">
              <p 
                className="text-sm font-medium uppercase tracking-wide"
                style={{ color: 'var(--color-success)' }}
              >
                Wallet Balance
              </p>
              <h3 
                className="text-3xl font-bold mt-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Rs {contactDetails.stats.walletBalance.toLocaleString()}
              </h3>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue="ledger" className="w-full flex-1 flex flex-col">
          <div style={{ borderBottomColor: 'var(--color-border-primary)' }} className="border-b">
            <TabsList className="bg-transparent h-auto p-0 w-full justify-start overflow-x-auto">
              {['Ledger', 'Purchases', 'Stock History', 'Documents', 'Payments'].map((tab) => (
                <TabsTrigger 
                  key={tab} 
                  value={tab.toLowerCase().replace(' ', '-')}
                  className="bg-transparent border-b-2 border-transparent rounded-none px-6 py-3"
                  style={{
                    color: 'var(--color-text-secondary)',
                    borderBottomColor: 'transparent'
                  }}
                  data-state="inactive"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="ledger" className="flex-1 mt-6 space-y-4">
            {/* Ledger Header Controls */}
            <div 
              className="flex flex-wrap justify-between items-center gap-4 p-4 rounded-xl border"
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  style={{
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)',
                    backgroundColor: 'var(--color-bg-tertiary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  December 2025
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  <Printer size={16} className="mr-2" /> Print
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-error)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  <FileText size={16} className="mr-2" /> PDF
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-success)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  <FileSpreadsheet size={16} className="mr-2" /> Excel
                </Button>
              </div>
            </div>

            {/* Ledger Table */}
            <div 
              className="border rounded-xl overflow-hidden"
              style={{
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'rgba(17, 24, 39, 0.3)'
              }}
            >
              <Table>
                <TableHeader
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.8)'
                  }}
                >
                  <TableRow
                    style={{
                      borderColor: 'var(--color-border-primary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(17, 24, 39, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <TableHead 
                      className="w-[120px]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Date
                    </TableHead>
                    <TableHead 
                      className="w-[140px]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Ref #
                    </TableHead>
                    <TableHead style={{ color: 'var(--color-text-secondary)' }}>
                      Description
                    </TableHead>
                    <TableHead 
                      className="text-right font-medium w-[140px]"
                      style={{ color: 'var(--color-error)' }}
                    >
                      Debit (Out)
                    </TableHead>
                    <TableHead 
                      className="text-right font-medium w-[140px]"
                      style={{ color: 'var(--color-success)' }}
                    >
                      Credit (In)
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold w-[160px]"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Balance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerData.map((row) => (
                    <TableRow 
                      key={row.id}
                      style={{
                        borderColor: 'var(--color-border-primary)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <TableCell 
                        className="font-mono text-xs"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {row.date}
                      </TableCell>
                      <TableCell>
                        <span 
                          className="hover:underline cursor-pointer text-sm font-medium"
                          style={{ color: 'var(--color-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-primary)';
                          }}
                        >
                          {row.ref}
                        </span>
                      </TableCell>
                      <TableCell style={{ color: 'var(--color-text-primary)' }}>
                        {row.description}
                      </TableCell>
                      <TableCell 
                        className="text-right font-mono"
                        style={{ color: 'rgba(239, 68, 68, 0.9)' }}
                      >
                        {row.debit > 0 ? `Rs ${row.debit.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-right font-mono"
                        style={{ color: 'rgba(16, 185, 129, 0.9)' }}
                      >
                        {row.credit > 0 ? `Rs ${row.credit.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-right font-bold font-mono"
                        style={{
                          color: 'var(--color-text-primary)',
                          backgroundColor: 'rgba(17, 24, 39, 0.3)'
                        }}
                      >
                        Rs {row.balance.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderTopColor: 'var(--color-border-primary)'
                  }}
                >
                  <TableRow
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <TableCell 
                      colSpan={5} 
                      className="text-right font-bold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Closing Balance
                    </TableCell>
                    <TableCell 
                      className="text-right font-bold text-xl"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Rs 450,000
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent 
            value="purchases"
            className="text-center py-20"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Purchases content placeholder
          </TabsContent>
          <TabsContent 
            value="stock-history"
            className="text-center py-20"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Stock History content placeholder
          </TabsContent>
          <TabsContent 
            value="documents"
            className="text-center py-20"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Documents content placeholder
          </TabsContent>
          <TabsContent 
            value="payments"
            className="text-center py-20"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Payments content placeholder
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
