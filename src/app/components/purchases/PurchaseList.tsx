import React from 'react';
import { Plus, Search, Truck, ArrowUpRight, ArrowDownRight, MoreVertical, ShoppingCart, Filter } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "../ui/utils";
import { EmptyState } from "../ui/EmptyState";
import { useNavigation } from '../../context/NavigationContext';

const purchases: any[] = []; // Empty for now to show Empty State

export const PurchaseList = () => {
  const { openDrawer } = useNavigation();

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Purchases
          </h2>
          <p 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Manage purchase orders and supplier bills.
          </p>
        </div>
        <Button 
          onClick={() => openDrawer('addPurchase')}
          className="gap-2"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-primary)',
            boxShadow: 'var(--shadow-lg) rgba(59, 130, 246, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
          }}
        >
          <Plus size={18} />
          Create Purchase
        </Button>
      </div>

       {/* Stats Row */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard 
          title="Total Purchases (YTD)" 
          value="$120,500" 
          subtitle="+8% vs last month"
          icon={Truck}
        />
        <GlassCard 
          title="Outstanding Bills" 
          value="$15,200" 
          subtitle="From 3 Suppliers"
          highlightColor="text-orange-400"
           icon={ShoppingCart}
        />
        <GlassCard 
          title="Overdue" 
          value="$2,400" 
          subtitle="Urgent attention needed"
          highlightColor="text-red-400"
          icon={Truck}
        />
      </div>

      {/* Main Content */}
      <div 
        className="border rounded-xl overflow-hidden min-h-[500px] flex flex-col"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        {purchases.length === 0 ? (
          <EmptyState 
            icon={Truck}
            title="No Purchases Found"
            description="You haven't recorded any purchase orders yet. Start by creating a new purchase to track your inventory costs."
            actionLabel="Create New Purchase"
            onAction={() => openDrawer('addPurchase')}
            className="border-none h-full flex-1"
          />
        ) : (
          <>
             {/* Table Toolbar (Only shown if data exists) */}
            <div 
              className="p-4 border-b flex gap-4"
              style={{ borderBottomColor: 'var(--color-border-primary)' }}
            >
              <div className="relative flex-1 max-w-sm">
                <Search 
                  className="absolute left-3 top-1/2 -translate-y-1/2" 
                  size={16}
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
                <Input 
                  placeholder="Search PO #, Supplier..." 
                  className="pl-9"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  }}
                />
              </div>
               <div className="flex gap-2 ml-auto">
                 <Button 
                   variant="outline" 
                   className="gap-2"
                   style={{
                     borderColor: 'var(--color-border-primary)',
                     color: 'var(--color-text-secondary)'
                   }}
                 >
                   <Filter size={14} /> Filter
                 </Button>
              </div>
            </div>
            {/* Table would go here */}
          </>
        )}
      </div>
    </div>
  );
};

const GlassCard = ({ title, value, subtitle, highlightColor, icon: Icon }: any) => {
  const valueColor = highlightColor === 'text-orange-400' 
    ? 'var(--color-warning)' 
    : highlightColor === 'text-red-400'
    ? 'var(--color-error)'
    : 'var(--color-text-primary)';
  
  return (
    <div 
      className="backdrop-blur-md border p-6 rounded-xl shadow-lg relative overflow-hidden"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)'
      }}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        {Icon && <Icon size={64} style={{ color: 'var(--color-text-primary)' }} />}
      </div>
      <p 
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </p>
      <div className="flex items-end gap-3 mt-1 mb-2">
        <h3 
          className="text-3xl font-bold"
          style={{ color: valueColor }}
        >
          {value}
        </h3>
      </div>
      <p 
        className="text-xs"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        {subtitle}
      </p>
    </div>
  );
};
