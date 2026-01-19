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
    <div className="flex-1 h-full bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">Modules & Features</h1>
        <p className="text-gray-400">Enable or disable core business modules. Changes reflect immediately in the sidebar.</p>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {moduleList.map((mod) => {
            const isEnabled = modules[mod.id]?.isEnabled;
            
            return (
              <div 
                key={mod.id} 
                className={cn(
                  "flex flex-col p-6 rounded-xl border transition-all duration-200",
                  isEnabled 
                    ? `bg-gray-900 border-gray-700 shadow-lg` 
                    : "bg-gray-900/50 border-gray-800 opacity-80 hover:opacity-100"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn("p-3 rounded-lg", mod.bgColor, mod.color)}>
                    <mod.icon size={24} strokeWidth={1.5} />
                  </div>
                  <div className="flex items-center gap-3">
                    {isEnabled && (
                      <Badge className="bg-green-900/20 text-green-400 border-green-900/50 hover:bg-green-900/30">
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
                  <h3 className="text-lg font-semibold text-white mb-2">{mod.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{mod.description}</p>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn(
                      "text-xs px-0 hover:bg-transparent", 
                      isEnabled ? "text-blue-400 hover:text-blue-300" : "text-gray-600 cursor-not-allowed"
                    )}
                    disabled={!isEnabled}
                    onClick={() => setConfigureModule(mod.id)}
                  >
                    <Settings size={14} className="mr-2" />
                    Configure
                  </Button>
                  
                  {isEnabled && (
                    <span className="flex items-center text-xs text-gray-500">
                      <CheckCircle2 size={12} className="mr-1 text-green-500" />
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
      <DialogContent className="sm:max-w-[600px] bg-gray-950 border-gray-800 text-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-pink-500/10 rounded-lg">
              <Calendar className="text-pink-500" size={20} />
            </div>
            <DialogTitle>Configure Rental Logic</DialogTitle>
          </div>
          <DialogDescription className="text-gray-400">
            Define how your rental business operates. These settings affect the booking flow.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Setting 1: Pricing Unit */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-white">Pricing Model</Label>
            <Select defaultValue="per_event">
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white w-full">
                <SelectValue placeholder="Select pricing unit" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                <SelectItem value="per_event">Per Event (Flat Rate for Duration)</SelectItem>
                <SelectItem value="per_day">Per Day (Daily Rate)</SelectItem>
                <SelectItem value="per_hour">Per Hour (Hourly Rate)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Best for bridal: "Per Event" (covers 3-5 days).</p>
          </div>

          {/* Setting 2: Security Policy */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-white">Security Requirements</Label>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-800 bg-gray-900/50">
                <Checkbox id="req_id" defaultChecked className="border-gray-600 data-[state=checked]:bg-pink-600 data-[state=checked]:border-pink-600" />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="req_id"
                    className="text-sm font-medium leading-none text-white cursor-pointer"
                  >
                    Require ID Card (Original/Copy)
                  </label>
                  <p className="text-xs text-gray-500">
                    Mandatory for new customers.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-800 bg-gray-900/50">
                <Checkbox id="req_deposit" defaultChecked className="border-gray-600 data-[state=checked]:bg-pink-600 data-[state=checked]:border-pink-600" />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="req_deposit"
                    className="text-sm font-medium leading-none text-white cursor-pointer"
                  >
                    Require Security Deposit
                  </label>
                  <p className="text-xs text-gray-500">
                    Cash or Cheque held until return.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Setting 3: Buffer Time */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-white">Turnaround Buffer</Label>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input 
                  type="number" 
                  defaultValue="1" 
                  className="bg-gray-900 border-gray-700 text-white"
                />
              </div>
              <Select defaultValue="days">
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={12} />
              Time needed for dry cleaning/repairs before next booking.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800">
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-pink-600 hover:bg-pink-500 text-white font-medium">
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
