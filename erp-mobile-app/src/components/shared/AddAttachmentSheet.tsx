import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { AttachmentFilePicker } from './AttachmentFilePicker';
import {
  appendAccountingAttachments,
  resolveAttachmentWriteTarget,
  type ResolveAttachmentTargetParams,
} from '../../lib/appendAccountingAttachments';
import {
  loadEffectiveExistingAttachments,
  REPLACE_ATTACHMENT_CONFIRM_MESSAGE,
  REPLACE_ATTACHMENT_INFO_MESSAGE,
  resolvePolicyReferenceType,
  usesSingleAccountingAttachmentPolicy,
} from '../../lib/accountingAttachmentPolicy';

export interface AddAttachmentSheetProps {
  open: boolean;
  companyId: string;
  branchId?: string | null;
  targetParams: ResolveAttachmentTargetParams;
  title?: string;
  onClose: () => void;
  onSaved?: (warning: string | null) => void;
}

export function AddAttachmentSheet({
  open,
  companyId,
  branchId,
  targetParams,
  title = 'Add attachment',
  onClose,
  onSaved,
}: AddAttachmentSheetProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [singlePolicy, setSinglePolicy] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSinglePolicy(false);
      setHasExisting(false);
      return;
    }
    let cancelled = false;
    setPolicyLoading(true);
    void (async () => {
      try {
        const target = await resolveAttachmentWriteTarget(companyId, targetParams);
        if (!target || cancelled) {
          if (!cancelled) {
            setSinglePolicy(false);
            setHasExisting(false);
          }
          return;
        }
        const refType = await resolvePolicyReferenceType(
          companyId,
          target,
          targetParams.referenceType,
        );
        const single = usesSingleAccountingAttachmentPolicy(refType);
        const existing = single
          ? await loadEffectiveExistingAttachments(companyId, target)
          : [];
        if (!cancelled) {
          setSinglePolicy(single);
          setHasExisting(existing.length > 0);
        }
      } finally {
        if (!cancelled) setPolicyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, companyId, targetParams]);

  if (!open) return null;

  const handleClose = () => {
    if (saving) return;
    setFiles([]);
    setError(null);
    setInfo(null);
    onClose();
  };

  const handleSave = async () => {
    if (!files.length) {
      setError('Choose a photo or file first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const target = await resolveAttachmentWriteTarget(companyId, targetParams);
      if (!target) {
        setError('Could not resolve where to save attachments.');
        return;
      }
      if (singlePolicy && hasExisting) {
        if (!window.confirm(REPLACE_ATTACHMENT_CONFIRM_MESSAGE)) {
          return;
        }
      }
      const res = await appendAccountingAttachments(companyId, target, files, {
        branchId,
        referenceType: targetParams.referenceType,
      });
      if (!res.ok) {
        setError(res.error || 'Upload failed.');
        return;
      }
      setFiles([]);
      onSaved?.(res.warning);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const sheetTitle = singlePolicy && hasExisting ? 'Replace attachment' : title;
  const saveLabel =
    singlePolicy && hasExisting ? 'Replace attachment' : singlePolicy ? 'Save attachment' : 'Save attachments';

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full sm:max-w-lg bg-[#1F2937] sm:rounded-xl rounded-t-2xl border border-[#374151] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151]">
          <h3 className="text-sm font-semibold text-white">{sheetTitle}</h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-[#374151] text-[#9CA3AF] disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error ? (
            <div className="p-3 rounded-lg bg-[#EF4444]/20 border border-[#EF4444] text-[#FCA5A5] text-sm">
              {error}
            </div>
          ) : null}
          {info ? (
            <div className="p-3 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-[#93C5FD] text-sm">
              {info}
            </div>
          ) : null}
          {singlePolicy && hasExisting && !policyLoading ? (
            <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-100 text-sm">
              {REPLACE_ATTACHMENT_INFO_MESSAGE}
            </div>
          ) : null}
          <AttachmentFilePicker
            files={files}
            onChange={setFiles}
            onError={setError}
            onInfo={setInfo}
            maxFiles={singlePolicy ? 1 : undefined}
            label={singlePolicy ? 'Attachment' : 'Attachments'}
            description={
              singlePolicy
                ? 'One file per receipt · camera or gallery · PDF, PNG, JPG up to 10MB'
                : 'Camera or gallery · PDF, PNG, JPG up to 10MB'
            }
          />
        </div>
        <div className="p-4 border-t border-[#374151]">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || files.length === 0 || policyLoading}
            className="w-full h-11 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 text-white font-medium flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </>
            ) : (
              saveLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
