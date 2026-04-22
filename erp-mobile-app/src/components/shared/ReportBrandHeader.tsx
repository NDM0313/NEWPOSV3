import type { CompanyBrand } from '../../api/reports';

interface ReportBrandHeaderProps {
  brand: CompanyBrand;
  title: string;
  subtitle?: string;
  metaRows?: { label: string; value: string }[];
}

/** Black-on-white branded header for PDF/print documents (mobile + web-parity). */
export function ReportBrandHeader({ brand, title, subtitle, metaRows }: ReportBrandHeaderProps) {
  const addressLine = [brand.address, brand.city, brand.country]
    .filter((v) => !!v && String(v).trim().length > 0)
    .join(', ');
  const contactLine = [
    brand.phone ? `Tel: ${brand.phone}` : null,
    brand.email ? `Email: ${brand.email}` : null,
    brand.website ? brand.website : null,
    brand.taxNumber ? `NTN: ${brand.taxNumber}` : null,
  ]
    .filter(Boolean)
    .join('  •  ');

  return (
    <div style={{ borderBottom: '2px solid #111', paddingBottom: 10, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {brand.logoUrl && (
          <img
            src={brand.logoUrl}
            alt="Logo"
            style={{ width: 64, height: 64, objectFit: 'contain' }}
            crossOrigin="anonymous"
          />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.2 }}>{brand.name}</div>
          {addressLine && <div style={{ fontSize: 10, marginTop: 2 }}>{addressLine}</div>}
          {contactLine && <div style={{ fontSize: 10, marginTop: 2 }}>{contactLine}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {metaRows && metaRows.length > 0 && (
          <table style={{ fontSize: 10, borderCollapse: 'collapse' }}>
            <tbody>
              {metaRows.map((r) => (
                <tr key={r.label}>
                  <td style={{ padding: '2px 8px 2px 0', color: '#444', textAlign: 'right' }}>{r.label}:</td>
                  <td style={{ padding: '2px 0', fontWeight: 600 }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
