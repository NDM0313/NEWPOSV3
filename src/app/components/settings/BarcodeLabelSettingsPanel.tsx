import React, { useEffect, useMemo, useState } from 'react';
import { Barcode, Eye, Loader2, Save } from 'lucide-react';
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
import {
  buildA4SheetHtml,
  previewLabelsInBrowser,
  type LabelPrintJob,
} from '@/app/services/barcodeLabelPrint';

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
  const [useFixedLabelSize, setUseFixedLabelSize] = useState(
    DEFAULT_BARCODE_LABEL.useFixedLabelSize === true,
  );
  const [labelWidthMm, setLabelWidthMm] = useState(DEFAULT_BARCODE_LABEL.labelWidthMm ?? 65);
  const [labelHeightMm, setLabelHeightMm] = useState(DEFAULT_BARCODE_LABEL.labelHeightMm ?? 25);
  const [presetId, setPresetId] = useState<BarcodeLabelPresetId>(() =>
    presetIdFromLayout(DEFAULT_BARCODE_LABEL.a4Columns, DEFAULT_BARCODE_LABEL.maxLabelsPerSheet, {
      useFixedLabelSize: DEFAULT_BARCODE_LABEL.useFixedLabelSize,
      labelWidthMm: DEFAULT_BARCODE_LABEL.labelWidthMm,
      labelHeightMm: DEFAULT_BARCODE_LABEL.labelHeightMm,
    }),
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
        const fixed = s.useFixedLabelSize === true;
        const w = s.labelWidthMm ?? 65;
        const h = s.labelHeightMm ?? 25;
        setUseFixedLabelSize(fixed);
        setLabelWidthMm(w);
        setLabelHeightMm(h);
        setPresetId(
          presetIdFromLayout(s.a4Columns, s.maxLabelsPerSheet, {
            useFixedLabelSize: fixed,
            labelWidthMm: w,
            labelHeightMm: h,
          }),
        );
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

  const buildPayload = (): BarcodeLabelSettings => {
    const base: BarcodeLabelSettings = {
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
      useFixedLabelSize,
    };
    if (useFixedLabelSize) {
      base.labelWidthMm = labelWidthMm;
      base.labelHeightMm = labelHeightMm;
    } else {
      delete base.labelWidthMm;
      delete base.labelHeightMm;
    }
    return base;
  };

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

  const handlePrintPreview = () => {
    const settings = buildPayload();
    const count = Math.min(60, Math.max(6, settings.maxLabelsPerSheet));
    const base: LabelPrintJob = {
      ...SAMPLE_LABEL_PREVIEW_JOB,
      companyName,
      branchName,
      businessName: companyName,
      quantity: 1,
    };
    const jobs = Array.from({ length: count }, () => ({ ...base }));
    try {
      previewLabelsInBrowser(buildA4SheetHtml(jobs, settings));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open print preview');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
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
          <h4 className="text-lg font-semibold text-foreground">Barcode label printing</h4>
          <p className="text-sm text-muted-foreground">
            Default content and A4 sheet layout when printing labels from Products
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-input-background p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Label content</p>
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
          <div className="rounded-xl border border-border bg-input-background p-5 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default sheet layout</p>
            <BarcodeLabelSheetLayoutFields
              idPrefix="settings-sheet"
              presetId={presetId}
              onPresetChange={setPresetId}
              a4Columns={a4Columns}
              onA4ColumnsChange={setA4Columns}
              maxLabelsPerSheet={maxLabelsPerSheet}
              onMaxLabelsPerSheetChange={setMaxLabelsPerSheet}
              useFixedLabelSize={useFixedLabelSize}
              onUseFixedLabelSizeChange={setUseFixedLabelSize}
              labelWidthMm={labelWidthMm}
              onLabelWidthMmChange={setLabelWidthMm}
              labelHeightMm={labelHeightMm}
              onLabelHeightMmChange={setLabelHeightMm}
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

        <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
          <BarcodeLabelPreviewCard
            job={SAMPLE_LABEL_PREVIEW_JOB}
            companyName={companyName}
            branchName={branchName}
            {...displayOptions}
            large
            className="w-full max-w-sm mx-auto"
            labelWidthMm={useFixedLabelSize ? labelWidthMm : undefined}
            labelHeightMm={useFixedLabelSize ? labelHeightMm : undefined}
          />
          <A4SheetMiniPreview
            totalLabels={maxLabelsPerSheet}
            maxLabelsPerSheet={maxLabelsPerSheet}
            a4Columns={a4Columns}
            firstLabel={SAMPLE_LABEL_PREVIEW_JOB}
            display={displayOptions}
            companyName={companyName}
            branchName={branchName}
            largeSheet
            useFixedLabelSize={useFixedLabelSize}
            labelWidthMm={labelWidthMm}
            labelHeightMm={labelHeightMm}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handlePrintPreview}
            className="w-full border-gray-600 text-gray-200 gap-2"
          >
            <Eye size={16} />
            Print preview
          </Button>
        </div>
      </div>
    </div>
  );
}
