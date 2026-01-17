import React from 'react';
import { 
  TrendingUp,
  Search,
  Users
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ReportActions } from './ReportActions';
import { cn } from "../ui/utils";

// Mock Data
const customerData = [
  { id: 1, name: 'Bridal Boutique Lahore', items: 45, revenue: 2100000, cost: 1450000, profit: 650000, margin: 30.9 },
  { id: 2, name: 'Karachi Fabrics', items: 28, revenue: 1800000, cost: 1350000, profit: 450000, margin: 25.0 },
  { id: 3, name: 'Mrs. Saad', items: 5, revenue: 450000, cost: 200000, profit: 250000, margin: 55.5 },
  { id: 4, name: 'Ali Textiles', items: 12, revenue: 950000, cost: 800000, profit: 150000, margin: 15.8 },
  { id: 5, name: 'Zara Ahmed', items: 3, revenue: 120000, cost: 80000, profit: 40000, margin: 33.3 },
  { id: 6, name: 'Fatima & Co.', items: 8, revenue: 320000, cost: 250000, profit: 70000, margin: 21.9 },
];

export const CustomerProfitabilityReport = () => {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <ReportActions title="Customer Profitability Report" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          className="border p-6 rounded-xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(to bottom right, var(--color-bg-card), rgba(5, 150, 105, 0.2))',
            borderColor: 'rgba(5, 150, 105, 0.3)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="relative z-10">
            <p 
              className="font-medium text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Most Profitable Customer
            </p>
            <h3 
              className="text-xl font-bold mt-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Bridal Boutique Lahore
            </h3>
            <p 
              className="text-sm mt-2 font-mono font-bold"
              style={{ color: 'var(--color-success)' }}
            >
              +Rs 650,000 Profit
            </p>
          </div>
          <Users 
            className="absolute right-4 top-4" 
            size={64}
            style={{ color: 'rgba(16, 185, 129, 0.1)' }}
          />
        </div>
        
        <div 
          className="border p-6 rounded-xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(to bottom right, var(--color-bg-card), rgba(59, 130, 246, 0.2))',
            borderColor: 'rgba(59, 130, 246, 0.3)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="relative z-10">
            <p 
              className="font-medium text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Highest Margin (Retail)
            </p>
            <h3 
              className="text-xl font-bold mt-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Mrs. Saad
            </h3>
            <p 
              className="text-sm mt-2 font-mono font-bold"
              style={{ color: 'var(--color-primary)' }}
            >
              55.5% Margin
            </p>
          </div>
          <TrendingUp 
            className="absolute right-4 top-4" 
            size={64}
            style={{ color: 'rgba(59, 130, 246, 0.1)' }}
          />
        </div>
        
        <div 
          className="border p-6 rounded-xl flex flex-col justify-center"
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="relative w-full">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <Input 
              placeholder="Search customers..." 
              className="pl-10 h-12 w-full"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
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
                  Customer Name
                </th>
                <th 
                  className="px-6 py-4 text-center"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Total Items
                </th>
                <th 
                  className="px-6 py-4 text-right"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Total Revenue
                </th>
                <th 
                  className="px-6 py-4 text-right"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Total Cost (COGS)
                </th>
                <th 
                  className="px-6 py-4 text-right"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Net Profit
                </th>
                <th 
                  className="px-6 py-4 text-right"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Profit Margin
                </th>
              </tr>
            </thead>
            <tbody
              style={{
                borderColor: 'var(--color-border-primary)'
              }}
              className="divide-y"
            >
              {customerData.map((row) => (
                <tr 
                  key={row.id}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          color: 'var(--color-text-secondary)',
                          borderRadius: 'var(--radius-full)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.5)';
                          e.currentTarget.style.color = 'var(--color-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                      >
                        {row.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span 
                        className="font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {row.name}
                      </span>
                    </div>
                  </td>
                  <td 
                    className="px-6 py-4 text-center"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {row.items}
                  </td>
                  <td 
                    className="px-6 py-4 text-right font-mono"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Rs {row.revenue.toLocaleString()}
                  </td>
                  <td 
                    className="px-6 py-4 text-right font-mono"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Rs {row.cost.toLocaleString()}
                  </td>
                  <td 
                    className="px-6 py-4 text-right font-mono font-bold"
                    style={{
                      color: 'var(--color-success)',
                      backgroundColor: 'rgba(5, 150, 105, 0.05)'
                    }}
                  >
                    Rs {row.profit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">
                    <span 
                      className="px-2 py-1 rounded text-xs font-bold"
                      style={{
                        backgroundColor: row.margin >= 30 
                          ? 'rgba(16, 185, 129, 0.2)' 
                          : row.margin >= 20 
                            ? 'rgba(59, 130, 246, 0.2)' 
                            : 'rgba(234, 179, 8, 0.2)',
                        color: row.margin >= 30 
                          ? 'var(--color-success)' 
                          : row.margin >= 20 
                            ? 'var(--color-primary)' 
                            : 'var(--color-warning)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      {row.margin}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div 
          className="p-4 border-t text-center"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(17, 24, 39, 0.8)'
          }}
        >
          <p 
            className="text-sm"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Showing top 6 customers based on profitability
          </p>
        </div>
      </div>
    </div>
  );
};
