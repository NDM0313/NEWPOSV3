import { useMemo, useState } from 'react';
import { Copy, Link2, Mail, MessageCircle, Share2, X } from 'lucide-react';
import type { User } from '../../types';
import {
  buildRegistrationLinkMessage,
  openEmailShare,
  openWhatsAppShare,
  shareRegistrationLinkViaNative,
  type ContactTypeParam,
} from '../../lib/shareRegistrationLink';

const PUBLIC_ERP_ORIGIN =
  (import.meta.env.VITE_ERP_PUBLIC_ORIGIN as string | undefined)?.replace(/\/$/, '') ||
  'https://erp.dincouture.pk';

interface LeadToolsSectionProps {
  user: User;
  companyId: string | null;
  branchId?: string | null;
  companyName?: string | null;
  onClose: () => void;
}

export function LeadToolsSection({
  user,
  companyId,
  branchId = null,
  companyName,
  onClose,
}: LeadToolsSectionProps) {
  const [type, setType] = useState<ContactTypeParam>('customer');
  const [source, setSource] = useState('mobile');
  const [ref, setRef] = useState(() => user.profileId?.slice(0, 8) || user.id.slice(0, 8));
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (companyId) params.set('company', companyId);
    if (branchId && branchId !== 'all') params.set('branch', branchId);
    params.set('type', type);
    if (source.trim()) params.set('source', source.trim());
    if (ref.trim()) params.set('ref', ref.trim());
    return `${PUBLIC_ERP_ORIGIN}/register-contact?${params.toString()}`;
  }, [companyId, branchId, type, source, ref]);

  const shareText = useMemo(
    () => buildRegistrationLinkMessage(companyName ?? undefined, url, type),
    [companyName, url, type],
  );

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleNativeShare = async () => {
    setShareHint(null);
    const ok = await shareRegistrationLinkViaNative({
      title: 'Registration link',
      text: shareText,
      url,
    });
    if (!ok) setShareHint('Use WhatsApp or Email below, or copy the link.');
  };

  const handleWhatsApp = () => {
    setShareHint(null);
    openWhatsAppShare(whatsappPhone.trim() || undefined, shareText);
  };

  const handleEmail = () => {
    setShareHint(null);
    const subject = companyName?.trim()
      ? `${companyName.trim()} — contact registration`
      : 'Contact registration';
    openEmailShare(subject, shareText);
  };

  const missingCompany = !companyId;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-[#111827]">
      <div className="flex items-center justify-between px-4 h-14 border-b border-[#374151] bg-[#1F2937]">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 className="w-5 h-5 text-[#3B82F6] shrink-0" />
          <h1 className="text-white font-semibold text-base truncate">Share registration link</h1>
        </div>
        <button type="button" onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full">
        {missingCompany ? (
          <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            Select a company first. The link must include your company so new contacts register in the right account.
          </p>
        ) : (
          <p className="text-sm text-[#9CA3AF] leading-relaxed">
            Share this link with a customer or supplier. They register in{' '}
            <span className="text-white font-medium">{companyName || 'your company'}</span>
            {branchId && branchId !== 'all' ? ' (this branch)' : ''}. No opening balance — they appear as a new lead in
            Contacts.
          </p>
        )}

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-[#9CA3AF]">Contact type</p>
          <div className="flex flex-wrap gap-2">
            {(['customer', 'supplier', 'worker'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                  type === t ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="block text-xs text-[#9CA3AF]">Source (optional)</label>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-[#111827] border border-[#374151] text-white text-sm"
            placeholder="mobile, whatsapp, counter"
          />
          <label className="block text-xs text-[#9CA3AF]">Your ref code (optional)</label>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-[#111827] border border-[#374151] text-white text-sm"
            placeholder="Salesman code"
          />
          <label className="block text-xs text-[#9CA3AF]">WhatsApp number (optional)</label>
          <input
            value={whatsappPhone}
            onChange={(e) => setWhatsappPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            className="w-full h-10 px-3 rounded-lg bg-[#111827] border border-[#374151] text-white text-sm"
            placeholder="03001234567 — leave blank to pick contact in WhatsApp"
          />
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <p className="text-xs text-[#9CA3AF] mb-2">Registration link</p>
          <p className="text-xs text-[#E5E7EB] font-mono break-all leading-relaxed">{url}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={missingCompany}
              onClick={() => void handleCopy()}
              className="h-11 rounded-lg bg-[#3B82F6] text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              disabled={missingCompany}
              onClick={() => void handleNativeShare()}
              className="h-11 rounded-lg bg-[#374151] text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              type="button"
              disabled={missingCompany}
              onClick={handleWhatsApp}
              className="h-11 rounded-lg bg-[#10B981] text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              type="button"
              disabled={missingCompany}
              onClick={handleEmail}
              className="h-11 rounded-lg bg-[#6366F1] text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
          </div>
          {shareHint ? <p className="text-xs text-[#9CA3AF] mt-2">{shareHint}</p> : null}
        </div>

        <div className="bg-white rounded-xl p-4 flex flex-col items-center">
          <img src={qrSrc} alt="QR code for registration link" width={220} height={220} className="rounded" />
          <p className="text-xs text-[#6B7280] mt-2 text-center">Scan to open registration form</p>
        </div>
      </div>
    </div>
  );
}
