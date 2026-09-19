-- Cron scheduler for recurring billing. Runs hourly, finds subscriptions
-- due for a charge, and calls the paygate-charge edge function for each
-- via pg_net (async HTTP from inside Postgres).
--
-- ONE-TIME MANUAL SETUP (do NOT put real secrets in a committed migration):
-- run this once in the Supabase SQL editor, replacing the value with your
-- actual service role key:
--
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');
--
-- and set your real project URL below before applying this migration.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function trigger_due_charges() returns void
language plpgsql
security definer
as $$
declare
  rec record;
  service_key text;
  func_url text := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/paygate-charge';
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key';

  if service_key is null then
    raise exception 'service_role_key not found in vault — run vault.create_secret() first';
  end if;

  for rec in
    select id from subscriptions
    where status = 'active'
      and next_charge_at is not null
      and next_charge_at <= now()
  loop
    perform net.http_post(
      url := func_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('subscription_id', rec.id)
    );
  end loop;
end;
$$;

select cron.schedule(
  'paygate-charge-sweep',
  '0 * * * *', -- hourly; a subscription is only ever picked up once its own next_charge_at has passed
  $$ select trigger_due_charges(); $$
);
