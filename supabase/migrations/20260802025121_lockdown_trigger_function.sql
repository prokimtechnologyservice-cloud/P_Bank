/*
# Lock down handle_new_user trigger function

handle_new_user() is a trigger function called automatically when a new auth
user is created. It should never be called directly via the REST API. Revoke
EXECUTE from both anon and authenticated roles so it can only run as a trigger.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
