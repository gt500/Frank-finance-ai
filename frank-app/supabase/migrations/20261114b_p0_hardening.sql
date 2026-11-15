-- Follow-up to 20261114a: close two gaps it introduced.

-- 1. increment_ai_usage is SECURITY DEFINER and, via default privileges, executable by anon/authenticated.
--    Anyone could burn any tenant's daily trial AI allowance. Only edge functions (service_role) call it.
revoke execute on function public.increment_ai_usage(text) from public, anon, authenticated;

-- 2. 20261114a redefined trigger_due_charges without its pinned search_path (set on 2026-09-28). Re-pin it.
alter function public.trigger_due_charges() set search_path = public, extensions;
revoke execute on function public.trigger_due_charges() from public, anon, authenticated;
