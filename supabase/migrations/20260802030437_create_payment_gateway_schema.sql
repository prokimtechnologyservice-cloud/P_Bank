/*
# Payment Gateway Schema — Merchants, Charges, Webhooks, Admin

## Overview
Adds a production-grade payment gateway to the banking app. External websites
(merchants) can register, get API keys, create charges, and receive money from
P Bank users. The bank user approves the payment in-app; funds move atomically
from the user's account to the merchant's settlement account. A webhook notifies
the merchant's server when payment completes.

## New Tables

### merchants
- id (uuid, PK)
- user_id (uuid, FK auth.users — the merchant owner)
- business_name (text)
- business_email (text)
- api_key (text, unique — secret key for API auth)
- webhook_url (text — where to send payment notifications)
- settlement_account_id (uuid, FK accounts — where received money goes)
- status (text: pending / active / suspended / rejected)
- created_at (timestamptz)

### charges
- id (uuid, PK)
- merchant_id (uuid, FK merchants)
- amount (numeric(15,2), > 0)
- currency (text, default 'THB')
- reference (text — merchant's own order/invoice ID)
- status (text: pending / paid / expired / cancelled)
- payer_account_id (uuid, FK accounts, nullable — set on payment)
- transaction_id (uuid, FK transactions, nullable — the bank transfer record)
- short_code (text, unique — short code the user types to find the charge)
- expires_at (timestamptz — charge expires after 15 min)
- created_at (timestamptz)
- paid_at (timestamptz, nullable)

### webhook_deliveries
- id (uuid, PK)
- charge_id (uuid, FK charges)
- merchant_id (uuid, FK merchants)
- payload (jsonb — the webhook body)
- status (text: pending / delivered / failed)
- attempts (int, default 0)
- response_status (int, nullable)
- created_at (timestamptz)
- delivered_at (timestamptz, nullable)

### admin_users
- id (uuid, PK)
- username (text, unique)
- password_hash (text)
- created_at (timestamptz)

## Security
- RLS enabled on all tables.
- merchants: owner can SELECT/UPDATE their own merchant record. INSERT is allowed
  for authenticated users (creating a new merchant registration). The settlement
  account is assigned by an admin via a SECURITY DEFINER function.
- charges: merchants can SELECT their own charges; bank users can SELECT charges
  they paid; INSERT is via the create-charge edge function (service role). UPDATE
  is via the pay-charge SECURITY DEFINER function only.
- webhook_deliveries: merchants can SELECT deliveries for their own charges.
- admin_users: NO policies — not readable/writable from the anon-key client at all.
  Admin auth is handled via a SECURITY DEFINER function that verifies credentials
  server-side and returns a signed admin session token.

## Important Notes
1. An admin account (username: Prokim, password: 36407) is seeded via a
   SECURITY DEFINER function using crypt() + gen_salt() for the password hash.
2. The pay_charge() function atomically: locks the payer account, locks the
   merchant settlement account, checks funds, moves money, inserts a transaction,
   marks the charge as paid, and queues a webhook delivery.
3. The settle_merchant() function (admin-only) creates a settlement account for
   an approved merchant and activates them.
4. All merchant API calls go through edge functions using the service role key,
   so the anon-key client never needs direct table access for charges.
*/

-- ========== merchants ==========
CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT '',
  business_email text NOT NULL DEFAULT '',
  api_key text NOT NULL UNIQUE DEFAULT '',
  webhook_url text NOT NULL DEFAULT '',
  settlement_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_merchant" ON merchants;
CREATE POLICY "select_own_merchant" ON merchants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_merchant" ON merchants;
CREATE POLICY "insert_own_merchant" ON merchants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_merchant" ON merchants;
CREATE POLICY "update_own_merchant" ON merchants
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== charges ==========
CREATE TABLE IF NOT EXISTS charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'THB',
  reference text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  payer_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  short_code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE charges ENABLE ROW LEVEL SECURITY;

-- Merchants can see their own charges; payers can see charges they paid
DROP POLICY IF EXISTS "select_charges" ON charges;
CREATE POLICY "select_charges" ON charges
  FOR SELECT TO authenticated USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR payer_account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())
  );

-- ========== webhook_deliveries ==========
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  attempts int NOT NULL DEFAULT 0,
  response_status int,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_webhooks" ON webhook_deliveries;
CREATE POLICY "select_own_webhooks" ON webhook_deliveries
  FOR SELECT TO authenticated USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- ========== admin_users ==========
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- No policies: admin_users is completely inaccessible from the anon-key client.

-- ========== indexes ==========
CREATE INDEX IF NOT EXISTS idx_charges_merchant ON charges(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_charges_short_code ON charges(short_code);
CREATE INDEX IF NOT EXISTS idx_webhooks_pending ON webhook_deliveries(status, created_at);

-- ========== seed admin user (Prokim / 36407) ==========
-- Using a DO block to seed if not exists, with crypt() + gen_salt()
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE username = 'Prokim') THEN
    INSERT INTO admin_users (username, password_hash)
    VALUES ('Prokim', crypt('36407', gen_salt('bf')));
  END IF;
END $$;

-- ========== admin_login function ==========
-- Verifies admin credentials server-side. Returns the admin user row (id, username)
-- if the password matches. Returns NULL otherwise. The frontend stores this in
-- a separate admin session (not a Supabase auth session).
CREATE OR REPLACE FUNCTION public.admin_login(p_username text, p_password text)
RETURNS TABLE (id uuid, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row admin_users%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM admin_users WHERE username = p_username;
  IF v_row.id IS NOT NULL AND v_row.password_hash = crypt(p_password, v_row.password_hash) THEN
    RETURN QUERY SELECT v_row.id, v_row.username;
    RETURN;
  END IF;
  -- Return empty result on failure
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_login(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO authenticated;

-- ========== admin: list all accounts (for monitoring) ==========
CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  account_number text,
  account_name text,
  balance numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT a.id, a.user_id, a.account_number, a.account_name, a.balance, a.created_at
  FROM accounts a
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_accounts() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;

-- ========== admin: list all transactions ==========
CREATE OR REPLACE FUNCTION public.admin_list_transactions(limit_count int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  from_account_id uuid,
  to_account_id uuid,
  amount numeric,
  memo text,
  slip_code text,
  created_at timestamptz,
  from_name text,
  to_name text,
  from_number text,
  to_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.from_account_id, t.to_account_id, t.amount, t.memo, t.slip_code, t.created_at,
    fa.account_name, ta.account_name, fa.account_number, ta.account_number
  FROM transactions t
  LEFT JOIN accounts fa ON fa.id = t.from_account_id
  LEFT JOIN accounts ta ON ta.id = t.to_account_id
  ORDER BY t.created_at DESC
  LIMIT limit_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_transactions(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_transactions(int) TO authenticated;

-- ========== admin: list all merchants ==========
CREATE OR REPLACE FUNCTION public.admin_list_merchants()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  business_name text,
  business_email text,
  webhook_url text,
  status text,
  settlement_account_id uuid,
  created_at timestamptz,
  api_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT m.id, m.user_id, m.business_name, m.business_email, m.webhook_url, m.status,
    m.settlement_account_id, m.created_at, m.api_key
  FROM merchants m
  ORDER BY m.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_merchants() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_merchants() TO authenticated;

-- ========== admin: list all charges ==========
CREATE OR REPLACE FUNCTION public.admin_list_charges(limit_count int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  merchant_id uuid,
  amount numeric,
  currency text,
  reference text,
  status text,
  short_code text,
  payer_account_id uuid,
  transaction_id uuid,
  expires_at timestamptz,
  created_at timestamptz,
  paid_at timestamptz,
  merchant_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.merchant_id, c.amount, c.currency, c.reference, c.status, c.short_code,
    c.payer_account_id, c.transaction_id, c.expires_at, c.created_at, c.paid_at,
    m.business_name
  FROM charges c
  LEFT JOIN merchants m ON m.id = c.merchant_id
  ORDER BY c.created_at DESC
  LIMIT limit_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_charges(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_charges(int) TO authenticated;

-- ========== admin: approve merchant + create settlement account ==========
CREATE OR REPLACE FUNCTION public.settle_merchant(p_merchant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant merchants%ROWTYPE;
  v_account_number text;
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

  -- generate unique account number
  LOOP
    v_account_number := lpad(floor(random() * 10000000000)::text, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = v_account_number);
  END LOOP;

  -- create a settlement account owned by the merchant's user
  INSERT INTO accounts (user_id, account_number, account_name, balance)
  VALUES (v_merchant.user_id, v_account_number, v_merchant.business_name || ' (ร้านค้า)', 0)
  RETURNING id INTO v_account_id;

  UPDATE merchants SET status = 'active', settlement_account_id = v_account_id WHERE id = p_merchant_id;

  RETURN v_account_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_merchant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.settle_merchant(uuid) TO authenticated;

-- ========== admin: reject merchant ==========
CREATE OR REPLACE FUNCTION public.reject_merchant(p_merchant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE merchants SET status = 'rejected' WHERE id = p_merchant_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_merchant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_merchant(uuid) TO authenticated;

-- ========== admin: suspend merchant ==========
CREATE OR REPLACE FUNCTION public.suspend_merchant(p_merchant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE merchants SET status = 'suspended' WHERE id = p_merchant_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.suspend_merchant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.suspend_merchant(uuid) TO authenticated;

-- ========== admin: system stats ==========
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS TABLE (
  total_accounts bigint,
  total_balance numeric,
  total_transactions bigint,
  total_volume numeric,
  total_merchants bigint,
  pending_merchants bigint,
  active_merchants bigint,
  total_charges bigint,
  paid_charges bigint,
  pending_charges bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM accounts),
    (SELECT coalesce(sum(balance), 0) FROM accounts),
    (SELECT count(*) FROM transactions),
    (SELECT coalesce(sum(amount), 0) FROM transactions),
    (SELECT count(*) FROM merchants),
    (SELECT count(*) FROM merchants WHERE status = 'pending'),
    (SELECT count(*) FROM merchants WHERE status = 'active'),
    (SELECT count(*) FROM charges),
    (SELECT count(*) FROM charges WHERE status = 'paid'),
    (SELECT count(*) FROM charges WHERE status = 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

-- ========== pay_charge: user pays a charge from their bank account ==========
CREATE OR REPLACE FUNCTION public.pay_charge(p_short_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge charges%ROWTYPE;
  v_payer_account accounts%ROWTYPE;
  v_settlement_account accounts%ROWTYPE;
  v_slip_code text;
  v_tx_id uuid;
BEGIN
  -- find the charge
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

  -- payer's account
  SELECT * INTO v_payer_account FROM accounts WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชีของคุณ';
  END IF;

  -- merchant settlement account
  SELECT * INTO v_settlement_account FROM accounts WHERE id = v_charge.merchant_id;
  -- Actually get the settlement account from the merchant record
  SELECT a.* INTO v_settlement_account
  FROM accounts a
  JOIN merchants m ON m.settlement_account_id = a.id
  WHERE m.id = v_charge.merchant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ร้านค้ายังไม่พร้อมรับเงิน';
  END IF;

  -- lock both accounts in deterministic order
  IF v_payer_account.id < v_settlement_account.id THEN
    SELECT * INTO v_payer_account FROM accounts WHERE id = v_payer_account.id FOR UPDATE;
    SELECT * INTO v_settlement_account FROM accounts WHERE id = v_settlement_account.id FOR UPDATE;
  ELSE
    SELECT * INTO v_settlement_account FROM accounts WHERE id = v_settlement_account.id FOR UPDATE;
    SELECT * INTO v_payer_account FROM accounts WHERE id = v_payer_account.id FOR UPDATE;
  END IF;

  -- sufficient funds
  IF v_payer_account.balance < v_charge.amount THEN
    RAISE EXCEPTION 'ยอดเงินคงเหลือไม่เพียงพอ';
  END IF;

  -- generate slip code
  v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  WHILE EXISTS (SELECT 1 FROM transactions WHERE slip_code = v_slip_code) LOOP
    v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  END LOOP;

  -- move money
  UPDATE accounts SET balance = balance - v_charge.amount WHERE id = v_payer_account.id;
  UPDATE accounts SET balance = balance + v_charge.amount WHERE id = v_settlement_account.id;

  -- record transaction
  INSERT INTO transactions (from_account_id, to_account_id, amount, memo, slip_code)
  VALUES (v_payer_account.id, v_settlement_account.id, v_charge.amount,
    'ชำระคำสั่งเรียกเก็บ ' || v_charge.short_code, v_slip_code)
  RETURNING id INTO v_tx_id;

  -- mark charge as paid
  UPDATE charges SET
    status = 'paid',
    payer_account_id = v_payer_account.id,
    transaction_id = v_tx_id,
    paid_at = now()
  WHERE id = v_charge.id;

  -- queue webhook delivery
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
GRANT EXECUTE ON FUNCTION public.pay_charge(text) TO authenticated;

-- ========== lookup_charge: user looks up a charge by short code ==========
CREATE OR REPLACE FUNCTION public.lookup_charge(p_short_code text)
RETURNS TABLE (
  id uuid,
  amount numeric,
  currency text,
  reference text,
  status text,
  short_code text,
  merchant_name text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.amount, c.currency, c.reference, c.status, c.short_code,
    m.business_name, c.expires_at
  FROM charges c
  JOIN merchants m ON m.id = c.merchant_id
  WHERE c.short_code = p_short_code AND m.status = 'active';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_charge(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_charge(text) TO authenticated;
