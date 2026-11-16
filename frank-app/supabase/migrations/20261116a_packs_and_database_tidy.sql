-- Packs and database tidy-up. Run AFTER 20261115a to 20261115d.
-- 1. New sign-ups can choose the Pro pack (the sign-up trigger only knew Starter and Growth).
-- 2. Indexes on the 9 foreign keys the Supabase advisor flagged.
-- 3. The six row-level-security policies that re-evaluated auth.uid() for every row now do it once,
--    and the duplicate policy on subscription_charges is removed.
-- Nothing here changes who can see what.

begin;

-- 1. handle_new_user: patch the live function text instead of retyping it, and refuse to change
--    anything if the text is not what we expect.
do $body$
declare d text;
begin
  d := pg_get_functiondef('public.handle_new_user'::regproc);
  d := replace(d, $q$growth boolean := meta->>'plan' = 'growth';$q$,
                  $q$pl text := lower(coalesce(meta->>'plan',''));$q$);
  d := replace(d, $q$'plan',case when growth then 'Growth' else 'Starter' end,$q$,
                  $q$'plan',case pl when 'pro' then 'Pro' when 'growth' then 'Growth' else 'Starter' end,$q$);
  d := replace(d, $q$'planPrice',case when growth then 999 else 499 end,$q$,
                  $q$'planPrice',case pl when 'pro' then 1999 when 'growth' then 999 else 499 end,$q$);
  if position($q$pl text := lower$q$ in d) = 0
     or position($q$when 'pro' then 'Pro'$q$ in d) = 0
     or position($q$when 'pro' then 1999$q$ in d) = 0
     or position('when growth then' in d) > 0 then
    raise exception 'handle_new_user does not look as expected; nothing changed';
  end if;
  execute d;
end
$body$;

-- 2. Foreign-key indexes
create index if not exists bank_postings_entry_id_idx          on public.bank_postings (entry_id);
create index if not exists bank_rules_account_idx              on public.bank_rules (account);
create index if not exists billing_notifications_subscr_idx    on public.billing_notifications (subscription_id);
create index if not exists documents_converted_to_idx          on public.documents (converted_to);
create index if not exists fixed_assets_entry_id_idx           on public.fixed_assets (entry_id);
create index if not exists journal_lines_account_code_idx      on public.journal_lines (account_code);
create index if not exists mail_log_document_id_idx            on public.mail_log (document_id);
create index if not exists subscription_charges_subscr_idx     on public.subscription_charges (subscription_id);
create index if not exists tenants_owner_id_idx                on public.tenants (owner_id);

-- 3. Row-level security: evaluate auth.uid() once per query, not once per row.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (id = (select auth.uid()));

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (id = (select auth.uid()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (id = (select auth.uid()));

drop policy if exists "subscriptions: read own tenant" on public.subscriptions;
create policy "subscriptions: read own tenant" on public.subscriptions
  for select using (tenant_id in (select p.tenant_id from public.profiles p where p.id = (select auth.uid())));

drop policy if exists "billing_notifications: read own tenant" on public.billing_notifications;
create policy "billing_notifications: read own tenant" on public.billing_notifications
  for select using (tenant_id in (select p.tenant_id from public.profiles p where p.id = (select auth.uid())));

-- Two policies did the same job; keep one.
drop policy if exists "charges: read own tenant" on public.subscription_charges;
drop policy if exists "subscription_charges: read own tenant" on public.subscription_charges;
create policy "subscription_charges: read own tenant" on public.subscription_charges
  for select using (subscription_id in (
    select s.id from public.subscriptions s
    where s.tenant_id in (select p.tenant_id from public.profiles p where p.id = (select auth.uid()))));

commit;

-- Not done here: pg_net cannot be moved out of the public schema (it is not relocatable), and the
-- Auth connection setting is changed in the Supabase dashboard (Authentication > Settings).
