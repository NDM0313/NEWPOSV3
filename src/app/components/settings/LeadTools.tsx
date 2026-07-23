import React, { useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';

const BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.origin}/register-contact`
    : 'https://erp.dincouture.pk/register-contact';

export const LeadTools = () => {
  const { companyId, branchId } = useSupabase();
  const [type, setType] = useState<'customer' | 'supplier' | 'worker'>('customer');
  const [source, setSource] = useState('');
  const [ref, setRef] = useState('');
  const [copied, setCopied] = useState(false);

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (companyId) params.set('company', companyId);
    if (branchId) params.set('branch', branchId);
    params.set('type', type);
    if (source.trim()) params.set('source', source.trim());
    if (ref.trim()) params.set('ref', ref.trim());
    return `${BASE_URL}?${params.toString()}`;
  };

  const url = buildUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownloadQR = () => {
    const container = qrRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const png = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = png;
      a.download = `lead-qr-${type}-${Date.now()}.png`;
      a.click();
      toast.success('QR code downloaded');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Lead Capture QR Codes</h3>
        <p className="text-sm text-muted-foreground">
          Generate QR codes and links for public contact registration. The link includes your company
          {branchId ? ' and branch' : ''} so leads register in the correct account.
        </p>
        {!companyId && (
          <p className="text-sm text-amber-400 mt-2">Select a company in the app before generating links.</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <Label className="text-foreground font-medium">Contact Type</Label>
          <div className="flex gap-4">
            {(['customer', 'supplier', 'worker'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="leadType"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="w-4 h-4 text-blue-600 bg-muted border-gray-600"
                />
                <span className="text-muted-foreground capitalize">{t}</span>
              </label>
            ))}
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Source (optional)</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. instagram, facebook, website"
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Referral Code (optional)</Label>
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="e.g. SALESMAN01, NDM01"
              className="mt-1 bg-muted border-border text-foreground"
            />
          </div>

          <div>
            <Label className="text-muted-foreground text-xs">Registration Link</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={url}
                readOnly
                className="bg-input-background border-border text-muted-foreground font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
                disabled={!companyId}
                className="shrink-0 border-border"
              >
                {copied ? <Copy size={16} className="text-green-500" /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <div ref={qrRef} className="bg-white p-4 rounded-xl">
            <QRCode value={url} size={200} level="M" fgColor="#111827" bgColor="#ffffff" />
          </div>
          <Button
            variant="outline"
            className="mt-4 gap-2 border-border"
            onClick={handleDownloadQR}
            disabled={!companyId}
          >
            <Download size={16} />
            Download QR Code
          </Button>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <p className="text-sm text-blue-300">
          <strong>Tip:</strong> Links include <code className="bg-muted px-1 rounded">company</code> and{' '}
          <code className="bg-muted px-1 rounded">branch</code> IDs so registrations stay in your tenant.
          Example:{' '}
          <code className="bg-muted px-1 rounded">
            ?company=…&branch=…&type=customer&source=instagram&ref=NDM01
          </code>
        </p>
      </div>
    </div>
  );
};
