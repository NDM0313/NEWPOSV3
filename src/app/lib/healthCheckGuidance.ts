/** System Health FAIL remediation — Roman Urdu UI copy + diagnostic SQL hints. */

export interface HealthCheckGuidance {
  /** Match erp_health_dashboard.component */
  component: string;
  meaningUr: string;
  stepsUr: string[];
  settingsHint?: string;
  diagnosticSql?: string;
  skipNoteUr?: string;
}

export const HEALTH_CHECK_GUIDANCE: HealthCheckGuidance[] = [
  {
    component: 'Walk-in Integrity',
    meaningUr: 'Har company ke liye sirf ek walk-in customer hona chahiye. Agar zyada hain to data inconsistent hai.',
    stepsUr: [
      'Supabase SQL editor mein neeche diagnostic query chalayein — kaun si company par duplicate walk-in hain dekhein.',
      'Migration `walkin_consolidation_single_per_company.sql` apply karein (duplicates merge + unique index).',
      'Merge ke baad Settings → System Health par Refresh karein.',
      'Naye branches par walk-in auto-create trigger check karein (`customers_sales_rls_controlled_access.sql`).',
    ],
    diagnosticSql: `SELECT company_id, COUNT(*) AS walkin_count
FROM public.contacts
WHERE system_type = 'walking_customer'
GROUP BY company_id
HAVING COUNT(*) > 1;`,
  },
  {
    component: 'Orphan Users',
    meaningUr: 'Kuch ERP user profiles Supabase Auth se link nahi (`auth_user_id` khali). Ye users login / branch access nahi kar sakte.',
    stepsUr: [
      'Settings → Users khol kar affected emails dekhein.',
      'Har user ko dubara Invite karein ya Add User se Auth account link karein.',
      'SQL se manually link karein jab Auth user pehle se maujood ho (neeche query).',
      'Stale test profiles delete karein agar unki zaroorat na ho.',
    ],
    settingsHint: 'Settings → Users & Access → Users',
    diagnosticSql: `SELECT id, email, full_name, company_id, role
FROM public.users
WHERE auth_user_id IS NULL;`,
  },
  {
    component: 'Orphan Sales',
    meaningUr: 'Kuch sales aise customer_id par point karti hain jo contacts table mein maujood nahi (customer delete/import issue).',
    stepsUr: [
      'Diagnostic query se orphan sales list karein.',
      'Affected sales ko company walk-in customer par reassign karein (neeche UPDATE — pehle SELECT se verify karein).',
      'Backup se customer restore karein agar galti se delete hua ho.',
      'Aage customer hard-delete se bachain jab open sales hon.',
    ],
    diagnosticSql: `SELECT s.id, s.invoice_number, s.customer_id, s.company_id
FROM public.sales s
WHERE s.customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = s.customer_id);`,
  },
  {
    component: 'Negative Stock',
    meaningUr: 'Inventory balance mein koi row negative quantity par hai — stock movement ya oversell issue.',
    stepsUr: [
      'Neeche query se affected products/branches identify karein.',
      'Terminal par `npm run inventory-health` chalayein — report `docs/inventory_health_report.json`.',
      'Source documents trace karein (purchase, sale void, adjustment).',
      'Corrective stock adjustment post karein ya Settings → Inventory mein Negative Stock Allowed review karein.',
    ],
    settingsHint: 'Settings → Operations → Inventory — General',
    diagnosticSql: `SELECT ib.*, pv.sku, p.name AS product_name
FROM public.inventory_balance ib
LEFT JOIN public.product_variations pv ON pv.id = ib.variation_id
LEFT JOIN public.products p ON p.id = ib.product_id
WHERE ib.quantity < 0;`,
  },
  {
    component: 'Document Sequence Validity',
    meaningUr: 'Global document counter (`document_sequences_global`) mein negative value hai — galat reset ya import.',
    stepsUr: [
      'Neeche query se bad rows dekhein.',
      'Har document type ke liye last issued number se counter set karein (0 se kam na ho).',
      'Settings → Numbering — Maintenance tab se sync tools use karein agar available hon.',
      'Manual SQL UPDATE se pehle max invoice number cross-check karein.',
    ],
    settingsHint: 'Settings → Accounting & Finance → Numbering — Maintenance',
    diagnosticSql: `SELECT company_id, document_type, current_number, updated_at
FROM public.document_sequences_global
WHERE current_number < 0;`,
  },
  {
    component: 'Sales created_by integrity',
    meaningUr: 'Kuch sales ka `created_by` invalid auth UUID hai (deleted user ya galat ID store hui).',
    stepsUr: [
      'Diagnostic query se affected sales list karein.',
      'Valid admin/owner auth user UUID par reassign karein.',
      'User delete ki jagah disable prefer karein taake history break na ho.',
      'Naye sales flows verify karein ke `auth.users.id` store ho raha ho.',
    ],
    settingsHint: 'Settings → Users & Access → Users',
    diagnosticSql: `SELECT s.id, s.invoice_number, s.created_by, s.company_id
FROM public.sales s
WHERE s.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.created_by);`,
  },
  {
    component: 'Payments received_by integrity',
    meaningUr: 'Kuch payments ka `received_by` invalid auth UUID hai.',
    stepsUr: [
      'Diagnostic query se orphan payments list karein.',
      'Valid auth user par reassign karein (maslan branch manager ya admin).',
      'Payment capture code verify karein ke hamesha auth UUID save ho.',
      'Refresh ke baad row OK honi chahiye.',
    ],
    diagnosticSql: `SELECT p.id, p.receipt_number, p.received_by, p.company_id, p.amount
FROM public.payments p
WHERE p.received_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.received_by);`,
  },
  {
    component: 'Permission Engine Integrity',
    meaningUr: 'RBAC engine incomplete: roles seed nahi, sales visibility missing, users bina role, ya company bina owner.',
    stepsUr: [
      'Migration `erp_permission_engine_v1.sql` apply ho chuki ho verify karein.',
      'Settings → Roles & Permissions mein har role ke liye sales visibility (view_own / view_branch / view_company) ON karein.',
      'Users jinka role khali hai unhe owner/admin/manager/user assign karein.',
      'Har company par kam az kam ek owner hona chahiye — pehle naya owner assign karein phir purana change karein.',
    ],
    settingsHint: 'Settings → Users & Access → Roles & Permissions',
    diagnosticSql: `-- Users without role
SELECT id, email, company_id FROM public.users
WHERE role IS NULL OR TRIM(COALESCE(role::text, '')) = '';

-- Companies without owner
SELECT c.company_id FROM (
  SELECT DISTINCT company_id FROM public.users WHERE company_id IS NOT NULL
) c
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u
  WHERE u.company_id = c.company_id AND u.role::text = 'owner'
);`,
  },
  {
    component: 'OVERALL',
    meaningUr: 'Koi bhi component FAIL hai to overall bhi FAIL. Har FAIL row alag fix hoti hai.',
    stepsUr: [
      'Neeche table mein har FAIL row expand karein — us check ki Fix Guide follow karein.',
      'Ek fix ke baad Refresh dabayein; doosri FAIL row par move karein.',
      'SKIP ka matlab migration/column missing — dev/admin se contact karein.',
    ],
  },
];

const guidanceByComponent = new Map(
  HEALTH_CHECK_GUIDANCE.map((g) => [g.component.toLowerCase(), g]),
);

export function getHealthCheckGuidance(component: string): HealthCheckGuidance | null {
  return guidanceByComponent.get(component.toLowerCase()) ?? null;
}

export const HEALTH_SKIP_NOTE_UR =
  'Migration ya column missing hai — ye data problem nahi. Dev/admin se migration apply karwaein.';

export const HEALTH_OVERALL_FAIL_BANNER_UR =
  'System Health FAIL hai. Neeche har FAIL row par Fix Guide expand karein — har check alag tarah fix hoti hai.';

export const HEALTH_SQL_COPY_WARNING_UR =
  'Sirf diagnostic ke liye. UPDATE/DELETE se pehle backup lein aur SELECT se verify karein.';
