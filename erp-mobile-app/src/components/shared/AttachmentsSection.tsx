import { Paperclip } from 'lucide-react';
import type { NormalizedAttachment } from '../../lib/normalizeAttachments';

export interface AttachmentsSectionProps {
  /** Section heading */
  title?: string;
  items: NormalizedAttachment[];
  /** Called with full list and tapped index (for preview modal) */
  onOpenPreview: (items: NormalizedAttachment[], startIndex: number) => void;
}

export function AttachmentsSection({ title = 'Attachments', items, onOpenPreview }: AttachmentsSectionProps) {
  if (!items.length) return null;

  return (
    <section className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
      <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((a, idx) => (
          <li key={`${a.url}-${idx}`}>
            <button
              type="button"
              onClick={() => onOpenPreview(items, idx)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#60A5FA] hover:bg-[#374151] hover:underline"
            >
              <Paperclip className="w-4 h-4 shrink-0 text-[#9CA3AF]" aria-hidden />
              <span className="min-w-0 truncate">{a.name || `Attachment ${idx + 1}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
