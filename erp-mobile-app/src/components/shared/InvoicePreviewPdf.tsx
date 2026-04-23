import { ReportBrandHeader } from './ReportBrandHeader';
import type { CompanyBrand } from '../../api/reports';

export interface InvoicePreviewItem {
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoicePreviewProps {
  brand: CompanyBrand;
  docType: 'sale' | 'purchase';
  docNumber: string;
  docDate: string;
  partyName: string;
  partyPhone?: string | null;
  branchName?: string | null;
  items: InvoicePreviewItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  paid?: number;
  due?: number;
  notes?: string | null;
  generatedBy?: string | null;
}

const fmt = (n: number): string =>
  (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-PK', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/**
 * WYSIWYG invoice/PO body for PdfPreviewModal. Matches ReportBrandHeader +
 * printable A4 body. Used for both sales invoices and purchase orders.
 */
export function InvoicePreviewPdf(props: InvoicePreviewProps) {
  const {
    brand,
    docType,
    docNumber,
    docDate,
    partyName,
    partyPhone,
    branchName,
    items,
    subtotal,
    discount = 0,
    tax = 0,
    total,
    paid,
    due,
    notes,
    generatedBy,
  } = props;

  const heading = docType === 'sale' ? 'Sales Invoice' : 'Purchase Order';
  const partyLabel = docType === 'sale' ? 'Customer' : 'Supplier';

  return (
    <div>
      <ReportBrandHeader
        brand={brand}
        title={heading}
        subtitle={docNumber}
        metaRows={[
          { label: 'Date', value: docDate },
          ...(branchName ? [{ label: 'Branch', value: branchName }] : []),
          ...(generatedBy ? [{ label: 'By', value: generatedBy }] : []),
        ]}
      />
      <div style={{ padding: '12px 18px 0 18px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: 10,
            background: '#F9FAFB',
            fontSize: 12,
          }}
        >
          <div>
            <div style={{ color: '#6B7280' }}>{partyLabel}</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{partyName || '—'}</div>
            {partyPhone && <div style={{ color: '#374151' }}>{partyPhone}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#6B7280' }}>Document</div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{docNumber}</div>
            <div style={{ color: '#374151' }}>{docDate}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 18px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F3F4F6' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB' }}>#</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #E5E7EB' }}>Item</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #E5E7EB' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #E5E7EB' }}>Rate</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #E5E7EB' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>
                  No line items.
                </td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ fontWeight: 500, color: '#111827' }}>{it.productName}</div>
                    {it.sku && <div style={{ fontSize: 10, color: '#6B7280' }}>{it.sku}</div>}
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6', textAlign: 'right' }}>{fmt(it.quantity)}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6', textAlign: 'right' }}>Rs. {fmt(it.unitPrice)}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6', textAlign: 'right', fontWeight: 500 }}>
                    Rs. {fmt(it.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '0 18px 16px 18px', display: 'flex', justifyContent: 'flex-end' }}>
        <table style={{ fontSize: 12, borderCollapse: 'collapse', minWidth: 260 }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px', color: '#6B7280' }}>Subtotal</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>Rs. {fmt(subtotal)}</td>
            </tr>
            {discount > 0 && (
              <tr>
                <td style={{ padding: '4px 8px', color: '#6B7280' }}>Discount</td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>- Rs. {fmt(discount)}</td>
              </tr>
            )}
            {tax > 0 && (
              <tr>
                <td style={{ padding: '4px 8px', color: '#6B7280' }}>Tax</td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>Rs. {fmt(tax)}</td>
              </tr>
            )}
            <tr style={{ borderTop: '1px solid #E5E7EB' }}>
              <td style={{ padding: '6px 8px', color: '#111827', fontWeight: 700 }}>Total</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#111827', fontWeight: 700 }}>Rs. {fmt(total)}</td>
            </tr>
            {typeof paid === 'number' && (
              <tr>
                <td style={{ padding: '4px 8px', color: '#6B7280' }}>Paid</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: '#059669' }}>Rs. {fmt(paid)}</td>
              </tr>
            )}
            {typeof due === 'number' && due > 0 && (
              <tr>
                <td style={{ padding: '4px 8px', color: '#6B7280' }}>Balance Due</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: '#DC2626', fontWeight: 600 }}>
                  Rs. {fmt(due)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {notes && (
        <div style={{ padding: '0 18px 16px 18px', fontSize: 11, color: '#374151' }}>
          <div style={{ color: '#6B7280', marginBottom: 4 }}>Notes</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{notes}</div>
        </div>
      )}

      <div
        style={{
          padding: '8px 18px 18px',
          fontSize: 10,
          color: '#9CA3AF',
          textAlign: 'center',
        }}
      >
        Thank you for your business.
      </div>
    </div>
  );
}
