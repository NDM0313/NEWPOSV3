import React, { useState } from 'react';

import { Printer, X } from 'lucide-react';

import { Button } from '../../ui/button';

import { Switch } from '../../ui/switch';

import { toast } from 'sonner';

import type { usePrinterConfig } from '@/app/hooks/usePrinterConfig';

import { useThermalPrint } from '@/app/hooks/useThermalPrint';

import { useSettings } from '@/app/context/SettingsContext';

import { useCompanyLogoDisplayUrl } from '@/app/hooks/useCompanyLogoDisplayUrl';

import { DEFAULT_THERMAL } from '@/app/types/printingSettings';

import {

  ThermalReceiptLayout,

  type ThermalPaperSize,

  type ThermalReceiptLineItem,

} from '@/app/components/shared/invoice/ThermalReceiptLayout';
import { getThermalDimensions } from '@/app/constants/thermalPrintDimensions';

import { AppliesToBanner } from './AppliesToBanner';



type PrinterHook = ReturnType<typeof usePrinterConfig>;



interface LegacyPrinterSettingsSectionProps {

  printer: PrinterHook;

}



const SAMPLE_ITEMS: ThermalReceiptLineItem[] = [

  { key: '1', name: 'Sample Product A', qty: '1', amount: '5,000' },

  { key: '2', name: 'Sample Product B', qty: '2', amount: '3,600' },

];



/** Legacy companies.printer_mode settings — prefer Thermal Receipts tab for new config. */

export function LegacyPrinterSettingsSection({ printer }: LegacyPrinterSettingsSectionProps) {

  const [testOpen, setTestOpen] = useState(false);

  const { printThermal } = useThermalPrint();

  const { company } = useSettings();

  const logoUrl = useCompanyLogoDisplayUrl(company.logoUrl);

  const paperSize: ThermalPaperSize = printer.config.paperSize ?? '58mm';



  return (

    <div className="space-y-4">

      <AppliesToBanner targets="Legacy POS printer_mode column — ClassicPrintBase paths. Prefer Thermal Receipts tab." />

      <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">

        Deprecated: use <strong>Thermal Receipts</strong> tab for receipt layout. This block syncs the old{' '}

        <code className="text-amber-100">companies.printer_mode</code> column used by some POS flows.

      </p>



      <div className="flex items-center justify-between bg-gray-900 p-4 rounded-lg border border-gray-800">

        <div>

          <p className="text-white font-medium">Printer Mode</p>

          <p className="text-sm text-gray-400">Thermal receipt or A4 invoice layout</p>

        </div>

        <select

          value={printer.config.mode}

          onChange={(e) => void printer.setMode(e.target.value as 'thermal' | 'a4')}

          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"

        >

          <option value="a4">A4 (Standard)</option>

          <option value="thermal">Thermal Receipt</option>

        </select>

      </div>



      {printer.config.mode === 'thermal' && (

        <div className="flex items-center justify-between bg-gray-900 p-4 rounded-lg border border-gray-800">

          <div>

            <p className="text-white font-medium">Paper Size</p>

            <p className="text-sm text-gray-400">58mm or 80mm thermal roll</p>

          </div>

          <select

            value={printer.config.paperSize}

            onChange={(e) => void printer.setPaperSize(e.target.value as '58mm' | '80mm')}

            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"

          >

            <option value="58mm">58mm</option>

            <option value="80mm">80mm</option>

          </select>

        </div>

      )}



      <div className="flex items-center justify-between bg-gray-900 p-4 rounded-lg border border-gray-800">

        <div>

          <p className="text-white font-medium">Auto Print Receipt</p>

          <p className="text-sm text-gray-400">Print receipt after POS sale</p>

        </div>

        <Switch

          checked={printer.config.autoPrintReceipt}

          onCheckedChange={(val) => void printer.setAutoPrintReceipt(val)}

        />

      </div>



      <Button

        variant="outline"

        className="border-gray-600 text-gray-300 hover:bg-gray-800"

        onClick={() => setTestOpen(true)}

      >

        <Printer size={16} className="mr-2" />

        Test Print

      </Button>



      {testOpen ? (

        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 thermal-print-overlay">

          <div
            className="thermal-print-modal-shell bg-gray-900 border border-gray-700 rounded-xl p-4 w-full max-h-[90vh] overflow-auto"
            style={{ maxWidth: getThermalDimensions(paperSize).modalMaxPx }}
          >

            <div className="flex items-center justify-between mb-3 no-print">

              <p className="text-white font-medium text-sm">Sample thermal receipt</p>

              <button type="button" onClick={() => setTestOpen(false)} className="text-gray-400 hover:text-white">

                <X size={18} />

              </button>

            </div>

            <div className="pdf-print-root">

            <ThermalReceiptLayout

              paperSize={paperSize}

              thermal={DEFAULT_THERMAL}

              companyName={company.name || 'Your Company'}

              companyAddress={company.address}

              companyPhone={company.phone}

              logoUrl={logoUrl || undefined}

              invoiceNo="TEST-001"

              invoiceDate={new Date().toLocaleDateString()}

              customerName="Walk-in Customer"

              cashierName="Admin"

              lineItems={SAMPLE_ITEMS}

              totalRows={[{ label: 'TOTAL', value: '8,600', bold: true }]}

              actions={

                <div className="flex gap-2 flex-wrap">

                  <Button

                    size="sm"

                    className="bg-blue-600 hover:bg-blue-500"

                    onClick={() => {

                      printThermal(paperSize);

                      toast.success('Test print dialog opened');

                    }}

                  >

                    <Printer size={14} className="mr-1" />

                    Print

                  </Button>

                  <Button size="sm" variant="secondary" onClick={() => setTestOpen(false)}>

                    Close

                  </Button>

                </div>

              }

            />

            </div>

          </div>

        </div>

      ) : null}

    </div>

  );

}


