import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Lock, Loader2 } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useSupabase } from '@/app/context/SupabaseContext';
import { branchService, Branch } from '@/app/services/branchService';

// Global Current User - Change role to 'user' to test locked behavior
export const currentUser = {
  id: 1,
  name: "Admin User",
  role: "admin" as "admin" | "user", // admin = can change branch, user = locked to assigned branch
  assignedBranchId: 1,
};

interface BranchSelectorProps {
  branchId: string | number;
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
  const { companyId, branchId: contextBranchId, user } = useSupabase();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  
  const isBranchLocked = currentUser.role !== "admin";
  
  // Load branches from Supabase
  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const branchesData = await branchService.getAllBranches(companyId);
      setBranches(branchesData);
      
      // If branchId is not set, use context branchId or first branch
      if (!branchId && contextBranchId) {
        setBranchId(contextBranchId);
      } else if (!branchId && branchesData.length > 0) {
        setBranchId(branchesData[0].id);
      }
    } catch (error) {
      console.error('[BRANCH SELECTOR] Error loading branches:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, contextBranchId, setBranchId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);
  
  const getBranchName = () => {
    const branch = branches.find(b => b.id === branchId || b.id.toString() === branchId.toString());
    if (!branch) return "Select Branch";
    return branch.code ? `${branch.code} | ${branch.name}` : branch.name;
  };

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
            {loading ? (
              <div className="px-3 py-4 text-center text-gray-400">
                <Loader2 size={16} className="animate-spin mx-auto mb-2" />
                <p className="text-xs">Loading branches...</p>
              </div>
            ) : branches.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-400">
                <p className="text-xs">No branches found</p>
              </div>
            ) : (
              branches.map(b => {
                const displayText = b.code ? `${b.code} | ${b.name}` : b.name;
                return (
                  <SelectItem key={b.id} value={b.id}>
                    {displayText}
                  </SelectItem>
                );
              })
            )}
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
          {loading ? (
            <div className="px-3 py-4 text-center text-gray-400">
              <Loader2 size={16} className="animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading branches...</p>
            </div>
          ) : branches.length === 0 ? (
            <div className="px-3 py-4 text-center text-gray-400">
              <p className="text-xs">No branches found</p>
            </div>
          ) : (
            branches.map(b => (
              <SelectItem key={b.id} value={b.id}>
                <div className="flex items-center gap-2">
                  {b.code && <span className="text-xs text-gray-500">{b.code}</span>}
                  <span>{b.name}</span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
