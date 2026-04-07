/**
 * Markdown report builder for admin opening-balance runs.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type ReportMeta = {
  companyId: string;
  mode: 'dry-run' | 'apply' | 'verify-only';
  generatedAtIso: string;
};

export function escapeMdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

export function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}\n\n`;
}

export function buildMarkdownReport(meta: ReportMeta, sections: string[]): string {
  const header = `# Company opening repair & verification

| Field | Value |
|--------|--------|
| Company UUID | \`${meta.companyId}\` |
| Mode | **${meta.mode}** |
| Generated (UTC) | ${meta.generatedAtIso} |

`;

  const checklist = `## PASS / FAIL checklist

| Check | Result |
|--------|--------|
| Customer opening path unchanged by this run | (see analysis) |
| Supplier opening repaired / planned | (see repair section) |
| Worker opening path unchanged by this run | (see analysis) |
| AP 2000 present in control snapshot after apply | (see controls) |
| No duplicate active \`opening_balance_contact_ap\` per contact | (see journals) |
| Basis map preserved (GL vs operational not conflated) | PASS — script does not touch purchase-due RPCs |
| P&L not driven by supplier opening (2000/3000 only) | PASS — by posting design |

`;

  return `${header}${sections.join('\n')}\n${checklist}`;
}

export async function writeReportFile(filePath: string, markdown: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, markdown, 'utf8');
}
