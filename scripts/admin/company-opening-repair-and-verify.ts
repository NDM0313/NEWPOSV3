#!/usr/bin/env npx tsx
/**
 * Admin: company-scoped supplier opening repair + GL verification + markdown report.
 *
 * Usage:
 *   npx tsx scripts/admin/company-opening-repair-and-verify.ts --company <uuid> --dry-run
 *   npx tsx scripts/admin/company-opening-repair-and-verify.ts --company <uuid> --apply
 *   npx tsx scripts/admin/company-opening-repair-and-verify.ts --company <uuid> --verify-only
 *
 * Env: Auto-loaded from project root (first import below): .env.local → .env → .env.development.local.
 *      Shell variables are not overwritten. Needs SUPABASE_URL or VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

/** Loads dotenv via side effect — keep this import before other local modules that touch the DB. */
import { createAdminSupabase, formatSupabaseAuthError } from '../lib/adminSupabase';
import {
  inspectCoreSchemas,
  fetchContactsForCompany,
  groupContactsByType,
  findSupplierOnlyNormalizeCandidates,
  findBothTypeReview,
  runSupplierOpeningRepair,
  runVerificationSummary,
  type RepairPlanItem,
} from '../lib/openingVerification';
import { buildMarkdownReport, section, escapeMdCell, writeReportFile } from '../lib/reportWriter';

const EPS = 0.02;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseArgs(argv: string[]): {
  company: string | null;
  mode: 'dry-run' | 'apply' | 'verify-only' | null;
} {
  let company: string | null = null;
  let mode: 'dry-run' | 'apply' | 'verify-only' | null = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--company' && argv[i + 1]) {
      company = argv[++i];
    } else if (a === '--dry-run') {
      mode = 'dry-run';
    } else if (a === '--apply') {
      mode = 'apply';
    } else if (a === '--verify-only') {
      mode = 'verify-only';
    }
  }
  return { company, mode };
}

function formatControlsTable(
  c: Record<string, { debit: number; credit: number; netDrMinusCr: number }>
): string {
  const rows = ['1100', '2000', '2010', '3000'].map((code) => {
    const x = c[code] || { debit: 0, credit: 0, netDrMinusCr: 0 };
    return `| ${code} | ${x.debit} | ${x.credit} | ${x.netDrMinusCr} |`;
  });
  return `| Code | Debit | Credit | Net (Dr−Cr) |\n|------|-------|--------|---------------|\n${rows.join('\n')}`;
}

function formatRepairPlans(plans: RepairPlanItem[]): string {
  if (plans.length === 0) return '_No planned actions._\n';
  const rows = plans.map(
    (p) =>
      `| ${escapeMdCell(p.contactId)} | ${escapeMdCell(p.name)} | ${p.action} | ${escapeMdCell(p.detail)} |`
  );
  return `| Contact ID | Name | Action | Detail |\n|------------|------|--------|--------|\n${rows.join('\n')}\n`;
}

async function main() {
  const { company, mode } = parseArgs(process.argv);
  if (!company || !UUID_RE.test(company)) {
    console.error('Usage: --company <uuid> and one of --dry-run | --apply | --verify-only');
    process.exit(1);
  }
  if (!mode) {
    console.error('Specify --dry-run, --apply, or --verify-only');
    process.exit(1);
  }

  const supabase = createAdminSupabase();
  const generatedAtIso = new Date().toISOString();
  const reportPath = `docs/accounting/COMPANY_${company.toUpperCase()}_OPENING_REPAIR_REPORT.md`;

  const schemas = await inspectCoreSchemas(supabase);
  const jeShape = schemas.find((s) => s.table === 'journal_entries');
  const jeColumns = jeShape?.columns ?? [];

  const schemaBody =
    schemas
      .map((s) => {
        const note = s.note ? `\n\n_${escapeMdCell(s.note)}_` : '';
        return `### \`${s.table}\`\n\n\`${s.columns.join('`, `')}\`${note}`;
      })
      .join('\n\n') + '\n';

  const contacts = await fetchContactsForCompany(supabase, company);
  const byType = groupContactsByType(contacts);
  const supplierCandidates = findSupplierOnlyNormalizeCandidates(contacts);
  const bothReview = findBothTypeReview(contacts);

  const contactsSummary = Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, list]) => `**${t}:** ${list.length}`)
    .join('\n');

  const contactsTableRows = contacts
    .slice(0, 200)
    .map(
      (c) =>
        `| ${c.id} | ${escapeMdCell(String(c.type))} | ${escapeMdCell(c.name || '')} | ${c.opening_balance ?? ''} | ${c.supplier_opening_balance ?? ''} |`
    )
    .join('\n');

  const before = await runVerificationSummary(supabase, company);

  const sections: string[] = [];

  sections.push(section('Schema inspection (live sample row keys)', schemaBody));

  sections.push(
    section(
      'Company contact overview',
      `${contactsSummary}\n\n### Sample contacts (max 200)\n\n| id | type | name | opening_balance | supplier_opening_balance |\n|----|------|------|-----------------|-------------------------|\n${contactsTableRows}\n`
    )
  );

  sections.push(
    section(
      'Pre-repair detection',
      `**Supplier-only normalize candidates** (opening_balance > 0, supplier_opening_balance ~ 0): **${supplierCandidates.length}**\n\n**both-type manual review** (opening_balance > 0, supplier_opening ~ 0 — AP not auto-moved): **${bothReview.length}**\n\n` +
        (bothReview.length
          ? `| id | name | opening_balance |\n|----|------|-----------------|\n${bothReview.map((b) => `| ${b.id} | ${escapeMdCell(b.name || '')} | ${b.opening_balance} |`).join('\n')}\n`
          : '')
    )
  );

  sections.push(
    section(
      'Control accounts (before)',
      formatControlsTable(before.controls) +
        `\n\n**opening_balance_contact_ap** (active): **${before.apOpeningCount}**\n` +
        `**opening_balance_contact_ar** (active): **${before.arOpeningCount}**\n` +
        `**opening_balance_contact_worker** (active): **${before.workerOpeningCount}**\n` +
        (before.apDuplicates.length
          ? `\n**Duplicate AP opening JEs per contact:**\n${before.apDuplicates.map((d) => `- \`${d.contactId}\`: ${d.count}`).join('\n')}\n`
          : '\n**Duplicate AP opening JEs:** none\n')
    )
  );

  let repairResult: Awaited<ReturnType<typeof runSupplierOpeningRepair>> | null = null;

  if (mode === 'verify-only') {
    sections.push(
      section(
        'Repair',
        '_Skipped (--verify-only)._\n\nOperational purchase-due / payables tab is **not** validated here (purchase-based only); empty payables for pure openings is **expected**.\n'
      )
    );
  } else if (mode === 'dry-run') {
    repairResult = await runSupplierOpeningRepair(supabase, company, {
      dryRun: true,
      journalEntryColumnKeys: jeColumns,
    });
    sections.push(
      section(
        'Repair (dry-run — no DB writes)',
        formatRepairPlans(repairResult.plans) +
          '\n_Re-run with `--apply` to execute._\n\nOperational payables tab: **not** part of this script (basis preserved).\n'
      )
    );
  } else {
    repairResult = await runSupplierOpeningRepair(supabase, company, {
      dryRun: false,
      journalEntryColumnKeys: jeColumns,
    });
    sections.push(
      section(
        'Repair (apply)',
        `**Contacts normalized:** ${repairResult.normalizedContactIds.length}\n` +
          `**Journals created:** ${repairResult.journalsCreated.length}\n` +
          `**Journals voided:** ${repairResult.journalsVoided.length}\n\n` +
          formatRepairPlans(repairResult.plans)
      )
    );
  }

  const after =
    mode === 'apply' ? await runVerificationSummary(supabase, company) : mode === 'dry-run' ? before : before;

  sections.push(
    section(
      mode === 'apply' ? 'Control accounts (after apply)' : 'Control accounts (after — unchanged if dry-run / verify-only)',
      formatControlsTable(after.controls) +
        `\n\n**opening_balance_contact_ap** (active): **${after.apOpeningCount}**\n` +
        `**Supplier normalize candidates remaining:** **${after.supplierCandidatesRemaining}**\n` +
        `**both-type review remaining:** **${after.bothReviewRemaining}**\n`
    )
  );

  const c2000 = after.controls['2000'];
  const ap2000Ok =
    Math.abs(c2000?.netDrMinusCr ?? 0) > EPS || (c2000?.credit ?? 0) > EPS;
  const checklistExtra =
    `| AP 2000 shows activity (credit or net Dr−Cr ≠ 0) | ${ap2000Ok ? 'PASS' : 'FAIL'} |\n` +
    `| Duplicate active AP opening per contact | ${after.apDuplicates.length === 0 ? 'PASS' : 'FAIL'} |\n` +
    `| Supplier-only normalize candidates remaining | ${after.supplierCandidatesRemaining === 0 ? 'PASS' : 'REVIEW'} |\n`;

  sections.push(
    section(
      'Interpretation',
      `- **Customer / worker:** not modified by repair logic; AR/worker JE counts listed for sanity.\n` +
        `- **Supplier AP opening:** Dr **3000** (equity) / Cr **2000** (AP) for positive payables.\n` +
        `- **P&L:** opening postings use balance-sheet accounts only.\n` +
        `\n### Extra checks\n\n| Check | Result |\n|--------|--------|\n${checklistExtra}`
    )
  );

  const md = buildMarkdownReport(
    { companyId: company, mode, generatedAtIso },
    sections
  );

  await writeReportFile(reportPath, md);
  console.log(`Report written: ${reportPath}`);
  console.log(`Mode: ${mode}`);
  if (repairResult && mode === 'apply') {
    console.log(`Normalized: ${repairResult.normalizedContactIds.length}, JE created: ${repairResult.journalsCreated.length}, voided: ${repairResult.journalsVoided.length}`);
  }
}

main().catch((e) => {
  console.error(formatSupabaseAuthError(e));
  process.exit(1);
});
