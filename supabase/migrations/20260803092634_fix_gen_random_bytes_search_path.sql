/*
# Fix gen_random_bytes not found

pgcrypto is installed in the `extensions` schema, not `public`.
All SECURITY DEFINER functions that call gen_random_bytes() have
`SET search_path = public`, so they can't find gen_random_bytes().

Fix: Add `extensions` to the search_path of all affected functions so
gen_random_bytes() resolves. Functions affected:
- transfer()
- admin_topup()
- admin_deduct()
- pay_charge()
*/

CREATE OR REPLACE FUNCTION public.transfer(
  p_to_account_number text,
  p_amount numeric,
  p_memo text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_account accounts%ROWTYPE;
  v_target_account accounts%ROWTYPE;
  v_slip_code text;
  v_tx_id uuid;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'ยอดเงินต้องมากกว่า 0';
  END IF;

  SELECT * INTO v_caller_account FROM accounts WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชีของคุณ';
  END IF;

  IF v_caller_account.account_number = p_to_account_number THEN
    RAISE EXCEPTION 'ไม่สามารถโอนเงินให้ตัวเองได้';
  END IF;

  SELECT * INTO v_target_account FROM accounts WHERE account_number = p_to_account_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชีปลายทาง';
  END IF;

  IF v_caller_account.id < v_target_account.id THEN
    SELECT * INTO v_caller_account FROM accounts WHERE id = v_caller_account.id FOR UPDATE;
    SELECT * INTO v_target_account FROM accounts WHERE id = v_target_account.id FOR UPDATE;
  ELSE
    SELECT * INTO v_target_account FROM accounts WHERE id = v_target_account.id FOR UPDATE;
    SELECT * INTO v_caller_account FROM accounts WHERE id = v_caller_account.id FOR UPDATE;
  END IF;

  IF v_caller_account.balance < p_amount THEN
    RAISE EXCEPTION 'ยอดเงินคงเหลือไม่เพียงพอ';
  END IF;

  v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  WHILE EXISTS (SELECT 1 FROM transactions WHERE slip_code = v_slip_code) LOOP
    v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  END LOOP;

  UPDATE accounts SET balance = balance - p_amount WHERE id = v_caller_account.id;
  UPDATE accounts SET balance = balance + p_amount WHERE id = v_target_account.id;

  INSERT INTO transactions (from_account_id, to_account_id, amount, memo, slip_code)
  VALUES (v_caller_account.id, v_target_account.id, p_amount, p_memo, v_slip_code)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer(text, numeric, text) TO anon, authenticated;

-- ========== admin_topup ==========
CREATE OR REPLACE FUNCTION public.admin_topup(p_account_id uuid, p_amount numeric, p_memo text DEFAULT 'เติมเงินโดยผู้ดูแล')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
GRANT EXECUTE ON FUNCTION public.admin_topup(uuid, numeric, text) TO anon, authenticated;

-- ========== admin_deduct ==========
CREATE OR REPLACE FUNCTION public.admin_deduct(p_account_id uuid, p_amount numeric, p_memo text DEFAULT 'หักเงินโดยผู้ดูแล')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
GRANT EXECUTE ON FUNCTION public.admin_deduct(uuid, numeric, text) TO anon, authenticated;

-- ========== pay_charge ==========
CREATE OR REPLACE FUNCTION public.pay_charge(p_short_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_charge charges%ROWTYPE;
  v_payer_account accounts%ROWTYPE;
  v_settlement_account accounts%ROWTYPE;
  v_slip_code text;
  v_tx_id uuid;
BEGIN
  SELECT * INTO v_charge FROM charges WHERE short_code = p_short_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบคำสั่งเรียกเก็บเงิน';
  END IF;

  IF v_charge.status != 'pending' THEN
    RAISE EXCEPTION 'คำสั่งนี้ไม่อยู่ในสถานะรอชำระ';
  END IF;

  IF now() > v_charge.expires_at THEN
    UPDATE charges SET status = 'expired' WHERE id = v_charge.id;
    RAISE EXCEPTION 'คำสั่งหมดอายุแล้ว';
  END IF;

  SELECT * INTO v_payer_account FROM accounts WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชีของคุณ';
  END IF;

  SELECT a.* INTO v_settlement_account
  FROM accounts a
  JOIN merchants m ON m.settlement_account_id = a.id
  WHERE m.id = v_charge.merchant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ร้านค้ายังไม่พร้อมรับเงิน';
  END IF;

  IF v_payer_account.id < v_settlement_account.id THEN
    SELECT * INTO v_payer_account FROM accounts WHERE id = v_payer_account.id FOR UPDATE;
    SELECT * INTO v_settlement_account FROM accounts WHERE id = v_settlement_account.id FOR UPDATE;
  ELSE
    SELECT * INTO v_settlement_account FROM accounts WHERE id = v_settlement_account.id FOR UPDATE;
    SELECT * INTO v_payer_account FROM accounts WHERE id = v_payer_account.id FOR UPDATE;
  END IF;

  IF v_payer_account.balance < v_charge.amount THEN
    RAISE EXCEPTION 'ยอดเงินคงเหลือไม่เพียงพอ';
  END IF;

  v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  WHILE EXISTS (SELECT 1 FROM transactions WHERE slip_code = v_slip_code) LOOP
    v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  END LOOP;

  UPDATE accounts SET balance = balance - v_charge.amount WHERE id = v_payer_account.id;
  UPDATE accounts SET balance = balance + v_charge.amount WHERE id = v_settlement_account.id;

  INSERT INTO transactions (from_account_id, to_account_id, amount, memo, slip_code)
  VALUES (v_payer_account.id, v_settlement_account.id, v_charge.amount,
    'ชำระคำสั่งเรียกเก็บ ' || v_charge.short_code, v_slip_code)
  RETURNING id INTO v_tx_id;

  UPDATE charges SET
    status = 'paid',
    payer_account_id = v_payer_account.id,
    transaction_id = v_tx_id,
    paid_at = now()
  WHERE id = v_charge.id;

  INSERT INTO webhook_deliveries (charge_id, merchant_id, payload)
  VALUES (v_charge.id, v_charge.merchant_id, jsonb_build_object(
    'event', 'charge.paid',
    'charge_id', v_charge.id,
    'short_code', v_charge.short_code,
    'amount', v_charge.amount,
    'currency', v_charge.currency,
    'reference', v_charge.reference,
    'transaction_id', v_tx_id,
    'paid_at', now()
  ));

  RETURN v_tx_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_charge(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.pay_charge(text) TO anon, authenticated;
