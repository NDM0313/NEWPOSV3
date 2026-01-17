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
    <div 
      className="border rounded-lg p-5 space-y-4"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border-primary)',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <div className="flex items-center justify-between">
        <h3 
          className="font-semibold flex items-center gap-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <Shield size={18} style={{ color: 'var(--color-primary)' }} />
          Security Deposit / Guarantee
        </h3>
        <Badge 
          variant="outline"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: 'var(--color-primary)',
            borderColor: 'rgba(59, 130, 246, 0.5)'
          }}
        >
          Required
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Security Type */}
        <div className="space-y-2">
          <Label 
            className="text-xs uppercase"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Guarantee Type
          </Label>
          <Select value={type} onValueChange={handleTypeChange}>
            <SelectTrigger
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
                borderColor: 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)'
              }}
            >
              <SelectItem value="cash">Cash Deposit</SelectItem>
              <SelectItem value="id_card">ID Card (Original)</SelectItem>
              <SelectItem value="passport">Passport</SelectItem>
              <SelectItem value="cheque">Security Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reference / ID Number */}
        <div className="space-y-2">
          <Label 
            className="text-xs uppercase"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {type === 'cash' ? 'Amount Received' : 'ID / Document Number'}
          </Label>
          <Input 
            value={reference}
            onChange={handleRefChange}
            placeholder={type === 'cash' ? '5000' : 'ABC-1234567'}
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
      </div>

      {/* Document Upload Area */}
      {type !== 'cash' && (
        <div className="space-y-2">
           <Label 
             className="text-xs uppercase"
             style={{ color: 'var(--color-text-secondary)' }}
           >
             Document Evidence
           </Label>
           <div 
             className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors"
             style={{
               borderColor: hasFile 
                 ? 'rgba(16, 185, 129, 0.5)' 
                 : 'var(--color-border-secondary)',
               backgroundColor: hasFile 
                 ? 'rgba(5, 150, 105, 0.05)' 
                 : 'transparent',
               borderRadius: 'var(--radius-lg)'
             }}
             onClick={handleFileUpload}
             onMouseEnter={(e) => {
               if (!hasFile) {
                 e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                 e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
               }
             }}
             onMouseLeave={(e) => {
               if (!hasFile) {
                 e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                 e.currentTarget.style.backgroundColor = 'transparent';
               }
             }}
           >
             {hasFile ? (
               <div className="text-center space-y-2">
                 <FileCheck size={32} className="mx-auto" style={{ color: 'var(--color-success)' }} />
                 <p 
                   className="font-medium text-sm"
                   style={{ color: 'var(--color-success)' }}
                 >
                   Document Attached
                 </p>
                 <p 
                   className="text-xs"
                   style={{ color: 'var(--color-text-tertiary)' }}
                 >
                   Click to replace
                 </p>
               </div>
             ) : (
               <div className="text-center space-y-2">
                 <Camera size={24} className="mx-auto" style={{ color: 'var(--color-text-secondary)' }} />
                 <p 
                   className="font-medium text-sm"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   Upload Photo of ID
                 </p>
                 <p 
                   className="text-xs"
                   style={{ color: 'var(--color-text-tertiary)' }}
                 >
                   Drag & drop or click to capture
                 </p>
               </div>
             )}
           </div>
           
           <div 
             className="flex items-center gap-2 mt-2 p-2 rounded border"
             style={{
               backgroundColor: 'rgba(234, 179, 8, 0.2)',
               borderColor: 'rgba(234, 179, 8, 0.5)',
               borderRadius: 'var(--radius-sm)'
             }}
           >
             <AlertCircle size={14} style={{ color: 'var(--color-warning)' }} />
             <span 
               className="text-xs font-medium"
               style={{ color: 'var(--color-warning)' }}
             >
               Status: Document Held by Shop
             </span>
           </div>
        </div>
      )}
    </div>
  );
};
