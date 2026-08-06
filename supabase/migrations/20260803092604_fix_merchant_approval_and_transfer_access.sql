/*
# Fix merchant approval + ensure transfer/lookup access

## Bug 1: settle_merchant() crashes with unique constraint violation
The function tried to INSERT a new account for the merchant's user, but
accounts.user_id has a UNIQUE constraint (one account per user). The
merchant already has a personal account, so the INSERT fails.

Fix: Use the merchant's EXISTING personal account as the settlement account.
No need to create a separate one — funds will settle into their personal account.

## Bug 2: Ensure transfer() and lookup_account() are callable
These were revoked from anon in a previous migration, but PUBLIC still grants
access. Make it explicit by granting to anon directly so there's no ambiguity.
*/

-- ========== Fix settle_merchant ==========
CREATE OR REPLACE FUNCTION public.settle_merchant(p_merchant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant merchants%ROWTYPE;
  v_account_id uuid;
BEGIN
  SELECT * INTO v_merchant FROM merchants WHERE id = p_merchant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบร้านค้า';
  END IF;

  IF v_merchant.settlement_account_id IS NOT NULL THEN
    -- already has a settlement account, just activate
    UPDATE merchants SET status = 'active' WHERE id = p_merchant_id;
    RETURN v_merchant.settlement_account_id;
  END IF;

  -- Use the merchant's existing personal account as the settlement account
  SELECT id INTO v_account_id FROM accounts WHERE user_id = v_merchant.user_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชีของเจ้าของร้านค้า';
  END IF;

  UPDATE merchants SET status = 'active', settlement_account_id = v_account_id WHERE id = p_merchant_id;

  RETURN v_account_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_merchant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.settle_merchant(uuid) TO anon, authenticated;

-- ========== Ensure transfer + lookup_account are explicitly callable ==========
GRANT EXECUTE ON FUNCTION public.transfer(text, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_account(text) TO anon, authenticated;
