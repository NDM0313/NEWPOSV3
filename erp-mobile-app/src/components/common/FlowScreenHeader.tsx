import type { ReactNode } from 'react';
import { SaveBlockingOverlay } from './SaveBlockingOverlay';

interface FlowScreenHeaderProps {
  children: ReactNode;
  className?: string;
  /** Extra classes on the inner toolbar row (default h-14). */
  innerClassName?: string;
}

/**
 * Sticky top bar for full-screen flows (Add/Edit Product, Sale steps, POS, etc.).
 * Pads below the OS status bar (time, battery, signal) on native WebView.
 */
export function FlowScreenHeader({ children, className = '', innerClassName = '' }: FlowScreenHeaderProps) {
  return (
    <div
      className={`bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40 flow-screen-header ${className}`.trim()}
    >
      <div className={`flex items-center min-h-14 px-4 ${innerClassName}`.trim()}>{children}</div>
    </div>
  );
}

interface FlowScreenRootProps {
  children: ReactNode;
  className?: string;
  /** When true, blocks all interaction inside this flow until save completes. */
  blocking?: boolean;
  blockingLabel?: string;
}

/** Full-viewport overlay / flow container (use with FlowScreenHeader). */
export function FlowScreenRoot({ children, className = '', blocking, blockingLabel }: FlowScreenRootProps) {
  return (
    <div className={`flow-screen-root relative ${className}`.trim()}>
      {children}
      <SaveBlockingOverlay active={blocking} label={blockingLabel} />
    </div>
  );
}
