import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const src = fs
  .readFileSync(path.join(root, 'migrations/20260602170000_extra_service_4120_package_split.sql'), 'utf8')
  .replace(/\r\n/g, '\n');
const headPath = path.join(root, 'migrations/20260603100000_sale_charge_expense_category.sql');
const head = fs
  .readFileSync(path.join(root, 'migrations/20260603100000_sale_charge_expense_category_head.sql'), 'utf8')
  .replace(/\r\n/g, '\n')
  .trimEnd();

const oldSale = `    FOR v_charge IN
      SELECT sc.id, sc.charge_type, sc.amount, sc.tailor_contact_id
      FROM public.sale_charges sc
      WHERE sc.sale_id = p_sale_id
        AND LOWER(TRIM(COALESCE(sc.charge_type, ''))) NOT IN ('discount', 'shipping')
        AND COALESCE(sc.amount, 0) > 0.005
    LOOP
      v_tailor_name := NULL;
      IF v_charge.tailor_contact_id IS NOT NULL THEN
        SELECT name INTO v_tailor_name FROM public.contacts WHERE id = v_charge.tailor_contact_id;
      END IF;`;

const newSale = `    FOR v_charge IN
      SELECT sc.id, sc.charge_type, sc.amount, sc.tailor_contact_id, sc.expense_category_id
      FROM public.sale_charges sc
      WHERE sc.sale_id = p_sale_id
        AND LOWER(TRIM(COALESCE(sc.charge_type, ''))) NOT IN ('discount', 'shipping')
        AND COALESCE(sc.amount, 0) > 0.005
    LOOP
      v_tailor_name := NULL;
      IF v_charge.expense_category_id IS NOT NULL THEN
        SELECT name INTO v_tailor_name FROM public.expense_categories WHERE id = v_charge.expense_category_id;
      END IF;
      IF v_tailor_name IS NULL AND v_charge.tailor_contact_id IS NOT NULL THEN
        SELECT name INTO v_tailor_name FROM public.contacts WHERE id = v_charge.tailor_contact_id;
      END IF;`;

const saleMarker = 'CREATE OR REPLACE FUNCTION public.record_sale_with_accounting(p_sale_id UUID)';
const saleTail = src.split('COMMENT ON FUNCTION public.record_sale_with_accounting(UUID)', 1)[0];
const saleBody = saleTail.slice(saleTail.indexOf(saleMarker) + saleMarker.length);
let saleFn = saleMarker + saleBody;
saleFn = saleFn.replace(oldSale, newSale);

const expMarker = 'CREATE OR REPLACE FUNCTION public.record_expense_with_accounting(p_expense_id UUID)';
const expTail = src.split('COMMENT ON FUNCTION public.record_expense_with_accounting(UUID)', 1)[0];
const expBody = expTail.slice(expTail.indexOf(expMarker) + expMarker.length);
let expFn = expMarker + expBody;

expFn = expFn.replace(
  `  v_tailor_id            UUID;
  v_invoice_no           TEXT;
  v_is_clearing          BOOLEAN;`,
  `  v_tailor_id            UUID;
  v_expense_category_id  UUID;
  v_tailor_name          TEXT;
  v_invoice_no           TEXT;
  v_is_clearing          BOOLEAN;`,
);
expFn = expFn.replace(
  `  v_tailor_id := v_expense.tailor_contact_id;

  v_is_clearing`,
  `  v_tailor_id := v_expense.tailor_contact_id;
  v_expense_category_id := v_expense.expense_category_id;

  v_is_clearing`,
);
expFn = expFn.replace(
  `    IF v_tailor_id IS NULL THEN
      SELECT sc.tailor_contact_id INTO v_tailor_id FROM public.sale_charges sc WHERE sc.id = v_sale_charge_id;
    END IF;

    SELECT COALESCE(s.invoice_no`,
  `    IF v_tailor_id IS NULL OR v_expense_category_id IS NULL THEN
      SELECT sc.tailor_contact_id, sc.expense_category_id
      INTO v_tailor_id, v_expense_category_id
      FROM public.sale_charges sc WHERE sc.id = v_sale_charge_id;
    END IF;
    v_tailor_name := NULL;
    IF v_expense_category_id IS NOT NULL THEN
      SELECT name INTO v_tailor_name FROM public.expense_categories WHERE id = v_expense_category_id;
    END IF;
    IF v_tailor_name IS NULL AND v_tailor_id IS NOT NULL THEN
      SELECT name INTO v_tailor_name FROM public.contacts WHERE id = v_tailor_id;
    END IF;

    SELECT COALESCE(s.invoice_no`,
);
expFn = expFn.replace(
  `'Expense #' || COALESCE(v_expense.expense_no, v_expense.id::TEXT)
        || ' - 4120 clearing'
        || CASE WHEN v_invoice_no IS NOT NULL THEN ' - ' || v_invoice_no ELSE '' END,`,
  `'Expense #' || COALESCE(v_expense.expense_no, v_expense.id::TEXT)
        || ' - 4120 clearing'
        || CASE WHEN v_invoice_no IS NOT NULL THEN ' - ' || v_invoice_no ELSE '' END
        || CASE WHEN v_tailor_name IS NOT NULL THEN ' - ' || v_tailor_name ELSE '' END,`,
);
expFn = expFn.replace(
  `'Extra Service clearing - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT),`,
  `'Extra Service clearing - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT)
        || CASE WHEN v_tailor_name IS NOT NULL THEN ' - ' || v_tailor_name ELSE '' END,`,
);

const out =
  head +
  '\n\n-- ----------------------------------------------------------------------------\n' +
  '-- record_sale_with_accounting — expense_category tailor name\n' +
  '-- ----------------------------------------------------------------------------\n' +
  saleFn +
  '\n-- ----------------------------------------------------------------------------\n' +
  '-- record_expense_with_accounting — expense_category from sale charge\n' +
  '-- ----------------------------------------------------------------------------\n' +
  expFn +
  '\n';

fs.writeFileSync(headPath, out, 'utf8');
console.log('Wrote', headPath, out.length);
