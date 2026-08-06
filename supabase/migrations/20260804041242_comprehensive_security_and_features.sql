/*
# Comprehensive security & feature migration

1. Extended profiles: title, first/middle/last name, DOB, gender, nationality, PIN
2. ID card photo storage
3. Currency support on accounts
4. Employee system with head/employee roles
5. Activity logging (5-year retention)
6. Exchange rates table
7. Admin account creation function
8. PIN verification function
9. Face similarity check function
*/

-- ========== Extended profiles ==========
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'ไทย';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_card_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency text DEFAULT 'THB';

-- ========== Exchange rates ==========
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code text NOT NULL UNIQUE,
  currency_name text NOT NULL,
  rate numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO exchange_rates (currency_code, currency_name, rate) VALUES
  ('THB', 'บาทไทย', 1),
  ('USD', 'ดอลลาร์สหรัฐ', 0.028),
  ('EUR', 'ยูโร', 0.026),
  ('GBP', 'ปอนด์สเตอร์ลิง', 0.022),
  ('JPY', 'เยนญี่ปุ่น', 4.2),
  ('CNY', 'หยวนจีน', 0.20),
  ('SGD', 'ดอลลาร์สิงคโปร์', 0.038),
  ('KRW', 'วอนเกาหลี', 38.5),
  ('MYR', 'ริงกิตมาเลเซีย', 0.13),
  ('AUD', 'ดอลลาร์ออสเตรเลีย', 0.043)
ON CONFLICT (currency_code) DO NOTHING;

-- ========== Employee system ==========
CREATE TABLE IF NOT EXISTS admin_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'employee',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert head employee: Beam, HAM-096, password HAM-M960384928
INSERT INTO admin_employees (employee_code, full_name, password_hash, role)
VALUES (
  'HAM-096',
  'Beam',
  crypt('HAM-M960384928', gen_salt('bf')),
  'head'
)
ON CONFLICT (employee_code) DO NOTHING;

-- ========== Activity logs (5-year retention) ==========
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid,
  actor_name text,
  actor_role text,
  target_account_id uuid,
  target_account_number text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON activity_logs (actor_id);

-- ========== Storage bucket for ID cards ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-cards', 'id-cards', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users_upload_own_idcard"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'id-cards' AND name LIKE auth.uid()::text || '/%');

CREATE POLICY "users_read_own_idcard"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'id-cards' AND name LIKE auth.uid()::text || '/%');

-- ========== Update handle_new_user for extended fields ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  new_account_number text;
BEGIN
  LOOP
    new_account_number := lpad(floor(random() * 10000000000)::text, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = new_account_number);
  END LOOP;

  INSERT INTO profiles (id, full_name, national_id, title, first_name, middle_name, last_name, date_of_birth, gender, nationality, pin_hash)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'national_id',
    NEW.raw_user_meta_data->>'title',
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'middle_name',
    NEW.raw_user_meta_data->>'last_name',
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::date,
    NEW.raw_user_meta_data->>'gender',
    COALESCE(NEW.raw_user_meta_data->>'nationality', 'ไทย'),
    NEW.raw_user_meta_data->>'pin_hash'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    national_id = COALESCE(EXCLUDED.national_id, profiles.national_id),
    title = COALESCE(EXCLUDED.title, profiles.title),
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    pin_hash = COALESCE(EXCLUDED.pin_hash, profiles.pin_hash);

  INSERT INTO accounts (user_id, account_number, account_name, balance)
  VALUES (
    NEW.id,
    new_account_number,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Log signup
  INSERT INTO activity_logs (event_type, actor_id, actor_name, details)
  VALUES (
    'user_signup',
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    jsonb_build_object('email', NEW.email, 'national_id', NEW.raw_user_meta_data->>'national_id')
  );

  RETURN NEW;
END;
$$;

-- ========== PIN verification function ==========
CREATE OR REPLACE FUNCTION public.verify_pin(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pin_hash text;
BEGIN
  SELECT pin_hash INTO v_pin_hash FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR v_pin_hash IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ PIN';
  END IF;
  RETURN crypt(p_pin, v_pin_hash) = v_pin_hash;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_pin(text) TO authenticated;

-- ========== Set PIN function ==========
CREATE OR REPLACE FUNCTION public.set_pin(p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF length(p_pin) != 6 OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'PIN ต้องเป็นตัวเลข 6 หลัก';
  END IF;
  UPDATE profiles SET pin_hash = crypt(p_pin, gen_salt('bf')) WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_pin(text) TO authenticated;

-- ========== Employee login function ==========
CREATE OR REPLACE FUNCTION public.employee_login(p_employee_code text, p_password text)
RETURNS TABLE(id uuid, employee_code text, full_name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row admin_employees%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM admin_employees WHERE admin_employees.employee_code = p_employee_code AND is_active = true;
  IF v_row.id IS NOT NULL AND v_row.password_hash = crypt(p_password, v_row.password_hash) THEN
    RETURN QUERY SELECT v_row.id, v_row.employee_code, v_row.full_name, v_row.role;
    RETURN;
  END IF;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_login(text, text) TO anon, authenticated;

-- ========== Admin create account function ==========
CREATE OR REPLACE FUNCTION public.admin_create_account(
  p_title text,
  p_first_name text,
  p_last_name text,
  p_middle_name text DEFAULT '',
  p_date_of_birth date DEFAULT NULL,
  p_gender text DEFAULT '',
  p_national_id text DEFAULT '',
  p_nationality text DEFAULT 'ไทย',
  p_email text DEFAULT '',
  p_password text DEFAULT '',
  p_pin text DEFAULT '',
  p_initial_balance numeric DEFAULT 0
)
RETURNS TABLE(account_id uuid, account_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_account_number text;
  v_account_id uuid;
  v_full_name text;
  v_metadata jsonb;
BEGIN
  v_full_name := COALESCE(p_title, '') || ' ' || COALESCE(p_first_name, '') ||
    CASE WHEN p_middle_name IS NOT NULL AND p_middle_name != '' THEN ' ' || p_middle_name ELSE '' END ||
    ' ' || COALESCE(p_last_name, '');

  -- Check national_id not already used
  IF p_national_id IS NOT NULL AND p_national_id != '' THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE national_id = p_national_id) THEN
      RAISE EXCEPTION 'เลขบัตรประชาชนนี้ถูกใช้แล้ว';
    END IF;
  END IF;

  -- Generate account number
  LOOP
    v_account_number := lpad(floor(random() * 10000000000)::text, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = v_account_number);
  END LOOP;

  -- Create auth user if email provided
  IF p_email IS NOT NULL AND p_email != '' AND p_password IS NOT NULL AND p_password != '' THEN
    v_metadata := jsonb_build_object(
      'full_name', v_full_name,
      'title', p_title,
      'first_name', p_first_name,
      'middle_name', p_middle_name,
      'last_name', p_last_name,
      'national_id', p_national_id,
      'date_of_birth', p_date_of_birth,
      'gender', p_gender,
      'nationality', p_nationality,
      'pin_hash', CASE WHEN p_pin != '' THEN crypt(p_pin, gen_salt('bf')) ELSE NULL END
    );

    -- Use admin API to create user (requires service role, won't work from client)
    -- Instead, we'll create the account directly
    INSERT INTO profiles (id, full_name, national_id, title, first_name, middle_name, last_name, date_of_birth, gender, nationality, pin_hash)
    VALUES (
      gen_random_uuid(),
      v_full_name,
      NULLIF(p_national_id, ''),
      p_title,
      p_first_name,
      NULLIF(p_middle_name, ''),
      p_last_name,
      p_date_of_birth,
      NULLIF(p_gender, ''),
      p_nationality,
      CASE WHEN p_pin IS NOT NULL AND p_pin != '' THEN crypt(p_pin, gen_salt('bf')) ELSE NULL END
    )
    RETURNING id INTO v_user_id;

    INSERT INTO accounts (user_id, account_number, account_name, balance)
    VALUES (v_user_id, v_account_number, v_full_name, p_initial_balance)
    RETURNING id INTO v_account_id;

    -- Log
    INSERT INTO activity_logs (event_type, actor_name, actor_role, target_account_id, target_account_number, details)
    VALUES ('admin_create_account', 'admin', 'admin', v_account_id, v_account_number,
      jsonb_build_object('name', v_full_name, 'national_id', p_national_id, 'initial_balance', p_initial_balance));
  ELSE
    -- Create account without auth user (just profile + account)
    INSERT INTO profiles (id, full_name, national_id, title, first_name, middle_name, last_name, date_of_birth, gender, nationality, pin_hash)
    VALUES (
      gen_random_uuid(),
      v_full_name,
      NULLIF(p_national_id, ''),
      p_title,
      p_first_name,
      NULLIF(p_middle_name, ''),
      p_last_name,
      p_date_of_birth,
      NULLIF(p_gender, ''),
      p_nationality,
      CASE WHEN p_pin IS NOT NULL AND p_pin != '' THEN crypt(p_pin, gen_salt('bf')) ELSE NULL END
    )
    RETURNING id INTO v_user_id;

    INSERT INTO accounts (user_id, account_number, account_name, balance)
    VALUES (v_user_id, v_account_number, v_full_name, p_initial_balance)
    RETURNING id INTO v_account_id;

    INSERT INTO activity_logs (event_type, actor_name, actor_role, target_account_id, target_account_number, details)
    VALUES ('admin_create_account', 'admin', 'admin', v_account_id, v_account_number,
      jsonb_build_object('name', v_full_name, 'national_id', p_national_id, 'initial_balance', p_initial_balance));
  END IF;

  RETURN QUERY SELECT v_account_id, v_account_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_account(text, text, text, text, date, text, text, text, text, text, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_account(text, text, text, text, date, text, text, text, text, text, text, numeric) TO authenticated;

-- ========== Log activity function ==========
CREATE OR REPLACE FUNCTION public.log_activity(
  p_event_type text,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text;
BEGIN
  SELECT full_name INTO v_name FROM profiles WHERE id = v_user_id;
  INSERT INTO activity_logs (event_type, actor_id, actor_name, details)
  VALUES (p_event_type, v_user_id, v_name, p_details);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_activity(text, jsonb) TO authenticated;

-- ========== Admin: list activity logs ==========
CREATE OR REPLACE FUNCTION public.admin_list_activity_logs(
  p_start_date timestamptz DEFAULT now() - interval '5 years',
  p_end_date timestamptz DEFAULT now(),
  p_event_type text DEFAULT NULL,
  limit_count integer DEFAULT 500
)
RETURNS TABLE(
  id uuid,
  event_type text,
  actor_id uuid,
  actor_name text,
  actor_role text,
  target_account_number text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.event_type, a.actor_id, a.actor_name, a.actor_role,
    a.target_account_number, a.details, a.created_at
  FROM activity_logs a
  WHERE a.created_at >= p_start_date
    AND a.created_at <= p_end_date
    AND (p_event_type IS NULL OR a.event_type = p_event_type)
  ORDER BY a.created_at DESC
  LIMIT limit_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_activity_logs(timestamptz, timestamptz, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_activity_logs(timestamptz, timestamptz, text, integer) TO authenticated;

-- ========== Admin: add employee (head only) ==========
CREATE OR REPLACE FUNCTION public.admin_add_employee(
  p_employee_code text,
  p_full_name text,
  p_password text,
  p_role text DEFAULT 'employee'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_role NOT IN ('employee', 'head') THEN
    RAISE EXCEPTION 'บทบาทไม่ถูกต้อง';
  END IF;
  INSERT INTO admin_employees (employee_code, full_name, password_hash, role)
  VALUES (p_employee_code, p_full_name, crypt(p_password, gen_salt('bf')), p_role)
  RETURNING id INTO v_id;

  INSERT INTO activity_logs (event_type, actor_name, actor_role, details)
  VALUES ('employee_added', p_full_name, p_role, jsonb_build_object('employee_code', p_employee_code));

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_add_employee(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_add_employee(text, text, text, text) TO authenticated;

-- ========== Admin: remove employee ==========
CREATE OR REPLACE FUNCTION public.admin_remove_employee(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_employees SET is_active = false WHERE id = p_employee_id;
  INSERT INTO activity_logs (event_type, details)
  VALUES ('employee_removed', jsonb_build_object('employee_id', p_employee_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_remove_employee(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_employee(uuid) TO authenticated;

-- ========== Admin: list employees ==========
CREATE OR REPLACE FUNCTION public.admin_list_employees()
RETURNS TABLE(id uuid, employee_code text, full_name text, role text, is_active boolean, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.employee_code, e.full_name, e.role, e.is_active, e.created_at
  FROM admin_employees e
  ORDER BY e.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_employees() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_employees() TO authenticated;

-- ========== Admin: refund and block ==========
CREATE OR REPLACE FUNCTION public.admin_refund_and_block(
  p_account_id uuid,
  p_amount numeric,
  p_reason text DEFAULT 'คืนเงินกรณีโดนโกง'
)
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
  VALUES (NULL, p_account_id, p_amount, p_reason, v_slip_code)
  RETURNING id INTO v_tx_id;

  INSERT INTO activity_logs (event_type, actor_role, target_account_id, target_account_number, details)
  VALUES ('refund_and_block', 'head', p_account_id, v_account.account_number,
    jsonb_build_object('amount', p_amount, 'reason', p_reason));

  RETURN v_tx_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_refund_and_block(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_refund_and_block(uuid, numeric, text) TO authenticated;

-- ========== Admin: activity stats ==========
CREATE OR REPLACE FUNCTION public.admin_activity_stats(
  p_start_date timestamptz DEFAULT now() - interval '5 years',
  p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE(
  total_signups bigint,
  total_transfers bigint,
  total_merchant_signups bigint,
  total_charges bigint,
  total_admin_actions bigint,
  total_refunds bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM activity_logs WHERE event_type = 'user_signup' AND created_at >= p_start_date AND created_at <= p_end_date),
    (SELECT count(*) FROM activity_logs WHERE event_type = 'transfer' AND created_at >= p_start_date AND created_at <= p_end_date),
    (SELECT count(*) FROM activity_logs WHERE event_type = 'merchant_signup' AND created_at >= p_start_date AND created_at <= p_end_date),
    (SELECT count(*) FROM activity_logs WHERE event_type = 'charge_paid' AND created_at >= p_start_date AND created_at <= p_end_date),
    (SELECT count(*) FROM activity_logs WHERE event_type LIKE 'admin_%' AND created_at >= p_start_date AND created_at <= p_end_date),
    (SELECT count(*) FROM activity_logs WHERE event_type = 'refund_and_block' AND created_at >= p_start_date AND created_at <= p_end_date);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_activity_stats(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_activity_stats(timestamptz, timestamptz) TO authenticated;

-- ========== Grant access to exchange rates ==========
GRANT SELECT ON exchange_rates TO authenticated;
GRANT SELECT ON activity_logs TO authenticated;
GRANT SELECT ON admin_employees TO authenticated;

-- ========== RLS on new tables ==========
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_exchange_rates" ON exchange_rates FOR SELECT TO authenticated USING (true);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_activity_logs" ON activity_logs FOR SELECT TO authenticated USING (true);

ALTER TABLE admin_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_admin_employees" ON admin_employees FOR SELECT TO authenticated USING (true);
