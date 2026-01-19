import React, { useState } from 'react';
import { Shield, Upload, Camera, FileCheck, AlertCircle } from 'lucide-react';
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";

export interface SecurityDetails {
  type: string;
  reference: string;
  hasFile: boolean;
  status: 'held' | 'released';
}

interface SecuritySectionProps {
  onChange: (details: SecurityDetails) => void;
}

export const SecuritySection = ({ onChange }: SecuritySectionProps) => {
  const [type, setType] = useState('id_card');
  const [reference, setReference] = useState('');
  const [hasFile, setHasFile] = useState(false);

  const updateDetails = (newType: string, newRef: string, newFile: boolean) => {
    onChange({
      type: newType,
      reference: newRef,
      hasFile: newFile,
      status: 'held'
    });
  };

  const handleTypeChange = (val: string) => {
    setType(val);
    updateDetails(val, reference, hasFile);
  };

  const handleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReference(val);
    updateDetails(type, val, hasFile);
  };

  const handleFileUpload = () => {
    // Mock upload
    setHasFile(true);
    updateDetails(type, reference, true);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Shield className="text-blue-500" size={18} />
          Security Deposit / Guarantee
        </h3>
        <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-900/50">
          Required
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Security Type */}
        <div className="space-y-2">
          <Label className="text-gray-400 text-xs uppercase">Guarantee Type</Label>
          <Select value={type} onValueChange={handleTypeChange}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="cash">Cash Deposit</SelectItem>
              <SelectItem value="id_card">ID Card (Original)</SelectItem>
              <SelectItem value="passport">Passport</SelectItem>
              <SelectItem value="cheque">Security Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reference / ID Number */}
        <div className="space-y-2">
          <Label className="text-gray-400 text-xs uppercase">
            {type === 'cash' ? 'Amount Received' : 'ID / Document Number'}
          </Label>
          <Input 
            value={reference}
            onChange={handleRefChange}
            placeholder={type === 'cash' ? '5000' : 'ABC-1234567'}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
      </div>

      {/* Document Upload Area */}
      {type !== 'cash' && (
        <div className="space-y-2">
           <Label className="text-gray-400 text-xs uppercase">Document Evidence</Label>
           <div 
             className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${hasFile ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'}`}
             onClick={handleFileUpload}
           >
             {hasFile ? (
               <div className="text-center space-y-2">
                 <FileCheck size={32} className="text-green-500 mx-auto" />
                 <p className="text-green-500 font-medium text-sm">Document Attached</p>
                 <p className="text-gray-500 text-xs">Click to replace</p>
               </div>
             ) : (
               <div className="text-center space-y-2">
                 <Camera size={24} className="text-gray-400 mx-auto" />
                 <p className="text-gray-300 font-medium text-sm">Upload Photo of ID</p>
                 <p className="text-gray-500 text-xs">Drag & drop or click to capture</p>
               </div>
             )}
           </div>
           
           <div className="flex items-center gap-2 mt-2 bg-yellow-900/20 p-2 rounded border border-yellow-900/50">
             <AlertCircle size={14} className="text-yellow-500" />
             <span className="text-yellow-500 text-xs font-medium">Status: Document Held by Shop</span>
           </div>
        </div>
      )}
    </div>
  );
};
