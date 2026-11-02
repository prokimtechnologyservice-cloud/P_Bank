/*
# Employee sign-in sessions and account creation for employees

1. New Tables
- `admin_employee_sessions`: one row per employee login. Stores a SHA-256 hash of the session token (never the token itself), the employee it belongs to, and an expiry time (12 hours).

2. New Functions
- `employee_sign_in(code, password)`: checks the employee credentials, creates a session and returns a one-time session token together with the employee details.
- `employee_id_for_session(token)`: internal helper that returns the employee id for a valid, unexpired token of an active employee.
- `employee_create_account(token, ...)`: verifies the session token on the server, then creates the account using the existing admin account function.

3. Replaced Functions
- `employee_login` is removed. It is replaced by `employee_sign_in`, which returns a session token.

4. Security
- RLS is enabled on `admin_employee_sessions` with no policies and no grants, so only the functions above can touch it.
- `employee_id_for_session` is callable only by internal functions.
- `employee_create_account` no longer requires the database sign-in that employees do not have. Instead, it checks the employee session token on the server.
- The existing `admin_create_account` remains restricted to signed-in users.

5. Notes
- Sessions for deleted or deactivated employees stop working automatically.
- Expired sessions are cleaned up whenever a new employee signs in.
*/

CREATE TABLE IF NOT EXISTS admin_employee_sessions (
  token_hash text PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES admin_employees(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_employee_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.employee_sign_in(p_employee_code text, p_password text)
RETURNS TABLE(token text, id uuid, employee_code text, full_name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row admin_employees%ROWTYPE;
  v_token text;
BEGIN
  SELECT * INTO v_row FROM admin_employees e
  WHERE e.employee_code = p_employee_code AND e.is_active = true;

  IF v_row.id IS NULL OR v_row.password_hash IS DISTINCT FROM crypt(p_password, v_row.password_hash) THEN
    RETURN;
  END IF;

  DELETE FROM admin_employee_sessions s WHERE s.expires_at < now();

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO admin_employee_sessions (token_hash, employee_id, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), v_row.id, now() + interval '12 hours');

  RETURN QUERY SELECT v_token, v_row.id, v_row.employee_code, v_row.full_name, v_row.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_id_for_session(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT s.employee_id
  FROM admin_employee_sessions s
  JOIN admin_employees e ON e.id = s.employee_id AND e.is_active = true
  WHERE s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND s.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION public.employee_create_account(
  p_token text,
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
BEGIN
  IF public.employee_id_for_session(p_token) IS NULL THEN
    RAISE EXCEPTION 'เซสชันพนักงานหมดอายุ กรุณาเข้าสู่ระบบพนักงานใหม่';
  END IF;

  RETURN QUERY SELECT * FROM public.admin_create_account(
    p_title, p_first_name, p_last_name, p_middle_name, p_date_of_birth,
    p_gender, p_national_id, p_nationality, p_email, p_password, p_pin, p_initial_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.employee_sign_in(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_sign_in(text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.employee_id_for_session(text) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.employee_create_account(text, text, text, text, text, date, text, text, text, text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_create_account(text, text, text, text, text, date, text, text, text, text, text, text, numeric) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.employee_login(text, text);
