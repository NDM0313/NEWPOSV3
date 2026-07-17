/** Admin/debug accounting loader metadata — hidden from easy/restricted hubs. */

import type { LoaderMetadata } from '../../../../api/singleCore';

export function AccountingLoaderDebugBadge({
  meta,
  hidden,
}: {
  meta: LoaderMetadata | null;
  hidden?: boolean;
}) {
  if (hidden || !meta) return null;
  const bits = [
    meta.source,
    meta.basis,
    meta.rpcName || 'no-rpc',
    meta.resultKind,
    meta.fallbackReason ? `fallback:${meta.fallbackReason.slice(0, 40)}` : null,
  ].filter(Boolean);
  return (
    <div className="px-4 pb-2">
      <p className="text-[10px] font-mono text-[#6B7280] break-all">
        [{bits.join(' · ')}] co={meta.companyId.slice(0, 8)} br=
        {meta.branchId ? meta.branchId.slice(0, 8) : 'all'} {meta.dateFrom || '…'}→{meta.dateTo || '…'}
      </p>
    </div>
  );
}
