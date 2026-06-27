/**
 * Load parameterized monitoring profile for unified ledger production QA (R6).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'monitoring-company-profiles.json');

export function loadMonitoringProfile(profileId) {
  const raw = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  const id = profileId || process.env.MONITORING_PROFILE || raw.default_profile || 'din-china';
  const profile = raw.profiles[id];
  if (!profile) {
    throw new Error(`Unknown monitoring profile: ${id}. Available: ${Object.keys(raw.profiles).join(', ')}`);
  }
  if (profile.requires_finance_sign_off && id !== raw.default_profile) {
    throw new Error(`Profile ${id} requires finance sign-off before monitoring run.`);
  }
  const golden = profile.golden || {};
  return {
    profileId: id,
    company: profile.company,
    companyId: profile.company_id,
    productionUrl: profile.production_url || 'https://erp.dincouture.pk',
    loginEmailDefault: profile.login_email_default,
    golden: {
      mrJalilClosing: golden.mr_jalil_closing_pkr,
      trialBalanceTotal: golden.trial_balance_debit_credit_pkr,
      roznamcha: {
        cashIn: golden.roznamcha_cash_in_pkr,
        cashOut: golden.roznamcha_cash_out_pkr,
        closing: golden.roznamcha_closing_pkr,
      },
    },
    expectedUnifiedFlagsOn: profile.expected_unified_flags_on || [],
    pilotBatchExpected: profile.pilot_batch_expected ?? 9,
    goldenFixturePath: profile.golden_fixture_path
      ? path.join(ROOT, profile.golden_fixture_path)
      : null,
    goldenPartyName: profile.golden_party_name || 'MR JALIL',
    goldenPartySearch: profile.golden_party_search || 'JALIL',
    skipAdminPilotBatch: profile.skip_admin_pilot_batch === true,
    flagVerifySql: id === 'din-bridal'
      ? path.join(path.dirname(fileURLToPath(import.meta.url)), 'din-bridal/r5-monitoring-flags-pipe.sql')
      : path.join(path.dirname(fileURLToPath(import.meta.url)), 'phase-215x-final-flags.sql'),
    evidenceDir: path.join(
      ROOT,
      'reports/single-core-ledger',
      profile.evidence_subdir || `monitoring-${id}`,
    ),
  };
}
