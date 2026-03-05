import { useState, useEffect } from 'react';
import { MapPin, ChevronRight, Loader2, LayoutGrid, PlusCircle, AlertCircle } from 'lucide-react';
import type { User, Branch } from '../types';
import { getBranches, createBranch } from '../api/branches';
import { getUserBranchIds } from '../api/permissions';

interface BranchSelectionProps {
  user: User;
  companyId: string | null;
  /** Public users.id for user_branches; used to filter branches by assignment. */
  profileId?: string;
  onBranchSelect: (branch: Branch) => void;
}

const ALL_BRANCHES_OPTION: Branch = { id: 'all', name: 'All Branches', location: 'All locations' };

export function BranchSelection({ user, companyId, profileId, onBranchSelect }: BranchSelectionProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userBranchIds, setUserBranchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [error, setError] = useState<string | null>(null);
  const [addingBranch, setAddingBranch] = useState(false);
  const [addBranchError, setAddBranchError] = useState<string | null>(null);
  const isAdmin = user.role === 'admin';

  const refreshBranches = () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    getBranches(companyId).then(({ data, error: err }) => {
      setLoading(false);
      setError(err || null);
      setBranches(err ? [] : data);
    });
  };

  useEffect(() => {
    if (!companyId) {
      setBranches([]);
      setLoading(false);
      setError(null);
      setUserBranchIds([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getBranches(companyId),
      profileId ? getUserBranchIds(profileId) : Promise.resolve([]),
    ]).then(([branchesRes, ubIds]) => {
      if (cancelled) return;
      setLoading(false);
      setError(branchesRes.error || null);
      setBranches(branchesRes.error ? [] : (branchesRes.data || []));
      setUserBranchIds(ubIds);
    });
    return () => { cancelled = true; };
  }, [companyId, profileId]);

  const handleAddMainBranch = async () => {
    if (!companyId) return;
    setAddBranchError(null);
    setAddingBranch(true);
    const { data, error: err } = await createBranch(companyId, 'Main Branch');
    setAddingBranch(false);
    if (err) {
      setAddBranchError(err);
      return;
    }
    refreshBranches();
    if (data) {
      onBranchSelect({ id: data.id, name: data.name, location: data.location });
    }
  };

  const list = (() => {
    if (user.branchLocked && user.branchId) {
      const locked = branches.find((b) => b.id === user.branchId);
      return locked ? [locked] : branches;
    }
    let base = branches;
    if (!isAdmin && userBranchIds.length > 0) {
      base = branches.filter((b) => userBranchIds.includes(b.id));
    }
    return isAdmin && base.length > 0 ? [ALL_BRANCHES_OPTION, ...base] : base;
  })();

  const noBranchAssigned = !isAdmin && userBranchIds.length === 0 && branches.length > 1;

  // Auto-select when user's branch is locked and only that branch is in list
  useEffect(() => {
    if (user.branchLocked && user.branchId && list.length === 1 && list[0].id === user.branchId) {
      onBranchSelect(list[0]);
    }
  }, [user.branchLocked, user.branchId, list, onBranchSelect]);

  // Single branch (and not locked): auto-select silently, no UI
  useEffect(() => {
    if (loading || error || user.branchLocked || noBranchAssigned) return;
    if (list.length === 1) {
      onBranchSelect(list[0]);
    }
  }, [loading, error, user.branchLocked, noBranchAssigned, list, onBranchSelect]);

  return (
    <div className="min-h-screen p-4">
      <div className="pt-8 pb-6 text-center">
        <h1 className="text-xl font-semibold mb-2 text-white">Welcome, {user.name}</h1>
        <p className="text-sm text-[#9CA3AF]">
          {user.branchLocked ? 'Your branch is set by admin.' : 'Select your branch to continue'}
        </p>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
        </div>
      ) : (
        <>
          {error && (
            <p className="text-sm text-amber-400 text-center mb-4">Could not load branches: {error}</p>
          )}
          {!error && noBranchAssigned && (
            <div className="max-w-md mx-auto p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#EF4444]">No branch assigned. Contact admin to assign you a branch.</p>
            </div>
          )}
          {!error && !noBranchAssigned && branches.length === 0 && (
            <div className="max-w-md mx-auto">
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 text-center">
                <p className="text-white font-medium mb-1">No branch set up</p>
                <p className="text-sm text-[#9CA3AF] mb-4">
                  Add a branch to create sales and use the app. You can add more branches later in Settings.
                </p>
                {addBranchError && (
                  <p className="text-sm text-amber-400 mb-3">{addBranchError}</p>
                )}
                <p className="text-xs text-[#6B7280] mb-4">
                  If you can&apos;t add a branch here, ask your administrator to add one in Settings.
                </p>
                <button
                  type="button"
                  onClick={handleAddMainBranch}
                  disabled={addingBranch}
                  className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2"
                >
                  {addingBranch ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <PlusCircle className="w-5 h-5" />
                  )}
                  {addingBranch ? 'Adding...' : 'Add main branch'}
                </button>
              </div>
            </div>
          )}
          {list.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {list.map((branch) => (
              <button
                key={branch.id}
                onClick={() => onBranchSelect(branch)}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] active:scale-[0.98] transition-all group text-left"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${branch.id === 'all' ? 'bg-[#8B5CF6]/20' : 'bg-[#3B82F6]/10'}`}>
                    {branch.id === 'all' ? (
                      <LayoutGrid className="w-6 h-6 text-[#8B5CF6]" />
                    ) : (
                      <MapPin className="w-6 h-6 text-[#3B82F6]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-1">{branch.name}</h3>
                    <p className="text-sm text-[#9CA3AF]">{branch.location}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#6B7280] group-hover:text-[#3B82F6]" />
                </div>
              </button>
            ))}
          </div>
          )}
        </>
      )}
    </div>
  );
}
