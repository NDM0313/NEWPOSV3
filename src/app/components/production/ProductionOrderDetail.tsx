import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Truck, 
  Package, 
  Save,
  ArrowLeft,
  Barcode,
  Share2,
  FileText,
  DollarSign,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { ShareOrderModal } from './ShareOrderModal';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { cn } from "../ui/utils";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";

// Mock Data
const inventoryItems = [
  { id: '1', name: 'Golden Tassel', cost: 150 },
  { id: '2', name: 'Swarovski Button', cost: 80 },
  { id: '3', name: 'Velvet Patch', cost: 200 },
  { id: '4', name: 'Silk Thread Spool', cost: 400 },
];

const vendors = [
  { id: 'v1', name: 'Ustad Aslam Kadhayi Wala', balance: -5000 },
  { id: 'v2', name: 'Master Sahab (Tailor)', balance: 1200 },
  { id: 'v3', name: 'Embroidery Works', balance: 0 },
  { id: 'v4', name: 'Rafiq Dyer', balance: -200 },
];

const couriers = ['DHL International', 'TCS', 'FedEx', 'Leopards'];

type ServiceType = 'Dyeing' | 'Handwork' | 'Stitching' | 'Designing';
type ServiceStatus = 'Assigned' | 'In Progress' | 'Received';

interface ServiceItem {
  id: number;
  type: ServiceType;
  vendorId: string;
  instructions: string;
  cost: number;
  status: ServiceStatus;
}

export const ProductionOrderDetail = ({ onBack }: { onBack?: () => void }) => {
  // --- STATE ---
  
  // Tab 1: Materials
  const [materials, setMaterials] = useState([
    { id: 1, itemId: '1', qty: 6, cost: 150 }
  ]);

  // Tab 2: Services (Dynamic List)
  const [services, setServices] = useState<ServiceItem[]>([
    { id: 1, type: 'Dyeing', vendorId: 'v4', instructions: 'Deep Red #B22222', cost: 1500, status: 'Received' },
    { id: 2, type: 'Handwork', vendorId: 'v1', instructions: 'Gold Dori work on borders', cost: 8500, status: 'In Progress' }
  ]);

  // Tab 3: Logistics
  const [logistics, setLogistics] = useState({
    courier: 'DHL International',
    tracking: '',
    shipmentType: 'International', // Local | International
    weight: 2.5,
    shippingCost: 4500, // Payable to DHL
    customerCharged: 5000, // Charged to Customer
    status: 'In Transit'
  });

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Financials (Assumed/Fixed for this order)
  const fabricCost = 5000;
  const salePrice = 35000;

  // --- HANDLERS ---

  // Material Handlers
  const addMaterial = () => {
    setMaterials([...materials, { id: Date.now(), itemId: '', qty: 1, cost: 0 }]);
  };

  const removeMaterial = (id: number) => {
    setMaterials(materials.filter(m => m.id !== id));
  };

  const updateMaterial = (id: number, field: string, value: any) => {
    setMaterials(materials.map(m => {
      if (m.id === id) {
        if (field === 'itemId') {
          const item = inventoryItems.find(i => i.id === value);
          return { ...m, itemId: value, cost: item ? item.cost : 0 };
        }
        return { ...m, [field]: value };
      }
      return m;
    }));
  };

  // Service Handlers
  const addService = () => {
    setServices([...services, { 
      id: Date.now(), 
      type: 'Handwork', 
      vendorId: '', 
      instructions: '', 
      cost: 0, 
      status: 'Assigned' 
    }]);
  };

  const removeService = (id: number) => {
    setServices(services.filter(s => s.id !== id));
  };

  const updateService = (id: number, field: keyof ServiceItem, value: any) => {
    setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // --- CALCULATIONS ---
  
  const totalMaterialCost = useMemo(() => 
    materials.reduce((acc, curr) => acc + (curr.cost * curr.qty), 0), 
  [materials]);

  const totalServicesCost = useMemo(() => 
    services.reduce((acc, curr) => acc + curr.cost, 0),
  [services]);
  
  const totalCost = fabricCost + totalMaterialCost + totalServicesCost + Number(logistics.shippingCost);
  const estimatedProfit = salePrice - totalCost;

  return (
    <div 
      className="flex flex-col h-full animate-in fade-in duration-300"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)'
      }}
    >
      
      {/* Header */}
      <div 
        className="flex items-center justify-between p-6 border-b"
        style={{
          borderBottomColor: 'var(--color-border-primary)',
          backgroundColor: 'rgba(3, 7, 18, 0.5)'
        }}
      >
        <div className="flex items-center gap-4">
          {onBack && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack}
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Production Order #105
              </h1>
              <Badge 
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--color-primary)',
                  borderColor: 'rgba(59, 130, 246, 0.2)',
                  borderRadius: 'var(--radius-sm)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                }}
              >
                In Production
              </Badge>
            </div>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Bridal Maxi Red (Custom Size) - Due Dec 30, 2025
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2"
            style={{
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-secondary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => setIsShareModalOpen(true)}
          >
            <Share2 size={16} /> Share Status
          </Button>
          <Button 
            className="shadow-lg"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              boxShadow: 'var(--shadow-lg) rgba(30, 58, 138, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
            }}
          >
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="materials" className="w-full max-w-5xl mx-auto">
          <TabsList 
            className="w-full justify-start h-auto p-0 bg-transparent border-b mb-8 overflow-x-auto"
            style={{ borderBottomColor: 'var(--color-border-primary)' }}
          >
            <TabsTrigger 
              value="materials" 
              className="rounded-none border-b-2 border-transparent px-6 py-3"
              style={{
                color: 'var(--color-text-secondary)',
                borderBottomColor: 'transparent'
              }}
              data-state="inactive"
            >
              Material
            </TabsTrigger>
            <TabsTrigger 
              value="services" 
              className="rounded-none border-b-2 border-transparent px-6 py-3"
              style={{
                color: 'var(--color-text-secondary)',
                borderBottomColor: 'transparent'
              }}
            >
              Services (Work)
            </TabsTrigger>
            <TabsTrigger 
              value="logistics" 
              className="rounded-none border-b-2 border-transparent px-6 py-3"
              style={{
                color: 'var(--color-text-secondary)',
                borderBottomColor: 'transparent'
              }}
            >
              Dispatch (DHL)
            </TabsTrigger>
            <TabsTrigger 
              value="summary" 
              className="rounded-none border-b-2 border-transparent px-6 py-3"
              style={{
                color: 'var(--color-text-secondary)',
                borderBottomColor: 'transparent'
              }}
            >
              Summary
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Materials */}
          <TabsContent value="materials" className="space-y-6">
            <Card 
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-primary)'
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle 
                   className="text-lg font-semibold"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   Inventory Consumption
                 </CardTitle>
                 <Button 
                   onClick={addMaterial} 
                   size="sm" 
                   variant="outline"
                   style={{
                     borderColor: 'var(--color-border-secondary)',
                     color: 'var(--color-primary)'
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.backgroundColor = 'transparent';
                   }}
                 >
                    <Plus className="h-4 w-4 mr-2" /> Add Material
                  </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {materials.map((material) => (
                    <div key={material.id} className="flex gap-4 items-end animate-in slide-in-from-left-2 duration-300">
                      <div className="flex-1">
                        <Label 
                          className="text-xs mb-1.5 block"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Item
                        </Label>
                        <Select 
                          value={material.itemId} 
                          onValueChange={(val) => updateMaterial(material.id, 'itemId', val)}
                        >
                          <SelectTrigger 
                            style={{
                              backgroundColor: 'var(--color-bg-tertiary)',
                              borderColor: 'var(--color-border-secondary)',
                              color: 'var(--color-text-primary)'
                            }}
                          >
                            <SelectValue placeholder="Select Item" />
                          </SelectTrigger>
                          <SelectContent 
                            style={{
                              backgroundColor: 'var(--color-bg-primary)',
                              borderColor: 'var(--color-border-primary)',
                              color: 'var(--color-text-primary)'
                            }}
                          >
                            {inventoryItems.map(item => (
                              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="w-24">
                        <Label 
                          className="text-xs mb-1.5 block"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Qty
                        </Label>
                        <Input 
                          type="number" 
                          value={material.qty}
                          onChange={(e) => updateMaterial(material.id, 'qty', Number(e.target.value))}
                          style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            borderColor: 'var(--color-border-secondary)',
                            color: 'var(--color-text-primary)'
                          }}
                        />
                      </div>
                      
                      <div className="w-32">
                        <Label 
                          className="text-xs mb-1.5 block"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Unit Cost
                        </Label>
                        <Input 
                          value={material.cost}
                          readOnly
                          style={{
                            backgroundColor: 'rgba(17, 24, 39, 0.5)',
                            borderColor: 'var(--color-border-primary)',
                            color: 'var(--color-text-secondary)'
                          }}
                        />
                      </div>
                      
                      <div className="w-32">
                        <Label 
                          className="text-xs mb-1.5 block"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Total
                        </Label>
                        <div 
                          className="h-10 flex items-center px-3 border rounded-md font-mono"
                          style={{
                            backgroundColor: 'rgba(17, 24, 39, 0.5)',
                            borderColor: 'var(--color-border-primary)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--color-text-primary)'
                          }}
                        >
                          {material.qty * material.cost}
                        </div>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeMaterial(material.id)}
                        className="h-10 w-10"
                        style={{ color: 'var(--color-text-tertiary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-error)';
                          e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-tertiary)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  ))}
                  
                  <Separator 
                    className="my-6"
                    style={{ backgroundColor: 'var(--color-border-primary)' }}
                  />
                  
                  <div 
                    className="flex justify-between items-center p-4 rounded-lg border"
                    style={{
                      backgroundColor: 'rgba(3, 7, 18, 0.3)',
                      borderColor: 'rgba(31, 41, 55, 0.5)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                     <span style={{ color: 'var(--color-text-secondary)' }}>
                       Base Fabric Cost (Allocated)
                     </span>
                     <span 
                       className="font-mono font-medium"
                       style={{ color: 'var(--color-text-primary)' }}
                     >
                       Rs {fabricCost.toLocaleString()}
                     </span>
                  </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Services & Handwork */}
          <TabsContent value="services" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Vendor Jobs & Services
              </h3>
              <Button 
                onClick={addService}
                className="shadow-lg"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-primary)',
                  boxShadow: 'var(--shadow-lg) rgba(30, 58, 138, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Process
              </Button>
            </div>

            <div className="space-y-4">
              {services.map((service, index) => (
                <Card 
                  key={service.id} 
                  className="overflow-hidden animate-in slide-in-from-bottom-2 duration-300"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)'
                  }}
                >
                  <div 
                    className="p-1 border-b"
                    style={{
                      background: 'linear-gradient(to right, rgba(59, 130, 246, 0.2), transparent)',
                      borderBottomColor: 'var(--color-border-primary)'
                    }}
                  ></div>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                      
                      {/* Left: Process & Vendor */}
                      <div className="md:col-span-3 space-y-4">
                        <div>
                          <Label 
                            className="text-xs mb-1.5 block"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Process Type
                          </Label>
                          <Select 
                            value={service.type} 
                            onValueChange={(val) => updateService(service.id, 'type', val)}
                          >
                            <SelectTrigger 
                              style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-secondary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent 
                              style={{
                                backgroundColor: 'var(--color-bg-primary)',
                                borderColor: 'var(--color-border-primary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                              <SelectItem value="Dyeing">Dyeing</SelectItem>
                              <SelectItem value="Handwork">Handwork</SelectItem>
                              <SelectItem value="Stitching">Stitching</SelectItem>
                              <SelectItem value="Designing">Designing</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label 
                            className="text-xs mb-1.5 block"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Vendor
                          </Label>
                          <Select 
                            value={service.vendorId} 
                            onValueChange={(val) => updateService(service.id, 'vendorId', val)}
                          >
                            <SelectTrigger 
                              style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-secondary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                              <SelectValue placeholder="Select Vendor" />
                            </SelectTrigger>
                            <SelectContent 
                              style={{
                                backgroundColor: 'var(--color-bg-primary)',
                                borderColor: 'var(--color-border-primary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                              {vendors.map(v => (
                                <SelectItem key={v.id} value={v.id}>
                                  <div className="flex flex-col text-left">
                                    <span>{v.name}</span>
                                    <span 
                                      className="text-[10px]"
                                      style={{ color: v.balance < 0 ? 'var(--color-error)' : 'var(--color-success)' }}
                                    >
                                      Bal: {v.balance}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Middle: Instructions */}
                      <div className="md:col-span-5">
                        <Label 
                          className="text-xs mb-1.5 block"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Instructions
                        </Label>
                        <Textarea 
                          value={service.instructions}
                          onChange={(e) => updateService(service.id, 'instructions', e.target.value)}
                          placeholder="e.g. Gold Dori work on borders"
                          className="min-h-[105px] resize-none"
                          style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            borderColor: 'var(--color-border-secondary)',
                            color: 'var(--color-text-primary)'
                          }}
                        />
                      </div>

                      {/* Right: Cost & Status */}
                      <div className="md:col-span-3 space-y-4">
                        <div>
                          <Label 
                            className="text-xs mb-1.5 block"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Cost (Payable)
                          </Label>
                          <div className="relative">
                            <span 
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              Rs
                            </span>
                            <Input 
                              type="number"
                              value={service.cost}
                              onChange={(e) => updateService(service.id, 'cost', Number(e.target.value))}
                              className="pl-8 font-mono"
                              style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-secondary)',
                                color: 'var(--color-text-primary)'
                              }}
                            />
                          </div>
                          <p 
                            className="text-[10px] mt-1 flex items-center gap-1"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            <CheckCircle2 size={10} /> Adds to Vendor Ledger
                          </p>
                        </div>

                        <div>
                          <Label 
                            className="text-xs mb-1.5 block"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Status
                          </Label>
                          <div 
                            className="flex p-1 rounded-lg border"
                            style={{
                              backgroundColor: 'var(--color-bg-tertiary)',
                              borderColor: 'var(--color-border-primary)',
                              borderRadius: 'var(--radius-lg)'
                            }}
                          >
                             {['Assigned', 'In Progress', 'Received'].map((s) => (
                               <button
                                 key={s}
                                 onClick={() => updateService(service.id, 'status', s)}
                                 className="flex-1 text-[10px] py-1.5 rounded-md transition-all font-medium"
                                 style={{
                                   backgroundColor: service.status === s 
                                     ? s === 'Received' 
                                       ? 'var(--color-success)' 
                                       : s === 'In Progress' 
                                       ? 'var(--color-primary)'
                                       : 'var(--color-border-secondary)'
                                     : 'transparent',
                                   color: service.status === s 
                                     ? 'var(--color-text-primary)' 
                                     : 'var(--color-text-tertiary)',
                                   borderRadius: 'var(--radius-md)',
                                   boxShadow: service.status === s ? 'var(--shadow-sm)' : 'none'
                                 }}
                                 onMouseEnter={(e) => {
                                   if (service.status !== s) {
                                     e.currentTarget.style.color = 'var(--color-text-secondary)';
                                   }
                                 }}
                                 onMouseLeave={(e) => {
                                   if (service.status !== s) {
                                     e.currentTarget.style.color = 'var(--color-text-tertiary)';
                                   }
                                 }}
                               >
                                 {s === 'In Progress' ? 'Work' : s}
                               </button>
                             ))}
                          </div>
                        </div>
                      </div>

                      {/* Delete Action */}
                      <div className="md:col-span-1 flex items-center justify-center pt-8">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeService(service.id)}
                          style={{ color: 'var(--color-text-disabled)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-error)';
                            e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-disabled)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab 3: Dispatch & Logistics */}
          <TabsContent value="logistics" className="space-y-6">
            <Card 
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.5)',
                borderColor: 'var(--color-border-primary)'
              }}
            >
              <CardHeader>
                <CardTitle 
                  className="flex items-center gap-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <Truck style={{ color: 'var(--color-primary)' }} /> Shipment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Shipment Info */}
                  <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label 
                            className="text-xs mb-1.5 block"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Shipment Type
                          </Label>
                          <Select 
                            value={logistics.shipmentType} 
                            onValueChange={(val) => setLogistics({...logistics, shipmentType: val})}
                          >
                            <SelectTrigger 
                              style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-secondary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent 
                              style={{
                                backgroundColor: 'var(--color-bg-primary)',
                                borderColor: 'var(--color-border-primary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                              <SelectItem value="Local">Local</SelectItem>
                              <SelectItem value="International">International</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label 
                            className="text-xs mb-1.5 block"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Weight / Vol
                          </Label>
                          <div className="relative">
                            <Input 
                              value={logistics.weight}
                              onChange={(e) => setLogistics({...logistics, weight: Number(e.target.value)})}
                              className="pr-8"
                              style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-secondary)',
                                color: 'var(--color-text-primary)'
                              }}
                            />
                            <span 
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              kg
                            </span>
                          </div>
                        </div>
                     </div>

                     <div>
                        <Label 
                          className="text-xs mb-1.5 block"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Courier Provider
                        </Label>
                        <Select 
                          value={logistics.courier} 
                          onValueChange={(val) => setLogistics({...logistics, courier: val})}
                        >
                          <SelectTrigger 
                            style={{
                              backgroundColor: 'var(--color-bg-tertiary)',
                              borderColor: 'var(--color-border-secondary)',
                              color: 'var(--color-text-primary)'
                            }}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent 
                            style={{
                              backgroundColor: 'var(--color-bg-primary)',
                              borderColor: 'var(--color-border-primary)',
                              color: 'var(--color-text-primary)'
                            }}
                          >
                            {couriers.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p 
                          className="text-[10px] mt-1 flex items-center gap-1"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          <CheckCircle2 size={10} /> Linked to Supplier Ledger
                        </p>
                     </div>

                     <div>
                        <Label 
                          className="text-xs mb-1.5 block"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Tracking ID
                        </Label>
                        <div className="relative">
                           <Input 
                             value={logistics.tracking}
                             onChange={(e) => setLogistics({...logistics, tracking: e.target.value})}
                             placeholder="Scan or enter ID"
                             className="pr-10"
                             style={{
                               backgroundColor: 'var(--color-bg-tertiary)',
                               borderColor: 'var(--color-border-secondary)',
                               color: 'var(--color-text-primary)'
                             }}
                           />
                           <Barcode 
                             className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4"
                             style={{ color: 'var(--color-text-tertiary)' }}
                           />
                        </div>
                     </div>
                  </div>

                  {/* Right Column: Costing & Attachment */}
                  <div className="space-y-6">
                     <div 
                       className="p-4 rounded-lg border space-y-4"
                       style={{
                         backgroundColor: 'rgba(3, 7, 18, 0.3)',
                         borderColor: 'rgba(31, 41, 55, 0.5)',
                         borderRadius: 'var(--radius-lg)'
                       }}
                     >
                        <h4 
                          className="text-sm font-semibold mb-2"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Costing (Crucial)
                        </h4>
                        <div>
                          <Label 
                            className="text-xs mb-1.5 block"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Our Cost (Payable to DHL)
                          </Label>
                          <div className="relative">
                             <span 
                               className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                               style={{ color: 'var(--color-text-tertiary)' }}
                             >
                               Rs
                             </span>
                             <Input 
                                type="number"
                                value={logistics.shippingCost}
                                onChange={(e) => setLogistics({...logistics, shippingCost: Number(e.target.value)})}
                                className="pl-8 font-medium"
                                style={{
                                  backgroundColor: 'var(--color-bg-primary)',
                                  borderColor: 'var(--color-border-secondary)',
                                  color: 'var(--color-warning)'
                                }}
                              />
                          </div>
                        </div>
                        <div>
                          <Label 
                            className="text-xs mb-1.5 block"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Charged to Customer
                          </Label>
                          <div className="relative">
                             <span 
                               className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                               style={{ color: 'var(--color-text-tertiary)' }}
                             >
                               Rs
                             </span>
                             <Input 
                                type="number"
                                value={logistics.customerCharged}
                                onChange={(e) => setLogistics({...logistics, customerCharged: Number(e.target.value)})}
                                className="pl-8 font-medium"
                                style={{
                                  backgroundColor: 'var(--color-bg-primary)',
                                  borderColor: 'var(--color-border-secondary)',
                                  color: 'var(--color-success)'
                                }}
                              />
                          </div>
                        </div>
                     </div>

                     <div>
                        <Label 
                          className="text-xs mb-1.5 block"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          Attachment (Receipt / Airway Bill)
                        </Label>
                        <div 
                          className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center transition-colors cursor-pointer h-32"
                          style={{
                            borderColor: 'var(--color-border-primary)',
                            borderRadius: 'var(--radius-lg)',
                            backgroundColor: 'rgba(3, 7, 18, 0.2)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(3, 7, 18, 0.2)';
                          }}
                        >
                           <Paperclip 
                             className="mb-2"
                             size={20}
                             style={{ color: 'var(--color-text-tertiary)' }}
                           />
                           <span 
                             className="text-xs"
                             style={{ color: 'var(--color-text-secondary)' }}
                           >
                             Click to upload image
                           </span>
                        </div>
                     </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Summary */}
          <TabsContent value="summary" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card 
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)'
                  }}
                >
                   <CardHeader>
                      <CardTitle style={{ color: 'var(--color-text-primary)' }}>
                         Cost Breakdown
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div 
                        className="flex justify-between items-center py-2 border-b"
                        style={{ borderBottomColor: 'var(--color-border-primary)' }}
                      >
                         <span style={{ color: 'var(--color-text-secondary)' }}>Base Fabric</span>
                         <span 
                           className="font-mono"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           Rs {fabricCost.toLocaleString()}
                         </span>
                      </div>
                      <div 
                        className="flex justify-between items-center py-2 border-b"
                        style={{ borderBottomColor: 'var(--color-border-primary)' }}
                      >
                         <span style={{ color: 'var(--color-text-secondary)' }}>Material & Accessories</span>
                         <span 
                           className="font-mono"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           Rs {totalMaterialCost.toLocaleString()}
                         </span>
                      </div>
                      <div 
                        className="flex justify-between items-center py-2 border-b"
                        style={{ borderBottomColor: 'var(--color-border-primary)' }}
                      >
                         <span style={{ color: 'var(--color-text-secondary)' }}>Services (Handwork/Stitching)</span>
                         <span 
                           className="font-mono"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           Rs {totalServicesCost.toLocaleString()}
                         </span>
                      </div>
                      <div 
                        className="flex justify-between items-center py-2 border-b"
                        style={{ borderBottomColor: 'var(--color-border-primary)' }}
                      >
                         <span style={{ color: 'var(--color-text-secondary)' }}>Logistics (DHL)</span>
                         <span 
                           className="font-mono"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           Rs {Number(logistics.shippingCost).toLocaleString()}
                         </span>
                      </div>
                      <div className="flex justify-between items-center py-3">
                         <span 
                           className="text-lg font-bold"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           Total Cost
                         </span>
                         <span 
                           className="text-xl font-bold font-mono"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           Rs {totalCost.toLocaleString()}
                         </span>
                      </div>
                   </CardContent>
                </Card>

                <Card 
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: 'var(--color-border-primary)'
                  }}
                >
                   <CardHeader>
                      <CardTitle style={{ color: 'var(--color-text-primary)' }}>
                         Profitability
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="flex flex-col justify-center h-64 space-y-6">
                      <div className="flex justify-between items-end">
                         <span 
                           className="text-lg"
                           style={{ color: 'var(--color-text-secondary)' }}
                         >
                           Sale Price
                         </span>
                         <span 
                           className="text-2xl font-bold"
                           style={{ color: 'var(--color-primary)' }}
                         >
                           Rs {salePrice.toLocaleString()}
                         </span>
                      </div>
                      <div className="flex justify-between items-end">
                         <span 
                           className="text-lg"
                           style={{ color: 'var(--color-text-secondary)' }}
                         >
                           Total Cost
                         </span>
                         <span 
                           className="text-2xl font-bold"
                           style={{ color: 'var(--color-error)' }}
                         >
                           - Rs {totalCost.toLocaleString()}
                         </span>
                      </div>
                      <Separator style={{ backgroundColor: 'var(--color-border-secondary)' }} />
                      <div className="flex justify-between items-end">
                         <span 
                           className="text-xl font-bold"
                           style={{ color: 'var(--color-text-secondary)' }}
                         >
                           Net Profit
                         </span>
                         <div className="text-right">
                            <span 
                              className="text-4xl font-black block"
                              style={{ color: estimatedProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}
                            >
                               Rs {estimatedProfit.toLocaleString()}
                            </span>
                            <span 
                              className="text-sm font-medium"
                              style={{ color: estimatedProfit >= 0 ? 'rgba(5, 150, 105, 1)' : 'rgba(220, 38, 38, 1)' }}
                            >
                               {((estimatedProfit / salePrice) * 100).toFixed(1)}% Margin
                            </span>
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

        </Tabs>
      </div>

      {/* Footer (Simplified) */}
      <div 
        className="border-t p-4 z-10"
        style={{
          borderTopColor: 'var(--color-border-primary)',
          backgroundColor: 'var(--color-bg-tertiary)'
        }}
      >
         <div className="max-w-5xl mx-auto flex justify-between items-center">
            <div 
              className="text-sm"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
               Last saved: Just now
            </div>
            <div className="flex gap-4">
               <div className="text-right">
                  <span 
                    className="text-xs uppercase block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Total Cost
                  </span>
                  <span 
                    className="font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Rs {totalCost.toLocaleString()}
                  </span>
               </div>
               <div 
                 className="w-px h-10"
                 style={{ backgroundColor: 'var(--color-border-primary)' }}
               ></div>
               <div className="text-right">
                  <span 
                    className="text-xs uppercase block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Net Profit
                  </span>
                  <span 
                    className="font-bold"
                    style={{ color: estimatedProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}
                  >
                    Rs {estimatedProfit.toLocaleString()}
                  </span>
               </div>
            </div>
         </div>
      </div>

      <ShareOrderModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        orderId="ORD-8821" 
      />
    </div>
  );
};
