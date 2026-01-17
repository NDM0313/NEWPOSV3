import React from 'react';
import { Search, Bell, Menu, Sun, Moon, MapPin, Plus } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";

export const TopHeader = () => {
  const { toggleSidebar, openDrawer } = useNavigation();
  const { theme, setTheme } = useTheme();
  const [branch, setBranch] = React.useState("Main Branch (HQ)");

  return (
    <header 
      className="h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 transition-colors"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderBottomColor: 'var(--color-border-primary)',
        borderBottomWidth: '1px',
        color: 'var(--color-text-primary)',
        zIndex: 'var(--z-index-sticky, 1020)'
      }}
    >
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={toggleSidebar}
          className="md:hidden p-2 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
        >
          <Menu size={24} />
        </button>
        
        {/* Branch Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="hidden md:flex items-center gap-2 bg-transparent"
              style={{
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <MapPin size={16} style={{ color: 'var(--color-primary)' }} />
              <span>{branch}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className="w-56"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              borderColor: 'var(--color-border-primary)'
            }}
          >
            <DropdownMenuItem onClick={() => setBranch("Main Branch (HQ)")}>Main Branch (HQ)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBranch("Downtown Outlet")}>Downtown Outlet</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBranch("Mall Kiosk")}>Mall Kiosk</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative max-w-md w-full hidden lg:block ml-4">
          <Search 
            className="absolute left-3 top-1/2 -translate-y-1/2" 
            size={16}
            style={{ color: 'var(--color-text-tertiary)' }}
          />
          <input 
            type="text" 
            placeholder="Search products, orders, customers..." 
            className="w-full border-none rounded-lg pl-10 pr-4 py-2 text-sm outline-none transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              borderRadius: 'var(--radius-lg)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Create Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="sm" 
              className="gap-2 hidden sm:flex"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-primary)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Create New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end"
            style={{
              backgroundColor: 'var(--color-bg-panel)',
              borderColor: 'var(--color-border-primary)'
            }}
          >
            <DropdownMenuItem onClick={() => openDrawer('addSale')}>
              New Sale
            </DropdownMenuItem>
             <DropdownMenuItem onClick={() => openDrawer('addPurchase')}>
              New Purchase
            </DropdownMenuItem>
             <div 
               className="h-px my-1"
               style={{ backgroundColor: 'var(--color-border-primary)' }}
             />
            <DropdownMenuItem onClick={() => openDrawer('addProduct')}>
              Add Product
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDrawer('addUser')}>
              Add User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
          }}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button 
          className="relative p-2 transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
          }}
        >
          <Bell size={20} />
          <span 
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border"
            style={{
              backgroundColor: 'var(--color-error)',
              borderRadius: '50%',
              borderColor: 'var(--color-bg-primary)'
            }}
          />
        </button>
        
        <div 
          className="w-8 h-8 rounded-full md:hidden"
          style={{
            background: 'linear-gradient(to top right, var(--color-wholesale), var(--color-primary))',
            borderRadius: '50%'
          }}
        />
      </div>
    </header>
  );
};
