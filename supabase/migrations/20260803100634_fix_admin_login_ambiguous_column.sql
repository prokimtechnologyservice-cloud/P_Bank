/*
# Fix admin_login: ambiguous column + crypt() search_path

The admin_login function had two bugs:
1. `username = p_username` was ambiguous — could refer to the PL/pgSQL
   variable or the table column. Fix by schema-qualifying: admin_users.username
2. `crypt()` is in the `extensions` schema (pgcrypto), but the function's
   search_path was only `public`. Fix by adding `extensions` to search_path.
*/

CREATE OR REPLACE FUNCTION public.admin_login(p_username text, p_password text)
RETURNS TABLE(id uuid, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row admin_users%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM admin_users WHERE admin_users.username = p_username;
  IF v_row.id IS NOT NULL AND v_row.password_hash = crypt(p_password, v_row.password_hash) THEN
    RETURN QUERY SELECT v_row.id, v_row.username;
    RETURN;
  END IF;
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_login(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO anon, authenticated;
