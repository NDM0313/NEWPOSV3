import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import type { User } from '../../../types';
import { getPayablesAging, getReceivablesAging, type AgingReport as AgingData } from '../../../api/reports';
import { ReportHeader } from './_shared/ReportHeader';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { AgingBuckets } from './_shared/AgingBuckets';
import { formatAmount } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { AgingPreviewPdf } from '../../shared/AgingPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';

export type AgingKind = 'payables' | 'receivables';

interface AgingReportProps {
  onBack: () => void;
  kind: AgingKind;
  companyId: string | null;
  branchId?: string | null;
  user: User;
  onOpenParty?: (partyId: string, partyName: string) => void;
}

export function AgingReport({ onBack, kind, companyId, branchId, user, onOpenParty }: AgingReportProps) {
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = kind === 'payables' ? getPayablesAging(companyId) : getReceivablesAging(companyId, branchId ?? null);
    load.then((d) => {
      if (cancelled) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, kind]);

  const title = kind === 'payables' ? 'Payables' : 'Receivables';
  const subtitle = kind === 'payables' ? 'What you owe suppliers' : 'What customers owe you';
  const gradient: 'amber' | 'rose' = kind === 'payables' ? 'amber' : 'rose';

  const stats = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Total', value: `Rs. ${formatAmount(data.grandTotal, 0)}` },
      { label: 'Parties', value: String(data.parties.length) },
      {
        label: 'Overdue 90+',
        value: `Rs. ${formatAmount((data.totals[3]?.amount ?? 0) + (data.totals[4]?.amount ?? 0), 0)}`,
        color: 'text-[#FCA5A5]',
      },
    ];
  }, [data]);

  const buckets = useMemo(
    () =>
      (data?.totals ?? []).map((t, i) => ({
        label: data?.labels[i] ?? '',
        amount: t.amount,
        count: t.count,
      })),
    [data],
  );

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title={title}
        subtitle={subtitle}
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient={gradient}
      />

      <ReportShell
        loading={loading}
        empty={!loading && (!data || data.parties.length === 0)}
        emptyLabel={kind === 'payables' ? 'No outstanding payables.' : 'No outstanding receivables.'}
      >
        {data && (
          <>
            <AgingBuckets buckets={buckets} grandTotal={data.grandTotal} />

            <ReportCard>
              <ReportSectionTitle title="Top parties" right={`${data.parties.length}`} />
              <ul className="divide-y divide-[#374151]">
                {data.parties.map((p) => (
                  <li key={p.partyId}>
                    <button
                      onClick={() => onOpenParty?.(p.partyId, p.partyName)}
                      disabled={!onOpenParty}
                      className="w-full px-4 py-3 text-left hover:bg-[#243044] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#111827] border border-[#374151] flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-[#9CA3AF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{p.partyName}</p>
                          <div className="mt-1 grid grid-cols-5 gap-1">
                            {p.buckets.map((b, i) => (
                              <div key={i} className="text-[10px] text-[#9CA3AF] text-center truncate">
                                <span className="block text-[9px] text-[#6B7280]">{data.labels[i]}</span>
                                {b > 0 ? formatAmount(b, 0) : '—'}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${kind === 'payables' ? 'text-[#F59E0B]' : 'text-[#EC4899]'}`}>
                            Rs. {formatAmount(p.total, 0)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </ReportCard>
          </>
        )}
      </ReportShell>

      {preview.brand && data && (
        <PdfPreviewModal
          open={preview.open}
          title={`${title} Aging`}
          filename={`${title}_Aging_${new Date().toISOString().slice(0, 10)}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`${title} Aging · ${subtitle}`}
        >
          <AgingPreviewPdf
            brand={preview.brand}
            title={`${title} Aging`}
            subtitle={subtitle}
            bucketLabels={data.labels}
            totals={data.totals.map((t, i) => ({ label: data.labels[i], amount: t.amount, count: t.count }))}
            grandTotal={data.grandTotal}
            parties={data.parties.map((p) => ({ name: p.partyName, meta: p.meta, buckets: p.buckets, total: p.total }))}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}
