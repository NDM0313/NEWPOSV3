-- Allow authenticated users to call create_business_transaction (e.g. after signUp).
-- App must pass auth.uid() as p_user_id so the new user creates their own business.
GRANT EXECUTE ON FUNCTION create_business_transaction(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
