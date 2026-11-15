-- Security advisor: SECURITY DEFINER functions callable through /rest/v1/rpc by anon/authenticated.
-- Trigger functions are only ever fired by their triggers (no EXECUTE check at fire time), so nobody
-- needs to call them directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_columns() from public, anon, authenticated;

-- current_tenant_id() is used inside RLS policies, which run as the querying role, so signed-in users
-- must keep EXECUTE. Logged-out visitors never read tenant tables.
revoke execute on function public.current_tenant_id() from public, anon;
grant execute on function public.current_tenant_id() to authenticated;
