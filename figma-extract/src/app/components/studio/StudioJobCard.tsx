import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  User,
  Phone,
  MapPin,
  Package,
  Zap,
  DollarSign,
  CheckCircle2,
  Circle,
  Clock,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  GripVertical,
  AlertTriangle
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

type WorkflowStep = {
  id: string;
  name: string;
  enabled: boolean;
  completed: boolean;
  assignedWorker?: string;
  cost?: number;
  notes?: string;
};

type Priority = 'Normal' | 'Urgent';

interface JobDetails {
  jobId: string;
  linkedInvoice: string;
  customerName: string;
  customerMobile: string;
  customerAddress?: string;
  productName: string;
  productCode: string;
  productImage: string;
  priority: Priority;
  expectedDelivery: string;
  createdDate: string;
  status: string;
}

// Mock data
const mockJobDetails: JobDetails = {
  jobId: "STU-0001",
  linkedInvoice: "INV-2045",
  customerName: "Ayesha Malik",
  customerMobile: "+92 345 1122334",
  customerAddress: "DHA Phase 5, Lahore",
  productName: "Royal Red Bridal Lehenga",
  productCode: "RBL-001",
  productImage: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80",
  priority: "Urgent",
  expectedDelivery: "2026-01-25",
  createdDate: "2026-01-18",
  status: "In Production",
};

const mockWorkers = [
  { id: "1", name: "Ali (Dyer)", type: "Dyer" },
  { id: "2", name: "Ahmed (Handwork)", type: "Handwork" },
  { id: "3", name: "Bilal (Tailor)", type: "Tailor" },
  { id: "4", name: "QC Team", type: "Quality" },
];

const defaultWorkflowSteps: WorkflowStep[] = [
  { id: "1", name: "Dyeing", enabled: true, completed: false },
  { id: "2", name: "Handwork", enabled: true, completed: false },
  { id: "3", name: "Stitching", enabled: true, completed: false },
  { id: "4", name: "Accessories", enabled: false, completed: false },
  { id: "5", name: "Quality Check", enabled: true, completed: false },
  { id: "6", name: "Ready for Delivery", enabled: true, completed: false },
];

export const StudioJobCard = () => {
  const [jobDetails] = useState<JobDetails>(mockJobDetails);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(defaultWorkflowSteps);
  const [editingCost, setEditingCost] = useState(false);
  const [internalCost, setInternalCost] = useState(3500);
  const [customerBilling, setCustomerBilling] = useState(5500);

  // Toggle step enabled/disabled
  const toggleStep = (stepId: string) => {
    setWorkflowSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, enabled: !step.enabled } : step
    ));
  };

  // Mark step as complete
  const completeStep = (stepId: string) => {
    setWorkflowSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed: !step.completed } : step
    ));
  };

  // Assign worker to step
  const assignWorker = (stepId: string, workerId: string) => {
    const worker = mockWorkers.find(w => w.id === workerId);
    setWorkflowSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, assignedWorker: worker?.name } : step
    ));
  };

  // Add cost to step
  const addCost = (stepId: string, cost: number) => {
    setWorkflowSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, cost } : step
    ));
  };

  // Calculate total internal cost
  const totalInternalCost = workflowSteps.reduce((sum, step) => sum + (step.cost || 0), 0);
  const profit = customerBilling - totalInternalCost;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} className="mr-2" />
            Back to Jobs
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">{jobDetails.jobId}</h1>
            <p className="text-sm text-gray-400">
              Linked Invoice: <span className="font-mono text-blue-400">{jobDetails.linkedInvoice}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "text-sm px-3 py-1",
              jobDetails.priority === 'Urgent' 
                ? "bg-yellow-900/20 text-yellow-400 border-yellow-900/50" 
                : "bg-blue-900/20 text-blue-400 border-blue-900/50"
            )}
          >
            {jobDetails.priority}
          </Badge>
          <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-900/50 text-sm px-3 py-1">
            {jobDetails.status}
          </Badge>
        </div>
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: WORKFLOW BUILDER (2/3 width) */}
        <div className="col-span-2 space-y-6">
          
          {/* WORKFLOW STEPS */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Zap size={18} className="text-blue-400" />
                Production Workflow
              </h2>
              <Button size="sm" variant="outline" className="border-gray-700 text-gray-400 h-8">
                <Plus size={14} className="mr-1" />
                Add Step
              </Button>
            </div>

            <div className="divide-y divide-gray-800">
              {workflowSteps.map((step, index) => (
                <div 
                  key={step.id} 
                  className={cn(
                    "p-4 transition-colors",
                    !step.enabled && "opacity-40",
                    step.completed && "bg-green-900/5"
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Drag Handle */}
                    <div className="mt-1 cursor-move text-gray-600 hover:text-gray-400">
                      <GripVertical size={16} />
                    </div>

                    {/* Step Number & Checkbox */}
                    <div className="flex flex-col items-center gap-2">
                      <div className={cn(
                        "h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                        step.completed 
                          ? "bg-green-500 border-green-500 text-white" 
                          : step.enabled 
                            ? "border-blue-500 text-blue-400" 
                            : "border-gray-700 text-gray-600"
                      )}>
                        {step.completed ? <CheckCircle2 size={16} /> : index + 1}
                      </div>
                      {index < workflowSteps.length - 1 && (
                        <div className={cn(
                          "h-8 w-0.5",
                          step.completed ? "bg-green-500" : "bg-gray-800"
                        )} />
                      )}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h3 className={cn(
                            "font-medium",
                            step.completed ? "text-green-400 line-through" : "text-white"
                          )}>
                            {step.name}
                          </h3>
                          {!step.enabled && (
                            <Badge variant="outline" className="bg-gray-900/50 text-gray-500 border-gray-800 text-xs">
                              Disabled
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              "h-7 text-xs",
                              step.enabled ? "text-gray-400" : "text-blue-400"
                            )}
                            onClick={() => toggleStep(step.id)}
                          >
                            {step.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>

                      {step.enabled && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          {/* Assigned Worker */}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">Assigned Worker</Label>
                            <Select 
                              value={step.assignedWorker || ""} 
                              onValueChange={(val) => assignWorker(step.id, val)}
                            >
                              <SelectTrigger className="bg-gray-950 border-gray-800 text-white h-9">
                                <SelectValue placeholder="Select worker..." />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                                {mockWorkers.map(worker => (
                                  <SelectItem key={worker.id} value={worker.id}>
                                    {worker.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Cost */}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">Cost (Internal)</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={step.cost || ''}
                              onChange={(e) => addCost(step.id, parseFloat(e.target.value) || 0)}
                              className="bg-gray-950 border-gray-800 text-white h-9"
                            />
                          </div>

                          {/* Notes */}
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs text-gray-500">Notes (Optional)</Label>
                            <Textarea
                              placeholder="Add notes..."
                              value={step.notes || ''}
                              onChange={(e) => {
                                setWorkflowSteps(prev => prev.map(s => 
                                  s.id === step.id ? { ...s, notes: e.target.value } : s
                                ));
                              }}
                              className="bg-gray-950 border-gray-800 text-white resize-none h-16"
                            />
                          </div>
                        </div>
                      )}

                      {/* Mark Complete Button */}
                      {step.enabled && !step.completed && (
                        <Button
                          size="sm"
                          className="mt-3 bg-green-600 hover:bg-green-500 h-8"
                          onClick={() => completeStep(step.id)}
                        >
                          <CheckCircle2 size={14} className="mr-1" />
                          Mark Complete
                        </Button>
                      )}
                      {step.completed && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 border-gray-700 text-gray-400 h-8"
                          onClick={() => completeStep(step.id)}
                        >
                          <X size={14} className="mr-1" />
                          Undo Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COSTING SECTION */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <DollarSign size={18} className="text-green-400" />
                Costing & Billing
              </h2>
              <Button
                size="sm"
                variant="ghost"
                className="text-gray-400 h-8"
                onClick={() => setEditingCost(!editingCost)}
              >
                {editingCost ? <Save size={14} className="mr-1" /> : <Edit size={14} className="mr-1" />}
                {editingCost ? "Save" : "Edit"}
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Internal Cost (Auto-calculated) */}
              <div className="p-3 bg-orange-900/10 border border-orange-900/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-gray-400 uppercase">Internal Cost (Auto)</Label>
                  <Badge variant="outline" className="bg-orange-900/20 text-orange-400 border-orange-900/50 text-xs">
                    Admin Only
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-orange-400">₹{totalInternalCost.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Sum of all step costs</p>
              </div>

              {/* Customer Billing (Editable) */}
              <div className="p-3 bg-green-900/10 border border-green-900/30 rounded-lg">
                <Label className="text-xs text-gray-400 uppercase mb-2 block">Customer Billing</Label>
                <Input
                  type="number"
                  value={customerBilling}
                  onChange={(e) => setCustomerBilling(parseFloat(e.target.value) || 0)}
                  disabled={!editingCost}
                  className="bg-gray-950 border-gray-800 text-white text-2xl font-bold h-12"
                />
                <p className="text-xs text-gray-500 mt-1">Amount charged to customer</p>
              </div>

              {/* Profit/Margin (Hidden) */}
              <div className="p-3 bg-purple-900/10 border border-purple-900/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-gray-400 uppercase">Profit/Margin</Label>
                  <Badge variant="outline" className="bg-purple-900/20 text-purple-400 border-purple-900/50 text-xs">
                    Hidden from Customer
                  </Badge>
                </div>
                <p className={cn(
                  "text-2xl font-bold",
                  profit > 0 ? "text-green-400" : "text-red-400"
                )}>
                  ₹{profit.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {profit > 0 ? "Profit" : "Loss"} • {((profit / customerBilling) * 100).toFixed(1)}% margin
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: JOB INFO (1/3 width) */}
        <div className="col-span-1 space-y-6">
          
          {/* PRODUCT INFO */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Package size={18} className="text-purple-400" />
                Product
              </h2>
            </div>
            <div className="p-4">
              <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden mb-3 border border-gray-700">
                <img src={jobDetails.productImage} alt="" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-medium text-white mb-1">{jobDetails.productName}</h3>
              <p className="text-sm text-gray-500 font-mono">{jobDetails.productCode}</p>
            </div>
          </div>

          {/* CUSTOMER INFO */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <User size={18} className="text-blue-400" />
                Customer
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-lg font-bold text-white shrink-0">
                  {jobDetails.customerName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-white">{jobDetails.customerName}</p>
                  <p className="text-xs text-gray-500">Customer</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Phone size={14} />
                <span className="font-mono">{jobDetails.customerMobile}</span>
              </div>

              {jobDetails.customerAddress && (
                <div className="flex items-start gap-2 text-gray-400 text-sm">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  <span>{jobDetails.customerAddress}</span>
                </div>
              )}
            </div>
          </div>

          {/* TIMELINE */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Calendar size={18} className="text-orange-400" />
                Timeline
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <Label className="text-xs text-gray-500 uppercase">Created Date</Label>
                <p className="text-white font-mono text-sm mt-1">{jobDetails.createdDate}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500 uppercase">Expected Delivery</Label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-white font-mono text-sm">{jobDetails.expectedDelivery}</p>
                  {jobDetails.priority === 'Urgent' && (
                    <AlertTriangle size={14} className="text-yellow-400" />
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500 uppercase">Time Remaining</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock size={14} className="text-gray-500" />
                  <p className="text-white text-sm">7 days</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
