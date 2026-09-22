-- Wave A (cont): purchase / purchase_items / payments FX write guards when module OFF.
-- Additive; narrow triggers; does not null or rewrite historical FX rows.

CREATE OR REPLACE FUNCTION public._purchase_row_has_import_fx_metadata(
  p_document_currency text,
  p_fx_rate_to_base numeric,
  p_foreign_subtotal numeric,
  p_foreign_total numeric
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    (
      public._normalize_import_fx_currency(p_document_currency) <> ''
      AND public._normalize_import_fx_currency(p_document_currency) <> 'PKR'
    )
    OR p_fx_rate_to_base IS NOT NULL
    OR p_foreign_subtotal IS NOT NULL
    OR p_foreign_total IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._guard_purchases_import_fx_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled boolean;
  v_new_currency text;
  v_fx_changed boolean;
BEGIN
  v_enabled := public._company_import_fx_enabled(NEW.company_id);
  v_new_currency := public._normalize_import_fx_currency(NEW.document_currency);

  IF TG_OP = 'INSERT' THEN
    IF NOT v_enabled THEN
      IF public._purchase_row_has_import_fx_metadata(
        NEW.document_currency, NEW.fx_rate_to_base, NEW.foreign_subtotal, NEW.foreign_total
      ) THEN
        RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: cannot write purchase FX metadata while Multi Currency is OFF'
          USING ERRCODE = 'check_violation';
      END IF;
      -- Force PKR-only shape when OFF (null FX cols already required above)
      IF v_new_currency = 'PKR' THEN
        NEW.document_currency := 'PKR';
      ELSIF v_new_currency = '' THEN
        NEW.document_currency := NULL;
      END IF;
      RETURN NEW;
    END IF;

    -- Module ON: normalize + validate currency when set
    IF v_new_currency <> '' THEN
      NEW.document_currency := v_new_currency;
      IF NOT public._company_import_fx_currency_allowed(NEW.company_id, v_new_currency) THEN
        RAISE EXCEPTION 'IMPORT_FX_CURRENCY_NOT_ACTIVE: % is not allowed for this company', v_new_currency
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  v_fx_changed :=
    public._normalize_import_fx_currency(NEW.document_currency)
      IS DISTINCT FROM public._normalize_import_fx_currency(OLD.document_currency)
    OR NEW.fx_rate_to_base IS DISTINCT FROM OLD.fx_rate_to_base
    OR NEW.foreign_subtotal IS DISTINCT FROM OLD.foreign_subtotal
    OR NEW.foreign_total IS DISTINCT FROM OLD.foreign_total;

  IF NOT v_enabled THEN
    IF v_fx_changed THEN
      RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: cannot introduce or alter purchase FX metadata while Multi Currency is OFF'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Preserve historical FX values unchanged; allow non-FX column updates
    RETURN NEW;
  END IF;

  -- Module ON
  IF v_new_currency <> '' THEN
    NEW.document_currency := v_new_currency;
    IF NOT public._company_import_fx_currency_allowed(NEW.company_id, v_new_currency) THEN
      RAISE EXCEPTION 'IMPORT_FX_CURRENCY_NOT_ACTIVE: % is not allowed for this company', v_new_currency
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchases_import_fx_write_guard ON public.purchases;
CREATE TRIGGER trg_purchases_import_fx_write_guard
  BEFORE INSERT OR UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public._guard_purchases_import_fx_write();

CREATE OR REPLACE FUNCTION public._guard_purchase_items_import_fx_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_enabled boolean;
  v_fx_changed boolean;
BEGIN
  SELECT p.company_id INTO v_company_id
  FROM public.purchases p
  WHERE p.id = NEW.purchase_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    -- Header missing (should not happen under FK); skip to avoid insert-order dead ends
    RETURN NEW;
  END IF;

  v_enabled := public._company_import_fx_enabled(v_company_id);

  IF TG_OP = 'INSERT' THEN
    IF NOT v_enabled AND (NEW.foreign_unit_price IS NOT NULL OR NEW.foreign_line_total IS NOT NULL) THEN
      RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: cannot write purchase_items FX metadata while Multi Currency is OFF'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  v_fx_changed :=
    NEW.foreign_unit_price IS DISTINCT FROM OLD.foreign_unit_price
    OR NEW.foreign_line_total IS DISTINCT FROM OLD.foreign_line_total;

  IF NOT v_enabled AND v_fx_changed THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: cannot introduce or alter purchase_items FX metadata while Multi Currency is OFF'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_items_import_fx_write_guard ON public.purchase_items;
CREATE TRIGGER trg_purchase_items_import_fx_write_guard
  BEFORE INSERT OR UPDATE ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public._guard_purchase_items_import_fx_write();

CREATE OR REPLACE FUNCTION public._guard_payments_import_fx_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled boolean;
  v_new_currency text;
  v_fx_changed boolean;
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_enabled := public._company_import_fx_enabled(NEW.company_id);
  v_new_currency := public._normalize_import_fx_currency(NEW.document_currency);

  IF TG_OP = 'INSERT' THEN
    IF NOT v_enabled THEN
      IF (
        (v_new_currency <> '' AND v_new_currency <> 'PKR')
        OR NEW.foreign_amount IS NOT NULL
        OR NEW.fx_rate IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: cannot write payment FX metadata while Multi Currency is OFF'
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END IF;

    IF v_new_currency <> '' THEN
      NEW.document_currency := v_new_currency;
      IF NOT public._company_import_fx_currency_allowed(NEW.company_id, v_new_currency) THEN
        RAISE EXCEPTION 'IMPORT_FX_CURRENCY_NOT_ACTIVE: % is not allowed for this company', v_new_currency
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  v_fx_changed :=
    public._normalize_import_fx_currency(NEW.document_currency)
      IS DISTINCT FROM public._normalize_import_fx_currency(OLD.document_currency)
    OR NEW.foreign_amount IS DISTINCT FROM OLD.foreign_amount
    OR NEW.fx_rate IS DISTINCT FROM OLD.fx_rate;

  IF NOT v_enabled THEN
    IF v_fx_changed THEN
      RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: cannot introduce or alter payment FX metadata while Multi Currency is OFF'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF v_new_currency <> '' THEN
    NEW.document_currency := v_new_currency;
    IF NOT public._company_import_fx_currency_allowed(NEW.company_id, v_new_currency) THEN
      RAISE EXCEPTION 'IMPORT_FX_CURRENCY_NOT_ACTIVE: % is not allowed for this company', v_new_currency
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_import_fx_write_guard ON public.payments;
CREATE TRIGGER trg_payments_import_fx_write_guard
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public._guard_payments_import_fx_write();

-- Direct table writes to Path 21 credit rows (bypass RPC) also require module ON.
CREATE OR REPLACE FUNCTION public._guard_fx_currency_purchases_import_fx_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_currency text;
BEGIN
  IF NOT public._company_import_fx_enabled(NEW.company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: cannot write fx_currency_purchases while Multi Currency is OFF'
      USING ERRCODE = 'check_violation';
  END IF;

  v_currency := public._normalize_import_fx_currency(NEW.document_currency);
  NEW.document_currency := v_currency;
  IF v_currency = '' OR v_currency = 'PKR' OR NOT public._company_import_fx_currency_allowed(NEW.company_id, v_currency) THEN
    RAISE EXCEPTION 'IMPORT_FX_CURRENCY_NOT_ACTIVE: % is not allowed for FX credit purchase', COALESCE(v_currency, '')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fx_currency_purchases_import_fx_write_guard ON public.fx_currency_purchases;
CREATE TRIGGER trg_fx_currency_purchases_import_fx_write_guard
  BEFORE INSERT OR UPDATE OF document_currency, foreign_amount, fx_rate_to_base, amount_pkr, status, agent_contact_id, wallet_account_id
  ON public.fx_currency_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public._guard_fx_currency_purchases_import_fx_write();

CREATE OR REPLACE FUNCTION public._guard_fx_currency_purchase_settlements_import_fx_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public._company_import_fx_enabled(NEW.company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: cannot write fx_currency_purchase_settlements while Multi Currency is OFF'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fx_currency_purchase_settlements_import_fx_write_guard
  ON public.fx_currency_purchase_settlements;
CREATE TRIGGER trg_fx_currency_purchase_settlements_import_fx_write_guard
  BEFORE INSERT OR UPDATE ON public.fx_currency_purchase_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public._guard_fx_currency_purchase_settlements_import_fx_write();
