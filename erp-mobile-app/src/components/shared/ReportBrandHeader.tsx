import type { CompanyBrand } from '../../api/reports';

interface ReportBrandHeaderProps {
  brand: CompanyBrand;
  title: string;
  subtitle?: string;
  metaRows?: { label: string; value: string }[];
}

/**
 * Black-on-white branded header for PDF/print (table layout for html2canvas stability).
 */
export function ReportBrandHeader({ brand, title, subtitle, metaRows }: ReportBrandHeaderProps) {
  const addressLine = [brand.address, brand.city, brand.country]
    .filter((v) => !!v && String(v).trim().length > 0)
    .join(', ');

  const contactLines: string[] = [];
  if (brand.phone?.trim()) contactLines.push(`Tel: ${brand.phone.trim()}`);
  if (brand.email?.trim()) contactLines.push(`Email: ${brand.email.trim()}`);
  if (brand.website?.trim()) contactLines.push(brand.website.trim());
  if (brand.taxNumber?.trim()) contactLines.push(`NTN: ${brand.taxNumber.trim()}`);

  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}
    >
      <tbody>
        <tr>
          <td style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '2px solid #111' }}>
            {brand.logoUrl ? (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={brand.logoUrl}
                  alt=""
                  style={{ width: 64, height: 64, objectFit: 'contain', display: 'inline-block' }}
                  crossOrigin="anonymous"
                />
              </div>
            ) : null}
            <div
              style={{
                display: 'block',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 0.2,
                lineHeight: 1.25,
                color: '#111',
              }}
            >
              {brand.name || 'Company'}
            </div>
            {addressLine ? (
              <div style={{ display: 'block', fontSize: 10, marginTop: 4, lineHeight: 1.35, color: '#111' }}>
                {addressLine}
              </div>
            ) : null}
            {contactLines.map((line) => (
              <div
                key={line}
                style={{ display: 'block', fontSize: 10, marginTop: 3, lineHeight: 1.35, color: '#333' }}
              >
                {line}
              </div>
            ))}
          </td>
        </tr>
        <tr>
          <td style={{ paddingTop: 12 }}>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'top', width: '50%', textAlign: 'left' }}>
                    <div
                      style={{
                        display: 'block',
                        fontSize: 15,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        lineHeight: 1.2,
                        color: '#111',
                      }}
                    >
                      {title}
                    </div>
                    {subtitle ? (
                      <div
                        style={{
                          display: 'block',
                          fontSize: 11,
                          color: '#333',
                          marginTop: 4,
                          fontWeight: 600,
                        }}
                      >
                        {subtitle}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ verticalAlign: 'top', width: '50%', textAlign: 'right' }}>
                    {metaRows && metaRows.length > 0 ? (
                      <table
                        role="presentation"
                        cellPadding={0}
                        cellSpacing={0}
                        style={{
                          fontSize: 10,
                          borderCollapse: 'collapse',
                          marginLeft: 'auto',
                        }}
                      >
                        <tbody>
                          {metaRows.map((r) => (
                            <tr key={r.label}>
                              <td
                                style={{
                                  padding: '2px 8px 2px 0',
                                  color: '#444',
                                  textAlign: 'right',
                                  whiteSpace: 'nowrap',
                                  verticalAlign: 'top',
                                }}
                              >
                                {r.label}:
                              </td>
                              <td
                                style={{
                                  padding: '2px 0',
                                  fontWeight: 600,
                                  textAlign: 'left',
                                  verticalAlign: 'top',
                                  color: '#111',
                                }}
                              >
                                {r.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
