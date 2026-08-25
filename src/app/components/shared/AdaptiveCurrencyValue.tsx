import React, { useLayoutEffect, useRef, useState } from 'react';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { cn } from '@/app/components/ui/utils';

export interface AdaptiveCurrencyValueProps {
  value: number;
  className?: string;
  as?: 'span' | 'p';
  /** When set, allow compact notation once value magnitude reaches this threshold (default: 1000). */
  forceCompactAbove?: number;
}

/**
 * KPI currency display: full amount when it fits the cell, compact (1K / 1M) on overflow.
 * Hover title always shows the full formatted amount.
 */
export function AdaptiveCurrencyValue({
  value,
  className,
  as: Tag = 'span',
  forceCompactAbove = 1000,
}: AdaptiveCurrencyValueProps) {
  const { formatCurrency, formatCurrencyCompact } = useFormatCurrency();
  const containerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [useCompact, setUseCompact] = useState(false);

  const fullText = formatCurrency(value);
  const compactText = formatCurrencyCompact(value);
  const canCompact = Math.abs(value) >= forceCompactAbove;
  const displayText = useCompact && canCompact ? compactText : fullText;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure || !canCompact) {
      setUseCompact(false);
      return;
    }

    const check = () => {
      setUseCompact(measure.scrollWidth > container.clientWidth);
    };

    check();
    const target = container.parentElement ?? container;
    const ro = new ResizeObserver(check);
    ro.observe(target);
    return () => ro.disconnect();
  }, [fullText, canCompact, className]);

  return (
    <span ref={containerRef} className="relative block min-w-0 max-w-full">
      <span
        ref={measureRef}
        aria-hidden
        className={cn('invisible absolute whitespace-nowrap pointer-events-none h-0 overflow-hidden', className)}
      >
        {fullText}
      </span>
      <Tag
        className={cn('min-w-0 truncate tabular-nums block max-w-full', className)}
        title={fullText}
      >
        {displayText}
      </Tag>
    </span>
  );
}
