import React from 'react';
import { Building2, Lock } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

// Global Branches Data
export const branches = [
  { id: 1, name: "Main Branch - Karachi", code: "BR-001" },
  { id: 2, name: "Sub Branch - Lahore", code: "BR-002" },
  { id: 3, name: "Sub Branch - Islamabad", code: "BR-003" },
];

// Global Current User - Change role to 'user' to test locked behavior
export const currentUser = {
  id: 1,
  name: "Admin User",
  role: "admin" as "admin" | "user", // admin = can change branch, user = locked to assigned branch
  assignedBranchId: 1,
};

interface BranchSelectorProps {
  branchId: string;
  setBranchId: (id: string) => void;
  variant?: 'header' | 'inline';
  className?: string;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({ 
  branchId, 
  setBranchId, 
  variant = 'header',
  className = '' 
}) => {
  const isBranchLocked = currentUser.role !== "admin";
  const getBranchName = () => branches.find(b => b.id.toString() === branchId)?.name || "Select Branch";

  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Label className={`text-xs font-medium uppercase tracking-wide flex items-center gap-1.5 ${ 
          isBranchLocked ? 'text-orange-500' : 'text-indigo-400'
        }`}>
          <Building2 size={14} />
          Branch {isBranchLocked && <Lock size={10} className="text-orange-400" />}
        </Label>
        <Select 
          value={branchId} 
          onValueChange={setBranchId}
          disabled={isBranchLocked}
        >
          <SelectTrigger className={`h-9 w-[200px] ${
            isBranchLocked 
              ? 'bg-gray-900 border-orange-500/30 text-orange-400 cursor-not-allowed opacity-70' 
              : 'bg-gray-950 border-indigo-500/30 text-indigo-300 hover:bg-gray-900'
          }`}>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm">{getBranchName()}</span>
            </div>
          </SelectTrigger>
          <SelectContent className="bg-gray-950 border-gray-800 text-white">
            {branches.map(b => (
              <SelectItem key={b.id} value={b.id.toString()}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{b.code}</span>
                  <span>{b.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Inline variant (for forms)
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className={`font-medium text-xs uppercase tracking-wide flex items-center gap-1 ${ 
        isBranchLocked ? 'text-orange-500' : 'text-indigo-500'
      }`}>
        Branch {isBranchLocked && <Lock size={10} className="text-orange-400" />}
      </Label>
      <Select 
        value={branchId} 
        onValueChange={setBranchId}
        disabled={isBranchLocked}
      >
        <SelectTrigger className={`h-10 ${
          isBranchLocked 
            ? 'bg-gray-900 border-orange-500/30 text-orange-400 cursor-not-allowed opacity-70' 
            : 'bg-gray-950 border-gray-700 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <Building2 size={14} className={`shrink-0 ${isBranchLocked ? 'text-orange-400' : 'text-gray-400'}`} />
            <span className="truncate text-sm">{getBranchName()}</span>
          </div>
        </SelectTrigger>
        <SelectContent className="bg-gray-950 border-gray-800 text-white">
          {branches.map(b => (
            <SelectItem key={b.id} value={b.id.toString()}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{b.code}</span>
                <span>{b.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
