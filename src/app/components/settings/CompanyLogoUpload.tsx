import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useCompanyLogoDisplayUrl } from '@/app/hooks/useCompanyLogoDisplayUrl';
import {
  deleteCompanyLogoFromStorage,
  uploadCompanyLogo,
} from '@/app/utils/companyLogoUpload';
import { toast } from 'sonner';

interface CompanyLogoUploadProps {
  logoUrl?: string;
  onChange: (logoUrl: string | undefined) => void;
}

export const CompanyLogoUpload: React.FC<CompanyLogoUploadProps> = ({ logoUrl, onChange }) => {
  const { companyId } = useSupabase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const displayUrl = useCompanyLogoDisplayUrl(logoUrl);

  const handleFile = async (file: File | null) => {
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const path = await uploadCompanyLogo(companyId, file);
      onChange(path);
      toast.success('Logo uploaded. Click Save to persist company settings.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (logoUrl) {
      await deleteCompanyLogoFromStorage(logoUrl);
    }
    onChange(undefined);
    toast.success('Logo removed. Click Save to update company settings.');
  };

  return (
    <div className="col-span-2 space-y-3">
      <Label className="text-gray-300 block">Company Logo</Label>
      <p className="text-xs text-gray-500">
        Used on invoices, receipts, reports, and other prints. PNG, JPG, or WebP, max 2 MB.
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-28 h-28 rounded-lg border border-gray-700 bg-gray-950 flex items-center justify-center overflow-hidden shrink-0">
          {displayUrl ? (
            <img src={displayUrl} alt="Company logo" className="max-w-full max-h-full object-contain" />
          ) : (
            <ImagePlus className="text-gray-600" size={32} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            className="border-gray-700 text-white hover:bg-gray-800"
            disabled={uploading || !companyId}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Uploading…
              </>
            ) : (
              <>
                <ImagePlus size={16} className="mr-2" />
                {logoUrl ? 'Replace logo' : 'Upload logo'}
              </>
            )}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              disabled={uploading}
              onClick={() => void handleRemove()}
            >
              <Trash2 size={16} className="mr-2" />
              Remove logo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
