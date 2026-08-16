/**

 * Shared thermal receipt layout — Settings preview + live sale print (WYSIWYG).

 * Sales invoices, POS receipts, and order slips ONLY — never tabular A4 reports.

 * Do NOT use ClassicPrintBase for thermal; this component owns compact roll typography.

 */

import React from 'react';

import type { ThermalSettings } from '@/app/types/printingSettings';

import {

  getThermalDimensions,

  type ThermalPaperSize,

} from '@/app/constants/thermalPrintDimensions';



export type { ThermalPaperSize };



export interface ThermalReceiptLineItem {

  key: string;

  name: string;

  sku?: string | null;

  qty: string;

  amount: string;

  /** Extra lines under product name (packing, bespoke, etc.) */

  subLines?: React.ReactNode;

}



export interface ThermalReceiptTotalRow {

  label: string;

  value: string;

  bold?: boolean;

  valueColor?: string;

}



export interface ThermalReceiptLayoutProps {

  paperSize: ThermalPaperSize;

  thermal: Pick<ThermalSettings, 'showLogo' | 'showQR' | 'showCashier' | 'compactMode'>;

  companyName: string;

  companyAddress?: string | null;

  companyPhone?: string | null;

  logoUrl?: string | null;

  invoiceNo: string;

  invoiceDate: string;

  customerName: string;

  customerPhone?: string | null;

  cashierName?: string | null;

  lineItems: ThermalReceiptLineItem[];

  totalRows: ThermalReceiptTotalRow[];

  statusLabel?: string;

  footerNote?: string | null;

  /** Action bar (Print / Preview / Close) — hidden when printing */

  actions?: React.ReactNode;

  contentRef?: React.RefObject<HTMLDivElement | null>;

  className?: string;

}



export const ThermalReceiptLayout: React.FC<ThermalReceiptLayoutProps> = ({

  paperSize,

  thermal,

  companyName,

  companyAddress,

  companyPhone,

  logoUrl,

  invoiceNo,

  invoiceDate,

  customerName,

  customerPhone,

  cashierName,

  lineItems,

  totalRows,

  statusLabel,

  footerNote,

  actions,

  contentRef,

  className,

}) => {

  const dims = getThermalDimensions(paperSize);

  const fontScale = thermal.compactMode ? 0.92 : 1;

  const basePx = dims.baseFontPx * fontScale;

  const padH = dims.horizontalPaddingPx * fontScale;

  const padV = padH * 1.25;

  const logoPx = dims.logoMaxPx * fontScale;

  const sizeClass = paperSize === '58mm' ? 'thermal-receipt-root--58mm' : 'thermal-receipt-root--80mm';

  const { item: itemPct, qty: qtyPct, amt: amtPct } = dims.columns;



  return (

    <div

      ref={contentRef}

      className={`thermal-receipt-root ${sizeClass} ${className ?? ''}`.trim()}

      data-print-sheet

      data-print-format="thermal"

      data-thermal-width={paperSize}

      style={{

        ['--thermal-width' as string]: `${dims.widthMm}mm`,

        ['--thermal-roll-width' as string]: `${dims.widthMm}mm`,

        width: dims.screenPx,

        maxWidth: `${dims.widthMm}mm`,

        margin: '0 auto',

      }}

    >

      {actions ? <div className="thermal-receipt-actions no-print mb-3">{actions}</div> : null}



      <div

        className="thermal-receipt-sheet bg-white text-black"

        style={{

          fontFamily: 'Arial, Helvetica, sans-serif',

          fontSize: `${basePx}px`,

          lineHeight: dims.lineHeight,

          padding: `${padV}px ${padH}px`,

          paddingBottom: `${padV * 1.25}px`,

          boxSizing: 'border-box',

        }}

      >

        <div className="text-center mb-3 w-full">

          {thermal.showLogo && logoUrl ? (

            <img

              src={logoUrl}

              alt=""

              className="mx-auto mb-2 object-contain"

              style={{ width: logoPx, height: logoPx, maxWidth: '100%' }}

            />

          ) : thermal.showLogo ? (

            <div

              className="bg-gray-200 rounded mx-auto mb-2 flex items-center justify-center text-muted-foreground"

              style={{ width: logoPx, height: logoPx, fontSize: 8 * fontScale }}

            >

              LOGO

            </div>

          ) : null}

          <div

            className="font-bold uppercase tracking-wide"

            style={{ fontSize: `${(basePx + 2) * fontScale}px` }}

          >

            {companyName}

          </div>

          {companyAddress ? (

            <p className="text-muted-foreground mt-1 break-words" style={{ fontSize: `${basePx}px` }}>

              {companyAddress}

            </p>

          ) : null}

          {companyPhone ? (

            <p className="text-muted-foreground" style={{ fontSize: `${basePx}px` }}>

              Tel: {companyPhone}

            </p>

          ) : null}

          <p

            className="font-bold uppercase mt-2"

            style={{ fontSize: `${basePx + 1}px`, letterSpacing: '0.05em' }}

          >

            Invoice

          </p>

        </div>



        <div

          className="w-full border-b border-dashed border-gray-400 pb-2 mb-2 flex justify-between gap-1 min-w-0"

          style={{ fontSize: `${basePx}px` }}

        >

          <span className="min-w-0 break-words">{invoiceDate}</span>

          <span className="font-bold shrink-0 whitespace-nowrap">{invoiceNo}</span>

        </div>



        {thermal.showCashier && cashierName ? (

          <div className="w-full mb-2 text-left min-w-0" style={{ fontSize: `${basePx}px` }}>

            <span className="text-muted-foreground">Cashier:</span>{' '}

            <span className="font-semibold break-words">{cashierName}</span>

          </div>

        ) : null}



        <div className="w-full mb-3 text-left min-w-0" style={{ fontSize: `${basePx}px` }}>

          <span className="text-muted-foreground">Customer:</span>{' '}

          <span className="font-semibold break-words">{customerName}</span>

          {customerPhone ? (

            <p className="text-muted-foreground mt-0.5 break-words">{customerPhone}</p>

          ) : null}

        </div>



        <table

          className="w-full mb-3 border-collapse thermal-line-items"

          style={{ fontSize: `${basePx}px`, tableLayout: 'fixed', width: '100%' }}

        >

          <colgroup>

            <col style={{ width: `${itemPct}%` }} />

            <col style={{ width: `${qtyPct}%` }} />

            <col style={{ width: `${amtPct}%` }} />

          </colgroup>

          <thead>

            <tr className="border-b border-black">

              <th className="text-left pb-1 font-semibold thermal-item-col">Item</th>

              <th className="text-center pb-1 font-semibold thermal-qty-col">Qty</th>

              <th className="text-right pb-1 font-semibold thermal-amt-col">Amt</th>

            </tr>

          </thead>

          <tbody>

            {lineItems.map((item) => (

              <tr key={item.key} className="align-top">

                <td className="py-1 pr-0.5 thermal-item-col">

                  <div className="break-words" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>

                    {item.name}

                  </div>

                  {item.sku ? (

                    <div className="text-muted-foreground" style={{ fontSize: `${basePx - 1}px` }}>

                      {item.sku}

                    </div>

                  ) : null}

                  {item.subLines}

                </td>

                <td className="text-center py-1 whitespace-nowrap thermal-qty-col">{item.qty}</td>

                <td className="text-right py-1 whitespace-nowrap thermal-amt-col">{item.amount}</td>

              </tr>

            ))}

          </tbody>

        </table>



        <div

          className="w-full border-t border-dashed border-gray-400 pt-2 space-y-1"

          style={{ fontSize: `${basePx}px` }}

        >

          {totalRows.map((row) => (

            <div

              key={row.label}

              className={`flex justify-between gap-1 min-w-0 ${row.bold ? 'font-bold' : ''}`}

              style={row.valueColor ? { color: row.valueColor } : undefined}

            >

              <span className="min-w-0 break-words">{row.label}</span>

              <span className="shrink-0 whitespace-nowrap">{row.value}</span>

            </div>

          ))}

        </div>



        {statusLabel ? (

          <p className="mt-2 break-words" style={{ fontSize: `${basePx}px` }}>

            <strong>Status:</strong> {statusLabel}

          </p>

        ) : null}



        {footerNote ? (

          <p className="mt-2 text-muted-foreground break-words" style={{ fontSize: `${basePx - 1}px` }}>

            {footerNote}

          </p>

        ) : null}



        {thermal.showQR ? (

          <div

            className="mt-3 mx-auto border border-gray-300 flex items-center justify-center text-muted-foreground"

            style={{ width: logoPx + 8, height: logoPx + 8, fontSize: 8 * fontScale }}

            aria-hidden

          >

            QR

          </div>

        ) : null}



        <p className="mt-3 text-center text-muted-foreground" style={{ fontSize: `${basePx - 1}px` }}>

          Thank you for your business!

        </p>

        <p className="mt-1 text-center text-muted-foreground" style={{ fontSize: `${basePx - 2}px` }}>

          Generated {new Date().toLocaleString()}

        </p>

      </div>

    </div>

  );

};


