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
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Share2 className="text-blue-400" size={20} />
            Share Order Status
          </DialogTitle>
          <DialogDescription className="text-gray-400">
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
              <Label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tracking Link</Label>
              <div className="flex gap-2">
                <Input 
                  value={trackingLink} 
                  readOnly 
                  className="bg-gray-950 border-gray-700 text-gray-300 font-mono text-xs h-10"
                />
                <Button 
                  size="icon" 
                  variant="outline" 
                  onClick={handleCopy}
                  className="shrink-0 border-gray-700 hover:bg-gray-800 hover:text-white"
                >
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </Button>
              </div>
            </div>

            <Button 
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold h-12 shadow-lg shadow-green-900/20 transition-all active:scale-[0.98]"
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
