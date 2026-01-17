import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  Receipt, 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  MoreVertical,
  Eye,
  Pencil,
  Trash,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";
import { AddExpenseDrawer } from './AddExpenseDrawer';
import { AddCategoryModal } from './AddCategoryModal';
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "sonner";
import { Building2, Zap, Users, ShoppingCart, Briefcase, Utensils } from 'lucide-react';

// Mock Data for Charts
const chartData = [
  { name: 'Rent', value: 40000, color: '#3B82F6' },
  { name: 'Salaries', value: 30000, color: '#8B5CF6' },
  { name: 'Utilities', value: 20000, color: '#F97316' },
  { name: 'Misc', value: 10000, color: '#9CA3AF' },
];

// Mock Data for Expenses List
const expenses = [
  { id: 1, date: 'Oct 24, 2023', ref: 'EXP-001', category: 'Rent', expenseFor: 'Shop Premises', account: 'Meezan Bank', amount: 40000, status: 'Paid' },
  { id: 2, date: 'Oct 22, 2023', ref: 'EXP-002', category: 'Salaries', expenseFor: 'All Staff', account: 'Meezan Bank', amount: 30000, status: 'Paid' },
  { id: 3, date: 'Oct 20, 2023', ref: 'EXP-003', category: 'Stitching', expenseFor: 'Batch #44', account: 'Cash Drawer', amount: 12500, status: 'Pending' },
  { id: 4, date: 'Oct 18, 2023', ref: 'EXP-004', category: 'Utilities', expenseFor: 'Electricity Bill', account: 'JazzCash', amount: 4200, status: 'Paid' },
  { id: 5, date: 'Oct 15, 2023', ref: 'EXP-005', category: 'Misc', expenseFor: 'Office Supplies', account: 'Cash Drawer', amount: 1500, status: 'Paid' },
  { id: 6, date: 'Oct 12, 2023', ref: 'EXP-006', category: 'Utilities', expenseFor: 'Internet Bill', account: 'JazzCash', amount: 3500, status: 'Paid' },
];

// Mock Data for Categories
const categoriesList = [
  { id: 1, name: 'Rent', icon: Building2, color: 'bg-blue-500', count: 50 },
  { id: 2, name: 'Salaries', icon: Users, color: 'bg-purple-500', count: 12 },
  { id: 3, name: 'Utilities', icon: Zap, color: 'bg-orange-500', count: 24 },
  { id: 4, name: 'Stitching', icon: ShoppingCart, color: 'bg-yellow-500', count: 5 },
  { id: 5, name: 'Office Supplies', icon: Briefcase, color: 'bg-gray-500', count: 0 },
  { id: 6, name: 'Food & Meals', icon: Utensils, color: 'bg-red-500', count: 8 },
];

const getCategoryBadgeStyle = (category: string) => {
  switch (category) {
    case 'Rent': 
      return {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        color: 'var(--color-primary)',
        borderColor: 'rgba(59, 130, 246, 0.2)'
      };
    case 'Salaries': 
      return {
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        color: 'var(--color-wholesale)',
        borderColor: 'rgba(147, 51, 234, 0.2)'
      };
    case 'Utilities': 
      return {
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        color: 'var(--color-warning)',
        borderColor: 'rgba(249, 115, 22, 0.2)'
      };
    case 'Stitching': 
      return {
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        color: 'var(--color-warning)',
        borderColor: 'rgba(234, 179, 8, 0.2)'
      };
    default: 
      return {
        backgroundColor: 'rgba(156, 163, 175, 0.1)',
        color: 'var(--color-text-secondary)',
        borderColor: 'rgba(156, 163, 175, 0.2)'
      };
  }
};

export const ExpensesDashboard = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'categories'>('overview');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  const handleEditCategory = (category: any) => {
    setSelectedCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = (category: any) => {
    if (category.count > 0) {
      toast.error(`This category is used in ${category.count} records. Cannot delete.`, {
        description: "Please reassign or delete the associated expenses first.",
        duration: 4000,
      });
    } else {
      toast.success(`Category "${category.name}" deleted successfully.`);
    }
  };

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setIsCategoryModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div 
        className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4"
        style={{ borderColor: 'var(--color-border-primary)' }}
      >
        <div className="space-y-4 w-full md:w-auto">
          <div>
            <h2 
              className="text-3xl font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Expenses
            </h2>
            <p 
              className="mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Track and manage business operational costs.
            </p>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center gap-6 mt-6">
            {(['overview', 'list', 'categories'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const tabLabels: Record<typeof tab, string> = {
                overview: 'Overview',
                list: 'All Expenses',
                categories: 'Categories'
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="pb-2 text-sm font-medium transition-all relative"
                  style={{
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  {tabLabels[tab]}
                  {isActive && (
                    <span 
                      className="absolute bottom-0 left-0 w-full h-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        borderRadius: 'var(--radius-full)'
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
           {activeTab === 'categories' ? (
             <Button 
               onClick={handleAddCategory}
               className="gap-2"
               style={{
                 backgroundColor: 'var(--color-primary)',
                 color: 'var(--color-text-primary)',
                 boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                 e.currentTarget.style.opacity = '0.9';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                 e.currentTarget.style.opacity = '1';
               }}
             >
               <Plus size={18} />
               Add New Category
             </Button>
           ) : (
             <Button 
               onClick={() => setIsDrawerOpen(true)}
               className="gap-2"
               style={{
                 backgroundColor: 'var(--color-primary)',
                 color: 'var(--color-text-primary)',
                 boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                 e.currentTarget.style.opacity = '0.9';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                 e.currentTarget.style.opacity = '1';
               }}
             >
               <Plus size={18} />
               Record Expense
             </Button>
           )}
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'overview' ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          {/* Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div 
              className="border p-6 rounded-xl flex flex-col justify-between"
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p 
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Total Monthly Expense
                  </p>
                  <h3 
                    className="text-2xl font-bold mt-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    $91,700
                  </h3>
                </div>
                <div 
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <TrendingUp style={{ color: 'var(--color-error)' }} size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span 
                  className="font-medium flex items-center gap-1"
                  style={{ color: 'var(--color-error)' }}
                >
                   <TrendingUp size={12} /> +12%
                </span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>
                  vs last month
                </span>
              </div>
            </div>

            <div 
              className="border p-6 rounded-xl flex flex-col justify-between"
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p 
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Last Month Comparison
                  </p>
                  <h3 
                    className="text-2xl font-bold mt-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    $81,200
                  </h3>
                </div>
                <div 
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <TrendingDown style={{ color: 'var(--color-success)' }} size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span 
                  className="font-medium flex items-center gap-1"
                  style={{ color: 'var(--color-success)' }}
                >
                   <TrendingDown size={12} /> -5%
                </span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>
                  budget utilization
                </span>
              </div>
            </div>

            <div 
              className="border p-6 rounded-xl flex flex-col justify-between"
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-primary)',
                borderRadius: 'var(--radius-xl)'
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p 
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Highest Category
                  </p>
                  <h3 
                    className="text-2xl font-bold mt-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Rent
                  </h3>
                </div>
                <div 
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <DollarSign style={{ color: 'var(--color-primary)' }} size={20} />
                </div>
              </div>
              <div className="mt-4">
                 <div 
                   className="w-full h-1.5 rounded-full overflow-hidden"
                   style={{
                     backgroundColor: 'var(--color-bg-card)',
                     borderRadius: 'var(--radius-full)'
                   }}
                 >
                    <div 
                      className="h-full rounded-full"
                      style={{ 
                        width: '45%',
                        backgroundColor: 'var(--color-primary)',
                        borderRadius: 'var(--radius-full)'
                      }}
                    ></div>
                 </div>
                 <p 
                   className="text-xs mt-2"
                   style={{ color: 'var(--color-text-tertiary)' }}
                 >
                   45% of total expenses
                 </p>
              </div>
            </div>
          </div>

          {/* Donut Chart Section */}
          <div 
            className="border rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px]"
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.5)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            <h3 
              className="text-lg font-bold mb-2 self-start"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Expense Breakdown
            </h3>
            <div className="h-[300px] w-full max-w-lg relative min-h-[300px] shrink-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-bg-card)', 
                      borderColor: 'var(--color-border-primary)', 
                      color: 'var(--color-text-primary)', 
                      borderRadius: 'var(--radius-md)' 
                    }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                    formatter={(value: number) => `$${value.toLocaleString()}`}
                  />
                  <Legend 
                     verticalAlign="bottom" 
                     height={36} 
                     iconType="circle"
                     formatter={(value) => (
                       <span 
                         className="ml-1"
                         style={{ color: 'var(--color-text-secondary)' }}
                       >
                         {value}
                       </span>
                     )}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Center Text */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                 <p 
                   className="text-sm"
                   style={{ color: 'var(--color-text-tertiary)' }}
                 >
                   Total
                 </p>
                 <p 
                   className="text-3xl font-bold"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   $91.7k
                 </p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'list' ? (
        /* All Expenses List Tab */
        <div 
          className="border rounded-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-300"
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
           {/* Toolbar */}
           <div 
             className="p-5 border-b flex flex-col sm:flex-row justify-between items-center gap-4"
             style={{ borderColor: 'var(--color-border-primary)' }}
           >
               <div className="relative w-full sm:w-64">
                  <Search 
                    size={14} 
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  />
                  <Input 
                    placeholder="Search expenses..." 
                    className="text-sm pl-9 h-9"
                    style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      borderColor: 'var(--color-border-primary)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
               </div>
               <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    className="h-9 gap-2"
                    style={{
                      borderColor: 'var(--color-border-primary)',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-secondary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                  >
                     <Filter size={14} />
                     Filter Category
                  </Button>
               </div>
           </div>

           {/* Table */}
           <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                 <thead 
                   className="text-xs uppercase border-b"
                   style={{
                     color: 'var(--color-text-tertiary)',
                     backgroundColor: 'rgba(3, 7, 18, 0.5)',
                     borderColor: 'var(--color-border-primary)'
                   }}
                 >
                    <tr>
                       <th className="px-6 py-3 font-medium">Date</th>
                       <th className="px-6 py-3 font-medium">Reference #</th>
                       <th className="px-6 py-3 font-medium">Category</th>
                       <th className="px-6 py-3 font-medium">Expense For</th>
                       <th className="px-6 py-3 font-medium">Paid Via</th>
                       <th className="px-6 py-3 font-medium text-right">Amount</th>
                       <th className="px-6 py-3 font-medium text-center">Action</th>
                    </tr>
                 </thead>
                 <tbody 
                   className="divide-y"
                   style={{ borderColor: 'var(--color-border-primary)' }}
                 >
                    {expenses.map((expense) => {
                      const badgeStyle = getCategoryBadgeStyle(expense.category);
                      return (
                       <tr 
                         key={expense.id} 
                         className="group transition-colors"
                         style={{ backgroundColor: 'transparent' }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.backgroundColor = 'transparent';
                         }}
                       >
                          <td 
                            className="px-6 py-4 font-medium"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                             <div className="flex items-center gap-2">
                                <Calendar 
                                  size={14} 
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                />
                                {expense.date}
                             </div>
                          </td>
                          <td 
                            className="px-6 py-4 font-mono text-xs"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                             {expense.ref}
                          </td>
                          <td className="px-6 py-4">
                             <Badge 
                               variant="outline" 
                               className="font-normal"
                               style={badgeStyle}
                             >
                                {expense.category}
                             </Badge>
                          </td>
                          <td 
                            className="px-6 py-4"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                             {expense.expenseFor}
                          </td>
                          <td 
                            className="px-6 py-4"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                             {expense.account}
                          </td>
                          <td 
                            className="px-6 py-4 text-right font-bold"
                            style={{ color: 'var(--color-error)' }}
                          >
                             -${expense.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-8 w-8"
                                   style={{ color: 'var(--color-text-tertiary)' }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.color = 'var(--color-text-primary)';
                                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.color = 'var(--color-text-tertiary)';
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                   }}
                                 >
                                   <MoreVertical size={16} />
                                 </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent 
                                 align="end" 
                                 className="w-[160px]"
                                 style={{
                                   backgroundColor: 'var(--color-bg-card)',
                                   borderColor: 'var(--color-border-secondary)',
                                   color: 'var(--color-text-primary)'
                                 }}
                               >
                                 <DropdownMenuItem 
                                   className="cursor-pointer"
                                   style={{ backgroundColor: 'transparent' }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                   }}
                                 >
                                   <Eye className="mr-2 h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                                   <span>View Details</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem 
                                   className="cursor-pointer"
                                   style={{ backgroundColor: 'transparent' }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                   }}
                                 >
                                   <Pencil className="mr-2 h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                                   <span>Edit</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuSeparator style={{ backgroundColor: 'var(--color-border-primary)' }} />
                                 <DropdownMenuItem 
                                   className="cursor-pointer"
                                   style={{ 
                                     backgroundColor: 'transparent',
                                     color: 'var(--color-error)'
                                   }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                                     e.currentTarget.style.color = 'var(--color-error)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                     e.currentTarget.style.color = 'var(--color-error)';
                                   }}
                                 >
                                   <Trash className="mr-2 h-4 w-4" />
                                   <span>Delete</span>
                                 </DropdownMenuItem>
                               </DropdownMenuContent>
                             </DropdownMenu>
                          </td>
                       </tr>
                      );
                    })}
                 </tbody>
              </table>
           </div>
        </div>
      ) : (
        /* Categories Tab */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-2 duration-300">
           {categoriesList.map((category) => {
             const getCategoryColor = (colorClass: string) => {
               if (colorClass.includes('blue')) return 'var(--color-primary)';
               if (colorClass.includes('purple')) return 'var(--color-wholesale)';
               if (colorClass.includes('orange')) return 'var(--color-warning)';
               if (colorClass.includes('yellow')) return 'var(--color-warning)';
               if (colorClass.includes('red')) return 'var(--color-error)';
               return 'var(--color-text-secondary)';
             };
             
             return (
               <div 
                 key={category.id}
                 className="group relative border rounded-xl p-5 transition-all min-h-[160px]"
                 style={{
                   backgroundColor: 'rgba(17, 24, 39, 0.5)',
                   borderColor: 'var(--color-border-primary)',
                   borderRadius: 'var(--radius-xl)'
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                   e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                   e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                   e.currentTarget.style.transform = 'translateY(-4px)';
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.backgroundColor = 'rgba(17, 24, 39, 0.5)';
                   e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                   e.currentTarget.style.boxShadow = 'none';
                   e.currentTarget.style.transform = 'translateY(0)';
                 }}
               >
                 {/* Color Dot */}
                 <div 
                   className="absolute top-5 right-5 w-2 h-2 rounded-full"
                   style={{
                     backgroundColor: getCategoryColor(category.color),
                     borderRadius: 'var(--radius-full)'
                   }}
                 />

                 <div className="flex flex-col h-full justify-between gap-4">
                   <div className="flex items-start gap-4">
                     <div 
                       className="p-3 rounded-lg border"
                       style={{
                         backgroundColor: 'var(--color-bg-tertiary)',
                         borderColor: 'var(--color-border-primary)',
                         borderRadius: 'var(--radius-lg)',
                         color: 'var(--color-text-secondary)'
                       }}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.color = 'var(--color-text-primary)';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.color = 'var(--color-text-secondary)';
                       }}
                     >
                       <category.icon size={24} />
                     </div>
                     <div>
                       <h3 
                         className="font-bold text-lg"
                         style={{ color: 'var(--color-text-primary)' }}
                       >
                         {category.name}
                       </h3>
                       <p 
                         className="text-sm"
                         style={{ color: 'var(--color-text-tertiary)' }}
                       >
                         {category.count} Expenses
                       </p>
                     </div>
                   </div>
                   
                   {/* Hover Actions */}
                   <div 
                     className="pt-4 border-t flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                     style={{ borderColor: 'rgba(31, 41, 55, 0.5)' }}
                   >
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditCategory(category)}
                        className="flex-1 h-8 text-xs"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          color: 'var(--color-text-secondary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                          e.currentTarget.style.color = 'var(--color-text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                      >
                        <Pencil size={12} className="mr-2" /> Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteCategory(category)}
                        className="h-8 px-3"
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: 'var(--color-error)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        }}
                      >
                        <Trash size={12} />
                      </Button>
                   </div>
                 </div>
               </div>
             );
           })}

           {/* Add New Card (Empty State-ish) */}
           <button 
             onClick={handleAddCategory}
             className="border border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-3 transition-all min-h-[160px]"
             style={{
               borderColor: 'var(--color-border-primary)',
               borderRadius: 'var(--radius-xl)',
               color: 'var(--color-text-tertiary)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.color = 'var(--color-text-primary)';
               e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
               e.currentTarget.style.backgroundColor = 'rgba(17, 24, 39, 0.3)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.color = 'var(--color-text-tertiary)';
               e.currentTarget.style.borderColor = 'var(--color-border-primary)';
               e.currentTarget.style.backgroundColor = 'transparent';
             }}
           >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                <Plus size={24} />
              </div>
              <span className="font-medium">Add New Category</span>
           </button>
        </div>
      )}

      <AddExpenseDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      
      <AddCategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)} 
        categoryToEdit={selectedCategory}
      />

    </div>
  );
};