/**
 * @deprecated Use the admin runner instead (service-role safe, report + verify):
 *
 *   npx tsx scripts/admin/company-opening-repair-and-verify.ts --company <uuid> --apply
 *
 * This file previously imported browser-tied app services; avoid for production repair.
 */

async function run() {
  console.error(
    'Use: npx tsx scripts/admin/company-opening-repair-and-verify.ts --company <UUID> --dry-run|--apply|--verify-only'
  );
  process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
