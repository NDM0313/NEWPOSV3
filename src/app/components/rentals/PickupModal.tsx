import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { useSupabase } from '@/app/context/SupabaseContext';
import type { RentalUI } from '@/app/context/RentalContext';
import { cn } from '@/app/components/ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/app/components/ui/alert-dialog';
import { Camera, Upload, X, DollarSign, CreditCard } from 'lucide-react';

export interface PickupConfirmPayload {
  actualPickupDate: string;
  notes?: string;
  documentType: string;
  documentNumber: string;
  documentExpiry?: string;
  documentReceived: boolean;
  remainingPaymentConfirmed: boolean;
  /** When true: deliver without full payment, create AR entry, set credit_flag */
  deliverOnCredit?: boolean;
  documentFrontImage?: string;
  documentBackImage?: string;
  customerPhoto?: string;
}

interface PickupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: RentalUI | null;
  onConfirm: (rentalId: string, payload: PickupConfirmPayload) => Promise<void>;
  /** Called when user wants to add payment (e.g. remaining amount). Opens payment dialog. */
  onAddPayment?: (rental: RentalUI) => void;
}

const DOCUMENT_TYPES = [
  { value: 'cnic', label: 'CNIC' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'other', label: 'Other' },
];

const BUCKET = 'payment-attachments';

async function uploadImage(companyId: string, rentalId: string, field: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${companyId}/rental-docs/${rentalId}/${field}_${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export const PickupModal = ({ open, onOpenChange, rental, onConfirm, onAddPayment }: PickupModalProps) => {
  const { user, companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLInputElement>(null);
  const [pickupDate, setPickupDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentExpiry, setDocumentExpiry] = useState('');
  const [documentReceived, setDocumentReceived] = useState(false);
  const [documentFrontFile, setDocumentFrontFile] = useState<File | null>(null);
  const [documentBackFile, setDocumentBackFile] = useState<File | null>(null);
  const [customerPhotoFile, setCustomerPhotoFile] = useState<File | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditChoiceOpen, setCreditChoiceOpen] = useState(false);

  const remainingAmount = (rental?.totalAmount ?? 0) - (rental?.paidAmount ?? 0);
  const hasFullPayment = remainingAmount <= 0;

  const doConfirm = async (deliverOnCredit: boolean) => {
    if (!rental) return;
    setCreditChoiceOpen(false);
    setError(null);
    setSaving(true);
    try {
      let documentFrontImage: string | undefined;
      let documentBackImage: string | undefined;
      let customerPhoto: string | undefined;
      if (companyId) {
        setUploadingImages(true);
        if (documentFrontFile) {
          documentFrontImage = await uploadImage(companyId, rental.id, 'front', documentFrontFile);
        }
        if (documentBackFile) {
          documentBackImage = await uploadImage(companyId, rental.id, 'back', documentBackFile);
        }
        if (customerPhotoFile) {
          customerPhoto = await uploadImage(companyId, rental.id, 'customer', customerPhotoFile);
        }
        setUploadingImages(false);
      }
      await onConfirm(rental.id, {
        actualPickupDate: pickupDate,
        notes: notes.trim() || undefined,
        documentType,
        documentNumber: documentNumber.trim(),
        documentExpiry: documentExpiry || undefined,
        documentReceived,
        remainingPaymentConfirmed: remainingAmount <= 0 && !deliverOnCredit,
        deliverOnCredit: deliverOnCredit || undefined,
        documentFrontImage,
        documentBackImage,
        customerPhoto,
      });
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to mark as picked up');
      if (e?.message?.toLowerCase().includes('bucket')) {
        toast.error('Storage bucket not found. Create payment-attachments bucket in Supabase.');
      }
    } finally {
      setSaving(false);
      setUploadingImages(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null);
    setPickupDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setDocumentType('');
    setDocumentNumber('');
    setDocumentExpiry('');
    setDocumentReceived(false);
    setDocumentFrontFile(null);
    setDocumentBackFile(null);
    setCustomerPhotoFile(null);
    onOpenChange(next);
  };

  const pickupBy = user?.email || (user?.user_metadata as any)?.full_name || 'Current user';
  const canConfirmBase = documentType && documentNumber.trim() && documentReceived && pickupDate >= (rental?.startDate || '');
  const canConfirm = canConfirmBase && hasFullPayment;
  const canConfirmOrCredit = canConfirmBase; // Can proceed to confirm or show credit choice

  const handleConfirmClick = () => {
    if (hasFullPayment) {
      doConfirm(false);
    } else {
      setCreditChoiceOpen(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl max-w-[900px] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-6 pb-4 border-b border-gray-800 shrink-0">
          <DialogTitle className="text-white text-xl tracking-tight">Confirm Pickup</DialogTitle>
          <DialogDescription className="text-gray-400">
            Process delivery for rental {rental?.rentalNo}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-y-auto">
          {/* LEFT SIDE */}
          <div className="flex-[6] overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0">
            {/* Card 1 – Rental Info */}
            <div className="rounded-xl border border-gray-700 p-4 bg-gray-800/30 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Rental Info</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Rental #</span><p className="font-mono text-pink-400">{rental?.rentalNo}</p></div>
                <div><span className="text-gray-500">Customer</span><p className="text-white">{rental?.customerName}</p></div>
                <div className="col-span-2">
                  <span className="text-gray-500">Product(s)</span>
                  <p className="text-white font-medium">{rental?.items?.map((i) => `${i.productName}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`).join(', ') || '—'}</p>
                </div>
                <div><span className="text-gray-500">Duration</span><p className="text-white">{rental?.items?.[0] ? `${rental.items.length} item(s)` : '—'}</p></div>
                <div><span className="text-gray-500">Return Date</span><p className="text-white">{rental?.expectedReturnDate}</p></div>
              </div>
            </div>

            {/* Card 2 – Payment Settlement */}
            <div className="rounded-xl border border-gray-700 p-4 bg-gray-800/30 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Payment Settlement</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total Amount</span><span className="text-white">{formatCurrency(rental?.totalAmount ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Advance Paid</span><span className="text-white">{formatCurrency(rental?.paidAmount ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Remaining Amount</span>
                  <span className={cn('font-semibold', remainingAmount > 0 ? 'text-red-400' : 'text-gray-400')}>
                    {formatCurrency(remainingAmount)}
                  </span>
                </div>
              </div>
              {remainingAmount > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-400 text-sm font-medium">
                    Remaining {formatCurrency(remainingAmount)}. Collect full payment or deliver on credit.
                  </div>
                  {onAddPayment && rental && (
                    <Button
                    type="button"
                    size="sm"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => onAddPayment(rental)}
                  >
                    <DollarSign size={16} className="mr-2" />
                    Add Payment ({formatCurrency(remainingAmount)})
                  </Button>
                  )}
                </div>
              )}
            </div>

            {/* Card 3 – Guarantee Document */}
            <div className="rounded-xl border border-gray-700 p-4 bg-gray-800/30 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Guarantee Document</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-gray-400 text-sm">Document Type</Label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger className="mt-1 bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-400 text-sm">Document Number *</Label>
                  <Input
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="ID / Passport number"
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-sm">Document Expiry (Optional)</Label>
                  <Input
                    type="date"
                    value={documentExpiry}
                    onChange={(e) => setDocumentExpiry(e.target.value)}
                    className="mt-1 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-gray-400 text-sm">Document Front Image</Label>
                    <input ref={frontRef} type="file" accept="image/*" className="hidden" onChange={(e) => setDocumentFrontFile(e.target.files?.[0] || null)} />
                    <div
                      onClick={() => frontRef.current?.click()}
                      className={cn(
                        "mt-1 border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors",
                        documentFrontFile ? "border-green-500/50 bg-green-500/5" : "border-gray-600 hover:border-gray-500 hover:bg-gray-800/50"
                      )}
                    >
                      {documentFrontFile ? (
                        <>
                          <Camera size={20} className="text-green-500" />
                          <span className="text-xs text-green-400 truncate max-w-full">{documentFrontFile.name}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setDocumentFrontFile(null); }} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                            <X size={12} /> Remove
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload size={20} className="text-gray-500" />
                          <span className="text-xs text-gray-400">Optional</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Document Back Image</Label>
                    <input ref={backRef} type="file" accept="image/*" className="hidden" onChange={(e) => setDocumentBackFile(e.target.files?.[0] || null)} />
                    <div
                      onClick={() => backRef.current?.click()}
                      className={cn(
                        "mt-1 border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors",
                        documentBackFile ? "border-green-500/50 bg-green-500/5" : "border-gray-600 hover:border-gray-500 hover:bg-gray-800/50"
                      )}
                    >
                      {documentBackFile ? (
                        <>
                          <Camera size={20} className="text-green-500" />
                          <span className="text-xs text-green-400 truncate max-w-full">{documentBackFile.name}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setDocumentBackFile(null); }} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                            <X size={12} /> Remove
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload size={20} className="text-gray-500" />
                          <span className="text-xs text-gray-400">Optional</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Customer Live Photo</Label>
                    <input ref={customerRef} type="file" accept="image/*" className="hidden" onChange={(e) => setCustomerPhotoFile(e.target.files?.[0] || null)} />
                    <div
                      onClick={() => customerRef.current?.click()}
                      className={cn(
                        "mt-1 border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors",
                        customerPhotoFile ? "border-green-500/50 bg-green-500/5" : "border-gray-600 hover:border-gray-500 hover:bg-gray-800/50"
                      )}
                    >
                      {customerPhotoFile ? (
                        <>
                          <Camera size={20} className="text-green-500" />
                          <span className="text-xs text-green-400 truncate max-w-full">{customerPhotoFile.name}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setCustomerPhotoFile(null); }} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
                            <X size={12} /> Remove
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload size={20} className="text-gray-500" />
                          <span className="text-xs text-gray-400">Optional</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={documentReceived}
                    onCheckedChange={(v) => setDocumentReceived(!!v)}
                    className="border-gray-600 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                  <span className="text-sm text-gray-300">Document physically received</span>
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE – Pickup Details Summary */}
          <div className="flex-[4] border-l border-gray-800 p-6 bg-gray-900/50 flex flex-col min-h-0 overflow-y-auto">
            <div className="sticky top-0 space-y-4">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Pickup Details</h4>
              <div>
                <Label className="text-gray-400 text-sm">Pickup Date</Label>
                <Input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  min={rental?.startDate}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Pickup By</Label>
                <p className="mt-1 text-sm text-gray-300">{pickupBy}</p>
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                  rows={3}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="px-6 py-2 text-sm text-red-400 shrink-0">{error}</p>}

        <DialogFooter className="px-6 py-4 border-t border-gray-800 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-gray-800 text-white border-gray-700">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmClick}
            disabled={saving || uploadingImages || !canConfirmOrCredit}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {saving ? 'Saving…' : uploadingImages ? 'Uploading…' : 'Confirm Pickup'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Credit choice: when remaining > 0 and user clicks Confirm */}
      <AlertDialog open={creditChoiceOpen} onOpenChange={setCreditChoiceOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remaining amount {formatCurrency(remainingAmount)}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Do you want to collect full payment first, or deliver on credit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white border-gray-700">Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              className="bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30"
              onClick={() => {
                setCreditChoiceOpen(false);
                onAddPayment?.(rental!);
              }}
            >
              <DollarSign size={16} className="mr-2" />
              Collect Full Payment
            </Button>
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={() => doConfirm(true)}
            >
              <CreditCard size={16} className="mr-2" />
              Deliver on Credit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
