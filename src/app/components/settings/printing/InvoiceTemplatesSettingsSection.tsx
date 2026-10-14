import React from 'react';
import { FileText, Printer, Save, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import type { InvoiceTemplate } from '@/app/types/invoiceDocument';
import { AppliesToBanner } from './AppliesToBanner';

function TemplateFormFields({
  template,
  onChange,
}: {
  template: Partial<InvoiceTemplate>;
  onChange: (t: Partial<InvoiceTemplate>) => void;
}) {
  const update = (key: keyof InvoiceTemplate, value: boolean | string | null) => {
    onChange({ ...template, [key]: value });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground">Show SKU</Label>
        <Switch checked={template.show_sku ?? true} onCheckedChange={(v) => update('show_sku', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground">Show Discount</Label>
        <Switch checked={template.show_discount ?? true} onCheckedChange={(v) => update('show_discount', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground">Show Tax</Label>
        <Switch checked={template.show_tax ?? true} onCheckedChange={(v) => update('show_tax', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground">Show Studio Cost</Label>
        <Switch checked={template.show_studio ?? true} onCheckedChange={(v) => update('show_studio', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground">Show Signature Line</Label>
        <Switch checked={template.show_signature ?? false} onCheckedChange={(v) => update('show_signature', v)} />
      </div>
      <div>
        <Label className="text-muted-foreground">Logo URL (optional override)</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-2">Leave blank to use company logo from Company profile.</p>
        <Input
          className="mt-1 bg-muted border-border text-foreground"
          placeholder="https://..."
          value={template.logo_url ?? ''}
          onChange={(e) => update('logo_url', e.target.value || null)}
        />
      </div>
      <div>
        <Label className="text-muted-foreground">Footer Note</Label>
        <Textarea
          className="mt-1 bg-muted border-border text-foreground min-h-[60px]"
          placeholder="Thank you for your business..."
          value={template.footer_note ?? ''}
          onChange={(e) => update('footer_note', e.target.value || null)}
        />
      </div>
    </div>
  );
}

export interface InvoiceTemplatesSettingsSectionProps {
  loading: boolean;
  saving: boolean;
  invoiceTemplateA4: Partial<InvoiceTemplate>;
  invoiceTemplateThermal: Partial<InvoiceTemplate>;
  onA4Change: (t: Partial<InvoiceTemplate>) => void;
  onThermalChange: (t: Partial<InvoiceTemplate>) => void;
  onSave: () => void;
}

/** Legacy invoice_documents table templates (separate from printing_settings). */
export function InvoiceTemplatesSettingsSection({
  loading,
  saving,
  invoiceTemplateA4,
  invoiceTemplateThermal,
  onA4Change,
  onThermalChange,
  onSave,
}: InvoiceTemplatesSettingsSectionProps) {
  return (
    <div className="space-y-4">
      <AppliesToBanner targets="Legacy invoice_documents table — older invoice print paths (separate from unified A4 engine)." />
      <div className="flex justify-end">
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
          disabled={saving || loading}
          onClick={onSave}
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Save Invoice Templates
        </Button>
      </div>
      {loading ? (
        <div className="p-6 text-center text-muted-foreground text-sm">Loading template settings…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h5 className="text-foreground font-semibold flex items-center gap-2 text-sm">
              <FileText size={16} /> A4 Invoice (legacy table)
            </h5>
            <TemplateFormFields template={invoiceTemplateA4} onChange={onA4Change} />
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h5 className="text-foreground font-semibold flex items-center gap-2 text-sm">
              <Printer size={16} /> Thermal (legacy table)
            </h5>
            <TemplateFormFields template={invoiceTemplateThermal} onChange={onThermalChange} />
          </div>
        </div>
      )}
    </div>
  );
}
