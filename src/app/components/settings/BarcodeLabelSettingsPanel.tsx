import React, { useEffect, useMemo, useState } from 'react';
import { Barcode, Loader2, Save } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import {
  DEFAULT_BARCODE_LABEL,
  getBarcodeLabelSettings,
  setBarcodeLabelSettings,
  type BarcodeLabelSettings,
} from '@/app/services/barcodeLabelSettingsService';
import { presetIdFromLayout, type BarcodeLabelPresetId } from '@/app/lib/barcodeLabelPresets';
import {
  BarcodeLabelContentFields,
  BarcodeLabelSheetLayoutFields,
} from '@/app/components/products/BarcodeLabelLayoutFields';
import {
  BarcodeLabelPreviewCard,
  A4SheetMiniPreview,
  SAMPLE_LABEL_PREVIEW_JOB,
} from '@/app/components/products/barcodeLabelPreview';

export interface BarcodeLabelSettingsPanelProps {
  companyId: string | null | undefined;
  companyName?: string;
  branchName?: string;
}

export function BarcodeLabelSettingsPanel({
  companyId,
  companyName,
  branchName,
}: BarcodeLabelSettingsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showName, setShowName] = useState(DEFAULT_BARCODE_LABEL.showName);
  const [showPrice, setShowPrice] = useState(DEFAULT_BARCODE_LABEL.showPrice);
  const [showVariation, setShowVariation] = useState(DEFAULT_BARCODE_LABEL.showVariation);
  const [showPacking, setShowPacking] = useState(DEFAULT_BARCODE_LABEL.showPacking);
  const [showCompany, setShowCompany] = useState(DEFAULT_BARCODE_LABEL.showCompanyName);
  const [showBranch, setShowBranch] = useState(DEFAULT_BARCODE_LABEL.showBranchName);
  const [a4Columns, setA4Columns] = useState(DEFAULT_BARCODE_LABEL.a4Columns);
  const [maxLabelsPerSheet, setMaxLabelsPerSheet] = useState(DEFAULT_BARCODE_LABEL.maxLabelsPerSheet);
  const [presetId, setPresetId] = useState<BarcodeLabelPresetId>(() =>
    presetIdFromLayout(DEFAULT_BARCODE_LABEL.a4Columns, DEFAULT_BARCODE_LABEL.maxLabelsPerSheet)
  );

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getBarcodeLabelSettings(companyId)
      .then((s) => {
        if (cancelled) return;
        setShowName(s.showName);
        setShowPrice(s.showPrice);
        setShowVariation(s.showVariation);
        setShowPacking(s.showPacking);
        setShowCompany(s.showCompanyName);
        setShowBranch(s.showBranchName);
        setA4Columns(s.a4Columns);
        setMaxLabelsPerSheet(s.maxLabelsPerSheet);
        setPresetId(presetIdFromLayout(s.a4Columns, s.maxLabelsPerSheet));
      })
      .catch(() => toast.error('Could not load barcode label defaults'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const fieldOptions = useMemo(
    () => ({
      showName,
      showPrice,
      showVariation,
      showPacking,
      showCompany,
      showBranch,
    }),
    [showName, showPrice, showVariation, showPacking, showCompany, showBranch]
  );

  const displayOptions = fieldOptions;

  const buildPayload = (): BarcodeLabelSettings => ({
    ...DEFAULT_BARCODE_LABEL,
    labelLayout: 'a4',
    a4Columns,
    maxLabelsPerSheet,
    showName,
    showPrice,
    showVariation,
    showPacking,
    showCompanyName: showCompany,
    showBranchName: showBranch,
    showBusinessName: showCompany,
  });

  const handleSave = async () => {
    if (!companyId) {
      toast.error('No company selected');
      return;
    }
    setSaving(true);
    try {
      await setBarcodeLabelSettings(companyId, buildPayload());
      toast.success('Barcode label defaults saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-8">
        <Loader2 className="animate-spin" size={18} />
        Loading label defaults…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-purple-500/10 rounded-lg">
          <Barcode className="text-purple-400" size={22} />
        </div>
        <div>
          <h4 className="text-lg font-semibold text-white">Barcode label printing</h4>
          <p className="text-sm text-gray-400">
            Default content and A4 sheet layout when printing labels from Products
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Label content</p>
            <BarcodeLabelContentFields
              idPrefix="settings"
              options={fieldOptions}
              onChange={(patch) => {
                if (patch.showName !== undefined) setShowName(patch.showName);
                if (patch.showPrice !== undefined) setShowPrice(patch.showPrice);
                if (patch.showVariation !== undefined) setShowVariation(patch.showVariation);
                if (patch.showPacking !== undefined) setShowPacking(patch.showPacking);
                if (patch.showCompany !== undefined) setShowCompany(patch.showCompany);
                if (patch.showBranch !== undefined) setShowBranch(patch.showBranch);
              }}
              companyName={companyName}
              branchName={branchName}
            />
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Default sheet layout</p>
            <BarcodeLabelSheetLayoutFields
              presetId={presetId}
              onPresetChange={setPresetId}
              a4Columns={a4Columns}
              onA4ColumnsChange={(n) => {
                setA4Columns(n);
                setPresetId(presetIdFromLayout(n, maxLabelsPerSheet));
              }}
              maxLabelsPerSheet={maxLabelsPerSheet}
              onMaxLabelsPerSheetChange={(n) => {
                setMaxLabelsPerSheet(n);
                setPresetId(presetIdFromLayout(a4Columns, n));
              }}
            />
          </div>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !companyId}
            className="bg-blue-600 hover:bg-blue-500 gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save label defaults
          </Button>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview</p>
          <BarcodeLabelPreviewCard
            job={SAMPLE_LABEL_PREVIEW_JOB}
            companyName={companyName}
            branchName={branchName}
            {...displayOptions}
            large
            className="w-full max-w-sm mx-auto"
          />
          <A4SheetMiniPreview
            totalLabels={12}
            maxLabelsPerSheet={maxLabelsPerSheet}
            a4Columns={a4Columns}
            firstLabel={SAMPLE_LABEL_PREVIEW_JOB}
            display={displayOptions}
            companyName={companyName}
            branchName={branchName}
            largeSheet
          />
        </div>
      </div>
    </div>
  );
}
