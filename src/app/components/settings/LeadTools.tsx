import React, { useState, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

const BASE_URL = typeof window !== 'undefined' ? `${window.location.origin}/register-contact` : 'https://erp.dincouture.pk/register-contact';

export const LeadTools = () => {
  const [type, setType] = useState<'customer' | 'supplier' | 'worker'>('customer');
  const [source, setSource] = useState('');
  const [ref, setRef] = useState('');
  const [copied, setCopied] = useState(false);

  const buildUrl = () => {
    const params = new URLSearchParams();
    params.set('type', type);
    if (source.trim()) params.set('source', source.trim());
    if (ref.trim()) params.set('ref', ref.trim());
    const qs = params.toString();
    return qs ? `${BASE_URL}?${qs}` : BASE_URL;
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
        <h3 className="text-lg font-semibold text-white mb-1">Lead Capture QR Codes</h3>
        <p className="text-sm text-gray-400">
          Generate QR codes and links for public contact registration. Share on social media, print on flyers, or add to your website.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <Label className="text-white font-medium">Contact Type</Label>
          <div className="flex gap-4">
            {(['customer', 'supplier', 'worker'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="leadType"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600"
                />
                <span className="text-gray-300 capitalize">{t}</span>
              </label>
            ))}
          </div>

          <div>
            <Label className="text-gray-400 text-xs">Source (optional)</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. instagram, facebook, website"
              className="mt-1 bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-xs">Referral Code (optional)</Label>
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="e.g. SALESMAN01, NDM01"
              className="mt-1 bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-xs">Registration Link</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={url}
                readOnly
                className="bg-gray-950 border-gray-700 text-gray-300 font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0 border-gray-700"
              >
                {copied ? <Copy size={16} className="text-green-500" /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center">
          <div ref={qrRef} className="bg-white p-4 rounded-xl">
            <QRCode
              value={url}
              size={200}
              level="M"
              fgColor="#111827"
              bgColor="#ffffff"
            />
          </div>
          <Button
            variant="outline"
            className="mt-4 gap-2 border-gray-700"
            onClick={handleDownloadQR}
          >
            <Download size={16} />
            Download QR Code
          </Button>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <p className="text-sm text-blue-300">
          <strong>Tip:</strong> Use different source/ref values to track where leads come from. Example: <code className="bg-gray-800 px-1 rounded">?type=customer&source=instagram&ref=NDM01</code>
        </p>
      </div>
    </div>
  );
};
