/**
 * Courier Slip — unified document engine (Wholesale: after packing list → shipment).
 * Shows: From/To, Courier, Tracking, Cost, optional company address and notes.
 */
import React from 'react';
import { ClassicPrintBase } from '@/app/components/shared/ClassicPrintBase';

export interface CourierSlipDocument {
  companyName: string;
  companyAddress?: string | null;
  /** Packing list / order ref */
  orderNo: string;
  date: string;
  /** Ship to */
  customerName: string;
  customerAddress?: string | null;
  customerPhone?: string | null;
  courierName: string;
  trackingNumber: string;
  shipmentCost: string;
  status: string;
  notes?: string | null;
}

export interface CourierSlipTemplateOptions {
  showCompanyAddress: boolean;
  showNotes: boolean;
  logoUrl?: string | null;
}

export interface CourierSlipTemplateProps {
  document: CourierSlipDocument;
  options: CourierSlipTemplateOptions;
  onPrint?: () => void;
  onClose?: () => void;
  actionChildren?: React.ReactNode;
}

export const CourierSlipTemplate: React.FC<CourierSlipTemplateProps> = ({
  document: doc,
  options,
  onPrint,
  onClose,
  actionChildren,
}) => {
  const headerMeta = [
    { label: 'Order / Packing', value: doc.orderNo },
    { label: 'Date', value: doc.date },
    { label: 'Courier', value: doc.courierName },
    { label: 'Tracking', value: doc.trackingNumber },
    { label: 'Cost', value: doc.shipmentCost },
    { label: 'Status', value: doc.status },
  ];

  return (
    <ClassicPrintBase
      documentTitle="COURIER SLIP"
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
          <strong>From:</strong> {doc.companyAddress}
        </div>
      )}

      <div className="classic-print-section" style={{ marginBottom: '12px', fontSize: '12px' }}>
        <strong>Ship To:</strong>
        <div style={{ marginTop: '4px' }}>
          {doc.customerName}
          {doc.customerAddress && <div style={{ fontSize: '11px', color: '#6b7280' }}>{doc.customerAddress}</div>}
          {doc.customerPhone && <div style={{ fontSize: '11px' }}>{doc.customerPhone}</div>}
        </div>
      </div>

      <table className="classic-print-table">
        <tbody>
          <tr><td><strong>Courier</strong></td><td>{doc.courierName}</td></tr>
          <tr><td><strong>Tracking No</strong></td><td>{doc.trackingNumber}</td></tr>
          <tr><td><strong>Shipment Cost</strong></td><td>{doc.shipmentCost}</td></tr>
          <tr><td><strong>Status</strong></td><td>{doc.status}</td></tr>
        </tbody>
      </table>

      {options.showNotes && doc.notes && (
        <div className="classic-print-section" style={{ marginTop: '16px', fontSize: '11px', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
          <strong>Notes:</strong> {doc.notes}
        </div>
      )}
    </ClassicPrintBase>
  );
};
