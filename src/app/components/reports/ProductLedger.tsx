import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  CornerUpLeft, 
  RefreshCw 
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ReportActions } from './ReportActions';
import { cn } from "../ui/utils";

// Mock Data
const ledgerData = [
  { id: 1, date: '2023-12-01', type: 'Purchase', party: 'Silk Traders Ltd', qty: 10, price: 40000, profit: 0, balance: 10 },
  { id: 2, date: '2023-12-05', type: 'Sale', party: 'Mrs. Saad', qty: -1, price: 120000, profit: 80000, balance: 9 },
  { id: 3, date: '2023-12-10', type: 'Return', party: 'Mrs. Saad', qty: 1, price: 120000, profit: -80000, balance: 10 },
  { id: 4, date: '2023-12-12', type: 'Sale', party: 'Bridal Boutique', qty: -5, price: 110000, profit: 350000, balance: 5 },
  { id: 5, date: '2023-12-28', type: 'Adjustment', party: 'Stock Audit', qty: -1, price: 40000, profit: 0, balance: 4 },
];

export const ProductLedger = () => {
  const [selectedProduct, setSelectedProduct] = useState('p1');

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Purchase':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--color-success)',
              borderColor: 'rgba(16, 185, 129, 0.2)',
              borderRadius: 'var(--radius-full)'
            }}
          >
            <ArrowDownRight size={12} /> Purchase
          </span>
        );
      case 'Sale':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-error)',
              borderColor: 'rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-full)'
            }}
          >
            <ArrowUpRight size={12} /> Sale
          </span>
        );
      case 'Return':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border"
            style={{
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              color: 'var(--color-warning)',
              borderColor: 'rgba(249, 115, 22, 0.2)',
              borderRadius: 'var(--radius-full)'
            }}
          >
            <CornerUpLeft size={12} /> Return
          </span>
        );
      case 'Adjustment':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--color-primary)',
              borderColor: 'rgba(59, 130, 246, 0.2)',
              borderRadius: 'var(--radius-full)'
            }}
          >
            <RefreshCw size={12} /> Adjustment
          </span>
        );
      default:
        return <span style={{ color: 'var(--color-text-secondary)' }}>{type}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <ReportActions title="Product Ledger (Item History)" />

      {/* Filters */}
      <div 
        className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border"
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.5)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="flex-1">
          <label 
            className="text-xs mb-1 block"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Select Product
          </label>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger 
              className="w-full h-10"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <SelectValue placeholder="Search product..." />
            </SelectTrigger>
            <SelectContent
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <div 
                className="p-2 sticky top-0 z-10 border-b mb-2"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderBottomColor: 'var(--color-border-primary)'
                }}
              >
                 <div className="relative">
                   <Search 
                     className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3"
                     style={{ color: 'var(--color-text-tertiary)' }}
                   />
                   <Input 
                     placeholder="Search..." 
                     className="h-8 pl-8 text-xs"
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
              <SelectItem value="p1">Bridal Maxi Red (SKU-101)</SelectItem>
              <SelectItem value="p2">Embroidered Lawn Suit (Vol 1)</SelectItem>
              <SelectItem value="p3">Gold Clutch</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-[200px]">
          <label 
            className="text-xs mb-1 block"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Date Range
          </label>
          <Button 
            variant="outline" 
            className="w-full justify-start text-left font-normal h-10"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
            }}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>Dec 2023</span>
          </Button>
        </div>
      </div>

      {/* Header Card */}
      <div 
        className="border p-6 rounded-xl relative overflow-hidden"
        style={{
          background: 'linear-gradient(to right, var(--color-bg-card), var(--color-bg-card))',
          borderColor: 'var(--color-border-secondary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Bridal Maxi Red
            </h2>
            <p 
              className="font-mono text-sm mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              SKU-101 • Category: Bridal
            </p>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Current Stock
              </p>
              <p 
                className="text-3xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                5 <span 
                  className="text-sm font-normal"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Units
                </span>
              </p>
            </div>
            <div 
              className="h-10 w-px hidden md:block"
              style={{ backgroundColor: 'var(--color-border-secondary)' }}
            ></div>
            <div className="text-right">
              <p 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Avg Cost
              </p>
              <p 
                className="text-xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Rs 40,000
              </p>
            </div>
            <div className="text-right">
              <p 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Avg Sale
              </p>
              <p 
                className="text-xl font-bold"
                style={{ color: 'var(--color-success)' }}
              >
                Rs 120,000
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div 
        className="border rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.5)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                borderBottomColor: 'var(--color-border-primary)'
              }}
              className="font-medium border-b"
            >
              <tr>
                <th 
                  className="px-6 py-4"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Date
                </th>
                <th 
                  className="px-6 py-4"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Type
                </th>
                <th 
                  className="px-6 py-4"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Party Name
                </th>
                <th 
                  className="px-6 py-4 text-center"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Qty Change
                </th>
                <th 
                  className="px-6 py-4 text-right"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Unit Price
                </th>
                <th 
                  className="px-6 py-4 text-right"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Profit
                </th>
                <th 
                  className="px-6 py-4 text-right"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Stock Balance
                </th>
              </tr>
            </thead>
            <tbody
              style={{
                borderColor: 'var(--color-border-primary)'
              }}
              className="divide-y"
            >
              {ledgerData.map((row) => (
                <tr 
                  key={row.id}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td 
                    className="px-6 py-4 whitespace-nowrap"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {row.date}
                  </td>
                  <td className="px-6 py-4">{getTypeBadge(row.type)}</td>
                  <td 
                    className="px-6 py-4 font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {row.party}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span 
                      className="font-mono font-bold"
                      style={{ 
                        color: row.qty > 0 ? 'var(--color-success)' : 'var(--color-error)' 
                      }}
                    >
                      {row.qty > 0 ? '+' : ''}{row.qty}
                    </span>
                  </td>
                  <td 
                    className="px-6 py-4 text-right font-mono"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Rs {row.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    {row.profit !== 0 ? (
                      <span 
                        className="font-bold"
                        style={{ 
                          color: row.profit > 0 ? 'var(--color-success)' : 'var(--color-error)' 
                        }}
                      >
                        {row.profit > 0 ? '+' : ''}Rs {Math.abs(row.profit).toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 text-right font-bold font-mono"
                    style={{
                      color: 'var(--color-text-primary)',
                      backgroundColor: 'rgba(17, 24, 39, 0.3)'
                    }}
                  >
                    {row.balance}
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
