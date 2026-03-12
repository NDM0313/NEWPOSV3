/**
 * Packing List — unified document engine (Wholesale workflow).
 * Columns: Product, SKU, Pieces, Cartons, Weight. Uses printing_settings (e.g. show SKU).
 */
import React from 'react';
import { ClassicPrintBase } from '@/app/components/shared/ClassicPrintBase';

export interface PackingListItem {
  product: string;
  sku: string;
  pieces: number;
  cartons: number;
  weight: string;
}

export interface PackingListDocument {
  companyName: string;
  companyAddress?: string | null;
  orderNo: string;
  date: string;
  items: PackingListItem[];
  totalPieces: number;
  totalCartons: number;
  totalWeight: string;
}

export interface PackingListTemplateOptions {
  showSku: boolean;
  showCompanyAddress: boolean;
  showNotes: boolean;
  showSignature: boolean;
  logoUrl?: string | null;
}

export interface PackingListTemplateProps {
  document: PackingListDocument;
  options: PackingListTemplateOptions;
  onPrint?: () => void;
  onClose?: () => void;
  actionChildren?: React.ReactNode;
}

export const PackingListTemplate: React.FC<PackingListTemplateProps> = ({
  document: doc,
  options,
  onPrint,
  onClose,
  actionChildren,
}) => {
  const headerMeta = [
    { label: 'Order / Invoice', value: doc.orderNo },
    { label: 'Date', value: doc.date },
  ];

  return (
    <ClassicPrintBase
      documentTitle="PACKING LIST"
      companyName={doc.companyName}
      logoUrl={options.logoUrl ?? undefined}
      headerMeta={headerMeta}
      onPrint={onPrint}
      onClose={onClose}
      printerMode="a4"
      showActions={true}
      actionChildren={actionChildren}
    >
      {options.showCompanyAddress && doc.companyAddress && (
        <div className="classic-print-section" style={{ marginBottom: '12px', fontSize: '11px', color: '#6b7280' }}>
          {doc.companyAddress}
        </div>
      )}

      <table className="classic-print-table">
        <thead>
          <tr>
            <th className="text-left">Product</th>
            {options.showSku && <th className="text-left">SKU</th>}
            <th className="text-right">Pieces</th>
            <th className="text-right">Cartons</th>
            <th className="text-right">Weight</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((row, i) => (
            <tr key={i}>
              <td style={{ fontSize: '11px' }}>{row.product}</td>
              {options.showSku && <td style={{ fontSize: '11px', color: '#6b7280' }}>{row.sku}</td>}
              <td className="text-right" style={{ fontSize: '11px' }}>{row.pieces}</td>
              <td className="text-right" style={{ fontSize: '11px' }}>{row.cartons}</td>
              <td className="text-right" style={{ fontSize: '11px' }}>{row.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="classic-print-section" style={{ marginTop: '16px', fontSize: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <span><strong>Total Pieces:</strong> {doc.totalPieces}</span>
        <span><strong>Total Cartons:</strong> {doc.totalCartons}</span>
        <span><strong>Total Weight:</strong> {doc.totalWeight}</span>
      </div>

      {options.showSignature && (
        <div className="classic-print-section" style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>Authorized Signature</p>
        </div>
      )}
    </ClassicPrintBase>
  );
};
