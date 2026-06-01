from pathlib import Path

src = Path("migrations/20260602170000_extra_service_4120_package_split.sql").read_text(encoding="utf-8")
head_path = Path("migrations/20260603100000_sale_charge_expense_category.sql")
head = head_path.read_text(encoding="utf-8").split(
    "-- ----------------------------------------------------------------------------\n-- record_sale_with_accounting"
)[0].rstrip()

old_sale = """    FOR v_charge IN
      SELECT sc.id, sc.charge_type, sc.amount, sc.tailor_contact_id
      FROM public.sale_charges sc
      WHERE sc.sale_id = p_sale_id
        AND LOWER(TRIM(COALESCE(sc.charge_type, ''))) NOT IN ('discount', 'shipping')
        AND COALESCE(sc.amount, 0) > 0.005
    LOOP
      v_tailor_name := NULL;
      IF v_charge.tailor_contact_id IS NOT NULL THEN
        SELECT name INTO v_tailor_name FROM public.contacts WHERE id = v_charge.tailor_contact_id;
      END IF;"""

new_sale = """    FOR v_charge IN
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
      END IF;"""

sale_fn = (
    "CREATE OR REPLACE FUNCTION public.record_sale_with_accounting"
    + src.split("CREATE OR REPLACE FUNCTION public.record_sale_with_accounting", 1)[1].split(
        "COMMENT ON FUNCTION public.record_sale_with_accounting", 1
    )[0]
)
sale_fn = sale_fn.replace(old_sale, new_sale)

exp_part = src.split("CREATE OR REPLACE FUNCTION public.record_expense_with_accounting", 1)[1].split(
    "COMMENT ON FUNCTION public.record_expense_with_accounting", 1
)[0]
exp_fn = "CREATE OR REPLACE FUNCTION public.record_expense_with_accounting" + exp_part
exp_fn = exp_fn.replace(
    """  v_tailor_id            UUID;
  v_invoice_no           TEXT;
  v_is_clearing          BOOLEAN;""",
    """  v_tailor_id            UUID;
  v_expense_category_id  UUID;
  v_tailor_name          TEXT;
  v_invoice_no           TEXT;
  v_is_clearing          BOOLEAN;""",
)
exp_fn = exp_fn.replace(
    """  v_tailor_id := v_expense.tailor_contact_id;

  v_is_clearing""",
    """  v_tailor_id := v_expense.tailor_contact_id;
  v_expense_category_id := v_expense.expense_category_id;

  v_is_clearing""",
)
exp_fn = exp_fn.replace(
    """    IF v_tailor_id IS NULL THEN
      SELECT sc.tailor_contact_id INTO v_tailor_id FROM public.sale_charges sc WHERE sc.id = v_sale_charge_id;
    END IF;

    SELECT COALESCE(s.invoice_no""",
    """    IF v_tailor_id IS NULL OR v_expense_category_id IS NULL THEN
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

    SELECT COALESCE(s.invoice_no""",
)
exp_fn = exp_fn.replace(
    "'Expense #' || COALESCE(v_expense.expense_no, v_expense.id::TEXT)\n"
    "        || ' - 4120 clearing'\n"
    "        || CASE WHEN v_invoice_no IS NOT NULL THEN ' - ' || v_invoice_no ELSE '' END,",
    "'Expense #' || COALESCE(v_expense.expense_no, v_expense.id::TEXT)\n"
    "        || ' - 4120 clearing'\n"
    "        || CASE WHEN v_invoice_no IS NOT NULL THEN ' - ' || v_invoice_no ELSE '' END\n"
    "        || CASE WHEN v_tailor_name IS NOT NULL THEN ' - ' || v_tailor_name ELSE '' END,",
)
exp_fn = exp_fn.replace(
    "'Extra Service clearing - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT),",
    "'Extra Service clearing - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT)\n"
    "        || CASE WHEN v_tailor_name IS NOT NULL THEN ' - ' || v_tailor_name ELSE '' END,",
)

out = (
    head
    + "\n\n-- ----------------------------------------------------------------------------\n"
    + "-- record_sale_with_accounting — expense_category tailor name\n"
    + "-- ----------------------------------------------------------------------------\n"
    + sale_fn
    + "\n-- ----------------------------------------------------------------------------\n"
    + "-- record_expense_with_accounting — expense_category from sale charge\n"
    + "-- ----------------------------------------------------------------------------\n"
    + exp_fn
    + "\n"
)
head_path.write_text(out, encoding="utf-8")
print("Wrote", head_path, "bytes", len(out))
