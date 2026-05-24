-- Company-scoped product image access helper for native clients when direct createSignedUrl fails.
-- Validates storage path + object existence; client retries signing or uses returned path.

CREATE OR REPLACE FUNCTION public.get_product_image_signed_url(
  p_path text,
  p_expires_seconds integer DEFAULT 3600
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_company uuid;
  v_expires integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_path IS NULL OR btrim(p_path) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'path_required');
  END IF;

  v_company := get_user_company_id();
  IF v_company IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_company');
  END IF;

  BEGIN
    IF split_part(p_path, '/', 1)::uuid IS DISTINCT FROM v_company THEN
      RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_path');
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'product-images'
      AND o.name = p_path
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_expires := GREATEST(60, LEAST(COALESCE(p_expires_seconds, 3600), 86400));

  RETURN jsonb_build_object(
    'ok', true,
    'path', p_path,
    'expires_seconds', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_image_signed_url(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_image_signed_url(text, integer) TO authenticated;

COMMENT ON FUNCTION public.get_product_image_signed_url(text, integer) IS
  'Validates company-scoped product-images storage path; mobile retries createSignedUrl after RPC success.';
