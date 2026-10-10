-- Log sale attachment add/remove in activity_logs when sales.attachments changes.
-- Covers mobile appendSaleAttachments, web upload, and any future client.

CREATE OR REPLACE FUNCTION public.log_sale_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_no VARCHAR(100);
  v_old_count INT;
  v_new_count INT;
  v_added_names TEXT;
  v_added_json JSONB;
  v_removed_count INT;
BEGIN
  v_invoice_no := COALESCE(NEW.invoice_no, OLD.invoice_no, 'N/A');

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      NEW.company_id,
      'sale',
      NEW.id,
      v_invoice_no,
      'create',
      NULL,
      NULL,
      row_to_json(NEW)::JSONB,
      NULL,
      NULL,
      NULL,
      NEW.created_by,
      'Sale Invoice Created',
      NULL
    );

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.log_activity(
        NEW.company_id,
        'sale',
        NEW.id,
        v_invoice_no,
        'status_change',
        'status',
        to_jsonb(OLD.status),
        to_jsonb(NEW.status),
        NULL,
        NULL,
        NULL,
        auth.uid(),
        format('Status changed from %s to %s', OLD.status, NEW.status),
        NULL
      );
    END IF;

    IF OLD.attachments IS DISTINCT FROM NEW.attachments THEN
      v_old_count := COALESCE(jsonb_array_length(OLD.attachments), 0);
      v_new_count := COALESCE(jsonb_array_length(NEW.attachments), 0);

      IF v_new_count > v_old_count THEN
        SELECT
          COALESCE(string_agg(COALESCE(added.elem->>'name', 'Attachment'), ', ' ORDER BY added.ord), ''),
          COALESCE(jsonb_agg(added.elem ORDER BY added.ord), '[]'::jsonb)
        INTO v_added_names, v_added_json
        FROM (
          SELECT ne.elem, ne.ord
          FROM jsonb_array_elements(COALESCE(NEW.attachments, '[]'::jsonb)) WITH ORDINALITY AS ne(elem, ord)
          WHERE NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(OLD.attachments, '[]'::jsonb)) AS oe(elem)
            WHERE COALESCE(oe.elem->>'url', '') = COALESCE(ne.elem->>'url', '')
          )
        ) AS added;

        PERFORM public.log_activity(
          NEW.company_id,
          'sale',
          NEW.id,
          v_invoice_no,
          'attachment_added',
          'attachments',
          COALESCE(OLD.attachments, '[]'::jsonb),
          v_added_json,
          NULL,
          NULL,
          NULL,
          auth.uid(),
          format(
            'Added %s attachment(s) to sale %s%s',
            GREATEST(v_new_count - v_old_count, 1),
            v_invoice_no,
            CASE WHEN v_added_names <> '' THEN ': ' || v_added_names ELSE '' END
          ),
          NULL
        );
      ELSIF v_new_count < v_old_count THEN
        v_removed_count := v_old_count - v_new_count;
        PERFORM public.log_activity(
          NEW.company_id,
          'sale',
          NEW.id,
          v_invoice_no,
          'attachment_removed',
          'attachments',
          COALESCE(OLD.attachments, '[]'::jsonb),
          COALESCE(NEW.attachments, '[]'::jsonb),
          NULL,
          NULL,
          NULL,
          auth.uid(),
          format('Removed %s attachment(s) from sale %s', v_removed_count, v_invoice_no),
          NULL
        );
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity(
      OLD.company_id,
      'sale',
      OLD.id,
      v_invoice_no,
      'delete',
      NULL,
      row_to_json(OLD)::JSONB,
      NULL,
      NULL,
      NULL,
      NULL,
      auth.uid(),
      'Sale Invoice Deleted',
      NULL
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.log_sale_activity() IS
  'Auto-log sale create/status/attachment/delete to activity_logs.';

DROP TRIGGER IF EXISTS trigger_log_sale_activity ON public.sales;
CREATE TRIGGER trigger_log_sale_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sale_activity();

NOTIFY pgrst, 'reload schema';
