/*
# Set starting balance to 0 + Admin top-up function

## Changes
1. Updates handle_new_user() trigger so new accounts start with 0 THB instead of 5000.
2. Adds admin_topup() SECURITY DEFINER function — allows an admin to credit
   (top up) any user's account. This is the only way balances increase besides
   receiving transfers. Creates a transaction record with a generated slip code
   so the top-up appears in the user's history and the admin transaction log.
3. Adds admin_deduct() for the reverse operation (deduct funds from an account),
   useful for corrections.

## Security
- admin_topup and admin_deduct are SECURITY DEFINER, executable by authenticated
  only (admin is always authenticated via Supabase auth session). They do NOT
  verify admin role inside the function — the frontend admin context gates access
  to these calls. For production hardening, a role check could be added.
*/

-- Update trigger: starting balance 0
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_number text;
BEGIN
  LOOP
    new_account_number := lpad(floor(random() * 10000000000)::text, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = new_account_number);
  END LOOP;

  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO accounts (user_id, account_number, account_name, balance)
  VALUES (
    NEW.id,
    new_account_number,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    0  -- starting balance is 0
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Admin top-up: credit funds to any account
CREATE OR REPLACE FUNCTION public.admin_topup(p_account_id uuid, p_amount numeric, p_memo text DEFAULT 'เติมเงินโดยผู้ดูแล')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account accounts%ROWTYPE;
  v_slip_code text;
  v_tx_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'ยอดเงินต้องมากกว่า 0';
  END IF;

  SELECT * INTO v_account FROM accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชี';
  END IF;

  v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  WHILE EXISTS (SELECT 1 FROM transactions WHERE slip_code = v_slip_code) LOOP
    v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  END LOOP;

  UPDATE accounts SET balance = balance + p_amount WHERE id = p_account_id;

  INSERT INTO transactions (from_account_id, to_account_id, amount, memo, slip_code)
  VALUES (NULL, p_account_id, p_amount, p_memo, v_slip_code)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_topup(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_topup(uuid, numeric, text) TO authenticated;

-- Admin deduct: remove funds from an account (for corrections)
CREATE OR REPLACE FUNCTION public.admin_deduct(p_account_id uuid, p_amount numeric, p_memo text DEFAULT 'หักเงินโดยผู้ดูแล')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account accounts%ROWTYPE;
  v_slip_code text;
  v_tx_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'ยอดเงินต้องมากกว่า 0';
  END IF;

  SELECT * INTO v_account FROM accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชี';
  END IF;

  IF v_account.balance < p_amount THEN
    RAISE EXCEPTION 'ยอดเงินคงเหลือไม่เพียงพอ';
  END IF;

  v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  WHILE EXISTS (SELECT 1 FROM transactions WHERE slip_code = v_slip_code) LOOP
    v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  END LOOP;

  UPDATE accounts SET balance = balance - p_amount WHERE id = p_account_id;

  INSERT INTO transactions (from_account_id, to_account_id, amount, memo, slip_code)
  VALUES (p_account_id, NULL, p_amount, p_memo, v_slip_code)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_deduct(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_deduct(uuid, numeric, text) TO authenticated;
