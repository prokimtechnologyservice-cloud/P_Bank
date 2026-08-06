/*
# Fix admin function access for non-Supabase-auth admin login

The admin login flow uses a custom admin_users table, NOT Supabase auth.
The admin_login() and all admin_*() SECURITY DEFINER functions were previously
granted only to `authenticated`, but the admin never has a Supabase auth session.
This migration grants EXECUTE to `anon` as well so the admin (using only the
anon-key client) can log in and call admin functions. The functions are all
SECURITY DEFINER and the frontend admin route guard gates UI access.
*/

-- admin_login: allow anon to call (it's the login function itself)
REVOKE EXECUTE ON FUNCTION public.admin_login(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO anon, authenticated;

-- admin_list_accounts
REVOKE EXECUTE ON FUNCTION public.admin_list_accounts() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO anon, authenticated;

-- admin_list_transactions
REVOKE EXECUTE ON FUNCTION public.admin_list_transactions(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_transactions(int) TO anon, authenticated;

-- admin_list_merchants
REVOKE EXECUTE ON FUNCTION public.admin_list_merchants() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_merchants() TO anon, authenticated;

-- admin_list_charges
REVOKE EXECUTE ON FUNCTION public.admin_list_charges(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_charges(int) TO anon, authenticated;

-- settle_merchant
REVOKE EXECUTE ON FUNCTION public.settle_merchant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.settle_merchant(uuid) TO anon, authenticated;

-- reject_merchant
REVOKE EXECUTE ON FUNCTION public.reject_merchant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_merchant(uuid) TO anon, authenticated;

-- suspend_merchant
REVOKE EXECUTE ON FUNCTION public.suspend_merchant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.suspend_merchant(uuid) TO anon, authenticated;

-- admin_stats
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO anon, authenticated;

-- admin_topup
REVOKE EXECUTE ON FUNCTION public.admin_topup(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_topup(uuid, numeric, text) TO anon, authenticated;

-- admin_deduct
REVOKE EXECUTE ON FUNCTION public.admin_deduct(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_deduct(uuid, numeric, text) TO anon, authenticated;
