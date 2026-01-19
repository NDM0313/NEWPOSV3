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
          <h2 className="text-2xl font-bold text-white">Purchases</h2>
          <p className="text-gray-400 text-sm">Manage purchase orders and supplier bills.</p>
        </div>
        <Button 
          onClick={() => openDrawer('addPurchase')}
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-500/20"
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
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden min-h-[500px] flex flex-col">
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
            <div className="p-4 border-b border-gray-800 flex gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <Input 
                  placeholder="Search PO #, Supplier..." 
                  className="pl-9 bg-gray-950 border-gray-800 text-white focus:border-blue-500" 
                />
              </div>
               <div className="flex gap-2 ml-auto">
                 <Button variant="outline" className="border-gray-800 text-gray-300 gap-2">
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

const GlassCard = ({ title, value, subtitle, highlightColor, icon: Icon }: any) => (
  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-xl shadow-lg relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-10">
      {Icon && <Icon size={64} className="text-white" />}
    </div>
    <p className="text-gray-400 text-sm font-medium">{title}</p>
    <div className="flex items-end gap-3 mt-1 mb-2">
      <h3 className={cn("text-3xl font-bold", highlightColor || "text-white")}>{value}</h3>
    </div>
    <p className="text-gray-500 text-xs">{subtitle}</p>
  </div>
);
