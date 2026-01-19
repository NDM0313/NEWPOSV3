import React, { useState } from 'react';
import { 
  Bell, 
  Menu, 
  MapPin, 
  Plus,
  ChevronDown,
  User,
  Settings,
  Lock,
  LogOut,
  FileText,
  ShoppingCart,
  Package,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

export const TopHeader = () => {
  const { toggleSidebar, openDrawer } = useNavigation();
  const [branch, setBranch] = useState("Main Branch (HQ)");
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'custom'>('today');
  const [notificationCount, setNotificationCount] = useState(3);

  const branches = [
    { id: 1, name: "Main Branch (HQ)", location: "Downtown", active: true },
    { id: 2, name: "Mall Outlet", location: "City Center", active: true },
    { id: 3, name: "Warehouse", location: "Industrial Area", active: true },
    { id: 4, name: "Online Store", location: "E-Commerce", active: false },
  ];

  const getDateRangeLabel = () => {
    const today = new Date();
    if (dateRange === 'today') {
      return today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (dateRange === 'week') {
      return 'This Week';
    }
    return 'Custom Range';
  };

  return (
    <header className="h-16 bg-header-background border-b border-header-border flex items-center justify-between px-6 sticky top-0 z-50 shadow-sm">
      {/* LEFT SECTION: Mobile Menu + Branch Selector */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-header-foreground hover:bg-accent transition-all duration-200"
        >
          <Menu size={22} />
        </button>
        
        {/* Branch / Location Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="hidden lg:flex items-center gap-2 px-4 py-2 h-10 bg-accent hover:bg-muted border border-border text-foreground rounded-lg transition-all"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse"></div>
              <MapPin size={16} className="text-blue-500" />
              <span className="font-medium">{branch}</span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-72 bg-card border-border shadow-2xl rounded-lg p-2"
          >
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Location</p>
            </div>
            {branches.map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => setBranch(b.name)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                  branch === b.name 
                    ? "bg-primary/10 text-primary" 
                    : "text-foreground hover:bg-accent"
                )}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  b.active ? "bg-emerald-500" : "bg-gray-600"
                )}></div>
                <div className="flex-1">
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">{b.location}</div>
                </div>
                {branch === b.name && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* CENTER SECTION: Empty (for balanced layout) */}
      <div className="flex-1"></div>

      {/* RIGHT SECTION: Actions Zone */}
      <div className="flex items-center gap-3">
        {/* Create New Dropdown - FIRST */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              className="flex items-center gap-2 px-4 py-2 h-9 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl shadow-lg shadow-blue-900/30 transition-all border-0"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span className="hidden sm:inline">Create New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-56 bg-card border-border shadow-2xl rounded-lg p-2"
          >
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</p>
            </div>
            <DropdownMenuItem 
              onClick={() => openDrawer('addSale')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <FileText size={16} className="text-emerald-500" />
              <span>New Invoice</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => openDrawer('addPurchase')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <ShoppingCart size={16} className="text-orange-500" />
              <span>New Purchase</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border my-2" />
            <DropdownMenuItem 
              onClick={() => openDrawer('addProduct')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <Package size={16} className="text-blue-500" />
              <span>Add Product</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => openDrawer('addContact')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <Users size={16} className="text-purple-500" />
              <span>Add Contact</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date Range Selector - SECOND */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost"
              className="flex items-center gap-2 px-3 py-2 h-9 bg-accent hover:bg-muted border border-border text-foreground rounded-lg transition-all"
            >
              <Calendar size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium hidden md:inline">{getDateRangeLabel()}</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end"
            className="w-48 bg-card border-border shadow-2xl rounded-lg p-2"
          >
            <DropdownMenuItem
              onClick={() => setDateRange('today')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange === 'today' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              Today
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRange('week')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange === 'week' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              This Week
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDateRange('custom')}
              className={cn(
                "px-3 py-2 rounded-lg cursor-pointer",
                dateRange === 'custom' 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-accent"
              )}
            >
              Custom Range
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <button 
          className="relative p-2.5 rounded-lg transition-all bg-accent hover:bg-muted border border-border text-muted-foreground hover:text-foreground"
          title="Notifications"
        >
          <Bell size={20} />
          {notificationCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground border-2 border-header-background text-xs font-bold shadow-sm"
            >
              {notificationCount}
            </Badge>
          )}
        </button>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-3 py-2 h-10 bg-accent hover:bg-muted border border-border rounded-lg transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                A
              </div>
              <div className="hidden xl:flex flex-col items-start">
                <span className="text-sm font-semibold text-foreground leading-tight">Admin</span>
                <span className="text-xs text-muted-foreground leading-tight">Super Admin</span>
              </div>
              <ChevronDown size={16} className="text-muted-foreground hidden xl:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-64 bg-card border-border shadow-2xl rounded-lg p-2"
          >
            {/* User Info Header */}
            <div className="px-3 py-3 mb-2 bg-accent rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold shadow-sm">
                  A
                </div>
                <div>
                  <div className="font-semibold text-foreground">Admin User</div>
                  <div className="text-xs text-muted-foreground">admin@dinbridal.com</div>
                </div>
              </div>
            </div>

            <DropdownMenuItem 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <User size={16} className="text-blue-500" />
              <span>View Profile</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <Settings size={16} className="text-muted-foreground" />
              <span>Settings</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-accent cursor-pointer transition-all"
            >
              <Lock size={16} className="text-orange-500" />
              <span>Change Password</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-border my-2" />
            
            <DropdownMenuItem 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer transition-all"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};