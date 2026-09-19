alter table subscriptions
  add column if not exists failed_charge_count integer not null default 0,
  add column if not exists downgraded_at timestamptz;

create table if not exists billing_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  subscription_id uuid not null references subscriptions(id),
  type text not null,              -- 'downgrade' for now, room to grow
  channel text not null default 'email',
  status text not null default 'pending', -- pending | sent | failed
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table billing_notifications enable row level security;
-- Edge functions use the service role key and bypass RLS.
-- Add a tenant-scoped SELECT policy here if the frontend needs to read these directly.
