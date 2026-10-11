import { useEffect, useMemo, useState } from 'react';
import { Search, X, Users, Loader2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';

export type PartyKind = 'customer' | 'supplier' | 'worker' | 'account';

export interface PartyOption {
  id: string;
  name: string;
  meta?: string;
}

interface PartyPickerProps {
  open: boolean;
  kind: PartyKind;
  companyId: string;
  title?: string;
  onClose: () => void;
  onSelect: (party: PartyOption) => void;
}

async function loadParties(kind: PartyKind, companyId: string): Promise<PartyOption[]> {
  if (kind === 'account') {
    const { data } = await supabase
      .from('accounts')
      .select('id, code, name, type, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code', { ascending: true })
      .limit(500);
    return (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: `${r.code} · ${r.name}`,
      meta: String(r.type ?? ''),
    }));
  }

  if (kind === 'worker') {
    const { data } = await supabase
      .from('workers')
      .select('id, name, phone, role')
      .eq('company_id', companyId)
      .order('name', { ascending: true })
      .limit(500);
    return (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name ?? 'Worker'),
      meta: String(r.role ?? r.phone ?? ''),
    }));
  }

  const type = kind === 'customer' ? 'customer' : 'supplier';
  const { data } = await supabase
    .from('contacts')
    .select('id, name, phone, type, code')
    .eq('company_id', companyId)
    .in('type', [type, 'both'])
    .order('name', { ascending: true })
    .limit(500);
  return (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    name: String(r.name ?? '—'),
    meta: [r.code, r.phone].filter(Boolean).join(' · '),
  }));
}

/**
 * Full-screen party picker used by every ledger/party-scoped report. Shared to
 * keep visual + UX consistent across the reports suite.
 */
export function PartyPicker(props: PartyPickerProps) {
  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!props.open || !props.companyId) return;
    setLoading(true);
    loadParties(props.kind, props.companyId)
      .then(setParties)
      .finally(() => setLoading(false));
  }, [props.open, props.kind, props.companyId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return parties;
    const q = search.trim().toLowerCase();
    return parties.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.meta ?? '').toLowerCase().includes(q),
    );
  }, [parties, search]);

  if (!props.open) return null;

  const title =
    props.title ??
    (props.kind === 'customer'
      ? 'Select customer'
      : props.kind === 'supplier'
      ? 'Select supplier'
      : props.kind === 'worker'
      ? 'Select worker'
      : 'Select account');

  return (
    <div className="fixed inset-0 z-50 bg-[#111827] flex flex-col">
      <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={props.onClose} className="p-2 hover:bg-white/10 rounded-lg text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold">{title}</h2>
            <p className="text-xs text-white/80">{parties.length} total</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-white/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-12 text-[#9CA3AF]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-[#9CA3AF]">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="text-sm">No matching entries.</p>
          </div>
        )}
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => props.onSelect(p)}
            className="w-full bg-[#1F2937] hover:bg-[#243044] border border-[#374151] rounded-xl p-3 text-left"
          >
            <p className="text-sm font-semibold text-white">{p.name}</p>
            {p.meta && <p className="text-xs text-[#9CA3AF] mt-0.5">{p.meta}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
