/*
# Restrict function execution to authenticated only

The transfer() and lookup_account() SECURITY DEFINER functions were executable
by the anon role by default. This migration revokes that access so only
authenticated users can call them. transfer() uses auth.uid() internally, so
anon calls would fail anyway, but explicit revocation is the correct posture.
*/

REVOKE EXECUTE ON FUNCTION public.transfer(text, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_account(text) FROM anon;
