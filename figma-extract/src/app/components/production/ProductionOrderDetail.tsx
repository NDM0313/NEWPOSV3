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
    <div className="flex flex-col h-full bg-gray-900 text-white animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-950/50">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="text-gray-400 hover:text-white">
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Production Order #105</h1>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20">
                In Production
              </Badge>
            </div>
            <p className="text-gray-400 text-sm mt-1">Bridal Maxi Red (Custom Size) - Due Dec 30, 2025</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="border-gray-700 text-gray-300 gap-2"
            onClick={() => setIsShareModalOpen(true)}
          >
            <Share2 size={16} /> Share Status
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20">
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="materials" className="w-full max-w-5xl mx-auto">
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-gray-800 mb-8 overflow-x-auto">
            <TabsTrigger 
              value="materials" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 px-6 py-3 text-gray-400"
            >
              Material
            </TabsTrigger>
            <TabsTrigger 
              value="services" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 px-6 py-3 text-gray-400"
            >
              Services (Work)
            </TabsTrigger>
            <TabsTrigger 
              value="logistics" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 px-6 py-3 text-gray-400"
            >
              Dispatch (DHL)
            </TabsTrigger>
            <TabsTrigger 
              value="summary" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-blue-400 px-6 py-3 text-gray-400"
            >
              Summary
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Materials */}
          <TabsContent value="materials" className="space-y-6">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                 <CardTitle className="text-lg font-semibold text-white">Inventory Consumption</CardTitle>
                 <Button onClick={addMaterial} size="sm" variant="outline" className="border-gray-700 hover:bg-gray-800 text-blue-400">
                    <Plus className="h-4 w-4 mr-2" /> Add Material
                  </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {materials.map((material) => (
                    <div key={material.id} className="flex gap-4 items-end animate-in slide-in-from-left-2 duration-300">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-500 mb-1.5 block">Item</Label>
                        <Select 
                          value={material.itemId} 
                          onValueChange={(val) => updateMaterial(material.id, 'itemId', val)}
                        >
                          <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                            <SelectValue placeholder="Select Item" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800 text-white">
                            {inventoryItems.map(item => (
                              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="w-24">
                        <Label className="text-xs text-gray-500 mb-1.5 block">Qty</Label>
                        <Input 
                          type="number" 
                          value={material.qty}
                          onChange={(e) => updateMaterial(material.id, 'qty', Number(e.target.value))}
                          className="bg-gray-950 border-gray-700 text-white" 
                        />
                      </div>
                      
                      <div className="w-32">
                        <Label className="text-xs text-gray-500 mb-1.5 block">Unit Cost</Label>
                        <Input 
                          value={material.cost}
                          readOnly
                          className="bg-gray-900/50 border-gray-800 text-gray-400" 
                        />
                      </div>
                      
                      <div className="w-32">
                        <Label className="text-xs text-gray-500 mb-1.5 block">Total</Label>
                        <div className="h-10 flex items-center px-3 bg-gray-900/50 border border-gray-800 rounded-md text-white font-mono">
                          {material.qty * material.cost}
                        </div>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeMaterial(material.id)}
                        className="h-10 w-10 text-gray-500 hover:text-red-400 hover:bg-red-950/20"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  ))}
                  
                  <Separator className="my-6 bg-gray-800" />
                  
                  <div className="flex justify-between items-center bg-gray-950/30 p-4 rounded-lg border border-gray-800/50">
                     <span className="text-gray-400">Base Fabric Cost (Allocated)</span>
                     <span className="font-mono font-medium text-white">Rs {fabricCost.toLocaleString()}</span>
                  </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Services & Handwork */}
          <TabsContent value="services" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Vendor Jobs & Services</h3>
              <Button onClick={addService} className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20">
                <Plus className="h-4 w-4 mr-2" /> Add Process
              </Button>
            </div>

            <div className="space-y-4">
              {services.map((service, index) => (
                <Card key={service.id} className="bg-gray-900/50 border-gray-800 overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                  <div className="p-1 bg-gradient-to-r from-blue-600/20 to-transparent border-b border-gray-800"></div>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                      
                      {/* Left: Process & Vendor */}
                      <div className="md:col-span-3 space-y-4">
                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">Process Type</Label>
                          <Select 
                            value={service.type} 
                            onValueChange={(val) => updateService(service.id, 'type', val)}
                          >
                            <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800 text-white">
                              <SelectItem value="Dyeing">Dyeing</SelectItem>
                              <SelectItem value="Handwork">Handwork</SelectItem>
                              <SelectItem value="Stitching">Stitching</SelectItem>
                              <SelectItem value="Designing">Designing</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">Vendor</Label>
                          <Select 
                            value={service.vendorId} 
                            onValueChange={(val) => updateService(service.id, 'vendorId', val)}
                          >
                            <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                              <SelectValue placeholder="Select Vendor" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800 text-white">
                              {vendors.map(v => (
                                <SelectItem key={v.id} value={v.id}>
                                  <div className="flex flex-col text-left">
                                    <span>{v.name}</span>
                                    <span className={cn("text-[10px]", v.balance < 0 ? "text-red-400" : "text-green-400")}>
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
                        <Label className="text-xs text-gray-500 mb-1.5 block">Instructions</Label>
                        <Textarea 
                          value={service.instructions}
                          onChange={(e) => updateService(service.id, 'instructions', e.target.value)}
                          placeholder="e.g. Gold Dori work on borders"
                          className="bg-gray-950 border-gray-700 text-white min-h-[105px] resize-none"
                        />
                      </div>

                      {/* Right: Cost & Status */}
                      <div className="md:col-span-3 space-y-4">
                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">Cost (Payable)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Rs</span>
                            <Input 
                              type="number"
                              value={service.cost}
                              onChange={(e) => updateService(service.id, 'cost', Number(e.target.value))}
                              className="bg-gray-950 border-gray-700 text-white pl-8 font-mono"
                            />
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Adds to Vendor Ledger
                          </p>
                        </div>

                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">Status</Label>
                          <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800">
                             {['Assigned', 'In Progress', 'Received'].map((s) => (
                               <button
                                 key={s}
                                 onClick={() => updateService(service.id, 'status', s)}
                                 className={cn(
                                   "flex-1 text-[10px] py-1.5 rounded-md transition-all font-medium",
                                   service.status === s 
                                    ? s === 'Received' ? "bg-green-600 text-white shadow" 
                                      : s === 'In Progress' ? "bg-blue-600 text-white shadow"
                                      : "bg-gray-700 text-white shadow"
                                    : "text-gray-500 hover:text-gray-300"
                                 )}
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
                          className="text-gray-600 hover:text-red-400 hover:bg-red-950/20"
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
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Truck className="text-blue-500" /> Shipment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Shipment Info */}
                  <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">Shipment Type</Label>
                          <Select 
                            value={logistics.shipmentType} 
                            onValueChange={(val) => setLogistics({...logistics, shipmentType: val})}
                          >
                            <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800 text-white">
                              <SelectItem value="Local">Local</SelectItem>
                              <SelectItem value="International">International</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">Weight / Vol</Label>
                          <div className="relative">
                            <Input 
                              value={logistics.weight}
                              onChange={(e) => setLogistics({...logistics, weight: Number(e.target.value)})}
                              className="bg-gray-950 border-gray-700 text-white pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">kg</span>
                          </div>
                        </div>
                     </div>

                     <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">Courier Provider</Label>
                        <Select 
                          value={logistics.courier} 
                          onValueChange={(val) => setLogistics({...logistics, courier: val})}
                        >
                          <SelectTrigger className="bg-gray-950 border-gray-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800 text-white">
                            {couriers.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Linked to Supplier Ledger
                        </p>
                     </div>

                     <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">Tracking ID</Label>
                        <div className="relative">
                           <Input 
                             value={logistics.tracking}
                             onChange={(e) => setLogistics({...logistics, tracking: e.target.value})}
                             placeholder="Scan or enter ID"
                             className="bg-gray-950 border-gray-700 text-white pr-10"
                           />
                           <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 h-4 w-4" />
                        </div>
                     </div>
                  </div>

                  {/* Right Column: Costing & Attachment */}
                  <div className="space-y-6">
                     <div className="bg-gray-950/30 p-4 rounded-lg border border-gray-800/50 space-y-4">
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Costing (Crucial)</h4>
                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">Our Cost (Payable to DHL)</Label>
                          <div className="relative">
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Rs</span>
                             <Input 
                                type="number"
                                value={logistics.shippingCost}
                                onChange={(e) => setLogistics({...logistics, shippingCost: Number(e.target.value)})}
                                className="bg-gray-900 border-gray-700 text-white pl-8 text-orange-400 font-medium" 
                              />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 mb-1.5 block">Charged to Customer</Label>
                          <div className="relative">
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Rs</span>
                             <Input 
                                type="number"
                                value={logistics.customerCharged}
                                onChange={(e) => setLogistics({...logistics, customerCharged: Number(e.target.value)})}
                                className="bg-gray-900 border-gray-700 text-white pl-8 text-green-400 font-medium" 
                              />
                          </div>
                        </div>
                     </div>

                     <div>
                        <Label className="text-xs text-gray-500 mb-1.5 block">Attachment (Receipt / Airway Bill)</Label>
                        <div className="border-2 border-dashed border-gray-800 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-gray-800/20 transition-colors cursor-pointer bg-gray-950/20 h-32">
                           <Paperclip className="text-gray-500 mb-2" size={20} />
                           <span className="text-xs text-gray-400">Click to upload image</span>
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
                <Card className="bg-gray-900/50 border-gray-800">
                   <CardHeader>
                      <CardTitle className="text-white">Cost Breakdown</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-800">
                         <span className="text-gray-400">Base Fabric</span>
                         <span className="text-white font-mono">Rs {fabricCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800">
                         <span className="text-gray-400">Material & Accessories</span>
                         <span className="text-white font-mono">Rs {totalMaterialCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800">
                         <span className="text-gray-400">Services (Handwork/Stitching)</span>
                         <span className="text-white font-mono">Rs {totalServicesCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-800">
                         <span className="text-gray-400">Logistics (DHL)</span>
                         <span className="text-white font-mono">Rs {Number(logistics.shippingCost).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-3">
                         <span className="text-lg font-bold text-white">Total Cost</span>
                         <span className="text-xl font-bold text-white font-mono">Rs {totalCost.toLocaleString()}</span>
                      </div>
                   </CardContent>
                </Card>

                <Card className="bg-gray-900/50 border-gray-800">
                   <CardHeader>
                      <CardTitle className="text-white">Profitability</CardTitle>
                   </CardHeader>
                   <CardContent className="flex flex-col justify-center h-64 space-y-6">
                      <div className="flex justify-between items-end">
                         <span className="text-gray-400 text-lg">Sale Price</span>
                         <span className="text-2xl font-bold text-blue-400">Rs {salePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end">
                         <span className="text-gray-400 text-lg">Total Cost</span>
                         <span className="text-2xl font-bold text-red-400">- Rs {totalCost.toLocaleString()}</span>
                      </div>
                      <Separator className="bg-gray-700" />
                      <div className="flex justify-between items-end">
                         <span className="text-gray-200 text-xl font-bold">Net Profit</span>
                         <div className="text-right">
                            <span className={cn(
                               "text-4xl font-black block",
                               estimatedProfit >= 0 ? "text-green-500" : "text-red-500"
                            )}>
                               Rs {estimatedProfit.toLocaleString()}
                            </span>
                            <span className={cn(
                               "text-sm font-medium",
                               estimatedProfit >= 0 ? "text-green-600" : "text-red-600"
                            )}>
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
      <div className="border-t border-gray-800 bg-gray-950 p-4 z-10">
         <div className="max-w-5xl mx-auto flex justify-between items-center">
            <div className="text-sm text-gray-500">
               Last saved: Just now
            </div>
            <div className="flex gap-4">
               <div className="text-right">
                  <span className="text-xs text-gray-400 uppercase block">Total Cost</span>
                  <span className="font-bold text-white">Rs {totalCost.toLocaleString()}</span>
               </div>
               <div className="w-px h-10 bg-gray-800"></div>
               <div className="text-right">
                  <span className="text-xs text-gray-400 uppercase block">Net Profit</span>
                  <span className={cn(
                     "font-bold",
                     estimatedProfit >= 0 ? "text-green-500" : "text-red-500"
                  )}>Rs {estimatedProfit.toLocaleString()}</span>
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
