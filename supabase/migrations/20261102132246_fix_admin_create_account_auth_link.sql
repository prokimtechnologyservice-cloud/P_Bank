/*
# Fix employee/admin account creation

1. Root cause
- Every customer profile must match a sign-in user (profiles.id references the sign-in user table).
- The previous account creation function inserted profiles with a random id, which always failed the link check. This is why creating accounts never worked.

2. Changes to admin_create_account
- Creates the sign-in user first (email optional, password optional). A database trigger then creates the matching profile and account.
- Stores the PIN hash and national ID, and replaces the trigger's random account number with the generated one and sets the starting balance.
- Rejects an email that is already in use with a clear message.
- Same parameters and return value, so existing callers keep working.

3. Security
- No change to who can call the function. Employee calls still go through employee_create_account, which checks the session token.
*/

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
  v_full_name := TRIM(COALESCE(p_title, '') || ' ' || COALESCE(p_first_name, '') ||
    CASE WHEN p_middle_name IS NOT NULL AND p_middle_name != '' THEN ' ' || p_middle_name ELSE '' END ||
    ' ' || COALESCE(p_last_name, ''));

  IF p_national_id IS NOT NULL AND p_national_id != '' THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE national_id = p_national_id) THEN
      RAISE EXCEPTION 'เลขบัตรประชาชนนี้ถูกใช้แล้ว';
    END IF;
  END IF;

  IF p_email IS NOT NULL AND p_email != '' AND EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'อีเมลนี้ถูกใช้งานแล้ว';
  END IF;

  LOOP
    v_account_number := lpad(floor(random() * 10000000000)::text, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.account_number = v_account_number);
  END LOOP;

  v_metadata := jsonb_build_object(
    'full_name', v_full_name,
    'title', p_title,
    'first_name', p_first_name,
    'middle_name', NULLIF(p_middle_name, ''),
    'last_name', p_last_name,
    'national_id', NULLIF(p_national_id, ''),
    'date_of_birth', p_date_of_birth,
    'gender', NULLIF(p_gender, ''),
    'nationality', p_nationality,
    'pin_hash', CASE WHEN p_pin IS NOT NULL AND p_pin != '' THEN crypt(p_pin, gen_salt('bf')) ELSE NULL END
  );

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    NULLIF(p_email, ''),
    CASE WHEN p_password IS NOT NULL AND p_password != '' THEN crypt(p_password, gen_salt('bf')) END,
    CASE WHEN p_email IS NOT NULL AND p_email != '' THEN now() END,
    '{"provider":"email","providers":["email"]}'::jsonb,
    v_metadata,
    now(),
    now(),
    false,
    false
  )
  RETURNING id INTO v_user_id;

  UPDATE accounts
  SET account_number = v_account_number, balance = COALESCE(p_initial_balance, 0)
  WHERE user_id = v_user_id
  RETURNING id INTO v_account_id;

  INSERT INTO activity_logs (event_type, actor_name, actor_role, target_account_id, target_account_number, details)
  VALUES ('admin_create_account', 'admin', 'admin', v_account_id, v_account_number,
    jsonb_build_object('name', v_full_name, 'national_id', p_national_id, 'initial_balance', p_initial_balance));

  RETURN QUERY SELECT v_account_id, v_account_number;
END;
$$;
