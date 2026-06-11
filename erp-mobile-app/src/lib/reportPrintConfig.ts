import type { FieldsConfig } from '../types/printingSettings';

export const REPORT_PRINT_FORMAT = 'a4' as const;
export const REPORT_DEFAULT_FONT_SIZE = 11;
export type ReportPrintOrientation = 'portrait' | 'landscape';

export type ReportHeaderFieldVisibility = Pick<
  FieldsConfig,
  'showLogo' | 'showCompanyAddress' | 'showPhone' | 'showEmail'
>;

export const DEFAULT_REPORT_HEADER_FIELDS: ReportHeaderFieldVisibility = {
  showLogo: true,
  showCompanyAddress: true,
  showPhone: true,
  showEmail: true,
};

export function pickReportHeaderFieldVisibility(
  fields?: Partial<FieldsConfig>,
): ReportHeaderFieldVisibility {
  return {
    showLogo: fields?.showLogo ?? DEFAULT_REPORT_HEADER_FIELDS.showLogo,
    showCompanyAddress: fields?.showCompanyAddress ?? DEFAULT_REPORT_HEADER_FIELDS.showCompanyAddress,
    showPhone: fields?.showPhone ?? DEFAULT_REPORT_HEADER_FIELDS.showPhone,
    showEmail: fields?.showEmail ?? DEFAULT_REPORT_HEADER_FIELDS.showEmail,
  };
}
