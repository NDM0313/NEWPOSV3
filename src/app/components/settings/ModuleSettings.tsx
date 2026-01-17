import React, { useState } from 'react';
import { useModules, ModuleId } from '../../context/ModuleContext';
import { 
  Calendar, 
  Clock, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  Box, 
  Hammer, 
  Award, 
  Calculator,
  ChevronRight
} from 'lucide-react';
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "../ui/utils";

export const ModuleSettings = () => {
  const { modules, toggleModule } = useModules();
  const [configuringModule, setConfigureModule] = useState<ModuleId | null>(null);

  const moduleList = [
    {
      id: 'rentals' as ModuleId,
      title: 'Rental & Leasing',
      description: 'Manage bookings, security deposits, and inventory blocking for rent-based items (Bridal, Electronics, Property).',
      icon: Calendar,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
      borderColor: 'border-pink-500/20'
    },
    {
      id: 'manufacturing' as ModuleId,
      title: 'Manufacturing',
      description: 'Track raw materials, Bill of Materials (BOM), work orders, and production processes.',
      icon: Hammer,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20'
    },
    {
      id: 'repairs' as ModuleId,
      title: 'Repairs & Services',
      description: 'Ticket-based system for tracking customer repairs, service status, and spare parts usage.',
      icon: Settings,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20'
    },
    {
      id: 'loyalty' as ModuleId,
      title: 'Loyalty Program',
      description: 'Points-based reward system, tiers (Silver/Gold), and automated customer retention campaigns.',
      icon: Award,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20'
    },
    {
      id: 'accounting' as ModuleId,
      title: 'Accounting',
      description: 'Double-entry bookkeeping, chart of accounts, expenses, and financial reporting.',
      icon: Calculator,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20'
    }
  ];

  const handleToggle = (id: ModuleId, checked: boolean) => {
    toggleModule(id, checked);
    if (checked && id === 'rentals') {
      setConfigureModule(id);
    }
  };

  return (
    <div 
      className="flex-1 h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
    >
      {/* Header */}
      <div 
        className="px-8 py-6 border-b"
        style={{ borderBottomColor: 'var(--color-border-primary)' }}
      >
        <h1 
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Modules & Features
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Enable or disable core business modules. Changes reflect immediately in the sidebar.
        </p>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {moduleList.map((mod) => {
            const isEnabled = modules[mod.id]?.isEnabled;
            
            return (
              <div 
                key={mod.id} 
                className="flex flex-col p-6 rounded-xl border transition-all duration-200"
                style={{
                  backgroundColor: isEnabled 
                    ? 'var(--color-bg-card)' 
                    : 'rgba(17, 24, 39, 0.5)',
                  borderColor: isEnabled 
                    ? 'var(--color-border-secondary)' 
                    : 'var(--color-border-primary)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: isEnabled ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
                  opacity: isEnabled ? 1 : 0.8
                }}
                onMouseEnter={(e) => {
                  if (!isEnabled) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isEnabled) {
                    e.currentTarget.style.opacity = '0.8';
                  }
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div 
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: mod.id === 'rentals' ? 'rgba(236, 72, 153, 0.1)' :
                                      mod.id === 'manufacturing' ? 'rgba(249, 115, 22, 0.1)' :
                                      mod.id === 'repairs' ? 'rgba(59, 130, 246, 0.1)' :
                                      mod.id === 'loyalty' ? 'rgba(147, 51, 234, 0.1)' :
                                      'rgba(16, 185, 129, 0.1)',
                      color: mod.id === 'rentals' ? 'var(--color-primary)' :
                             mod.id === 'manufacturing' ? 'var(--color-warning)' :
                             mod.id === 'repairs' ? 'var(--color-primary)' :
                             mod.id === 'loyalty' ? 'var(--color-wholesale)' :
                             'var(--color-success)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <mod.icon size={24} strokeWidth={1.5} />
                  </div>
                  <div className="flex items-center gap-3">
                    {isEnabled && (
                      <Badge
                        style={{
                          backgroundColor: 'rgba(5, 150, 105, 0.2)',
                          color: 'var(--color-success)',
                          borderColor: 'rgba(5, 150, 105, 0.5)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.2)';
                        }}
                      >
                        Active
                      </Badge>
                    )}
                    <Switch 
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggle(mod.id, checked)}
                    />
                  </div>
                </div>

                <div className="flex-1 mb-6">
                  <h3 
                    className="text-lg font-semibold mb-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {mod.title}
                  </h3>
                  <p 
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {mod.description}
                  </p>
                </div>

                <div 
                  className="mt-auto pt-4 border-t flex items-center justify-between"
                  style={{ borderTopColor: 'var(--color-border-primary)' }}
                >
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs px-0 hover:bg-transparent"
                    style={{
                      color: isEnabled ? 'var(--color-primary)' : 'var(--color-text-tertiary)'
                    }}
                    onMouseEnter={(e) => {
                      if (isEnabled) {
                        e.currentTarget.style.color = 'var(--color-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isEnabled) {
                        e.currentTarget.style.color = 'var(--color-primary)';
                      }
                    }}
                    disabled={!isEnabled}
                    onClick={() => setConfigureModule(mod.id)}
                  >
                    <Settings size={14} className="mr-2" />
                    Configure
                  </Button>
                  
                  {isEnabled && (
                    <span 
                      className="flex items-center text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      <CheckCircle2 size={12} className="mr-1" style={{ color: 'var(--color-success)' }} />
                      Installed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configuration Modal */}
      <RentalConfigModal 
        open={configuringModule === 'rentals'} 
        onOpenChange={(open) => !open && setConfigureModule(null)} 
      />
    </div>
  );
};

const RentalConfigModal = ({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[600px]"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)'
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div 
              className="p-2 rounded-lg"
              style={{
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <Calendar size={20} style={{ color: 'var(--color-primary)' }} />
            </div>
            <DialogTitle style={{ color: 'var(--color-text-primary)' }}>
              Configure Rental Logic
            </DialogTitle>
          </div>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            Define how your rental business operates. These settings affect the booking flow.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Setting 1: Pricing Unit */}
          <div className="space-y-3">
            <Label 
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Pricing Model
            </Label>
            <Select defaultValue="per_event">
              <SelectTrigger 
                className="w-full"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
              >
                <SelectValue placeholder="Select pricing unit" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-primary)',
                  color: 'var(--color-text-primary)'
                }}
              >
                <SelectItem value="per_event">Per Event (Flat Rate for Duration)</SelectItem>
                <SelectItem value="per_day">Per Day (Daily Rate)</SelectItem>
                <SelectItem value="per_hour">Per Hour (Hourly Rate)</SelectItem>
              </SelectContent>
            </Select>
            <p 
              className="text-xs"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Best for bridal: "Per Event" (covers 3-5 days).
            </p>
          </div>

          {/* Setting 2: Security Policy */}
          <div className="space-y-3">
            <Label 
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Security Requirements
            </Label>
            <div className="grid grid-cols-1 gap-3">
              <div 
                className="flex items-start space-x-3 p-3 rounded-lg border"
                style={{
                  borderColor: 'var(--color-border-primary)',
                  backgroundColor: 'rgba(17, 24, 39, 0.5)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <Checkbox id="req_id" defaultChecked />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="req_id"
                    className="text-sm font-medium leading-none cursor-pointer"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Require ID Card (Original/Copy)
                  </label>
                  <p 
                    className="text-xs"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Mandatory for new customers.
                  </p>
                </div>
              </div>
              
              <div 
                className="flex items-start space-x-3 p-3 rounded-lg border"
                style={{
                  borderColor: 'var(--color-border-primary)',
                  backgroundColor: 'rgba(17, 24, 39, 0.5)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <Checkbox id="req_deposit" defaultChecked />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="req_deposit"
                    className="text-sm font-medium leading-none cursor-pointer"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Require Security Deposit
                  </label>
                  <p 
                    className="text-xs"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Cash or Cheque held until return.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Setting 3: Buffer Time */}
          <div className="space-y-3">
            <Label 
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Turnaround Buffer
            </Label>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input 
                  type="number" 
                  defaultValue="1"
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
              <Select defaultValue="days">
                <SelectTrigger 
                  className="w-32"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p 
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <Clock size={12} />
              Time needed for dry cleaning/repairs before next booking.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            style={{
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-secondary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => onOpenChange(false)}
            className="font-medium"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)'
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
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
