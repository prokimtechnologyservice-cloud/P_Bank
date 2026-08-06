/*
# Add activity logging to transfer function
*/

CREATE OR REPLACE FUNCTION public.transfer(p_to_account_number text, p_amount numeric, p_memo text DEFAULT '')
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

  -- Log activity
  INSERT INTO activity_logs (event_type, actor_id, target_account_number, details)
  VALUES (
    'transfer',
    auth.uid(),
    p_to_account_number,
    jsonb_build_object('amount', p_amount, 'memo', p_memo, 'slip_code', v_slip_code, 'from_account', v_caller_account.account_number)
  );

  RETURN v_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer(text, numeric, text) TO anon, authenticated;
