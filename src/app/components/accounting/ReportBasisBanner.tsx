import React from 'react';
import {
  reportBasisBannerClass,
  reportBasisDescription,
  reportBasisLabel,
  type ReportBasis,
} from '@/app/lib/financialTruthBasis';

export function ReportBasisBanner(props: {
  basis: ReportBasis;
  detail?: string;
  className?: string;
}) {
  const { basis, detail, className = '' } = props;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${reportBasisBannerClass(basis)} ${className}`}
      role="note"
    >
      <strong className="font-semibold">{reportBasisLabel(basis)}</strong>
      <span className="text-inherit/80">
        {' '}
        — {detail ?? reportBasisDescription(basis)}
      </span>
    </div>
  );
}

export function ReportBasisBadge(props: { basis: ReportBasis }) {
  return (
    <span
      className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${reportBasisBannerClass(props.basis)}`}
    >
      {reportBasisLabel(props.basis)}
    </span>
  );
}
