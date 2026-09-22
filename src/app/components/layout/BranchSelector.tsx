import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Lock, Loader2 } from 'lucide-react';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useGlobalFilterOptional } from '@/app/context/GlobalFilterContext';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';
import { branchService, Branch } from '@/app/services/branchService';

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
  const globalFilter = useGlobalFilterOptional();
  const { canManageSettings } = useCheckPermission();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  const useGlobalBranch = variant === 'header' && !propSetBranchId && globalFilter != null;
  const branchId = propBranchId ?? (useGlobalBranch ? globalFilter.branchId : contextBranchId) ?? null;
  const setBranchId = propSetBranchId ?? (useGlobalBranch ? globalFilter.setBranchId : contextSetBranchId);

  const isAdmin = canManageSettings;
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
          isBranchLocked ? (disabled ? 'text-muted-foreground' : 'text-orange-500') : 'text-indigo-400'
        }`}>
          <Building2 size={14} />
          Branch {isBranchLocked && <Lock size={10} className={disabled ? 'text-muted-foreground' : 'text-orange-400'} />}
        </Label>
        <Select 
          value={value} 
          onValueChange={(v) => setBranchId(v)}
          disabled={isBranchLocked}
        >
          <SelectTrigger className={`h-9 w-[200px] ${
            isBranchLocked 
              ? 'bg-popover border-orange-500/30 text-orange-400 cursor-not-allowed opacity-70' 
              : 'bg-input-background border-indigo-500/30 text-indigo-300 hover:bg-popover'
          }`}>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm">{getBranchName()}</span>
            </div>
          </SelectTrigger>
          <SelectContent className="bg-input-background border-border text-foreground">
            {loading ? (
              <div className="px-3 py-4 text-center text-muted-foreground">
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
        isBranchLocked ? (disabled ? 'text-muted-foreground' : 'text-orange-500') : 'text-indigo-500'
      }`}>
        Branch {isBranchLocked && <Lock size={10} className={disabled ? 'text-muted-foreground' : 'text-orange-400'} />}
      </Label>
      <Select 
        value={value} 
        onValueChange={(v) => setBranchId(v)}
        disabled={isBranchLocked}
      >
        <SelectTrigger className={`h-10 ${
          isBranchLocked 
            ? 'bg-popover border-orange-500/30 text-orange-400 cursor-not-allowed opacity-70' 
            : 'bg-input-background border-border text-foreground'
        }`}>
          <div className="flex items-center gap-2">
            <Building2 size={14} className={`shrink-0 ${isBranchLocked ? 'text-orange-400' : 'text-muted-foreground'}`} />
            <span className="truncate text-sm">{getBranchName()}</span>
          </div>
        </SelectTrigger>
        <SelectContent className="bg-input-background border-border text-foreground">
          {loading ? (
            <div className="px-3 py-4 text-center text-muted-foreground">
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
