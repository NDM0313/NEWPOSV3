/**
 * Reusable badge for document status (Sale/Purchase).
 * Shows "Cancelled" with amber styling when status is cancelled.
 */

import React from 'react';
import { Badge } from '@/app/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

export type DocumentStatus = 'draft' | 'quotation' | 'order' | 'final' | 'cancelled' | 'ordered' | 'received' | 'pending';

interface DocumentStatusBadgeProps {
  status: DocumentStatus | string;
  /** Optional label override (e.g. "Final Invoice" vs "Final") */
  label?: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; icon?: React.ComponentType<{ size?: number }> }> = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
  quotation: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  order: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  ordered: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  final: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  received: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  cancelled: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: AlertCircle },
};

export const DocumentStatusBadge: React.FC<DocumentStatusBadgeProps> = ({ status, label, className }) => {
  const key = (status || '').toString().toLowerCase();
  const config = STATUS_CONFIG[key] || STATUS_CONFIG.draft;
  const Icon = config.icon;
  const displayLabel = label ?? (key === 'cancelled' ? 'Cancelled' : key.charAt(0).toUpperCase() + key.slice(1));

  return (
    <Badge className={cn('text-xs font-medium gap-1', config.bg, config.text, config.border, className)}>
      {Icon && <Icon size={12} />}
      {displayLabel}
    </Badge>
  );
};
