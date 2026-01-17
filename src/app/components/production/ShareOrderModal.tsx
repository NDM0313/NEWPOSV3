import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { Copy, Check, Share2, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";

interface ShareOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

export const ShareOrderModal = ({ isOpen, onClose, orderId }: ShareOrderModalProps) => {
  const [copied, setCopied] = useState(false);
  const trackingLink = `https://dincollection.com/track/${orderId || 'ORD-8821'}`;
  const whatsappMessage = `Salam! Track your suit status here: ${trackingLink}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingLink);
    setCopied(true);
    toast.success("Tracking link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="sm:max-w-md shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)'
        }}
      >
        <DialogHeader>
          <DialogTitle 
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Share2 size={20} style={{ color: 'var(--color-primary)' }} />
            Share Order Status
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            Share this QR code or link with the customer to track their order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6 space-y-6">
          {/* QR Code Container */}
          <div className="bg-white p-4 rounded-xl shadow-lg border-4 border-white/10">
            <QRCode 
              value={trackingLink} 
              size={200}
              fgColor="#111827"
              bgColor="#ffffff"
              level="M"
            />
          </div>

          <div className="w-full space-y-4">
            <div className="space-y-2">
              <Label 
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Tracking Link
              </Label>
              <div className="flex gap-2">
                <Input 
                  value={trackingLink} 
                  readOnly 
                  className="font-mono text-xs h-10"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
                <Button 
                  size="icon" 
                  variant="outline" 
                  onClick={handleCopy}
                  className="shrink-0"
                  style={{
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {copied ? (
                    <Check size={16} style={{ color: 'var(--color-success)' }} />
                  ) : (
                    <Copy size={16} />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              className="w-full font-bold h-12 transition-all active:scale-[0.98]"
              style={{
                backgroundColor: '#25D366',
                color: 'white',
                boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#128C7E';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#25D366';
              }}
              onClick={handleWhatsApp}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Share via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
