import { useState, useEffect } from 'react';
import { MapPin, ChevronRight, Loader2, LayoutGrid } from 'lucide-react';
import type { User, Branch } from '../types';
import { getBranches } from '../api/branches';

const ALL_BRANCHES_OPTION: Branch = { id: 'all', name: 'All Branches', location: 'All locations' };

interface BranchSelectionProps {
  user: User;
  companyId: string | null;
  onBranchSelect: (branch: Branch) => void;
}

const MOCK_BRANCHES: Branch[] = [
  { id: '1', name: 'Main Branch (HQ)', location: 'Karachi, Pakistan' },
  { id: '2', name: 'Lahore Branch', location: 'Lahore, Pakistan' },
  { id: '3', name: 'Islamabad Branch', location: 'Islamabad, Pakistan' },
];

export function BranchSelection({ user, companyId, onBranchSelect }: BranchSelectionProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = user.role === 'admin' || user.role === 'Admin';

  useEffect(() => {
    if (!companyId) {
      setBranches(MOCK_BRANCHES);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBranches(companyId).then(({ data, error: err }) => {
      if (cancelled) return;
      setLoading(false);
      if (err) {
        setError(err);
        setBranches(MOCK_BRANCHES);
      } else {
        setBranches(data.length ? data : MOCK_BRANCHES);
      }
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const list = isAdmin ? [ALL_BRANCHES_OPTION, ...branches] : branches;

  return (
    <div className="min-h-screen p-4">
      <div className="pt-8 pb-6 text-center">
        <h1 className="text-xl font-semibold mb-2 text-white">Welcome, {user.name}</h1>
        <p className="text-sm text-[#9CA3AF]">Select your branch to continue</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
        </div>
      ) : (
        <>
          {error && (
            <p className="text-sm text-amber-400 text-center mb-4">Could not load branches. Showing default list.</p>
          )}
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
        </>
      )}
    </div>
  );
}
