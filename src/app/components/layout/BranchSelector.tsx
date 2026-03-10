import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Lock, Loader2 } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';
import { branchService, Branch } from '@/app/services/branchService';

// Global Current User - Change role to 'user' to test locked behavior
export const currentUser = {
  id: 1,
  name: "Admin User",
  role: "admin" as "admin" | "user", // admin = can change branch, user = locked to assigned branch
  assignedBranchId: 1,
};

interface BranchSelectorProps {
  /** When not provided, uses context branchId/setBranchId (for filter bars). */
  branchId?: string | null;
  setBranchId?: (id: string) => void;
  variant?: 'header' | 'inline';
  className?: string;
  disabled?: boolean;
  /** When true (header variant), show "All Branches" option. */
  showAllBranchesOption?: boolean;
}

/** Global rule: when company has ≤1 branch, selector is hidden and default branch is used automatically. */
export const BranchSelector: React.FC<BranchSelectorProps> = ({
  branchId: propBranchId,
  setBranchId: propSetBranchId,
  variant = 'header',
  className = '',
  disabled = false,
  showAllBranchesOption = true,
}) => {
  const { companyId, branchId: contextBranchId, setBranchId: contextSetBranchId } = useSupabase();
  const { canManageSettings } = useCheckPermission();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  const branchId = propBranchId ?? contextBranchId ?? null;
  const setBranchId = propSetBranchId ?? contextSetBranchId;

  const isAdmin = canManageSettings || currentUser.role === 'admin';
  const isBranchLocked = disabled || !isAdmin;

  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const branchesData = await branchService.getBranchesCached(companyId);
      setBranches(branchesData);
    } catch (error) {
      console.error('[BRANCH SELECTOR] Error loading branches:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Global rule: hide selector when single branch (or none)
  if (branches.length <= 1) return null;

  const getBranchName = () => {
    if (branchId === 'all') return 'All Branches';
    const branch = branches.find(b => b.id === branchId || b.id.toString() === String(branchId));
    if (!branch) return 'Select Branch';
    return branch.name;
  };

  const value = branchId ?? 'all';

  if (!setBranchId) return null;

  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Label className={`text-xs font-medium uppercase tracking-wide flex items-center gap-1.5 ${ 
          isBranchLocked ? (disabled ? 'text-gray-500' : 'text-orange-500') : 'text-indigo-400'
        }`}>
          <Building2 size={14} />
          Branch {isBranchLocked && <Lock size={10} className={disabled ? 'text-gray-400' : 'text-orange-400'} />}
        </Label>
        <Select 
          value={value} 
          onValueChange={(v) => setBranchId(v)}
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
            ) : (
              <>
                {showAllBranchesOption && (
                  <SelectItem value="all">All Branches</SelectItem>
                )}
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </>
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
        isBranchLocked ? (disabled ? 'text-gray-500' : 'text-orange-500') : 'text-indigo-500'
      }`}>
        Branch {isBranchLocked && <Lock size={10} className={disabled ? 'text-gray-400' : 'text-orange-400'} />}
      </Label>
      <Select 
        value={value} 
        onValueChange={(v) => setBranchId(v)}
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
          ) : (
            <>
              {showAllBranchesOption && (
                <SelectItem value="all">All Branches</SelectItem>
              )}
              {branches.map(b => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
