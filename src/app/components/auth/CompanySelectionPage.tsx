import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, Loader2, LogOut, Search } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { listPlatformCompanies, type PlatformCompany } from '@/app/services/platformCompanyService';
import { isPlatformOperatorAppRole } from '@/app/config/functionalRoles';

/**
 * Platform ops (developer / super_admin) — pick active company before the main ERP shell.
 * Same RPCs as mobile CompanySelection.
 */
export const CompanySelectionPage: React.FC = () => {
  const {
    user,
    userRole,
    homeCompanyId,
    selectPlatformCompany,
    signOut,
    erpFullName,
  } = useSupabase();
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
    const { error: err } = await selectPlatformCompany(company.id, company.name);
    setBusyId(null);
    if (err) setError(err);
  };

  const roleLabel = isPlatformOperatorAppRole(userRole)
    ? String(userRole || 'developer')
    : 'user';
  const displayName = erpFullName || user?.email || 'Platform user';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md text-center mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Select company</h1>
        <p className="text-sm text-muted-foreground">
          {roleLabel} · {displayName}
        </p>
        <p className="text-xs text-muted-foreground/80 mt-2">
          Platform access — one company at a time. Entries post into the company you pick.
        </p>
      </div>

      <div className="w-full max-w-md mb-4 relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies"
          className="w-full h-11 pl-9 pr-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="w-full max-w-md space-y-3">
          {error && (
            <p className="text-sm text-amber-400 text-center mb-2">{error}</p>
          )}
          {!error && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">No companies found.</p>
          )}
          {filtered.map((company) => {
            const home = homeCompanyId === company.id;
            const busy = busyId === company.id;
            return (
              <button
                key={company.id}
                type="button"
                disabled={!!busyId}
                onClick={() => void handleSelect(company)}
                className={`w-full bg-card border rounded-xl p-4 hover:border-primary active:scale-[0.99] transition-all text-left disabled:opacity-60 ${
                  home ? 'border-primary' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-500/20">
                    {busy ? (
                      <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                    ) : (
                      <Building2 className="w-6 h-6 text-violet-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground mb-0.5 truncate">{company.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {home ? 'Home company · click to open' : 'Click to open'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );
};
