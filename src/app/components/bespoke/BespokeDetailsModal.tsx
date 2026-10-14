import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { DatePicker } from '../ui/DatePicker';
import { format, parseISO, isValid } from 'date-fns';
import { Loader2, Upload } from 'lucide-react';
import type { BespokeFabricMaterial, BespokeFormConfig, BespokeMetadata, CustomizationDetails } from '@/app/types/bespoke';
import { buildBespokeMetadataForPersist, normalizeFabricMaterials } from '@/app/types/bespoke';
import type { BespokeInjectionPayload } from '@/app/lib/bespokeCartInjection';
import { uploadBespokeReferenceImage, getBespokeImageDisplayUrl } from '@/app/utils/bespokeImageUpload';
import { BespokeFabricMaterialsEditor } from './BespokeFabricMaterialsEditor';
import { toast } from 'sonner';

export interface BespokeDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName?: string;
  config: BespokeFormConfig;
  initial?: CustomizationDetails;
  /** Fabric lines restored from injected cart children when editing. */
  initialFabrics?: BespokeFabricMaterial[];
  companyId: string;
  branchId?: string | null;
  onSave: (payload: BespokeInjectionPayload) => void;
}

export function BespokeDetailsModal({
  open,
  onOpenChange,
  productName,
  config,
  initial,
  initialFabrics,
  companyId,
  branchId,
  onSave,
}: BespokeDetailsModalProps) {
  const [fabricMaterials, setFabricMaterials] = useState<BespokeFabricMaterial[]>([]);
  const [colorName, setColorName] = useState('');
  const [shadeCode, setShadeCode] = useState('');
  const [measurements, setMeasurements] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [imageUrl, setImageUrl] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');

  useEffect(() => {
    if (!open) return;
    const fromChildren = initialFabrics?.length ? initialFabrics : [];
    const fromJson = normalizeFabricMaterials(initial?.fabric_materials);
    const materials = fromChildren.length
      ? fromChildren
      : fromJson.length
        ? fromJson
        : [{ product_id: '', product_name: '', sku: '', unit_code: 'm', quantity: 0 }];
    setFabricMaterials(materials);
    setColorName(initial?.color_name ?? '');
    setShadeCode(initial?.shade_card_code ?? '');
    setMeasurements(
      typeof initial?.measurements === 'string'
        ? initial.measurements
        : initial?.measurements
          ? JSON.stringify(initial.measurements, null, 2)
          : '',
    );
    setDeliveryDate(
      initial?.expected_delivery_date
        ? new Date(initial.expected_delivery_date)
        : undefined,
    );
    setImageUrl(initial?.image_url ?? '');
    setImagePath(initial?.image_storage_path ?? '');
    setNotes(initial?.notes ?? '');
  }, [open, initial, initialFabrics]);

  useEffect(() => {
    if (!open) {
      setPreviewSrc('');
      return;
    }
    const external = imageUrl.trim();
    if (external) {
      setPreviewSrc(external);
      return;
    }
    const path = imagePath.trim();
    if (!path) {
      setPreviewSrc('');
      return;
    }
    let cancelled = false;
    getBespokeImageDisplayUrl(path).then((url) => {
      if (!cancelled) setPreviewSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [open, imageUrl, imagePath]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const path = await uploadBespokeReferenceImage(companyId, file);
      setImagePath(path);
      setImageUrl('');
      const signed = await getBespokeImageDisplayUrl(path);
      setPreviewSrc(signed);
      toast.success('Image uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = () => {
    const validMaterials = fabricMaterials.filter((m) => m.product_id && m.quantity > 0);
    const metaRaw: BespokeMetadata = {
      ...(config.show_color_code && colorName.trim() ? { color_name: colorName.trim() } : {}),
      ...(config.show_color_code && shadeCode.trim() ? { shade_card_code: shadeCode.trim() } : {}),
      ...(config.show_measurements && measurements.trim() ? { measurements: measurements.trim() } : {}),
      ...(config.show_delivery_date && deliveryDate
        ? { expected_delivery_date: deliveryDate.toISOString().split('T')[0] }
        : {}),
      ...(config.show_image_upload && imageUrl.trim() ? { image_url: imageUrl.trim() } : {}),
      ...(config.show_image_upload && imagePath ? { image_storage_path: imagePath } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const metadata = buildBespokeMetadataForPersist(metaRaw) ?? {};
    onSave({
      metadata,
      fabrics: config.show_fabric ? validMaterials : [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize / Add Details</DialogTitle>
          {productName && (
            <p className="text-sm text-muted-foreground">{productName}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground rounded border border-border bg-input-background/80 px-3 py-2">
            Fabrics selected here are added as separate cart lines for inventory. Add stitching and other
            modification charges under <strong className="text-muted-foreground">Extra Expenses</strong> on the sale.
          </p>

          {config.show_fabric && companyId && (
            <BespokeFabricMaterialsEditor
              companyId={companyId}
              branchId={branchId}
              value={fabricMaterials}
              onChange={setFabricMaterials}
            />
          )}

          {config.show_color_code && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">Color name</Label>
                <Input
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  className="bg-input-background border-border text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Shade card code</Label>
                <Input
                  value={shadeCode}
                  onChange={(e) => setShadeCode(e.target.value)}
                  className="bg-input-background border-border text-white mt-1"
                />
              </div>
            </div>
          )}

          {config.show_measurements && (
            <div>
              <Label className="text-muted-foreground">Measurements</Label>
              <Textarea
                value={measurements}
                onChange={(e) => setMeasurements(e.target.value)}
                placeholder="Chest, length, sleeve… or paste measurement sheet"
                className="bg-input-background border-border text-white mt-1 min-h-[80px]"
              />
            </div>
          )}

          {config.show_delivery_date && (
            <div>
              <Label className="text-muted-foreground">Expected delivery date</Label>
              <div className="mt-1">
                <DatePicker
                  value={deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : ''}
                  onChange={(v) => {
                    if (!v) {
                      setDeliveryDate(undefined);
                      return;
                    }
                    const d = parseISO(v);
                    if (isValid(d)) setDeliveryDate(d);
                  }}
                  placeholder="Select date"
                />
              </div>
            </div>
          )}

          {config.show_image_upload && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Reference image</Label>
              <Input
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (e.target.value.trim()) setImagePath('');
                }}
                placeholder="External image URL (optional)"
                className="bg-input-background border-border text-white"
              />
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="bespoke-image-file"
                  className="cursor-pointer inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Upload file
                </Label>
                <input
                  id="bespoke-image-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleFile}
                />
              </div>
              {previewSrc && (
                <img
                  src={previewSrc}
                  alt="Reference"
                  className="max-h-32 rounded border border-border object-contain"
                />
              )}
            </div>
          )}

          <div>
            <Label className="text-muted-foreground">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-input-background border-border text-white mt-1 min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save details</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
