/*
# Banking App Schema

1. New Tables
- `profiles` — extended user info (Thai name, display name, avatar) linked to auth.users
  - id (uuid, PK, = auth.users.id)
  - full_name (text, Thai display name)
  - created_at (timestamptz)
- `accounts` — one bank account per user
  - id (uuid, PK)
  - user_id (uuid, FK auth.users, unique — one account per user)
  - account_number (text, unique — 10-digit Thai-style account number)
  - account_name (text, display name on the account)
  - balance (numeric(15,2), default 0)
  - created_at (timestamptz)
- `transactions` — ledger of all transfers (sent + received)
  - id (uuid, PK)
  - from_account_id (uuid, FK accounts, nullable for external deposits)
  - to_account_id (uuid, FK accounts, nullable for external withdrawals)
  - amount (numeric(15,2), > 0)
  - memo (text, optional note)
  - slip_code (text, unique reference code shown on the slip)
  - created_at (timestamptz)

2. Security
- Enable RLS on all tables.
- profiles: owner-scoped CRUD (authenticated).
- accounts: owner can SELECT their own account; INSERT only via trigger (auto-created on signup); UPDATE restricted so users cannot directly change balance — only the transfer function can.
- transactions: a user can SELECT rows where they are the sender OR receiver; no direct INSERT/UPDATE/DELETE from the client — all writes go through the transfer() SECURITY DEFINER function.

3. Important Notes
- A trigger auto-creates a profile + account with a unique 10-digit account number and a welcome bonus of 5,000 THB whenever a new auth user signs up.
- The transfer() SECURITY DEFINER function performs an atomic transfer: it locks both accounts, checks sufficient funds, moves the money, and inserts a transaction row with a generated slip code. It is the ONLY way balances change.
- Balances are never updated directly by the client; RLS prevents it.
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- accounts ----------
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number text NOT NULL UNIQUE,
  account_name text NOT NULL DEFAULT '',
  balance numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Owner can read their own account
DROP POLICY IF EXISTS "select_own_account" ON accounts;
CREATE POLICY "select_own_account" ON accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE from the client: accounts are created by trigger,
-- balances are changed only by the transfer() SECURITY DEFINER function.
-- We intentionally do NOT add insert/update/delete policies here.

-- ---------- transactions ----------
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  memo text NOT NULL DEFAULT '',
  slip_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- A user can see transactions where they are the sender or receiver
DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions
  FOR SELECT TO authenticated USING (
    from_account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())
    OR to_account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())
  );

-- No direct INSERT/UPDATE/DELETE: all writes via transfer() SECURITY DEFINER function.

-- ---------- index for history queries ----------
CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON transactions(from_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account_id, created_at DESC);

-- ---------- auto-create profile + account on signup ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_number text;
BEGIN
  -- generate a unique 10-digit account number
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
    5000.00  -- welcome bonus
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- transfer function (atomic, privileged) ----------
CREATE OR REPLACE FUNCTION public.transfer(
  p_to_account_number text,
  p_amount numeric,
  p_memo text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- caller's account
  SELECT * INTO v_caller_account FROM accounts WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชีของคุณ';
  END IF;

  -- cannot transfer to self
  IF v_caller_account.account_number = p_to_account_number THEN
    RAISE EXCEPTION 'ไม่สามารถโอนเงินให้ตัวเองได้';
  END IF;

  -- target account
  SELECT * INTO v_target_account FROM accounts WHERE account_number = p_to_account_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบบัญชีปลายทาง';
  END IF;

  -- lock both accounts in deterministic order to avoid deadlock
  IF v_caller_account.id < v_target_account.id THEN
    SELECT * INTO v_caller_account FROM accounts WHERE id = v_caller_account.id FOR UPDATE;
    SELECT * INTO v_target_account FROM accounts WHERE id = v_target_account.id FOR UPDATE;
  ELSE
    SELECT * INTO v_target_account FROM accounts WHERE id = v_target_account.id FOR UPDATE;
    SELECT * INTO v_caller_account FROM accounts WHERE id = v_caller_account.id FOR UPDATE;
  END IF;

  -- sufficient funds
  IF v_caller_account.balance < p_amount THEN
    RAISE EXCEPTION 'ยอดเงินคงเหลือไม่เพียงพอ';
  END IF;

  -- generate unique slip code (e.g. TX240101-AB12CD)
  v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  WHILE EXISTS (SELECT 1 FROM transactions WHERE slip_code = v_slip_code) LOOP
    v_slip_code := 'TX' || to_char(now(), 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
  END LOOP;

  -- move money
  UPDATE accounts SET balance = balance - p_amount WHERE id = v_caller_account.id;
  UPDATE accounts SET balance = balance + p_amount WHERE id = v_target_account.id;

  -- record transaction
  INSERT INTO transactions (from_account_id, to_account_id, amount, memo, slip_code)
  VALUES (v_caller_account.id, v_target_account.id, p_amount, p_memo, v_slip_code)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- Allow authenticated users to call transfer()
GRANT EXECUTE ON FUNCTION public.transfer(text, numeric, text) TO authenticated;

-- ---------- helper: look up account by number (for transfer target preview) ----------
-- Returns account_name only, never balance.
CREATE OR REPLACE FUNCTION public.lookup_account(p_account_number text)
RETURNS TABLE (account_number text, account_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT a.account_number, a.account_name
  INTO account_number, account_name
  FROM accounts a
  WHERE a.account_number = p_account_number;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_account(text) TO authenticated;
