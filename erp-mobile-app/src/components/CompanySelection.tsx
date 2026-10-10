import { useState, useEffect, useMemo } from 'react';
import { Building2, ChevronRight, Loader2, Search } from 'lucide-react';
import type { User } from '../types';
import {
  listPlatformCompanies,
  setPlatformActiveCompany,
  type PlatformCompany,
} from '../api/platformCompany';
import { getFunctionalRoleLabel } from '../config/functionalRoles';

interface CompanySelectionProps {
  user: User;
  /** Currently active company (session or home). Highlighted in the list. */
  currentCompanyId?: string | null;
  onCompanySelect: (company: { id: string; name: string }) => void;
}

export function CompanySelection({ user, currentCompanyId, onCompanySelect }: CompanySelectionProps) {
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listPlatformCompanies().then(({ data, error: err }) => {
      if (cancelled) return;
      setLoading(false);
      setError(err);
      setCompanies(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, query]);

  const handleSelect = async (company: PlatformCompany) => {
    setBusyId(company.id);
    setError(null);
    const { error: err } = await setPlatformActiveCompany(company.id);
    setBusyId(null);
    if (err) {
      setError(err);
      return;
    }
    onCompanySelect({ id: company.id, name: company.name });
  };

  return (
    <div className="min-h-screen p-4">
      <div className="pt-8 pb-6 text-center">
        <h1 className="text-xl font-semibold mb-2 text-white">Select company</h1>
        <p className="text-sm text-[#9CA3AF]">
          {getFunctionalRoleLabel(user.role)} · {user.name}
        </p>
        <p className="text-xs text-[#6B7280] mt-2">
          Platform access — one company at a time. Entries post into the company you pick.
        </p>
      </div>

      <div className="max-w-md mx-auto mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies"
            className="w-full h-11 pl-9 pr-3 rounded-xl bg-[#1F2937] border border-[#374151] text-white placeholder:text-[#6B7280] outline-none focus:border-[#3B82F6]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
        </div>
      ) : (
        <>
          {error && (
            <p className="text-sm text-amber-400 text-center mb-4 max-w-md mx-auto">{error}</p>
          )}
          {!error && filtered.length === 0 && (
            <p className="text-sm text-[#9CA3AF] text-center">No companies found.</p>
          )}
          <div className="space-y-3 max-w-md mx-auto">
            {filtered.map((company) => {
              const active = currentCompanyId === company.id;
              const busy = busyId === company.id;
              return (
                <button
                  key={company.id}
                  type="button"
                  disabled={!!busyId}
                  onClick={() => void handleSelect(company)}
                  className={`w-full bg-[#1F2937] border rounded-xl p-4 hover:border-[#3B82F6] active:scale-[0.98] transition-all group text-left disabled:opacity-60 ${
                    active ? 'border-[#3B82F6]' : 'border-[#374151]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#8B5CF6]/20">
                      {busy ? (
                        <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin" />
                      ) : (
                        <Building2 className="w-6 h-6 text-[#8B5CF6]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white mb-1 truncate">{company.name}</h3>
                      <p className="text-sm text-[#9CA3AF]">
                        {active ? 'Current session' : 'Tap to open'}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#6B7280] group-hover:text-[#3B82F6]" />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
